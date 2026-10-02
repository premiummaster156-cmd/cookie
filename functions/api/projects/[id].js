import { json, readJson } from "../_lib.js";
import { dbAvailable, getSessionUser } from "../auth/_auth.js";

async function user(request,env){
  if(!dbAvailable(env)) return {error:json({error:"Cookie database is not connected."},503)};
  const current=await getSessionUser(request,env);
  return current?{user:current}:{error:json({error:"Authentication required."},401)};
}
async function project(env,userId,id){
  return env.DB.prepare("SELECT id,name,description,created_at,updated_at FROM projects WHERE id=? AND user_id=? LIMIT 1").bind(id,userId).first();
}
export async function onRequestGet({request,env,params}){
  const a=await user(request,env); if(a.error)return a.error;
  const id=String(params?.id||"");
  const row=await project(env,a.user.id,id);
  if(!row)return json({error:"Project not found."},404);
  const files=await env.DB.prepare("SELECT id,path,content,mime,created_at,updated_at FROM project_files WHERE project_id=? AND user_id=? ORDER BY path LIMIT 500").bind(id,a.user.id).all();
  return json({project:row,files:files.results||[]});
}
export async function onRequestPatch({request,env,params}){
  const a=await user(request,env); if(a.error)return a.error;
  const id=String(params?.id||""); const body=await readJson(request);
  const name=String(body?.name||"").trim().slice(0,100); const description=String(body?.description||"").slice(0,4000);
  const row=await project(env,a.user.id,id); if(!row)return json({error:"Project not found."},404);
  const nextName=name||row.name; const nextDescription=body?.description===undefined?row.description:description;
  const now=Math.floor(Date.now()/1000);
  await env.DB.prepare("UPDATE projects SET name=?,description=?,updated_at=? WHERE id=? AND user_id=?").bind(nextName,nextDescription,now,id,a.user.id).run();
  return json({ok:true});
}
export async function onRequestDelete({request,env,params}){
  const a=await user(request,env); if(a.error)return a.error;
  const id=String(params?.id||"");
  await env.DB.prepare("DELETE FROM projects WHERE id=? AND user_id=?").bind(id,a.user.id).run();
  return json({ok:true});
}
