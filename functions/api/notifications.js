import { dbAvailable, getSessionUser } from "./auth/_auth.js";
import { json, readJson } from "./_lib.js";

function serialize(row){
  const action=String(row?.action||"").toLowerCase();
  const createdAt=Number(row?.created_at||0);
  const duration=Number(row?.duration_seconds||0);
  const until=action==="suspend"&&duration>0 ? createdAt+duration : 0;
  return {
    id:String(row?.id||""),
    action,
    reason:String(row?.reason||""),
    createdAt:createdAt*1000,
    until:until*1000,
    read:Boolean(row?.read_at)
  };
}

export async function onRequestGet({request,env}){
  if(!dbAvailable(env))return json({error:"Cookie database is not connected."},503);
  const user=await getSessionUser(request,env);
  if(!user)return json({error:"Sign in required."},401);
  try{
    const rows=await env.DB.prepare(
      "SELECT id,action,reason,duration_seconds,created_at,read_at FROM moderation_events WHERE target_user_id=? ORDER BY created_at DESC LIMIT 50"
    ).bind(user.id).all();
    const items=(rows?.results||[]).map(serialize);
    return json({ok:true,items,unread:items.filter(x=>!x.read).length});
  }catch(error){
    console.error("[Cookie notifications GET]",error);
    return json({error:"Notifications could not be loaded."},500);
  }
}

export async function onRequestPost({request,env}){
  if(!dbAvailable(env))return json({error:"Cookie database is not connected."},503);
  const user=await getSessionUser(request,env);
  if(!user)return json({error:"Sign in required."},401);
  try{
    const body=await readJson(request);
    const id=String(body?.id||"").trim();
    if(id){
      await env.DB.prepare("UPDATE moderation_events SET read_at=? WHERE id=? AND target_user_id=?").bind(Math.floor(Date.now()/1000),id,user.id).run();
    }else{
      await env.DB.prepare("UPDATE moderation_events SET read_at=? WHERE target_user_id=? AND read_at IS NULL").bind(Math.floor(Date.now()/1000),user.id).run();
    }
    return json({ok:true});
  }catch(error){
    console.error("[Cookie notifications POST]",error);
    return json({error:"Notifications could not be updated."},500);
  }
}
