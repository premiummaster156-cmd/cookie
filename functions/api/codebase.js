import { json, readJson } from "./_lib.js";
import { dbAvailable, getSessionUser, normalizeEmail, randomToken } from "./auth/_auth.js";

const OWNER_EMAIL="cookie.ai.noreply@gmail.com";
const ILLU_EMAIL="illu.dev.official@gmail.com";
const REPO="premiummaster156-cmd/cookie";
const BRANCH="main";
const MAX_FILE_BYTES=1000000;
const MAX_REVIEW_CHARS=140000;
const PROTECTED_PATHS=new Set(["functions/api/admin.js","functions/api/_db.js","functions/api/auth/_auth.js","functions/api/chat.js","functions/api/codebase.js","src/CodeStudioPage.tsx","src/App.tsx","src/main.tsx","src/styles.css","migrations/0007_code_studio_reviews.sql",".github/workflows/code-studio-checks.yml",".github/workflows/build-dist.yml"]);
const DEVELOPER_MEMBER_ROLES=new Set(["developer","frontend-developer","backend-developer","fullstack-developer","lead-developer","engineer"]);
function isHiddenPath(path){
  const p=cleanPath(path);
  if(!p)return true;
  if(/^\.env(?:\.|$)/i.test(p)||/^\.dev\.vars(?:\.|$)/i.test(p))return true;
  if(PROTECTED_PATHS.has(p))return true;
  if(/\.md$/i.test(p))return true;
  return false;
}

