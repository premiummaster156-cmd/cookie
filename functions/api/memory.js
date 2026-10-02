import { json, readJson } from "./_lib.js";
import { dbAvailable, getSessionUser, randomToken } from "./auth/_auth.js";

async function auth(request,env){
  if(!dbAvailable(env)) return {error:json({error:"Cookie database is not connected."},503)};
  const user=await getSessionUser(request,env);
  return user?{user}:{error:json({error:"Authentication required."},401)};
}

export async function onRequestGet({request,env}){
  const a=auth(request,env); const authResult=await a; if(authResult.error)return authResult.error;
  const result=await env.DB.prepare("SELECT id,key,value,created_at,updated_at FROM memories WHERE user_id=? ORDER BY updated_at DESC LIMIT 200").bind(authResult.user.id).all();
  return json({memories:(result.results||[]).map(row=>({id:row.id,key:row.key,value:row.value,createdAt:Number(row.created_at),updatedAt:Number(row.updated_at)}))});
}

export async function onRequestPost({request,env}){
  const authResult=await auth(request,env); if(authResult.error)return authResult.error;
  const body=await readJson(request);
  const key=String(body?.key||"").trim().slice(0,120);
  const value=String(body?.value||"").trim().slice(0,4000);
  if(!key||!value)return json({error:"Memory key and value are required."},400);
  const now=Math.floor(Date.now()/1000);
  await env.DB.prepare(
    "INSERT INTO memories (id,user_id,key,value,created_at,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(user_id,key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at"
  ).bind(randomToken(16),authResult.user.id,key,value,now,now).run();
  const row=await env.DB.prepare("SELECT id,key,value,created_at,updated_at FROM memories WHERE user_id=? AND key=? LIMIT 1").bind(authResult.user.id,key).first();
  return json({ok:true,memory:row?{id:row.id,key:row.key,value:row.value,createdAt:Number(row.created_at),updatedAt:Number(row.updated_at)}:null});
}

export async function onRequestDelete({request,env}){
  const authResult=await auth(request,env); if(authResult.error)return authResult.error;
  const body=await readJson(request);
  const url=new URL(request.url);
  const id=String(body?.id||url.searchParams.get("id")||"").trim();
  const key=String(body?.key||url.searchParams.get("key")||"").trim();
  if(id) await env.DB.prepare("DELETE FROM memories WHERE id=? AND user_id=?").bind(id,authResult.user.id).run();
  else if(key) await env.DB.prepare("DELETE FROM memories WHERE key=? AND user_id=?").bind(key,authResult.user.id).run();
  else return json({error:"Memory id or key is required."},400);
  return json({ok:true});
}
