import { json, readJson } from "../../_lib.js";
import { dbAvailable, getSessionUser, randomToken } from "../auth/_auth.js";

async function auth(request,env){
  if(!dbAvailable(env)) return {error:json({error:"Cookie database is not connected."},503)};
  const user=await getSessionUser(request,env);
  return user?{user}:{error:json({error:"Authentication required."},401)};
}
function validPath(v){
  const path=String(v||"").replace(/^\/+|\\/g,"").trim().slice(0,240);
  return path && !path.includes("..") ? path : "";
}
async function ownedProject(env,userId,id){
  return env.DB.prepare("SELECT id FROM projects WHERE id=? AND user_id=? LIMIT 1").bind(id,userId).first();
}

export async function onRequestGet({request,env,params}){
  const a=await auth(request,env); if(a.error)return a.error;
  const pid=String(params?.id||""); const p=await ownedProject(env,a.user.id,pid);
  if(!p)return json({error:"Project not found."},404);
  const result=await env.DB.prepare("SELECT id,path,content,mime,created_at,updated_at FROM project_files WHERE project_id=? AND user_id=? ORDER BY path LIMIT 1000").bind(pid,a.user.id).all();
  return json({files:result.results||[]});
}

export async function onRequestPut({request,env,params}){
  const a=await auth(request,env); if(a.error)return a.error;
  const pid=String(params?.id||""); const p=await ownedProject(env,a.user.id,pid);
  if(!p)return json({error:"Project not found."},404);
  const body=await readJson(request);
  const path=validPath(body?.path);
  const content=String(body?.content||"").slice(0,1000000);
  const mime=String(body?.mime||"text/plain").slice(0,100);
  if(!path)return json({error:"A safe file path is required."},400);
  const now=Math.floor(Date.now()/1000);
  await env.DB.prepare(
    "INSERT INTO project_files (id,project_id,user_id,path,content,mime,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(project_id,path) DO UPDATE SET content=excluded.content,mime=excluded.mime,updated_at=excluded.updated_at"
  ).bind(randomToken(18),pid,a.user.id,path,content,mime,now,now).run();
  await env.DB.prepare("UPDATE projects SET updated_at=? WHERE id=? AND user_id=?").bind(now,pid,a.user.id).run();
  return json({ok:true});
}

export async function onRequestDelete({request,env,params}){
  const a=await auth(request,env); if(a.error)return a.error;
  const pid=String(params?.id||""); const p=await ownedProject(env,a.user.id,pid);
  if(!p)return json({error:"Project not found."},404);
  const body=await readJson(request); const url=new URL(request.url);
  const path=validPath(body?.path||url.searchParams.get("path"));
  if(!path)return json({error:"File path is required."},400);
  await env.DB.prepare("DELETE FROM project_files WHERE project_id=? AND user_id=? AND path=?").bind(pid,a.user.id,path).run();
  await env.DB.prepare("UPDATE projects SET updated_at=? WHERE id=? AND user_id=?").bind(Math.floor(Date.now()/1000),pid,a.user.id).run();
  return json({ok:true});
}