function mimeFor(path){const e=String(path).toLowerCase().split(".").pop();return ({ts:"text/typescript",tsx:"text/tsx",js:"text/javascript",jsx:"text/jsx",css:"text/css",html:"text/html",json:"application/json",md:"text/markdown",sql:"application/sql",yml:"text/yaml",yaml:"text/yaml",toml:"text/plain",svg:"image/svg+xml",png:"image/png",jpg:"image/jpeg",jpeg:"image/jpeg",gif:"image/gif",webp:"image/webp"}[e]||"text/plain")}
function cleanPath(v){const p=String(v||"").replace(/\\/g,"/").replace(/^\/+/,"").trim();return !p||p.length>500||p.includes("..")||p.includes("//")?"" : p}
function text(v,max=20000){return String(v??"").slice(0,max)}
function now(){return Math.floor(Date.now()/1000)}
async function hashText(value){const bytes=new TextEncoder().encode(String(value));const digest=await crypto.subtle.digest("SHA-256",bytes);return Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,"0")).join("")}
async function ensureSchema(env){
  // Code Studio must be self-healing because Pages does not automatically run
  // D1 migrations for every deployment. Create the workspace tables if they
  // are missing, then repair the one additive column used by this version.
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS codebase_files (path TEXT PRIMARY KEY,content TEXT NOT NULL DEFAULT '',mime TEXT NOT NULL DEFAULT 'text/plain',is_binary INTEGER NOT NULL DEFAULT 0,size INTEGER NOT NULL DEFAULT 0,github_sha TEXT,updated_by TEXT NOT NULL DEFAULT '',created_at INTEGER NOT NULL DEFAULT 0,updated_at INTEGER NOT NULL DEFAULT 0,deleted INTEGER NOT NULL DEFAULT 0,dirty INTEGER NOT NULL DEFAULT 0)").run();
  try{await env.DB.prepare("ALTER TABLE codebase_files ADD COLUMN dirty INTEGER NOT NULL DEFAULT 0").run()}catch{}
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS codebase_revisions (id TEXT PRIMARY KEY,path TEXT NOT NULL,content TEXT NOT NULL DEFAULT '',mime TEXT NOT NULL DEFAULT 'text/plain',editor_email TEXT NOT NULL DEFAULT '',created_at INTEGER NOT NULL DEFAULT 0)").run();
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS codebase_members (id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,role TEXT NOT NULL DEFAULT 'frontend-developer',active INTEGER NOT NULL DEFAULT 1,created_at INTEGER NOT NULL DEFAULT 0,updated_at INTEGER NOT NULL DEFAULT 0)").run();
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS codebase_reviews (id TEXT PRIMARY KEY,user_email TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'needs_changes',risk TEXT NOT NULL DEFAULT 'unknown',summary TEXT NOT NULL DEFAULT '',findings_json TEXT NOT NULL DEFAULT '[]',checks_json TEXT NOT NULL DEFAULT '[]',diff_hash TEXT NOT NULL DEFAULT '',base_sha TEXT,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,commit_sha TEXT,deployment_status TEXT NOT NULL DEFAULT 'not_started')").run();
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS codebase_settings (key TEXT PRIMARY KEY,value TEXT NOT NULL DEFAULT '',updated_at INTEGER NOT NULL)").run();
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS codebase_audit (id TEXT PRIMARY KEY,action TEXT NOT NULL,path TEXT NOT NULL,before_revision_id TEXT,meta_json TEXT NOT NULL DEFAULT '{}',editor_email TEXT NOT NULL DEFAULT '',created_at INTEGER NOT NULL DEFAULT 0,undone INTEGER NOT NULL DEFAULT 0)").run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_codebase_audit_created ON codebase_audit(created_at DESC)").run();
  try{await env.DB.prepare("ALTER TABLE codebase_files ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0").run()}catch{}
  const t=now();
  await env.DB.prepare("INSERT OR IGNORE INTO codebase_settings (key,value,updated_at) VALUES ('auto_review','1',?)").bind(t).run();
  await env.DB.prepare("INSERT OR IGNORE INTO codebase_settings (key,value,updated_at) VALUES ('auto_commit','0',?)").bind(t).run();
}
async function access(request,env){
  if(!dbAvailable(env))return {error:json({error:"Cookie database is not connected."},503)};
  const user=await getSessionUser(request,env);if(!user)return {error:json({error:"Sign in required.",code:"AUTH_REQUIRED"},401)};
  // The Neon compatibility layer initializes the complete shared schema once
  // per database connection. Do not run per-request CREATE/ALTER statements here.
  const email=normalizeEmail(user.email);
  const accountRole=String(user.role||"user").toLowerCase();
  const privileged=["owner","admin","staff"].includes(accountRole)||email===OWNER_EMAIL;
  const member=await env.DB.prepare("SELECT id,email,role,active FROM codebase_members WHERE email=? LIMIT 1").bind(email).first();
  if(email===ILLU_EMAIL&&!member){
    const t=now();
    await env.DB.prepare("INSERT OR IGNORE INTO codebase_members (id,email,role,active,created_at,updated_at) VALUES (?,?,?,?,?,?)").bind("illu-developer",ILLU_EMAIL,"frontend-developer",1,t,t).run();
  }
  const effectiveMember=member||await env.DB.prepare("SELECT id,email,role,active FROM codebase_members WHERE email=? LIMIT 1").bind(email).first();
  const memberRole=String(effectiveMember?.role||"").toLowerCase();
  const developerMember=Boolean(effectiveMember&&Number(effectiveMember.active||0)!==0&&DEVELOPER_MEMBER_ROLES.has(memberRole));
  const allowed=(accountRole==="owner"||accountRole==="admin"||developerMember||email===OWNER_EMAIL)&&accountRole!=="staff";
  if(!allowed)return {error:json({error:"Code Studio is restricted to owner, admin, and explicitly assigned developer accounts.",code:"CODEBASE_FORBIDDEN"},403)};
  return {user,owner:email===OWNER_EMAIL,accountRole,member:{...(effectiveMember||{}),role:email===OWNER_EMAIL?"owner":effectiveMember?.role||accountRole||"developer"}}
}
async function githubJson(url,token="",options={}){
  const headers={Accept:"application/vnd.github+json","User-Agent":"Cookie-Code-Studio","X-GitHub-Api-Version":"2026-03-10",...(token?{Authorization:"Bearer "+token}:{})};
  const r=await fetch(url,{...options,headers:{...headers,...(options.headers||{})}});
  const body=await r.text();let data=null;try{data=body?JSON.parse(body):null}catch{}
  if(!r.ok)throw new Error("GitHub request failed: "+r.status+" "+String(data?.message||body).slice(0,240));
  return data;
}
async function seedFromGithub(env,actor){
  const tree=await githubJson("https://api.github.com/repos/"+REPO+"/git/trees/"+BRANCH+"?recursive=1",String(env.GITHUB_TOKEN||"").trim());
  const rows=Array.isArray(tree?.tree)?tree.tree.filter(x=>x?.type==="blob"&&x?.path&&!x.path.startsWith(".git/")).slice(0,1200):[];
  if(!rows.length)return 0;
  const existingRows=(await env.DB.prepare("SELECT path,github_sha,dirty,deleted FROM codebase_files").all()).results||[];
  const existing=new Map(existingRows.map(x=>[x.path,x]));
  const seen=new Set(),t=now(),statements=[];
  for(const item of rows){
    const path=cleanPath(item.path);if(!path||isHiddenPath(path)||Number(item.size||0)>MAX_FILE_BYTES)continue;
    seen.add(path);
    const prev=existing.get(path);
    if(!prev){
      statements.push(env.DB.prepare("INSERT INTO codebase_files (path,content,mime,is_binary,size,github_sha,updated_by,created_at,updated_at,deleted,dirty) VALUES (?,?,?,?,?,?,?,?,?,0,0)")
        .bind(path,"",mimeFor(path),0,Number(item.size||0),item.sha||null,"github-sync",t,t));
    }else if(Number(prev.dirty||0)){
      statements.push(env.DB.prepare("UPDATE codebase_files SET mime=?,size=?,deleted=0 WHERE path=?")
        .bind(mimeFor(path),Number(item.size||0),path));
    }else{
      statements.push(env.DB.prepare("UPDATE codebase_files SET mime=?,size=?,github_sha=?,deleted=0,content=CASE WHEN COALESCE(github_sha,'')<>? THEN '' ELSE content END,updated_at=? WHERE path=?")
        .bind(mimeFor(path),Number(item.size||0),item.sha||null,item.sha||null,t,path));
    }
  }
  for(const prev of existingRows){
    if(!seen.has(prev.path)&&!Number(prev.dirty||0)&&!Number(prev.deleted||0)){
      statements.push(env.DB.prepare("UPDATE codebase_files SET deleted=1,updated_at=? WHERE path=?").bind(t,prev.path));
    }
  }
  for(let i=0;i<statements.length;i+=80)await env.DB.batch(statements.slice(i,i+80));
  return rows.length;
}
async function loadVirtual(env){
  const r=await env.DB.prepare("SELECT path,content,mime,is_binary,size,github_sha,updated_by,updated_at,COALESCE(deleted,0) AS deleted,COALESCE(dirty,0) AS dirty FROM codebase_files ORDER BY path LIMIT 1200").all();
  return (r.results||[]).filter(x=>!isHiddenPath(x.path));
}
async function fetchGithubRaw(path){
  const url="https://raw.githubusercontent.com/"+REPO+"/"+BRANCH+"/"+path.split("/").map(encodeURIComponent).join("/");
  const r=await fetch(url,{headers:{"User-Agent":"Cookie-Code-Studio"}});
  if(!r.ok)throw new Error("GitHub file fetch failed: "+r.status);
  const buf=new Uint8Array(await r.arrayBuffer());
  if(buf.byteLength>MAX_FILE_BYTES)throw new Error("File is too large for Code Studio.");
  const mime=mimeFor(path);let content="";let binary=0;
  if(/^image\//.test(mime)||/\.(ico|woff2?|ttf|eot|pdf|zip)$/i.test(path)){
    let x="";for(let i=0;i<buf.length;i+=0x8000)x+=String.fromCharCode(...buf.subarray(i,i+0x8000));
    content=btoa(x);binary=1;
  }else content=new TextDecoder().decode(buf);
  return {content,mime,is_binary:binary,size:buf.byteLength};
}
async function githubFile(path,token=""){
  const encoded=path.split("/").map(encodeURIComponent).join("/");
  try{
    const d=await githubJson("https://api.github.com/repos/"+REPO+"/contents/"+encoded+"?ref="+BRANCH,token);
    if(d?.type!=="file")return {exists:false,content:"",sha:null};
    const raw=atob(String(d.content||"").replace(/\s/g,""));
    const bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));
    return {exists:true,content:new TextDecoder().decode(bytes),sha:d.sha||null};
  }catch(error){
    if(String(error?.message||"").includes(" 404 "))return {exists:false,content:"",sha:null};
    throw error;
  }
}
function changedFiles(files,baseline){
  const map=new Map(baseline.map(x=>[x.path,x]));
  const candidates=files.filter(x=>!isHiddenPath(x.path)&&(x.deleted||Number(x.dirty||0)||!x.github_sha));
  const paths=new Set([...baseline.map(x=>x.path),...candidates.map(x=>x.path)].filter(p=>!isHiddenPath(p)));
  const out=[];
  for(const path of paths){
    const v=candidates.find(x=>x.path===path);const b=map.get(path);
    const before=b?.content||"";const after=v?.deleted?null:(v?.content??"");
    if(after===null&&b?.exists){out.push({path,status:"deleted",before,after:""});continue}
    if(!b?.exists&&after!==null){out.push({path,status:"added",before:"",after});continue}
    if(b?.exists&&after!==null&&before!==after){out.push({path,status:"modified",before,after})}
  }
  return out;
}
function diffText(before,after){
  const a=String(before||"").split("\n"),b=String(after||"").split("\n");
  const max=Math.max(a.length,b.length),lines=[];let changes=0;
  for(let i=0;i<max;i++){if(a[i]===b[i]){if(i<3||i>=max-3)lines.push("  "+(a[i]??""));}else{if(i<a.length)lines.push("- "+a[i]);if(i<b.length)lines.push("+ "+b[i]);changes++}}
  return {text:lines.join("\n"),changes};
}
function makeDiff(changes){
  return changes.map(c=>{
    const d=diffText(c.before,c.after);
    return "### "+c.status.toUpperCase()+" "+c.path+"\n"+d.text;
  }).join("\n\n");
}
function codeBalanceIssue(source){
  const s=String(source||"");
  const stack=[];let quote="";let escape=false;let lineComment=false;let blockComment=false;
  for(let i=0;i<s.length;i++){
    const ch=s[i],next=s[i+1];
    if(lineComment){if(ch==="\n")lineComment=false;continue}
    if(blockComment){if(ch==="*"&&next==="/"){blockComment=false;i++}continue}
    if(quote){if(escape){escape=false;continue}if(ch==="\\"){escape=true;continue}if(ch===quote)quote="";continue}
    if(ch==="/"&&next==="/"){lineComment=true;i++;continue}
    if(ch==="/"&&next==="*"){blockComment=true;i++;continue}
    if(ch==='"'||ch==="\'"||ch==="\\x60"){quote=ch;continue}
    if(ch==="{"||ch==="("||ch==="["){stack.push(ch);continue}
    if(ch==="}"||ch===")"||ch==="]"){
      const expected=ch==="}"?"{":ch===")"?"(":"[";
      if(stack.pop()!==expected)return "Mismatched "+ch+" near character "+i+".";
    }
  }
  if(quote)return "Unterminated string/template literal.";
  if(blockComment)return "Unterminated block comment.";
  if(stack.length)return "Unclosed "+stack[stack.length-1]+" delimiter.";
  return "";
}
function securityChecks(changes){
  const checks=[];
  for(const c of changes){
    if(c.status==="deleted")continue;
    const p=String(c.path||""),after=String(c.after||"");
    const lower=after.toLowerCase();
    if(/(?:api[_-]?key|secret|password|token)\s*[:=]\s*["'\x60][^"'\x60]{12,}/i.test(after)&&!/(process\.env|env\.|import\.meta\.env)/.test(after))
      checks.push({name:"Secret exposure",status:"fail",detail:p+": Possible hard-coded credential detected."});
    if(/\.env(?:\.|$)/i.test(p))checks.push({name:"Environment file",status:"fail",detail:p+": Environment files must not be committed through Code Studio."});
    if(/(?:eval\s*\(|new Function\s*\(|child_process|exec\s*\(|spawn\s*\()/i.test(after))
      checks.push({name:"Dangerous execution",status:"warn",detail:p+": Dynamic or process execution requires explicit review."});
    if(/(?:innerHTML\s*=|dangerouslySetInnerHTML)/.test(after))
      checks.push({name:"HTML injection surface",status:"warn",detail:p+": Raw HTML rendering requires security review."});
  }
  return checks;
}
function syntaxChecks(changes){
  const checks=[];
  for(const c of changes){
    if(c.status==="deleted")continue;
    const p=String(c.path||""),after=String(c.after||"");
    if(/\.(?:ts|tsx|js|jsx|mjs|cjs)$/i.test(p)){const issue=codeBalanceIssue(after);if(issue)checks.push({name:"Syntax structure",status:"fail",detail:p+": "+issue});}
    if(/\.jsonc?$/i.test(p)){try{JSON.parse(after)}catch(error){checks.push({name:"JSON syntax",status:"fail",detail:p+": "+String(error?.message||"Invalid JSON.").slice(0,180)})}}
  }
  return checks;
}

function deterministicChecks(changes){
  const checks=[];const all=changes.map(c=>c.path+"\n"+c.after).join("\n");
  const totalLines=changes.reduce((n,c)=>n+String(c.after||"").split("\n").length,0);
  checks.push({name:"Diff size",status:totalLines>2500?"fail":"pass",detail:totalLines>2500?"Change set is too large for automatic commit.":totalLines+" changed-file lines inspected."});
  const secret=/-----BEGIN (?:RSA|OPENSSH|EC|DSA|PGP) PRIVATE KEY-----|(?:api[_-]?key|secret|token|password)\s*[:=]\s*["'][^"']{12,}["']|ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|AIza[0-9A-Za-z_-]{20,}/i;
  checks.push({name:"Secret scan",status:secret.test(all)?"fail":"pass",detail:secret.test(all)?"Possible credential or secret detected.":"No obvious credential pattern detected."});
  const dangerous=/(rm\s+-rf\s+\/|curl\s+[^\n|]+\|\s*(?:ba)?sh|wget\s+[^\n|]+\|\s*(?:ba)?sh|chmod\s+777|eval\s*\(|child_process\.(?:exec|execSync)\s*\()/i;
  checks.push({name:"Dangerous commands",status:dangerous.test(all)?"fail":"pass",detail:dangerous.test(all)?"Potentially dangerous command detected.":"No blocked shell pattern detected."});
  const destructive=/\bDROP\s+(?:TABLE|COLUMN|DATABASE)\b|\bDELETE\s+FROM\s+[^\n;]+\s*;/i;
  const migrations=changes.filter(c=>/^migrations\//.test(c.path));const migrationRisk=migrations.some(c=>destructive.test(c.after||""));
  checks.push({name:"Migration safety",status:migrationRisk?"fail":"pass",detail:migrationRisk?"Destructive migration pattern detected.":"No destructive migration pattern detected."});
  const packageChange=changes.some(c=>c.path==="package.json"||c.path==="package-lock.json"||c.path==="npm-shrinkwrap.json");
  checks.push({name:"Dependency changes",status:packageChange?"warn":"pass",detail:packageChange?"Dependency metadata changed; review package changes carefully.":"No package manifest changes."});
  const configChange=changes.some(c=>/^(wrangler\.toml|wrangler\.jsonc?|\.github\/workflows\/)/.test(c.path));
  checks.push({name:"Deployment configuration",status:configChange?"warn":"pass",detail:configChange?"Deployment/CI configuration changed.":"No deployment configuration changes."});
  const required=["src/App.tsx","src/Auth.tsx","functions/api/auth/_auth.js"];
  const removedRequired=changes.some(c=>c.status==="deleted"&&required.includes(c.path));
  checks.push({name:"Required files",status:removedRequired?"fail":"pass",detail:removedRequired?"A protected application/auth file is being deleted.":"Protected application files remain present."});
  return checks;
}
async function aiReview(env,changes,checks){
  const key=String(env.OLLAMA_API_KEY||"").trim();if(!key)return {ok:false,error:"The review service is temporarily unavailable."};
  const endpoint=String(env.OLLAMA_URL||"https://ollama.com/api/chat").trim();
  const payload=changes.map(c=>"FILE: "+c.path+"\nSTATUS: "+c.status+"\nBEFORE:\n"+text(c.before,18000)+"\nAFTER:\n"+text(c.after,18000)).join("\n\n");
  const prompt=[
    "You are Cookie Code Studio's dedicated security/code reviewer.",
    "Review only the exact proposed change below. Do not invent files or tests.",
    "Return ONLY valid JSON with keys: status, risk, summary, findings, required_fixes.",
    "status must be exactly Approved, Needs changes, or Blocked.",
    "risk must be exactly low, medium, high, or critical.",
    "findings must be an array of objects with file, severity, message.",
    "required_fixes must be an array of strings.",
    "Approve only when the change is coherent, reasonably safe, and deterministic checks below do not fail.",
    "Never approve a change with a credible syntax, compile, import, control-flow, or behavior regression. Use Needs changes when correctness is uncertain.",
    "Inspect every changed code file carefully for missing imports/exports, undefined identifiers, invalid JSX/TypeScript/JavaScript, broken branches, accidental deletions, and integration regressions.",
    "Pay special attention to secrets, auth, permissions, destructive migrations, dependency changes, broken imports, unrelated deletions, and dangerous commands.",
    "DETERMINISTIC CHECKS: "+JSON.stringify(checks),
    "EXACT CHANGE:\n"+payload.slice(0,MAX_REVIEW_CHARS)
  ].join("\n\n");
  const models=["gemma4:cloud","gpt-oss:20b-cloud","deepseek-v4-pro:cloud","qwen3-coder:480b-cloud"];
  const valid=[];
  for(const model of models){
    try{
      const r=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+key},body:JSON.stringify({model,stream:false,think:true,options:{temperature:0.05,num_ctx:64000},messages:[{role:"system",content:"Return strict JSON only. You are a skeptical production reviewer."},{role:"user",content:prompt}]})});
      const raw=await r.text();let data=null;try{data=JSON.parse(raw)}catch{}
      if(!r.ok)continue;
      let out=String(data?.message?.content||data?.response||"").trim();
      out=out.replace(/<think>[\s\S]*?<\/think>/gi,"").replace(/^\x60\x60\x60(?:json)?/i,"").replace(/\x60\x60\x60$/,"").trim();
      const first=out.indexOf("{"),last=out.lastIndexOf("}");
      if(first>=0&&last>first)out=out.slice(first,last+1);
      const parsed=JSON.parse(out);
      if(["Approved","Needs changes","Blocked"].includes(parsed.status)){
        valid.push({ok:true,model,status:parsed.status,risk:parsed.risk||"medium",summary:text(parsed.summary,4000),findings:Array.isArray(parsed.findings)?parsed.findings.slice(0,30):[],required_fixes:Array.isArray(parsed.required_fixes)?parsed.required_fixes.slice(0,30):[]});
        if(valid.length>=2)break;
      }
    }catch(error){console.error("[Cookie Code Studio review]",error)}
  }
  if(!valid.length)return {ok:false,error:"AI review service did not return a valid review."};
  const concern=valid.find(x=>x.status==="Blocked")||valid.find(x=>x.status==="Needs changes");
  if(concern)return {...concern,model:valid.map(x=>x.model).join(" + ")};
  return {ok:true,model:valid.map(x=>x.model).join(" + "),status:"Approved",risk:valid.some(x=>["high","critical"].includes(x.risk))?"high":"low",summary:valid.map(x=>x.summary).filter(Boolean).join(" "),findings:valid.flatMap(x=>x.findings).slice(0,30),required_fixes:[]};
}
async function aiWorkspaceChat(env,user,message,history=[]){
  const key=String(env.OLLAMA_API_KEY||"").trim();if(!key)return {ok:false,error:"Cookie Dev AI is temporarily unavailable."};
  const endpoint=String(env.OLLAMA_URL||"https://ollama.com/api/chat").trim();
  const files=await loadVirtual(env);
  const context=files.filter(x=>!x.deleted&&!isHiddenPath(x.path)).slice(0,220).map(f=>"FILE "+f.path+"\n"+text(f.content,9000)).join("\n\n");
  const cleanHistory=Array.isArray(history)?history.slice(-10).map(m=>({role:m?.role==="assistant"?"assistant":"user",content:text(m?.content,6000)})):[];
  const prompt=[
    "You are Cookie Dev AI inside Cookie Code Studio.",
    "Work from the exact virtual workspace below. You may propose or apply file edits.",
    "Return ONLY valid JSON with keys reply and edits.",
    "reply is a concise developer-facing message.",
    "edits is an array of {path,content}. Include only files that must change.",
    "Never claim a file was changed unless it appears in edits.",
    "Preserve unrelated content and inspect the exact workspace before editing.",
    "Do not modify hidden/protected files, .env files, secrets, or markdown files.",
    "When fixing code, return complete replacement content for each edited file.",
    "WORKSPACE:\n"+context.slice(0,90000),
    "CONVERSATION:\n"+JSON.stringify(cleanHistory),
    "REQUEST:\n"+text(message,12000)
  ].join("\n\n");
  const models=["gemma4:cloud","gpt-oss:20b-cloud","qwen3-coder:480b-cloud"];
  for(const model of models){
    try{
      const r=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+key},body:JSON.stringify({model,stream:false,think:true,options:{temperature:0.08,num_ctx:64000},messages:[{role:"system",content:"Return strict JSON only."},{role:"user",content:prompt}]})});
      const raw=await r.text();let data=null;try{data=JSON.parse(raw)}catch{}
      if(!r.ok)continue;
      let out=String(data?.message?.content||data?.response||"").trim();
      out=out.replace(/<think>[\s\S]*?<\/think>/gi,"").replace(/^\x60\x60\x60(?:json)?/i,"").replace(/\x60\x60\x60$/,"").trim();
      const first=out.indexOf("{"),last=out.lastIndexOf("}");
      if(first>=0&&last>first)out=out.slice(first,last+1);
      const parsed=JSON.parse(out);
      const edits=[];
      for(const edit of (Array.isArray(parsed.edits)?parsed.edits:[]).slice(0,12)){
        const p=cleanPath(edit?.path),body=String(edit?.content??"");
        if(p&&!isHiddenPath(p)&&body.length<=MAX_FILE_BYTES)edits.push({path:p,content:body});
      }
      return {ok:true,model,reply:text(parsed.reply||"I reviewed the workspace.",5000),edits};
    }catch(error){console.error("[Cookie Dev AI]",error)}
  }
  return {ok:false,error:"Cookie Dev AI could not return a valid response."};
}

async function deploymentState(sha,token=""){
  if(!sha)return {status:"not_started",checks:[]};
  try{
    const data=await githubJson("https://api.github.com/repos/"+REPO+"/commits/"+sha+"/check-runs",token);
    const checks=(data?.check_runs||[]).map(x=>({name:x.name,status:x.status,conclusion:x.conclusion,url:x.html_url||""}));
    const relevant=checks.filter(x=>/cloudflare|pages|build|deploy/i.test(x.name));
    const pool=relevant.length?relevant:checks;
    if(pool.some(x=>x.status!=="completed"))return {status:"building",checks:pool};
    if(pool.some(x=>x.conclusion==="failure"||x.conclusion==="cancelled"||x.conclusion==="timed_out"))return {status:"failed",checks:pool};
    if(pool.length&&pool.every(x=>x.conclusion==="success"))return {status:"success",checks:pool};
    return {status:"queued",checks:pool};
  }catch(error){return {status:"unknown",checks:[],error:String(error?.message||"")}}
}
async function getBranch(token=""){
  return githubJson("https://api.github.com/repos/"+REPO+"/git/ref/heads/"+BRANCH,token);
}
async function reviewWorkspace(env,user){
  const files=await loadVirtual(env);
  const candidates=files.filter(x=>!x.deleted&&!isHiddenPath(x.path)&&(Number(x.dirty||0)||!x.github_sha));
  const baseline=[];
  for(const f of candidates){
    const b=await githubFile(f.path,String(env.GITHUB_TOKEN||"").trim());baseline.push({path:f.path,...b});
  }
  const changes=changedFiles(files,baseline);const checks=[...deterministicChecks(changes),...syntaxChecks(changes),...securityChecks(changes)];
  const branch=await getBranch(String(env.GITHUB_TOKEN||"").trim());const diff=makeDiff(changes);const diffHash=await hashText(JSON.stringify(changes));
  if(!changes.length){
    return {status:"Approved",risk:"low",summary:"No changes are pending.",findings:[],required_fixes:[],checks,changes,baseSha:branch?.object?.sha||null,diffHash};
  }
  if(checks.some(x=>x.status==="fail")){
    return {status:"Blocked",risk:"high",summary:"Deterministic safety checks blocked this change set.",findings:checks.filter(x=>x.status==="fail").map(x=>({file:"",severity:"high",message:x.detail})),required_fixes:checks.filter(x=>x.status==="fail").map(x=>x.detail),checks,changes,baseSha:branch?.object?.sha||null,diffHash,diff};
  }
  const ai=await aiReview(env,changes,checks);
  if(!ai.ok){
    return {status:"Blocked",risk:"high",summary:"AI review could not be completed, so the safety gate failed closed.",findings:[{file:"",severity:"high",message:ai.error}],required_fixes:[ai.error],checks,changes,baseSha:branch?.object?.sha||null,diffHash,diff};
  }
  const status=ai.status==="Approved"&&!checks.some(x=>x.status==="fail")?"Approved":ai.status;
  return {...ai,status,checks,changes,baseSha:branch?.object?.sha||null,diffHash,diff};
}
async function recordAudit(env,{action,path,beforeRevisionId=null,meta={},editorEmail}) {
  const id=randomToken(16);
  await env.DB.prepare("INSERT INTO codebase_audit (id,action,path,before_revision_id,meta_json,editor_email,created_at,undone) VALUES (?,?,?,?,?,?,?,0)")
    .bind(id,action,path,beforeRevisionId,JSON.stringify(meta),editorEmail,now()).run();
  return id;
}
async function undoAudit(env,auditId,actorEmail,isOwner=false){
  const audit=await env.DB.prepare("SELECT * FROM codebase_audit WHERE id=? LIMIT 1").bind(auditId).first();
  if(!audit||Number(audit.undone||0))return {ok:false,error:"That Code Studio action is already undone or no longer exists."};
  if(!isOwner&&normalizeEmail(audit.editor_email)!==normalizeEmail(actorEmail))return {ok:false,error:"Only the developer who made the change or the owner can undo it."};
  let meta={};try{meta=JSON.parse(audit.meta_json||"{}")}catch{}
  const revision=audit.before_revision_id?await env.DB.prepare("SELECT * FROM codebase_revisions WHERE id=? LIMIT 1").bind(audit.before_revision_id).first():null;
  const t=now();
  if(audit.action==="create"||audit.action==="duplicate"){
    await env.DB.prepare("UPDATE codebase_files SET deleted=1,dirty=1,updated_by=?,updated_at=? WHERE path=?").bind(actorEmail,t,audit.path).run();
  }else if(audit.action==="edit"||audit.action==="delete"){
    if(!revision)return {ok:false,error:"The saved undo snapshot is missing."};
    await env.DB.prepare("INSERT INTO codebase_files (path,content,mime,is_binary,size,github_sha,updated_by,created_at,updated_at,deleted,dirty) VALUES (?,?,?,?,?,?,?,?,?,0,1) ON CONFLICT(path) DO UPDATE SET content=excluded.content,mime=excluded.mime,is_binary=excluded.is_binary,size=excluded.size,updated_by=excluded.updated_by,updated_at=excluded.updated_at,deleted=0,dirty=1")
      .bind(revision.path,revision.content,revision.mime,0,new TextEncoder().encode(revision.content).byteLength,actorEmail,t,t).run();
  }else if(audit.action==="rename"){
    if(!revision)return {ok:false,error:"The saved rename snapshot is missing."};
    const from=String(meta.from||audit.path),to=String(meta.to||"");
    await env.DB.prepare("INSERT INTO codebase_files (path,content,mime,is_binary,size,github_sha,updated_by,created_at,updated_at,deleted,dirty) VALUES (?,?,?,?,?,?,?,?,?,0,1) ON CONFLICT(path) DO UPDATE SET content=excluded.content,mime=excluded.mime,is_binary=excluded.is_binary,size=excluded.size,updated_by=excluded.updated_by,updated_at=excluded.updated_at,deleted=0,dirty=1")
      .bind(from,revision.content,revision.mime,0,new TextEncoder().encode(revision.content).byteLength,actorEmail,t,t).run();
    if(to)await env.DB.prepare("UPDATE codebase_files SET deleted=1,dirty=1,updated_by=?,updated_at=? WHERE path=?").bind(actorEmail,t,to).run();
  }else return {ok:false,error:"This action type cannot be undone yet."};
  await env.DB.prepare("UPDATE codebase_audit SET undone=1 WHERE id=?").bind(auditId).run();
  return {ok:true,auditId};
}
async function recentAudits(env){
  const r=await env.DB.prepare("SELECT id,action,path,editor_email,created_at,undone FROM codebase_audit ORDER BY created_at DESC,id DESC LIMIT 12").all();
  return r.results||[];
}
async function saveReview(env,user,result){
  const id=randomToken(16),t=now();
  await env.DB.prepare("INSERT INTO codebase_reviews (id,user_email,status,risk,summary,findings_json,checks_json,diff_hash,base_sha,created_at,updated_at,deployment_status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
    .bind(id,user.email,result.status,result.risk||"unknown",text(result.summary,5000),JSON.stringify(result.findings||[]),JSON.stringify(result.checks||[]),result.diffHash||"",result.baseSha||null,t,t,"not_started").run();
  return id;
}
async function commitApproved(env,user,reviewId){
  const token=String(env.GITHUB_TOKEN||"").trim();if(!token)return {ok:false,error:"GITHUB_TOKEN is not configured in Cloudflare Pages secrets."};
  const review=await env.DB.prepare("SELECT * FROM codebase_reviews WHERE id=? LIMIT 1").bind(reviewId).first();
  if(!review||review.status!=="Approved")return {ok:false,error:"No approved Code Studio review is available."};
  const current=await getBranch(token);const currentSha=current?.object?.sha;
  if(!currentSha||currentSha!==review.base_sha){
    await env.DB.prepare("UPDATE codebase_reviews SET status='Blocked',summary=?,updated_at=? WHERE id=?").bind("GitHub changed after this review. Sync and review again.",now(),reviewId).run();
    return {ok:false,error:"GitHub changed after the review. Sync the workspace and review again."};
  }
  const files=await loadVirtual(env);const baseline=[];for(const f of files.filter(x=>!x.deleted&&(Number(x.dirty||0)||!x.github_sha)))baseline.push({path:f.path,...await githubFile(f.path,String(env.GITHUB_TOKEN||"").trim())});
  const changes=changedFiles(files,baseline);if(!changes.length)return {ok:false,error:"There are no changes to commit."};
  const freshChecks=[...deterministicChecks(changes),...syntaxChecks(changes),...securityChecks(changes)];if(freshChecks.some(x=>x.status==="fail"))return {ok:false,error:"A deterministic safety or syntax check failed during commit."};
  const parent=await githubJson("https://api.github.com/repos/"+REPO+"/git/commits/"+currentSha,token);
  const treeEntries=changes.map(c=>c.status==="deleted"?{path:c.path,mode:"100644",type:"blob",sha:null}:{path:c.path,mode:"100644",type:"blob",content:String(c.after||"")});
  const newTree=await githubJson("https://api.github.com/repos/"+REPO+"/git/trees",token,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({base_tree:parent.tree.sha,tree:treeEntries})});
  const title=String(changes.length===1?changes[0].path:"multiple files").slice(0,70);
  const commit=await githubJson("https://api.github.com/repos/"+REPO+"/git/commits",token,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:"feat(code-studio): "+title,tree:newTree.sha,parents:[currentSha]})});
  await githubJson("https://api.github.com/repos/"+REPO+"/git/refs/heads/"+BRANCH,token,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({sha:commit.sha,force:false})});
  for(const c of changes){
    if(c.status==="deleted")await env.DB.prepare("UPDATE codebase_files SET deleted=1,github_sha=NULL,dirty=0,updated_by=?,updated_at=? WHERE path=?").bind(user.email,now(),c.path).run();
    else{
      const entry=(newTree.tree||[]).find(x=>x.path===c.path);await env.DB.prepare("UPDATE codebase_files SET deleted=0,github_sha=?,dirty=0,updated_by=?,updated_at=? WHERE path=?").bind(entry?.sha||null,user.email,now(),c.path).run();
    }
  }
  await env.DB.prepare("UPDATE codebase_reviews SET commit_sha=?,deployment_status='queued',updated_at=? WHERE id=?").bind(commit.sha,now(),reviewId).run();
  return {ok:true,commitSha:commit.sha,commitUrl:commit.html_url||"https://github.com/"+REPO+"/commit/"+commit.sha,deploymentStatus:"queued"};
}
async function state(env){
  const files=await loadVirtual(env);const changed=[];
  for(const f of files.filter(x=>!x.deleted&&!isHiddenPath(x.path)&&(Number(x.dirty||0)||!x.github_sha)))changed.push({...f,status:f.github_sha?"modified":"added"});
  const reviews=await env.DB.prepare("SELECT * FROM codebase_reviews ORDER BY updated_at DESC LIMIT 8").all();
  const settings=await env.DB.prepare("SELECT key,value FROM codebase_settings").all();
  const branch=await getBranch(String(env.GITHUB_TOKEN||"").trim()).catch(()=>null);
  const latestReview=reviews.results?.[0]||null;
  const deployment=await deploymentState(latestReview?.commit_sha||null,String(env.GITHUB_TOKEN||"").trim());
  const audits=await recentAudits(env);
  return {files,members:(await env.DB.prepare("SELECT email,role,active,updated_at FROM codebase_members ORDER BY role,email").all()).results||[],reviews:reviews.results||[],settings:Object.fromEntries((settings.results||[]).map(x=>[x.key,x.value])),branchSha:branch?.object?.sha||null,deployment,audits};
}
async function handleGet({request,env}){
  const a=await access(request,env);if(a.error)return a.error;
  const url=new URL(request.url),requested=cleanPath(url.searchParams.get("path")),action=String(url.searchParams.get("action")||"");
  if(requested&&isHiddenPath(requested))return json({error:"This file is hidden from Code Studio for security."},404);
  if(action==="access")return json({ok:true,owner:a.owner,role:a.member.role,canEdit:true});
  const t=now();await env.DB.prepare("INSERT OR IGNORE INTO codebase_members (id,email,role,active,created_at,updated_at) VALUES (?,?,?,?,?,?)").bind("cookie-owner",OWNER_EMAIL,"owner",1,t,t).run();
  const count=await env.DB.prepare("SELECT COUNT(*) AS count FROM codebase_files").first();
  // Seed only an empty workspace. Re-seeding on every state request caused
  // hundreds of Neon statements for the repository and could exceed Cloudflare
  // Free's 50 external-subrequest limit. Owner-triggered Sync performs the
  // explicit refresh when the GitHub repository changes.
  if(Number(count?.count||0)===0)await seedFromGithub(env,a.user.email);
  if(action==="state")return json({ok:true,owner:a.owner,role:a.member.role,...await state(env)});
  if(action==="diff"){
    const files=await loadVirtual(env),baseline=[],candidates=files.filter(x=>!x.deleted&&(Number(x.dirty||0)||!x.github_sha));
    for(const f of candidates)baseline.push({path:f.path,...await githubFile(f.path,String(env.GITHUB_TOKEN||"").trim())});
    const changes=changedFiles(files,baseline);return json({ok:true,changes:changes.map(c=>({...c,diff:diffText(c.before,c.after)}))});
  }
  if(requested){
    let file=await env.DB.prepare("SELECT path,content,mime,is_binary,size,github_sha,updated_by,updated_at,COALESCE(deleted,0) AS deleted,COALESCE(dirty,0) AS dirty FROM codebase_files WHERE path=? LIMIT 1").bind(requested).first();
    if(!file||file.deleted)return json({error:"File not found."},404);
    // Workspace seeding stores GitHub metadata only to stay under the free
    // subrequest limit. Hydrate the real file on first open. Do not use size as
    // the gate because GitHub tree metadata can omit it for some blobs.
    if(!file.content&&!Number(file.dirty||0)&&file.github_sha){
      const token=String(env.GITHUB_TOKEN||"").trim();
      // Prefer the authenticated GitHub Contents API because it is the same
      // API already used by Code Studio for diffs/commits. Fall back to raw
      // GitHub if the Contents endpoint cannot serve this file.
      let loaded=null;
      try{
        const fromApi=await githubFile(requested,token);
        if(fromApi.exists)loaded={content:fromApi.content,mime:mimeFor(requested),is_binary:0,size:new TextEncoder().encode(fromApi.content).byteLength};
      }catch{}
      if(!loaded)loaded=await fetchGithubRaw(requested);
      await env.DB.prepare("UPDATE codebase_files SET content=?,mime=?,is_binary=?,size=?,updated_at=? WHERE path=?").bind(loaded.content,loaded.mime,loaded.is_binary,loaded.size,now(),requested).run();
      file={...file,...loaded};
    }
    return json({ok:true,owner:a.owner,role:a.member.role,file})
  }
  const files=await env.DB.prepare("SELECT path,mime,is_binary,size,github_sha,updated_by,updated_at,COALESCE(deleted,0) AS deleted FROM codebase_files WHERE COALESCE(deleted,0)=0 ORDER BY path LIMIT 1200").all();
  const members=await env.DB.prepare("SELECT email,role,active,updated_at FROM codebase_members ORDER BY role,email").all();
  return json({ok:true,owner:a.owner,role:a.member.role,files:(files.results||[]).filter(x=>!isHiddenPath(x.path)),members:members.results||[]})
}
async function handlePut({request,env}){
  const a=await access(request,env);if(a.error)return a.error;const body=await readJson(request),action=String(body?.action||"");
  if(action==="rename"||action==="duplicate"){
    const from=cleanPath(body?.from),to=cleanPath(body?.to);if(!from||!to)return json({error:"Both source and destination paths are required."},400);
    if(isHiddenPath(from)||isHiddenPath(to))return json({error:"Protected or hidden Code Studio files cannot be changed here."},403);
    const src=await env.DB.prepare("SELECT * FROM codebase_files WHERE path=? LIMIT 1").bind(from).first();if(!src||src.deleted)return json({error:"Source file not found."},404);
    if(action==="rename")await env.DB.prepare("DELETE FROM codebase_files WHERE path=?").bind(to).run();
    const t=now();await env.DB.prepare("INSERT INTO codebase_files (path,content,mime,is_binary,size,github_sha,updated_by,created_at,updated_at,deleted) VALUES (?,?,?,?,?,?,?,?,?,0) ON CONFLICT(path) DO UPDATE SET content=excluded.content,mime=excluded.mime,is_binary=excluded.is_binary,size=excluded.size,github_sha=excluded.github_sha,updated_by=excluded.updated_by,updated_at=excluded.updated_at,deleted=0,dirty=1").bind(to,src.content,src.mime,src.is_binary,src.size,action==="duplicate"?null:src.github_sha,a.user.email,t,t).run();
    let revisionId=null;
    if(action==="rename"){
      revisionId=randomToken(16);
      await env.DB.prepare("INSERT INTO codebase_revisions (id,path,content,mime,editor_email,created_at) VALUES (?,?,?,?,?,?)").bind(revisionId,from,src.content,src.mime,a.user.email,t).run();
      await env.DB.prepare("UPDATE codebase_files SET deleted=1,updated_by=?,updated_at=? WHERE path=?").bind(a.user.email,t,from).run();
    }
    const auditId=await recordAudit(env,{action,path:to,beforeRevisionId:revisionId,meta:{from,to},editorEmail:a.user.email});
    return json({ok:true,path:to,auditId});
  }
  const path=cleanPath(body?.path),content=String(body?.content??"");if(!path)return json({error:"A valid file path is required."},400);
  if(isHiddenPath(path))return json({error:"Protected or hidden Code Studio files cannot be changed here."},403);
  const size=new TextEncoder().encode(content).byteLength;if(size>MAX_FILE_BYTES)return json({error:"File is too large for Code Studio."},413);
  const t=now(),previous=await env.DB.prepare("SELECT content,mime FROM codebase_files WHERE path=? LIMIT 1").bind(path).first();
  if(previous&&!Number(previous.deleted||0)&&String(previous.content)===content)return json({ok:true,unchanged:true});
  let revisionId=null;
  if(previous&&!Number(previous.deleted||0)){revisionId=randomToken(16);await env.DB.prepare("INSERT INTO codebase_revisions (id,path,content,mime,editor_email,created_at) VALUES (?,?,?,?,?,?)").bind(revisionId,path,previous.content,previous.mime,a.user.email,t).run();}
  await env.DB.prepare("INSERT INTO codebase_files (path,content,mime,is_binary,size,github_sha,updated_by,created_at,updated_at,deleted) VALUES (?,?,?,?,?,?,?,?,?,0) ON CONFLICT(path) DO UPDATE SET content=excluded.content,mime=excluded.mime,is_binary=0,size=excluded.size,github_sha=excluded.github_sha,updated_by=excluded.updated_by,updated_at=excluded.updated_at,deleted=0,dirty=1").bind(path,content,String(body?.mime||mimeFor(path)),0,size,previous?.github_sha||null,a.user.email,t,t).run();
  const auditId=await recordAudit(env,{action:previous&&!Number(previous.deleted||0)?"edit":"create",path,beforeRevisionId:revisionId,editorEmail:a.user.email});
  return json({ok:true,updatedAt:t,auditId});
}
async function handleDelete({request,env}){
  const a=await access(request,env);if(a.error)return a.error;
  const path=cleanPath(new URL(request.url).searchParams.get("path"));
  if(!path)return json({error:"File path is required."},400);
  if(isHiddenPath(path))return json({error:"Protected or hidden Code Studio files cannot be deleted."},403);
  const current=await env.DB.prepare("SELECT * FROM codebase_files WHERE path=? LIMIT 1").bind(path).first();
  if(!current||current.deleted)return json({error:"File not found."},404);
  const t=now(),revisionId=randomToken(16);
  await env.DB.prepare("INSERT INTO codebase_revisions (id,path,content,mime,editor_email,created_at) VALUES (?,?,?,?,?,?)").bind(revisionId,path,current.content,current.mime,a.user.email,t).run();
  await env.DB.prepare("UPDATE codebase_files SET deleted=1,dirty=1,updated_by=?,updated_at=? WHERE path=?").bind(a.user.email,t,path).run();
  const auditId=await recordAudit(env,{action:"delete",path,beforeRevisionId:revisionId,editorEmail:a.user.email});
  return json({ok:true,auditId,watch:"AI review will inspect this deletion."});
}
async function handlePost({request,env}){
  const a=await access(request,env);if(a.error)return a.error;const body=await readJson(request),action=String(body?.action||"");
  if(action==="sync"){if(!a.owner)return json({error:"Only the owner can sync the GitHub codebase."},403);const count=await seedFromGithub(env,a.user.email);return json({ok:true,count})}
  if(action==="member"){if(!a.owner)return json({error:"Only the owner can manage Code Studio members."},403);const email=normalizeEmail(body?.email);if(!/^\S+@\S+\.\S+$/.test(email))return json({error:"Enter a valid email address."},400);const t=now();await env.DB.prepare("INSERT INTO codebase_members (id,email,role,active,created_at,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(email) DO UPDATE SET role=excluded.role,active=1,updated_at=excluded.updated_at").bind(randomToken(16),email,"frontend-developer",1,t,t).run();return json({ok:true})}
  if(action==="review"){const result=await reviewWorkspace(env,a.user);const id=await saveReview(env,a.user,result);return json({ok:true,reviewId:id,...result})}
  if(action==="ai-chat"){
    const message=text(body?.message,12000).trim();
    if(!message)return json({error:"Enter a message for Cookie Dev AI."},400);
    const result=await aiWorkspaceChat(env,a.user,message,body?.history||[]);
    if(!result.ok)return json(result,503);
    const applied=[];
    for(const edit of result.edits||[]){
      const previous=await env.DB.prepare("SELECT content,mime,github_sha,deleted FROM codebase_files WHERE path=? LIMIT 1").bind(edit.path).first();
      if(previous&&!Number(previous.deleted||0)&&String(previous.content)===edit.content)continue;
      const t=now(),size=new TextEncoder().encode(edit.content).byteLength;
      let revisionId=null;
      if(previous&&!Number(previous.deleted||0)){
        revisionId=randomToken(16);
        await env.DB.prepare("INSERT INTO codebase_revisions (id,path,content,mime,editor_email,created_at) VALUES (?,?,?,?,?,?)").bind(revisionId,edit.path,previous.content,previous.mime,a.user.email,t).run();
      }
      await env.DB.prepare("INSERT INTO codebase_files (path,content,mime,is_binary,size,github_sha,updated_by,created_at,updated_at,deleted,dirty) VALUES (?,?,?,?,?,?,?,?,?,0,1) ON CONFLICT(path) DO UPDATE SET content=excluded.content,mime=excluded.mime,is_binary=0,size=excluded.size,github_sha=excluded.github_sha,updated_by=excluded.updated_by,updated_at=excluded.updated_at,deleted=0,dirty=1")
        .bind(edit.path,edit.content,mimeFor(edit.path),0,size,previous?.github_sha||null,a.user.email,t,t).run();
      await recordAudit(env,{action:previous&&!Number(previous.deleted||0)?"edit":"create",path:edit.path,beforeRevisionId:revisionId,meta:{source:"cookie-dev-ai"},editorEmail:a.user.email});
      applied.push(edit.path);
    }
    return json({ok:true,model:result.model,reply:result.reply,edits:applied});
  }
  if(action==="undo"){
    const auditId=String(body?.auditId||"").trim();
    const latest=auditId?null:await env.DB.prepare("SELECT id FROM codebase_audit WHERE editor_email=? AND undone=0 ORDER BY created_at DESC,id DESC LIMIT 1").bind(a.user.email).first();
    const result=await undoAudit(env,auditId||latest?.id||"",a.user.email,a.owner);
    return json(result,result.ok?200:409);
  }
  if(action==="commit"){const reviewId=String(body?.reviewId||"");const result=await commitApproved(env,a.user,reviewId);return json(result,result.ok?200:409)}
  if(action==="settings"){if(!a.owner)return json({error:"Only the owner can change automation settings."},403);const key=String(body?.key||"");if(!["auto_review","auto_commit"].includes(key))return json({error:"Unknown setting."},400);const value=body?.value?"1":"0";await env.DB.prepare("INSERT INTO codebase_settings (key,value,updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at").bind(key,value,now()).run();return json({ok:true,key,value})}
  if(action==="auto-review-and-commit"){
    if(!a.owner)return json({error:"Only the owner can run automatic commit."},403);
    const result=await reviewWorkspace(env,a.user);const id=await saveReview(env,a.user,result);
    if(result.status!=="Approved")return json({ok:false,reviewId:id,...result},409);
    return json(await commitApproved(env,a.user,id));
  }
  return json({error:"Unknown Code Studio action."},400)
}

async function safeCodebase(handler,context){
  try{return await handler(context)}
  catch(error){
    console.error("[Cookie Code Studio]",error);
    const message=String(error?.message||"Unknown server error").slice(0,300);
    return json({error:"Code Studio server error: "+message,code:"CODEBASE_SERVER_ERROR"},500);
  }
}
export async function onRequestGet(context){return safeCodebase(handleGet,context)}
export async function onRequestPut(context){return safeCodebase(handlePut,context)}
export async function onRequestDelete(context){return safeCodebase(handleDelete,context)}
export async function onRequestPost(context){return safeCodebase(handlePost,context)}
