import { json, readJson } from "./_lib.js";
import { dbAvailable, getSessionUser } from "./auth/_auth.js";

const MAX_CHATS = 80;
const MAX_MESSAGES = 200;
const MAX_TEXT = 20000;
const MAX_SHARE_MESSAGES = 200;
const MAX_SHARE_PAYLOAD = 3000000;

async function ensureShareTable(env){
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS shared_chats (
    id TEXT PRIMARY KEY,
    user_id INTEGER,
    title TEXT NOT NULL,
    payload TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`).run();
}

function shareId(){
  return crypto.randomUUID().replaceAll("-","");
}

async function requireUser(request, env) {
  if (!dbAvailable(env)) return {error:json({error:"Cookie database is not connected."},503)};
  const user = await getSessionUser(request, env);
  if (!user) return {error:json({error:"Authentication required."},401)};
  return {user};
}

export async function onRequestGet({request,env}) {
  const url=new URL(request.url);
  const shareIdParam=String(url.searchParams.get("share")||"").replace(/[^a-f0-9]/gi,"").slice(0,32);
  if(shareIdParam){
    if(!dbAvailable(env)) return json({error:"Cookie database is not connected."},503);
    if(shareIdParam.length!==32) return json({error:"Invalid share link."},400);
    await ensureShareTable(env);
    const row=await env.DB.prepare("SELECT title,payload,created_at FROM shared_chats WHERE id=? LIMIT 1").bind(shareIdParam).first();
    if(!row) return json({error:"This share link no longer exists."},404);
    try{
      const data=JSON.parse(String(row.payload||""));
      return json({ok:true,title:String(data?.title||row.title||"Shared Cookie chat"),messages:Array.isArray(data?.messages)?data.messages:[],createdAt:Number(row.created_at)||Date.now()});
    }catch{return json({error:"This share link is corrupted."},500);}
  }
  const auth=await requireUser(request,env);
  if(auth.error) return auth.error;
  const chats=await env.DB.prepare(
    "SELECT id,title,model,temporary,pinned,archived,branch_of,branch_message_id,updated_at,created_at FROM chats WHERE user_id=? ORDER BY updated_at DESC LIMIT ?"
  ).bind(auth.user.id,MAX_CHATS).all();
  const rows=chats.results||[];
  const ids=rows.map(x=>x.id);
  let messages=[];
  if(ids.length){
    const marks=ids.map(()=>"?").join(",");
    const result=await env.DB.prepare(
      "SELECT id,chat_id,role,content,created_at,position FROM chat_messages WHERE user_id=? AND chat_id IN ("+marks+") ORDER BY chat_id,position LIMIT ?"
    ).bind(auth.user.id,...ids,MAX_CHATS*MAX_MESSAGES).all();
    messages=result.results||[];
  }
  const byChat=new Map();
  for(const row of messages){
    if(!byChat.has(row.chat_id)) byChat.set(row.chat_id,[]);
    const list=byChat.get(row.chat_id);
    if(list.length<MAX_MESSAGES) list.push({
      id:row.id,role:row.role,content:row.content,createdAt:Number(row.created_at)
    });
  }
  return json({
    chats:rows.map(row=>({
      id:row.id,title:row.title,model:row.model,temporary:Boolean(row.temporary),
      pinned:Boolean(row.pinned),archived:Boolean(row.archived),
      branchOf:row.branch_of?String(row.branch_of):undefined,
      branchMessageId:row.branch_message_id?String(row.branch_message_id):undefined,
      updatedAt:Number(row.updated_at),messages:byChat.get(row.id)||[]
    }))
  });
}

export async function onRequestPost({request,env}) {
  const url=new URL(request.url);
  if(url.searchParams.get("share")==="1"){
    const auth=await requireUser(request,env);
    if(auth.error) return auth.error;
    const body=await readJson(request);
    const title=String(body?.title||"Shared Cookie chat").slice(0,200);
    const messages=Array.isArray(body?.messages)?body.messages.slice(-MAX_SHARE_MESSAGES).map((m)=>({
      id:String(m?.id||crypto.randomUUID()).slice(0,100),
      role:m?.role==="assistant"?"assistant":"user",
      content:String(m?.content||"").slice(0,MAX_TEXT),
      createdAt:Number(m?.createdAt)||Date.now()
    })):[];

    const payload=JSON.stringify({title,messages});
    if(payload.length>MAX_SHARE_PAYLOAD) return json({error:"This conversation is too large to share."},413);
    await ensureShareTable(env);
    const id=shareId();
    await env.DB.prepare("INSERT INTO shared_chats (id,user_id,title,payload,created_at) VALUES (?,?,?,?,?)").bind(id,auth.user.id,title,payload,Date.now()).run();
    return json({ok:true,id,url:new URL("/#share="+id,request.url).toString()});
  }
  const auth=await requireUser(request,env);
  if(auth.error) return auth.error;
  const body=await readJson(request);
  const incoming=Array.isArray(body?.chats)?body.chats.slice(-MAX_CHATS):[];
  const normalized=incoming.map(chat=>({
    id:String(chat?.id||"").slice(0,100),
    title:String(chat?.title||"New chat").slice(0,200),
    model:String(chat?.model||"standard").slice(0,60),
    temporary:chat?.temporary?1:0,pinned:chat?.pinned?1:0,archived:chat?.archived?1:0,
    updatedAt:Number(chat?.updatedAt)||Date.now(),createdAt:Number(chat?.createdAt)||Date.now(),
    branchOf:chat?.branchOf?String(chat.branchOf).slice(0,100):"",
    branchMessageId:chat?.branchMessageId?String(chat.branchMessageId).slice(0,100):"",
    messages:(Array.isArray(chat?.messages)?chat.messages.slice(-MAX_MESSAGES):[]).map((m,i)=>({
      id:String(m?.id||"").slice(0,100),
      role:m?.role==="assistant"?"assistant":"user",
      content:String(m?.content||"").slice(0,MAX_TEXT),
      createdAt:Number(m?.createdAt)||Date.now(),position:i
    })).filter(m=>m.id)
  })).filter(c=>c.id);

  const current=await env.DB.prepare("SELECT id FROM chats WHERE user_id=?").bind(auth.user.id).all();
  const currentIds=new Set((current.results||[]).map(r=>r.id));
  const nextIds=new Set(normalized.map(c=>c.id));
  const statements=[];

  for(const chat of normalized){
    statements.push(env.DB.prepare(
      "INSERT INTO chats (id,user_id,title,model,temporary,pinned,archived,branch_of,branch_message_id,updated_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,model=excluded.model,temporary=excluded.temporary,pinned=excluded.pinned,archived=excluded.archived,branch_of=excluded.branch_of,branch_message_id=excluded.branch_message_id,updated_at=excluded.updated_at WHERE chats.user_id=excluded.user_id"
    ).bind(chat.id,auth.user.id,chat.title,chat.model,chat.temporary,chat.pinned,chat.archived,chat.branchOf||null,chat.branchMessageId||null,chat.updatedAt,chat.createdAt));
    statements.push(env.DB.prepare("DELETE FROM chat_messages WHERE chat_id=? AND user_id=?").bind(chat.id,auth.user.id));
    for(const m of chat.messages){
      statements.push(env.DB.prepare(
        "INSERT INTO chat_messages (id,chat_id,user_id,role,content,created_at,position) VALUES (?,?,?,?,?,?,?)"
      ).bind(m.id,chat.id,auth.user.id,m.role,m.content,m.createdAt,m.position));
    }
  }
  for(const id of currentIds){
    if(!nextIds.has(id)) {
      statements.push(env.DB.prepare("DELETE FROM chats WHERE id=? AND user_id=?").bind(id,auth.user.id));
    }
  }
  if(statements.length) await env.DB.batch(statements);
  return json({ok:true,count:normalized.length});
}

export async function onRequestDelete({request,env}) {
  const auth=await requireUser(request,env);
  if(auth.error) return auth.error;
  const url=new URL(request.url);
  const id=String(url.searchParams.get("id")||"").slice(0,100);
  if(!id) return json({error:"Chat id is required."},400);
  await env.DB.prepare("DELETE FROM chats WHERE id=? AND user_id=?").bind(id,auth.user.id).run();
  return json({ok:true});
}
