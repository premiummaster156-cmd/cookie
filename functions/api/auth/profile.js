import { json, readJson } from "../_lib.js";
import { dbAvailable, getSessionUser } from "./_auth.js";

function safeName(v){return String(v||"").trim().slice(0,80)}
function safeUsername(v){return String(v||"").trim().toLowerCase().replace(/[^a-z0-9_-]/g,"").slice(0,24)}

export async function onRequestPatch({request,env}){
  if(!dbAvailable(env)) return json({error:"Cookie database is not connected."},503);
  const current=await getSessionUser(request,env); if(!current)return json({error:"Authentication required."},401);
  const body=await readJson(request);
  const name=safeName(body?.name);
  const username=safeUsername(body?.username);
  if(!name) return json({error:"Name is required."},400);
  if(username.length<3) return json({error:"Username must be at least 3 characters."},400);
  const conflict=await env.DB.prepare("SELECT id FROM users WHERE username=? AND id<>? LIMIT 1").bind(username,current.id).first();
  if(conflict)return json({error:"That username is already in use."},409);
  const now=Math.floor(Date.now()/1000);
  await env.DB.prepare("UPDATE users SET name=?,username=?,updated_at=? WHERE id=?").bind(name,username,now,current.id).run();
  const updated=await env.DB.prepare("SELECT id,email,email_verified,name,username,avatar_url,plan,credits_remaining FROM users WHERE id=?").bind(current.id).first();
  return json({ok:true,user:updated});
}
