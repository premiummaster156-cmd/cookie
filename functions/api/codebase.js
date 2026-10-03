import { json, readJson } from "./_lib.js";
import { dbAvailable, getSessionUser, normalizeEmail, randomToken } from "./auth/_auth.js";

const OWNER_EMAIL="cookie.ai.noreply@gmail.com";
const ILLU_EMAIL="illu.dev.official@gmail.com";
const REPO="premiummaster156-cmd/cookie";
const MAX_FILE_BYTES=1000000;

function mimeFor(path){const e=String(path).toLowerCase().split(".").pop();return ({ts:"text/typescript",tsx:"text/tsx",js:"text/javascript",jsx:"text/jsx",css:"text/css",html:"text/html",json:"application/json",md:"text/markdown",sql:"application/sql",yml:"text/yaml",yaml:"text/yaml",toml:"text/plain",svg:"image/svg+xml",png:"image/png",jpg:"image/jpeg",jpeg:"image/jpeg",gif:"image/gif",webp:"image/webp"}[e]||"text/plain")}
function cleanPath(v){const p=String(v||"").replace(/\\/g,"/").replace(/^\/+/,"").trim();return !p||p.length>500||p.includes("..")||p.includes("//")?"":p}
async function access(request,env){
 if(!dbAvailable(env))return {error:json({error:"Cookie database is not connected."},503)};
 const user=await getSessionUser(request,env);if(!user)return {error:json({error:"Sign in required.",code:"AUTH_REQUIRED"},401)};
 const email=normalizeEmail(user.email);
 const member=await env.DB.prepare("SELECT id,email,role,active FROM codebase_members WHERE email=? LIMIT 1").bind(email).first();
 if(email===ILLU_EMAIL&&!member){
   const now=Math.floor(Date.now()/1000);
   await env.DB.prepare("INSERT OR IGNORE INTO codebase_members (id,email,role,active,created_at,updated_at) VALUES (?,?,?,?,?,?)").bind("illu-developer",ILLU_EMAIL,"frontend-developer",1,now,now).run();
 }
 const effectiveMember=member||await env.DB.prepare("SELECT id,email,role,active FROM codebase_members WHERE email=? LIMIT 1").bind(email).first();
 if(email!==OWNER_EMAIL&&!effectiveMember?.active)return {error:json({error:"You are not a Code Studio member.",code:"CODEBASE_FORBIDDEN"},403)};
 return {user,owner:email===OWNER_EMAIL,member:{...(effectiveMember||{}),role:email===OWNER_EMAIL?"owner":effectiveMember?.role||"developer"}}
}
async function githubJson(url){const r=await fetch(url,{headers:{Accept:"application/vnd.github+json","User-Agent":"Cookie-Code-Studio"}});if(!r.ok)throw new Error("GitHub request failed: "+r.status);return r.json()}
async function seedFromGithub(env,actor){
 const tree=await githubJson("https://api.github.com/repos/"+REPO+"/git/trees/main?recursive=1");
 const rows=Array.isArray(tree?.tree)?tree.tree.filter(x=>x?.type==="blob"&&x?.path&&!x.path.startsWith(".git/")).slice(0,500):[];
 for(const item of rows){
  const path=cleanPath(item.path);if(!path||Number(item.size||0)>MAX_FILE_BYTES)continue;
  const r=await fetch("https://raw.githubusercontent.com/"+REPO+"/main/"+item.path,{headers:{"User-Agent":"Cookie-Code-Studio"}});if(!r.ok)continue;
  const buf=new Uint8Array(await r.arrayBuffer());if(buf.byteLength>MAX_FILE_BYTES)continue;
  const mime=mimeFor(path);let content="";let binary=0;
  if(/^image\//.test(mime)||/\.(ico|woff2?|ttf|eot|pdf|zip)$/i.test(path)){let x="";for(let i=0;i<buf.length;i+=0x8000)x+=String.fromCharCode(...buf.subarray(i,i+0x8000));content=btoa(x);binary=1}else content=new TextDecoder().decode(buf);
  const now=Math.floor(Date.now()/1000);
  await env.DB.prepare("INSERT INTO codebase_files (path,content,mime,is_binary,size,github_sha,updated_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(path) DO UPDATE SET content=excluded.content,mime=excluded.mime,is_binary=excluded.is_binary,size=excluded.size,github_sha=excluded.github_sha,updated_by=excluded.updated_by,updated_at=excluded.updated_at").bind(path,content,mime,binary,buf.byteLength,item.sha,actor,now,now).run();
 }
 return rows.length;
}
export async function onRequestGet({request,env}){
 const a=await access(request,env);if(a.error)return a.error;
 const now=Math.floor(Date.now()/1000);
 await env.DB.prepare("INSERT OR IGNORE INTO codebase_members (id,email,role,active,created_at,updated_at) VALUES (?,?,?,?,?,?)").bind(randomToken(16),OWNER_EMAIL,"owner",1,now,now).run();
 const url=new URL(request.url),requested=cleanPath(url.searchParams.get("path"));
 if(requested){const file=await env.DB.prepare("SELECT path,content,mime,is_binary,size,github_sha,updated_by,updated_at FROM codebase_files WHERE path=? LIMIT 1").bind(requested).first();if(!file)return json({error:"File not found."},404);return json({ok:true,owner:a.owner,role:a.member.role,file})}
 const count=await env.DB.prepare("SELECT COUNT(*) AS count FROM codebase_files").first();
 if(Number(count?.count||0)===0)await seedFromGithub(env,a.user.email);
 const files=await env.DB.prepare("SELECT path,mime,is_binary,size,github_sha,updated_by,updated_at FROM codebase_files ORDER BY path LIMIT 1000").all();
 const members=await env.DB.prepare("SELECT email,role,active,updated_at FROM codebase_members ORDER BY role,email").all();
 return json({ok:true,owner:a.owner,role:a.member.role,files:files.results||[],members:members.results||[]})
}
export async function onRequestPut({request,env}){
 const a=await access(request,env);if(a.error)return a.error;const body=await readJson(request),path=cleanPath(body?.path),content=String(body?.content??"");
 if(!path)return json({error:"A valid file path is required."},400);
 const size=new TextEncoder().encode(content).byteLength;if(size>MAX_FILE_BYTES)return json({error:"File is too large for Code Studio."},413);
 const now=Math.floor(Date.now()/1000),previous=await env.DB.prepare("SELECT content,mime FROM codebase_files WHERE path=? LIMIT 1").bind(path).first();
 if(previous&&String(previous.content)===content)return json({ok:true,unchanged:true});
 if(previous)await env.DB.prepare("INSERT INTO codebase_revisions (id,path,content,mime,editor_email,created_at) VALUES (?,?,?,?,?,?)").bind(randomToken(16),path,previous.content,previous.mime,a.user.email,now).run();
 await env.DB.prepare("INSERT INTO codebase_files (path,content,mime,is_binary,size,github_sha,updated_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(path) DO UPDATE SET content=excluded.content,mime=excluded.mime,is_binary=0,size=excluded.size,updated_by=excluded.updated_by,updated_at=excluded.updated_at").bind(path,content,String(body?.mime||mimeFor(path)),0,size,null,a.user.email,now,now).run();
 return json({ok:true,updatedAt:now})
}
export async function onRequestDelete({request,env}){const a=await access(request,env);if(a.error)return a.error;const path=cleanPath(new URL(request.url).searchParams.get("path"));if(!path)return json({error:"File path is required."},400);await env.DB.prepare("DELETE FROM codebase_files WHERE path=?").bind(path).run();return json({ok:true})}
export async function onRequestPost({request,env}){
 const a=await access(request,env);if(a.error)return a.error;const body=await readJson(request),action=String(body?.action||"");
 if(action==="sync"){if(!a.owner)return json({error:"Only the owner can sync the GitHub codebase."},403);const count=await seedFromGithub(env,a.user.email);return json({ok:true,count})}
 if(action==="member"){if(!a.owner)return json({error:"Only the owner can manage Code Studio members."},403);const email=normalizeEmail(body?.email);if(!/^\S+@\S+\.\S+$/.test(email))return json({error:"Enter a valid email address."},400);const now=Math.floor(Date.now()/1000);await env.DB.prepare("INSERT INTO codebase_members (id,email,role,active,created_at,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(email) DO UPDATE SET role=excluded.role,active=1,updated_at=excluded.updated_at").bind(randomToken(16),email,"frontend-developer",1,now,now).run();return json({ok:true})}
 return json({error:"Unknown Code Studio action."},400)
}