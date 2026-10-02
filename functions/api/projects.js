import { json, readJson } from "./_lib.js";
import { dbAvailable, getSessionUser, randomToken } from "./auth/_auth.js";

async function getUser(request,env){
  if(!dbAvailable(env)) return {error:json({error:"Cookie database is not connected."},503)};
  const user=await getSessionUser(request,env);
  return user?{user}:{error:json({error:"Authentication required."},401)};
}
function cleanName(v){return String(v||"").trim().slice(0,100)}
function cleanText(v){return String(v||"").slice(0,4000)}

export async function onRequestGet({request,env}){
  const a=await getUser(request,env); if(a.error)return a.error;
  const result=await env.DB.prepare(
    "SELECT id,name,description,created_at,updated_at FROM projects WHERE user_id=? ORDER BY updated_at DESC LIMIT 100"
  ).bind(a.user.id).all();
  return json({projects:result.results||[]});
}

export async function onRequestPost({request,env}){
  const a=await getUser(request,env); if(a.error)return a.error;
  const body=await readJson(request);
  const name=cleanName(body?.name);
  if(!name)return json({error:"Project name is required."},400);
  const description=cleanText(body?.description);
  const now=Math.floor(Date.now()/1000);
  const id=randomToken(18);
  await env.DB.prepare(
    "INSERT INTO projects (id,user_id,name,description,created_at,updated_at) VALUES (?,?,?,?,?,?)"
  ).bind(id,a.user.id,name,description,now,now).run();
  return json({ok:true,project:{id,name,description,created_at:now,updated_at:now}});
}
