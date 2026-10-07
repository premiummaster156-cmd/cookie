import React,{useEffect,useMemo,useRef,useState} from "react";
import {
  Activity,AlertCircle,Archive,ArrowDownToLine,ArrowLeft,ArrowRight,Bot,Braces,Check,ChevronDown,ChevronRight,
  CircleDot,Code2,Copy,FileCode2,FileJson,FilePlus2,FileText,Folder,FolderOpen,GitBranch,GitCommitHorizontal,Image as ImageIcon,
  GitCompare,History,Keyboard,LayoutPanelLeft,Loader2,Menu,MoreHorizontal,PanelBottom,Play,Plus,RefreshCw,
  Search,Settings2,ShieldAlert,ShieldCheck,SquareTerminal,Trash2,UploadCloud,UserPlus,Users,X,Zap,CreditCard,SlidersHorizontal,UserRound
} from "lucide-react";

type CodeFile={path:string;mime:string;is_binary:number;size:number;github_sha?:string|null;updated_by?:string;updated_at:number;deleted?:number};
type Member={email:string;role:string;active:number;updated_at:number};
type Change={path:string;status:string;before:string;after:string;diff?:{text:string;changes:number}};
type Finding={file?:string;severity?:string;message:string};
type Check={name:string;status:"pass"|"warn"|"fail";detail:string};
type Review={id?:string;status:string;risk:string;summary:string;findings:Finding[];checks:Check[];commit_sha?:string;deployment_status?:string;created_at?:number;updated_at?:number};
type Audit={id:string;action:string;path:string;editor_email:string;created_at:number;undone:number};
type DevAttachment={id:string;kind:"image"|"file";name:string;mime:string;data:string;size:number};
type DevPendingEdit={path:string;content:string};
type Backup={id:string;baseSha:string;commitSha:string;createdAt:number;fileCount:number};

const iconFor=(p:string)=>{const e=p.split(".").pop()?.toLowerCase()||"";if(["json","jsonc"].includes(e))return <FileJson size={15}/>;if(["ts","tsx","js","jsx","css","html","sql"].includes(e))return <FileCode2 size={15}/>;return <FileText size={15}/>};
const ext=(p:string)=>p.split(".").pop()?.toLowerCase()||"";
function treeFor(files:CodeFile[]){const root:any={name:"COOKIE",children:{},file:null};for(const f of files.filter(x=>!x.deleted)){let n=root;const parts=f.path.split("/");parts.forEach((part,i)=>{n.children[part]??={name:part,children:{},file:null};n=n.children[part];if(i===parts.length-1)n.file=f.path})}return root}
function Tree({node,prefix,onOpen,active,depth=0}:{node:any;prefix:string;onOpen:(p:string)=>void;active:string;depth?:number}){const [open,setOpen]=useState(false);const items=Object.values(node.children||{}) as any[];items.sort((a,b)=>Number(Boolean(b.file))-Number(Boolean(a.file))||a.name.localeCompare(b.name));return <>{items.map(c=>{const full=prefix?prefix+"/"+c.name:c.name;if(c.file)return <button className={"cs-file "+(active===c.file?"active":"")} key={full} onClick={()=>onOpen(c.file)} style={{paddingLeft:10+depth*14}}>{iconFor(c.file)}<span>{c.name}</span></button>;return <div key={full}><button className="cs-folder" onClick={()=>setOpen(v=>!v)} style={{paddingLeft:10+depth*14}}>{open?<ChevronDown size={13}/>:<ChevronRight size={13}/>}<Folder size={14}/><span>{c.name}</span></button>{open&&<Tree node={c} prefix={full} onOpen={onOpen} active={active} depth={depth+1}/>}</div>})}</>}
function languageLabel(p:string){const e=ext(p);return ({ts:"TypeScript",tsx:"TypeScript React",js:"JavaScript",jsx:"JavaScript React",json:"JSON",css:"CSS",html:"HTML",sql:"SQL",md:"Markdown",yml:"YAML",yaml:"YAML",sh:"Shell",py:"Python"} as any)[e]||e.toUpperCase()||"Plain Text"}
function escapeHtml(v:string){return String(v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}
function highlightCode(source:string,path:string){
  const e=ext(path);
  const keywords=new Set(("const let var function return if else for while do switch case break continue throw try catch finally class extends new import from export default async await yield typeof instanceof in of interface type enum public private protected readonly abstract implements as satisfies declare namespace def elif except with lambda pass raise global nonlocal and or not is True False None SELECT FROM WHERE INSERT INTO UPDATE DELETE CREATE ALTER TABLE DROP VALUES JOIN LEFT RIGHT INNER OUTER ON AS AND OR NOT NULL TRUE FALSE BEGIN END").split(/\s+/));
  const tokenRe=/(\/\*[\s\S]*?\*\/|\/\/[^\n]*|\x60(?:\\.|[^\x60\\])*\x60|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b\d+(?:\.\d+)?\b)/g;
  let out="",last=0;
  const plain=(raw:string)=>{
    let s=escapeHtml(raw);
    s=s.replace(/\b([A-Za-z_$][\w$]*)\b/g,(m)=>keywords.has(m)?'<span class="tok-keyword">'+m+"</span>":m);
    s=s.replace(/([A-Za-z_$][\w$]*)(?=\s*:)/g,'<span class="tok-property">$1</span>');
    if(e==="css")s=s.replace(/(^|[{};\s])(\.[A-Za-z_-][\w-]*|#[A-Za-z_-][\w-]*)/g,'$1<span class="tok-selector">$2</span>');
    if(e==="html"||e==="tsx"||e==="jsx")s=s.replace(/(&lt;\/?)([A-Za-z][\w:-]*)/g,'$1<span class="tok-tag">$2</span>');
    return s;
  };
  let m;
  while((m=tokenRe.exec(source))){
    out+=plain(source.slice(last,m.index));
    const token=m[0],escaped=escapeHtml(token);
    if(token.startsWith("//")||token.startsWith("/*")||token.startsWith("#"))out+='<span class="tok-comment">'+escaped+"</span>";
    else if(token.startsWith("\x60")||token.startsWith('"')||token.startsWith("'"))out+='<span class="tok-string">'+escaped+"</span>";
    else out+='<span class="tok-number">'+escaped+"</span>";
    last=m.index+token.length;
  }
  out+=plain(source.slice(last));
  return out||" ";
}
async function parseApiResponse(r:Response){const raw=await r.text();if(!raw.trim())return {};try{return JSON.parse(raw)}catch{return {error:raw.slice(0,500)||("Request failed ("+r.status+").")}}}


function AdminControlPanel({role,onClose,onNotice,onError}:{role:string;onClose:()=>void;onNotice:(x:string)=>void;onError:(x:string)=>void}){
  const [data,setData]=useState<any>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[query,setQuery]=useState("");
  const [email,setEmail]=useState(""),[credits,setCredits]=useState("100"),[plan,setPlan]=useState("pro"),[days,setDays]=useState("30"),[userRole,setUserRole]=useState("vip");
  const [limits,setLimits]=useState<any>({chat_limit_free:10,chat_limit_pro:30,chat_limit_max:60,image_limit_free:3,image_limit_pro:20,image_limit_max:50});
  const load=async()=>{
    setLoading(true);
    try{
      const r=await fetch("/api/admin",{credentials:"same-origin",cache:"no-store"});
      const d=await parseApiResponse(r);
      if(!r.ok)throw new Error(d?.error||"Could not load account control.");
      setData(d);setLimits(d.limits||limits);
    }catch(e:any){onError(e?.message||"Could not load account control.");}
    finally{setLoading(false);}
  };
  useEffect(()=>{load()},[]);
  const act=async(body:any)=>{
    setBusy(true);
    try{
      const r=await fetch("/api/admin",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify(body)});
      const d=await parseApiResponse(r);
      if(!r.ok)throw new Error(d?.error||"Account action failed.");
      onNotice("Account changes saved");
      await load();
    }catch(e:any){onError(e?.message||"Account action failed.");}
    finally{setBusy(false);}
  };
  const choose=(u:any)=>{
    setEmail(String(u.email||""));setPlan(String(u.plan||"free"));setUserRole(String(u.role||"user"));setCredits(String(u.credits??0));setDays("30");
  };
  const users=(data?.users||[]).filter((u:any)=>{
    const q=query.trim().toLowerCase();
    return !q||String(u.email||"").toLowerCase().includes(q)||String(u.name||"").toLowerCase().includes(q)||String(u.username||"").toLowerCase().includes(q);
  }).slice(0,100);
  return <div className="cs-admin-panel">
    <div className="cs-admin-head">
      <div><span className="cs-admin-kicker"><ShieldCheck size={13}/>Privileged control</span><h2>Cookie Account Control</h2><p>Manage accounts, credits, subscriptions, model access and AI limits. Server-side permissions remain authoritative.</p></div>
      <div className="cs-admin-head-actions"><span className="cs-admin-role">{role}</span><button onClick={onClose} aria-label="Close account control"><X size={15}/></button></div>
    </div>
    {loading?<div className="cs-admin-loading"><Loader2 className="spin" size={18}/>Loading accounts…</div>:<>
      <div className="cs-admin-stats">{[["Users",data?.stats?.users||0],["Free",data?.stats?.plans?.find((x:any)=>x.plan==="free")?.count||0],["Pro",data?.stats?.plans?.find((x:any)=>x.plan==="pro")?.count||0],["MAX",data?.stats?.plans?.find((x:any)=>x.plan==="max")?.count||0]].map(([a,b])=><div key={String(a)}><span>{a}</span><strong>{b}</strong></div>)}</div>
      <section className="cs-admin-section">
        <div className="cs-admin-section-title"><UserRound size={15}/>Account controls</div>
        <div className="cs-admin-form">
          <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="user@example.com" autoComplete="off"/>
          <input value={credits} onChange={e=>setCredits(e.target.value)} placeholder="Credits" inputMode="numeric"/>
          <select value={plan} onChange={e=>setPlan(e.target.value)}><option value="free">Free</option><option value="pro">Pro</option><option value="max">MAX</option></select>
          <input value={days} onChange={e=>setDays(e.target.value)} placeholder="Days" inputMode="numeric"/>
          <select value={userRole} onChange={e=>setUserRole(e.target.value)}>
            <option value="user">User</option><option value="vip">VIP</option><option value="staff">Staff</option>
            {role!=="staff"&&<option value="admin">Admin</option>}
            {role==="owner"&&<option value="owner">Owner</option>}
          </select>
        </div>
        <div className="cs-admin-actions">
          <button disabled={busy||!email.trim()} onClick={()=>act({action:"credit",email,delta:Number(credits||0)})}><CreditCard size={14}/>Adjust credits</button>
          <button disabled={busy||!email.trim()} onClick={()=>act({action:"gift",email,plan,days:Number(days||30),credits:Number(credits||0)})}><Zap size={14}/>Gift plan + credits</button>
          <button disabled={busy||!email.trim()} onClick={()=>act({action:"user",email,plan,role:userRole,credits:Number(credits||0)})}><Users size={14}/>Save account</button>
        </div>
        <small className="cs-admin-hint">“Gift plan + credits” grants the selected model tier for the selected number of days.</small>
      </section>
      <section className="cs-admin-section">
        <div className="cs-admin-section-title"><SlidersHorizontal size={15}/>AI limits</div>
        <div className="cs-admin-limits">{Object.entries(limits).map(([k,v])=><label key={k}><span>{k.replaceAll("_"," ")}</span><input value={String(v)} inputMode="numeric" onChange={e=>setLimits((x:any)=>({...x,[k]:Number(e.target.value)}))}/></label>)}</div>
        <button className="primary" disabled={busy||role==="staff"} onClick={()=>act({action:"limits",limits})}><SlidersHorizontal size={14}/>Save limits</button>
        {role==="staff"&&<small className="cs-admin-hint">Staff can manage accounts but only owner/admin can change global AI limits.</small>}
      </section>
      <section className="cs-admin-section">
        <div className="cs-admin-section-title"><Users size={15}/>Accounts</div>
        <div className="cs-admin-search"><Search size={14}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search accounts"/></div>
        <div className="cs-admin-users">{users.map((u:any)=><button key={u.id} onClick={()=>choose(u)}><span><strong>{u.name||u.username||u.email}</strong><small>{u.email}</small></span><span><b>{String(u.plan||"free").toUpperCase()}</b><small>{u.credits} credits · {u.role}</small></span></button>)}</div>
        {!users.length&&<div className="cs-admin-empty">No accounts match this search.</div>}
      </section>
    </>}
  </div>;
}

export default function CodeStudioPage({onExit=()=>{}}:{onExit?:()=>void}){
 const [files,setFiles]=useState<CodeFile[]>([]),[members,setMembers]=useState<Member[]>([]),[audits,setAudits]=useState<Audit[]>([]),[selected,setSelected]=useState(""),[content,setContent]=useState(""),[saved,setSaved]=useState(""),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[syncing,setSyncing]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState(""),[search,setSearch]=useState(""),[tabs,setTabs]=useState<string[]>([]),[activePanel,setActivePanel]=useState<"problems"|"output"|"terminal"|"review"|"deployment">("review"),[panelOpen,setPanelOpen]=useState(true),[explorer,setExplorer]=useState(true),[activity,setActivity]=useState<"explorer"|"search"|"source"|"run">("explorer"),[commandOpen,setCommandOpen]=useState(false),[commandQuery,setCommandQuery]=useState(""),[quickOpen,setQuickOpen]=useState(false),[newPath,setNewPath]=useState(""),[newOpen,setNewOpen]=useState(false),[memberOpen,setMemberOpen]=useState(false),[memberEmail,setMemberEmail]=useState(""),[adminOpen,setAdminOpen]=useState(false),[owner,setOwner]=useState(false),[role,setRole]=useState(""),[branchSha,setBranchSha]=useState(""),[review,setReview]=useState<Review|null>(null),[changes,setChanges]=useState<Change[]>([]),[deployment,setDeployment]=useState<any>({status:"not_started",checks:[]}),[reviewing,setReviewing]=useState(false),[committing,setCommitting]=useState(false),[autoReview,setAutoReview]=useState(true),[autoCommit,setAutoCommit]=useState(false),[terminal,setTerminal]=useState<string[]>(["Cookie Code Studio terminal","Ready. Safe project commands are available through the server."]),[renaming,setRenaming]=useState(false),[renameTo,setRenameTo]=useState(""),[aiOpen,setAiOpen]=useState(false),[aiInput,setAiInput]=useState(""),[aiBusy,setAiBusy]=useState(false),[aiAttachments,setAiAttachments]=useState<DevAttachment[]>([]),[aiPendingEdits,setAiPendingEdits]=useState<DevPendingEdit[]>([]),[backups,setBackups]=useState<Backup[]>([]),[aiMessages,setAiMessages]=useState<{role:"user"|"assistant";content:string;edits?:string[]}[]>([]);
 const saveTimer=useRef<any>(null),editorRef=useRef<HTMLTextAreaElement|null>(null),searchRef=useRef<HTMLInputElement|null>(null);
 useEffect(()=>{const previous=document.title;document.title="Cookie Code Studio";return()=>{document.title=previous}},[]);

 const load=async()=>{setError("");try{const r=await fetch("/api/codebase?action=state",{credentials:"same-origin",cache:"no-store"}),d=await parseApiResponse(r);if(!r.ok)throw new Error(d?.error||"Could not open Code Studio.");setFiles(d.files||[]);setMembers(d.members||[]);setAudits(d.audits||[]);setOwner(Boolean(d.owner));setRole(d.role||"");setBranchSha(d.branchSha||"");setAutoReview(d.settings?.auto_review!=="0");setAutoCommit(d.settings?.auto_commit==="1");setBackups(d.backups||[]);const latest=(d.reviews||[])[0];if(latest)setReview({...latest,findings:JSON.parse(latest.findings_json||"[]"),checks:JSON.parse(latest.checks_json||"[]")});setDeployment(d.deployment||{status:"not_started",checks:[]})}catch(e:any){setError(e?.message||"Could not open Code Studio.")}finally{setLoading(false)}};
 useEffect(()=>{load();return()=>{if(saveTimer.current)clearTimeout(saveTimer.current)}},[]);
 const open=async(path:string)=>{if(saveTimer.current){clearTimeout(saveTimer.current);saveTimer.current=null}setError("");try{const r=await fetch("/api/codebase?path="+encodeURIComponent(path),{credentials:"same-origin",cache:"no-store"}),d=await parseApiResponse(r);if(!r.ok)throw new Error(d?.error||"Could not load file.");if(d.file?.is_binary){setContent("[Binary file — stored in the virtual workspace and read-only.]");setSaved("[Binary file — stored in the virtual workspace and read-only.]")}else{setContent(String(d.file?.content||""));setSaved(String(d.file?.content||""))}setSelected(path);setTabs(p=>p.includes(path)?p:[...p,path]);if(window.matchMedia?.("(max-width:760px)").matches)setExplorer(false);setTimeout(()=>editorRef.current?.focus(),40)}catch(e:any){setError(e?.message||"Could not load file.")}};
 const dirty=Boolean(selected)&&content!==saved;
 const autosave=async(next=content,targetPath=selected)=>{if(!targetPath||targetPath!==selected||next===saved)return;setSaving(true);try{const r=await fetch("/api/codebase",{method:"PUT",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({path:targetPath,content:next,mime:files.find(f=>f.path===targetPath)?.mime})}),d=await parseApiResponse(r);if(!r.ok)throw new Error(d?.error||"Autosave failed.");setSaved(next);setFiles(p=>p.map(f=>f.path===selected?{...f,updated_by:"you",updated_at:Date.now()/1000,github_sha:null}:f));setNotice("Saved to virtual workspace");setTimeout(()=>setNotice(""),1800);if(autoCommit){const rr=await fetch("/api/codebase",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({action:"auto-review-and-commit"})}),rd=await parseApiResponse(rr);if(!rr.ok||!rd.ok){setError(rd?.error||"Automatic review/commit was blocked.");}else{setReview(normalizeReview(rd));setNotice("Approved and committed — Cloudflare deployment queued.")}}else if(autoReview){await runReview(true)}}catch(e:any){setError(e?.message||"Autosave failed.")}finally{setSaving(false)}};
 const scheduleSave=(v:string)=>{const targetPath=selected;setContent(v);if(saveTimer.current)clearTimeout(saveTimer.current);saveTimer.current=setTimeout(()=>autosave(v,targetPath),850)};
 const runReview=async(silent=false)=>{if(reviewing)return;setReviewing(true);if(!silent)setError("");try{const r=await fetch("/api/codebase",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({action:"review"})}),d=await parseApiResponse(r);if(!r.ok)throw new Error(d?.error||"Review failed.");setReview(normalizeReview(d));setChanges(d.changes||[]);if(d.status==="Blocked"&&(d.changes||[]).length>0){const ur=await fetch("/api/codebase",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({action:"undo"})}),ud=await parseApiResponse(ur);if(ur.ok&&ud.ok){setNotice("Safety Watch restored the blocked deletion.");setTimeout(()=>setNotice(""),2200);await load();setChanges([])}}else{const dr=await fetch("/api/codebase?action=diff",{credentials:"same-origin"});const dd=await parseApiResponse(dr);if(dr.ok)setChanges(dd.changes||[])}setActivePanel("review");setPanelOpen(true)}catch(e:any){setError(e?.message||"AI review failed.")}finally{setReviewing(false)}};
 const restoreLatestBackup=async()=>{
   const backup=backups[0];if(!backup)return;
   if(!window.confirm("Restore the last Code Studio backup? This restores the files from before that commit into the virtual workspace."))return;
   setError("");
   try{
     const r=await fetch("/api/codebase",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({action:"restore-backup",backupId:backup.id})});
     const d=await parseApiResponse(r);if(!r.ok||!d.ok)throw new Error(d?.error||"Backup restore failed.");
     setNotice("Backup restored to the virtual workspace. Review before committing.");setTimeout(()=>setNotice(""),2400);
     await load();await refreshDiff();setActivePanel("review");setPanelOpen(true);
   }catch(e:any){setError(e?.message||"Backup restore failed.")}
 };
 const refreshDiff=async()=>{const r=await fetch("/api/codebase?action=diff",{credentials:"same-origin"}),d=await parseApiResponse(r);if(r.ok)setChanges(d.changes||[])};
 const undoLast=async()=>{const audit=audits.find(a=>!a.undone);if(!audit)return;setError("");try{const r=await fetch("/api/codebase",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({action:"undo",auditId:audit.id})}),d=await parseApiResponse(r);if(!r.ok||!d.ok)throw new Error(d?.error||"Undo failed.");setNotice("Last developer change restored.");setTimeout(()=>setNotice(""),2200);await load();await refreshDiff()}catch(e:any){setError(e?.message||"Undo failed.")}};
 const commit=async()=>{if(!review?.id||review.status!=="Approved")return;setCommitting(true);setError("");try{const r=await fetch("/api/codebase",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({action:"commit",reviewId:review.id})}),d=await parseApiResponse(r);if(!r.ok||!d.ok)throw new Error(d?.error||"Commit blocked.");setReview({...review,commit_sha:d.commitSha,deployment_status:"queued"});setNotice("Committed to GitHub. Cloudflare deployment is queued.");await load()}catch(e:any){setError(e?.message||"Commit failed.")}finally{setCommitting(false)}};
 const sync=async()=>{if(!owner||syncing)return;setSyncing(true);try{const r=await fetch("/api/codebase",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({action:"sync"})}),d=await parseApiResponse(r);if(!r.ok)throw new Error(d?.error||"Sync failed.");setNotice("Workspace synced from GitHub");setSelected("");setTabs([]);await load()}catch(e:any){setError(e?.message||"Sync failed.")}finally{setSyncing(false)}};
 const createFile=async()=>{const path=newPath.trim();if(!path)return;const r=await fetch("/api/codebase",{method:"PUT",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({path,content:"",mime:"text/plain"})}),d=await parseApiResponse(r);if(!r.ok){setError(d?.error||"Could not create file.");return}setNewPath("");setNewOpen(false);await load();await open(path)};
 const remove=async()=>{if(!selected||!window.confirm("Delete this file from the virtual workspace?"))return;const r=await fetch("/api/codebase?path="+encodeURIComponent(selected),{method:"DELETE",credentials:"same-origin"}),d=await parseApiResponse(r);if(!r.ok){setError(d?.error||"Delete failed.");return}setTabs(p=>p.filter(x=>x!==selected));setSelected("");setContent("");setSaved("");await load();if(autoReview)await runReview(true)};
 const rename=async()=>{if(!selected||!renameTo.trim())return;const r=await fetch("/api/codebase",{method:"PUT",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({action:"rename",from:selected,to:renameTo.trim()})}),d=await parseApiResponse(r);if(!r.ok){setError(d?.error||"Rename failed.");return}const to=renameTo.trim();setRenaming(false);setRenameTo("");setTabs(p=>p.map(x=>x===selected?to:x));await load();await open(to)};
 const duplicate=async()=>{if(!selected)return;const to=selected.replace(/(\.[^.]*)?$/,".copy$1");const r=await fetch("/api/codebase",{method:"PUT",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({action:"duplicate",from:selected,to})}),d=await parseApiResponse(r);if(!r.ok){setError(d?.error||"Duplicate failed.");return}await load();await open(to)};
 const addMember=async()=>{if(!memberEmail.trim())return;const r=await fetch("/api/codebase",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({action:"member",email:memberEmail})}),d=await parseApiResponse(r);if(!r.ok){setError(d?.error||"Could not add member.");return}setMemberEmail("");setMemberOpen(false);await load()};
 const setting=async(key:string,value:boolean)=>{if(!owner)return;const r=await fetch("/api/codebase",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({action:"settings",key,value})});if(!r.ok){const d=await parseApiResponse(r);setError(d?.error||"Could not update setting.");return}if(key==="auto_review")setAutoReview(value);if(key==="auto_commit")setAutoCommit(value)};
 const normalizeReview=(d:any):Review=>({id:d.reviewId||d.id,status:d.status||"Needs changes",risk:d.risk||"unknown",summary:d.summary||"",findings:d.findings||[],checks:d.checks||[],commit_sha:d.commitSha,deployment_status:d.deploymentStatus||d.deployment_status});
 const addDevAttachments=(list:FileList|null)=>{if(!list)return;Array.from(list).slice(0,10-aiAttachments.length).forEach(file=>{const reader=new FileReader();reader.onload=()=>setAiAttachments(p=>[...p,{id:Math.random().toString(36).slice(2),kind:file.type.startsWith("image/")?"image":"file",name:file.name,mime:file.type||"application/octet-stream",data:String(reader.result||""),size:file.size}]);reader.readAsDataURL(file)})};
 const applyDevFixes=async()=>{
   if(!aiPendingEdits.length||aiBusy)return;
   setAiBusy(true);setError("");
   try{
     const r=await fetch("/api/codebase",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({action:"apply-ai-edits",edits:aiPendingEdits})});
     const d=await parseApiResponse(r);if(!r.ok||!d.ok)throw new Error(d?.error||"Could not apply the proposed fixes.");
     setAiMessages(p=>[...p,{role:"assistant",content:"Applied the proposed fixes to the virtual workspace.",edits:Array.isArray(d.edits)?d.edits:[]}]);
     setAiPendingEdits([]);await load();await refreshDiff();setActivePanel("review");setPanelOpen(true);
     if(selected&&Array.isArray(d.edits)&&d.edits.includes(selected))await open(selected);
     setNotice("Fixes applied. Review them before committing.");setTimeout(()=>setNotice(""),2200);
   }catch(e:any){setError(e?.message||"Could not apply the proposed fixes.")}finally{setAiBusy(false)}
 };
 const sendDevAI=async()=>{
   const message=aiInput.trim();if((!message&&!aiAttachments.length)||aiBusy)return;
   const next=[...aiMessages,{role:"user" as const,content:message||"Attached files"}];setAiMessages(next);setAiInput("");setAiBusy(true);
   try{
     const r=await fetch("/api/codebase",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({action:"ai-chat",message,history:next,attachments:aiAttachments})});
     const d=await parseApiResponse(r);if(!r.ok)throw new Error(d?.error||"Cookie Dev AI failed.");
     const edits=Array.isArray(d.edits)?d.edits:[];setAiPendingEdits(edits.map((x:any)=>({path:String(x.path),content:String(x.content??"")})));
     setAiMessages(p=>[...p,{role:"assistant",content:String(d.reply||"I inspected the workspace."),edits:edits.map((x:any)=>String(x.path||"")).filter(Boolean)}]);
     setAiAttachments([]);
   }catch(e:any){setAiMessages(p=>[...p,{role:"assistant",content:"I couldn't complete that request: "+(e?.message||"unknown error")}])}
   finally{setAiBusy(false)}
 };

 const filtered=useMemo(()=>files.filter(f=>!f.deleted&&!/\.md$/i.test(f.path)&&(!search||f.path.toLowerCase().includes(search.toLowerCase()))),[files,search]);
 const root=useMemo(()=>treeFor(filtered),[filtered]);
 const lines=Math.max(1,content.split("\n").length);
 const commands=[
  ["Open File","quick","⌘P"],["Save","save","⌘S"],["Find","find","⌘F"],["Replace","replace","⌘H"],["Create File","create",""],["Rename","rename",""],["Delete","delete",""],["Search Workspace","search",""],["Source Control","source",""],["Review Changes","review",""],["Approve & Commit","commit",""],["Sync from GitHub","sync",""],["Run Build","build",""],["Open Terminal","terminal",""],["Toggle Explorer","explorer",""]
 ].filter(x=>!commandQuery||x[0].toLowerCase().includes(commandQuery.toLowerCase()));
 const runCommand=(id:string)=>{setCommandOpen(false);if(id==="quick")setQuickOpen(true);if(id==="save")autosave();if(id==="find"){editorRef.current?.focus();document.execCommand("find")}if(id==="replace"){setNotice("Use the browser/editor replace shortcut for this file.")}if(id==="create"){setNewOpen(true);setExplorer(true)}if(id==="rename"){setRenaming(true);setRenameTo(selected)}if(id==="delete")remove();if(id==="search"){setActivity("search");setExplorer(true);searchRef.current?.focus()}if(id==="source"){setActivity("source");setPanelOpen(true);refreshDiff()}if(id==="review")runReview();if(id==="commit")commit();if(id==="sync")sync();if(id==="build"){setActivePanel("deployment");setPanelOpen(true);setNotice("Builds run in GitHub Actions after an approved commit.")}if(id==="terminal"){setActivePanel("terminal");setPanelOpen(true)}if(id==="explorer"){setExplorer(v=>!v)}};
 useEffect(()=>{const onKey=(e:KeyboardEvent)=>{const mod=e.metaKey||e.ctrlKey;if(mod&&e.key.toLowerCase()==="s"){e.preventDefault();autosave()}if(mod&&e.key.toLowerCase()==="p"){e.preventDefault();setQuickOpen(true)}if(mod&&e.shiftKey&&e.key.toLowerCase()==="p"){e.preventDefault();setCommandOpen(true);setCommandQuery("")}if(mod&&e.key.toLowerCase()==="f"){e.preventDefault();editorRef.current?.focus();setNotice("Find: use browser search within the editor.")}if(e.key==="Escape"){setCommandOpen(false);setQuickOpen(false);setMemberOpen(false)}};window.addEventListener("keydown",onKey);return()=>window.removeEventListener("keydown",onKey)},[selected,content,saved,review]);
 if(loading)return <div className="cs-loading"><Loader2 size={22} className="spin"/><strong>Opening Code Studio</strong><span>Loading the virtual workspace…</span></div>;
 const status=deployment.status==="success"?"Deployed":deployment.status==="failed"?"Deployment failed":deployment.status==="building"?"Deploying":review?.deployment_status==="queued"?"Deployment queued":review?.commit_sha?"Committed":review?.status==="Approved"?"Approved":dirty?"Unsaved":saving?"Saving":"Saved";
 return <div className="code-studio-v2">
  <div className="cs-titlebar">
   <button className="cs-mobile-menu" onClick={()=>setExplorer(v=>!v)}><Menu size={17}/></button>
   <div className="cs-title-left"><button className="cs-back-cookie" onClick={onExit} title="Back to Cookie AI"><ArrowLeft size={15}/><span>Back to Cookie AI</span></button><span className="cs-title-divider"/><Code2 size={17}/><strong>Code Studio</strong><span className="muted">/</span><span>Cookie</span><span className="branch-chip"><GitBranch size={13}/>main</span></div>
   <div className="cs-title-actions"><button className="cs-dev-ai-btn" onClick={()=>setAiOpen(true)}><Bot size={14}/><span>Cookie Dev AI</span></button><button onClick={()=>{setCommandOpen(true);setCommandQuery("")}}><Keyboard size={14}/>Command Palette <kbd>⌘⇧P</kbd></button><button onClick={()=>setQuickOpen(true)}><Search size={14}/>Quick Open <kbd>⌘P</kbd></button><button onClick={sync} disabled={!owner||syncing}><RefreshCw size={14}/>{syncing?"Syncing":"Sync"}</button></div>
  </div>
  <div className="cs-workbench">
   <nav className="cs-activity">
    <button className={activity==="explorer"?"active":""} onClick={()=>setActivity("explorer")} title="Explorer"><LayoutPanelLeft size={19}/></button>
    <button className={activity==="search"?"active":""} onClick={()=>setActivity("search")} title="Search"><Search size={19}/></button>
    <button className={activity==="source"?"active":""} onClick={()=>{setActivity("source");setPanelOpen(true);refreshDiff()}} title="Source Control"><GitCompare size={19}/>{changes.length>0&&<i>{changes.length}</i>}</button>
    <button className={activity==="run"?"active":""} onClick={()=>setActivity("run")} title="Run and Build"><Play size={19}/></button>
    <div className="cs-activity-spacer"/>
    <button onClick={()=>setMemberOpen(true)} title="Members"><Users size={18}/></button>
    <button onClick={()=>setActivePanel("terminal")} title="Terminal"><SquareTerminal size={18}/></button>
    {["owner","admin"].includes(String(role||"").toLowerCase())&&<button onClick={()=>setAdminOpen(true)} title="Account control"><SlidersHorizontal size={18}/></button>}
   </nav>
   {explorer&&<aside className="cs-explorer">
    <div className="cs-pane-head"><strong>{activity==="search"?"SEARCH":activity==="source"?"SOURCE CONTROL":activity==="run"?"RUN / BUILD":"EXPLORER"}</strong><div><button onClick={()=>setExplorer(false)} className="mobile-only"><X size={15}/></button><button onClick={()=>setNewOpen(true)}><Plus size={15}/></button></div></div>
    {activity==="search"&&<div className="cs-searchbox"><Search size={14}/><input ref={searchRef} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search workspace"/></div>}
    {activity==="source"&&<div className="cs-source-head"><span>{changes.length} changed</span><button onClick={refreshDiff}><RefreshCw size={14}/></button></div>}
    {activity==="run"&&<div className="cs-run-menu"><button onClick={()=>runCommand("build")}><Play size={15}/>Run build</button><button onClick={()=>{setActivePanel("terminal");setPanelOpen(true)}}><SquareTerminal size={15}/>Open terminal</button><button onClick={()=>{setNotice("Safety checks are available through Review Changes.");runReview()}}><ShieldCheck size={15}/>Run checks</button></div>}
    {activity==="source"&&changes.length>0?<div className="cs-change-list">{changes.map(c=><button key={c.path} onClick={()=>open(c.path)}><span className={"change-dot "+c.status}/><span>{c.path}</span><small>{c.status}</small></button>)}</div>:activity!=="run"&&<><div className="cs-searchbox explorer-search"><Search size={14}/><input value={activity==="search"?search:""} onChange={e=>setSearch(e.target.value)} placeholder="Filter files"/></div><div className="cs-root-row"><FolderOpen size={15}/><strong>COOKIE</strong><span>{filtered.length}</span></div><div className="cs-tree"><Tree node={root} prefix="" onOpen={open} active={selected}/></div></>}
    <div className="cs-explorer-foot"><small className="cs-protected-note"><ShieldCheck size={12}/>Protected internals hidden · .env blocked</small><button onClick={()=>setNewOpen(true)}><FilePlus2 size={15}/>New file</button><button onClick={()=>setMemberOpen(true)}><UserPlus size={15}/>Members</button></div>
   </aside>}
   <main className="cs-editor-area">
    <div className="cs-tabs">{tabs.map(p=><button key={p} className={selected===p?"active":""} onClick={()=>open(p)}><span className={dirty&&selected===p?"dirty-dot":""}>{iconFor(p)}</span><span>{p.split("/").pop()}</span>{selected===p&&dirty&&<CircleDot size={11}/>}<X size={13} onClick={e=>{e.stopPropagation();setTabs(t=>t.filter(x=>x!==p));if(selected===p){const next=tabs.find(x=>x!==p);if(next)open(next);else{setSelected("");setContent("");setSaved("")}}}}/></button>)}</div>
    <div className="cs-breadcrumb"><span>COOKIE</span><ChevronRight size={13}/>{selected?selected.split("/").map((p,i)=><React.Fragment key={i}><span className={i===selected.split("/").length-1?"current":""}>{p}</span>{i<selected.split("/").length-1&&<ChevronRight size={12}/>}</React.Fragment>):<span className="muted">No file selected</span>}<div className="cs-editor-tools"><span>{selected?languageLabel(selected):"Plain Text"}</span><span>Spaces: 2</span><span>UTF-8</span></div></div>
    <div className="cs-editor-wrap">
      {!selected?<div className="cs-empty"><Code2 size={38}/><h2>Cookie Code Studio</h2><p>Open a file from Explorer, or use Quick Open.</p><div><button onClick={()=>setQuickOpen(true)}><Search size={15}/>Open File <kbd>⌘P</kbd></button><button onClick={()=>setCommandOpen(true)}><Keyboard size={15}/>Command Palette</button></div></div>:<div className="cs-code-editor"><div className="cs-gutter">{Array.from({length:lines},(_,i)=><span key={i}>{i+1}</span>)}</div><div className="cs-code-surface"><pre className="cs-highlight" aria-hidden dangerouslySetInnerHTML={{__html:highlightCode(content,selected)}}/><textarea className="cs-code-input" ref={editorRef} spellCheck={false} value={content} readOnly={String(content).startsWith("[Binary file")} onScroll={e=>{const pre=e.currentTarget.previousElementSibling as HTMLElement|null;if(pre){pre.scrollTop=e.currentTarget.scrollTop;pre.scrollLeft=e.currentTarget.scrollLeft}}} onChange={e=>scheduleSave(e.target.value)} onKeyDown={e=>{if((e.metaKey||e.ctrlKey)&&e.key==="s"){e.preventDefault();autosave()}if(e.key==="Tab"){e.preventDefault();const s=e.currentTarget.selectionStart;const v=e.currentTarget.value;e.currentTarget.value=v.slice(0,s)+"  "+v.slice(e.currentTarget.selectionEnd);e.currentTarget.selectionStart=e.currentTarget.selectionEnd=s+2;setContent(e.currentTarget.value)}}}/></div><div className="cs-minimap"><div className="mini-title">{selected.split("/").pop()}</div>{content.split("\n").slice(0,90).map((l,i)=><span key={i} style={{width:Math.min(100,Math.max(8,l.length/1.3))+"%"}}/>)}</div></div>}
    </div>
    <div className="cs-statusbar"><span><GitBranch size={13}/>main</span><span className={"status-main "+(status.includes("Approved")||status==="Committed"?"good":"")}>{status}</span><span>{selected?"Ln 1, Col 1":"Ready"}</span><span className="spacer"/><span>{role||"developer"}</span><span>Cookie Code Studio</span></div>
    {panelOpen&&<section className="cs-bottom">
      <div className="cs-bottom-tabs">{(["problems","output","terminal","review","deployment"] as const).map(p=><button key={p} className={activePanel===p?"active":""} onClick={()=>setActivePanel(p)}>{p==="review"&&<Bot size={14}/>} {p==="deployment"&&<UploadCloud size={14}/>} {p[0].toUpperCase()+p.slice(1)}{p==="problems"&&review?.findings?.length?<b>{review.findings.length}</b>:null}</button>)}<button className="panel-close" onClick={()=>setPanelOpen(false)}><X size={14}/></button></div>
      <div className="cs-bottom-body">
       {activePanel==="review"&&<div className="review-panel"><div className="review-summary"><div><span className={"review-badge "+String(review?.status||"pending").toLowerCase().replace(/\s+/g,"-")}>{review?.status==="Blocked"?<ShieldAlert size={15}/>:review?.status==="Needs changes"?<AlertCircle size={15}/>:<ShieldCheck size={15}/>} {review?.status||"Review pending"}</span><span className="risk">Risk: {review?.risk||"—"}</span></div><p>{review?.summary||"Run Review Changes to inspect the exact workspace diff with AI and deterministic safety checks."}</p></div><div className="review-actions"><button className="primary" onClick={()=>runReview()} disabled={reviewing}>{reviewing?<><Loader2 className="spin" size={15}/>Reviewing…</>:<><Bot size={15}/>Review Changes</>}</button><button onClick={undoLast} disabled={!audits.some(a=>!a.undone)}><History size={15}/>Undo last change</button><button onClick={restoreLatestBackup} disabled={!backups.length}><RefreshCw size={15}/>Restore last backup</button><button onClick={commit} disabled={committing||review?.status!=="Approved"}>{committing?<><Loader2 className="spin" size={15}/>Committing…</>:<><GitCommitHorizontal size={15}/>Approve & Commit</>}</button></div><div className="review-grid"><div><h4>Safety checks</h4>{(review?.checks||[]).map((c,i)=><div className="check-row" key={i}><span className={"check-icon "+c.status}>{c.status==="pass"?<Check size={13}/>:c.status==="warn"?<AlertCircle size={13}/>:<ShieldAlert size={13}/>}</span><div><strong>{c.name}</strong><small>{c.detail}</small></div></div>)}</div><div><h4>AI findings</h4>{(review?.findings||[]).length?(review!.findings.map((f,i)=><div className="finding" key={i}><span className={"severity "+String(f.severity||"medium")}/><div><strong>{f.file||"Workspace"}</strong><p>{f.message}</p></div></div>)):<div className="empty-note">No findings reported.</div>}</div></div></div>}
       {activePanel==="problems"&&<div className="empty-panel">{review?.findings?.length?<>{review.findings.map((f,i)=><div className="problem-row" key={i}><AlertCircle size={15}/><b>{f.file||"Workspace"}</b><span>{f.message}</span></div>)}</>:<><Check size={22}/><strong>No current problems</strong><span>Run a review to populate diagnostics.</span></>}</div>}
       {activePanel==="output"&&<div className="terminal-output">{terminal.map((x,i)=><div key={i} className={x.startsWith("$")?"cmd":""}>{x}</div>)}</div>}
       {activePanel==="terminal"&&<div className="terminal-output">{terminal.map((x,i)=><div key={i} className={x.startsWith("$")?"cmd":""}>{x}</div>)}<div className="terminal-input"><span>i</span><input value="No live shell is attached in this build." readOnly aria-label="Terminal status"/></div></div>}
       {activePanel==="deployment"&&<div className="deployment-panel"><div className="deploy-icon"><UploadCloud size={20}/></div><div><strong>{review?.deployment_status==="queued"?"Cloudflare deployment queued":review?.commit_sha?"GitHub commit created":"No deployment yet"}</strong><p>{review?.commit_sha?"Commit "+review.commit_sha.slice(0,12)+" is now the source for the next Pages build. Code Studio will not claim deployment success until an actual deployment status is available.":"Approve and commit a clean review to trigger the connected Pages deployment."}</p></div>{review?.commit_sha&&<a href={"https://github.com/premiummaster156-cmd/cookie/commit/"+review.commit_sha} target="_blank" rel="noreferrer">View commit</a>}</div>}
      </div>
    </section>}
   </main>
  </div>
  {notice&&<div className="cs-toast">{notice}</div>}
  {error&&<div className="cs-errorbar"><AlertCircle size={15}/><span>{error}</span><button onClick={()=>setError("")}><X size={14}/></button></div>}
  {aiOpen&&<div className="cs-ai-backdrop" onMouseDown={()=>setAiOpen(false)}><section className="cs-ai-drawer" onMouseDown={e=>e.stopPropagation()}>
    <div className="cs-ai-head"><div><span className="cs-ai-kicker"><Bot size={13}/>Cookie Dev AI</span><strong>Workspace engineer</strong><small>Inspects the workspace first. It only changes code after you explicitly apply its proposed fixes.</small></div><button onClick={()=>setAiOpen(false)} aria-label="Close Cookie Dev AI"><X size={16}/></button></div>
    {aiPendingEdits.length>0&&<div className="cs-ai-pending"><div><strong>{aiPendingEdits.length} proposed fix{aiPendingEdits.length===1?"":"es"}</strong><small>Nothing has been changed yet.</small></div><button className="primary" onClick={applyDevFixes} disabled={aiBusy}><Check size={14}/>Apply fixes</button></div>}<div className="cs-ai-messages">{!aiMessages.length&&<div className="cs-ai-empty"><Bot size={28}/><strong>Talk to Cookie Dev AI</strong><span>Ask it to inspect a file, debug an issue, refactor code, or make a targeted change.</span></div>}{aiMessages.map((m,i)=><div className={"cs-ai-message "+m.role} key={i}><span className="cs-ai-author">{m.role==="user"?"You":"Cookie Dev AI"}</span><p>{m.content}</p>{m.edits?.length?<div className="cs-ai-edits">{m.edits.map(x=><span key={x}>{x}</span>)}</div>:null}</div>)}{aiBusy&&<div className="cs-ai-message assistant"><span className="cs-ai-author">Cookie Dev AI</span><p><Loader2 className="spin" size={14}/> Working in the workspace…</p></div>}</div>
    {!!aiAttachments.length&&<div className="cs-ai-attachments">{aiAttachments.map(a=><div key={a.id} className="cs-ai-attachment">{a.kind==="image"?<img src={a.data} alt=""/>:<FileText size={16}/>}<span>{a.name}</span><button onClick={()=>setAiAttachments(p=>p.filter(x=>x.id!==a.id))}><X size={12}/></button></div>)}</div>}<div className="cs-ai-composer"><div className="cs-ai-compose-left"><input hidden id="cs-ai-file" type="file" multiple onChange={e=>{addDevAttachments(e.target.files);e.currentTarget.value=""}}/><input hidden id="cs-ai-image" type="file" accept="image/*" multiple onChange={e=>{addDevAttachments(e.target.files);e.currentTarget.value=""}}/><button type="button" className="cs-ai-attach" onClick={()=>document.getElementById("cs-ai-file")?.click()} aria-label="Attach files"><FilePlus2 size={16}/></button><button type="button" className="cs-ai-attach" onClick={()=>document.getElementById("cs-ai-image")?.click()} aria-label="Attach images"><ImageIcon size={16}/></button><textarea value={aiInput} onChange={e=>setAiInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendDevAI()}}} placeholder="Ask Cookie Dev AI to inspect the workspace…"/></div><button className="primary" onClick={sendDevAI} disabled={aiBusy||(!aiInput.trim()&&!aiAttachments.length)}>{aiBusy?<Loader2 className="spin" size={15}/>:<ArrowRight size={15}/>}Send</button></div>
  </section></div>}
  {newOpen&&<div className="cs-modal-backdrop" onMouseDown={()=>setNewOpen(false)}><div className="cs-modal" onMouseDown={e=>e.stopPropagation()}><div className="modal-head"><strong>New file</strong><button onClick={()=>setNewOpen(false)}><X size={15}/></button></div><p>Create a file anywhere in the virtual workspace.</p><input autoFocus value={newPath} onChange={e=>setNewPath(e.target.value)} placeholder="src/components/NewThing.tsx" onKeyDown={e=>e.key==="Enter"&&createFile()}/><button className="primary" onClick={createFile}>Create file</button></div></div>}
  {renaming&&<div className="cs-modal-backdrop" onMouseDown={()=>setRenaming(false)}><div className="cs-modal" onMouseDown={e=>e.stopPropagation()}><div className="modal-head"><strong>Rename file</strong><button onClick={()=>setRenaming(false)}><X size={15}/></button></div><input autoFocus value={renameTo} onChange={e=>setRenameTo(e.target.value)} onKeyDown={e=>e.key==="Enter"&&rename()}/><button className="primary" onClick={rename}>Rename</button></div></div>}
  {memberOpen&&<div className="cs-modal-backdrop" onMouseDown={()=>setMemberOpen(false)}><div className="cs-modal" onMouseDown={e=>e.stopPropagation()}><div className="modal-head"><strong>Code Studio control</strong><button onClick={()=>setMemberOpen(false)}><X size={15}/></button></div><div className="member-list">{members.map(m=><div key={m.email}><span><strong>{m.email}</strong><small>{m.role}</small></span><CircleDot size={13}/></div>)}</div>{owner&&<><div className="cs-automation"><div><strong>Automation</strong><small>Server-side gates always remain active.</small></div><label><input type="checkbox" checked={autoReview} onChange={e=>setting("auto_review",e.target.checked)}/><span>Auto Review</span></label><label><input type="checkbox" checked={autoCommit} onChange={e=>setting("auto_commit",e.target.checked)}/><span>Auto Review + Auto Commit</span></label><p>Auto commit still requires deterministic checks, AI approval, and GitHub branch-divergence protection.</p></div><input value={memberEmail} onChange={e=>setMemberEmail(e.target.value)} placeholder="developer@example.com"/><button className="primary" onClick={addMember}><UserPlus size={15}/>Add developer</button></>}</div></div>}
  {commandOpen&&<div className="cs-modal-backdrop" onMouseDown={()=>setCommandOpen(false)}><div className="cs-command" onMouseDown={e=>e.stopPropagation()}><div className="command-input"><Search size={16}/><input autoFocus value={commandQuery} onChange={e=>setCommandQuery(e.target.value)} placeholder="Type a command…"/></div>{commands.map(c=><button key={c[1]} onClick={()=>runCommand(c[1])}><span>{c[0]}</span><kbd>{c[2]}</kbd></button>)}</div></div>}
  {adminOpen&&<div className="cs-modal-backdrop" onMouseDown={()=>setAdminOpen(false)}><div className="cs-admin-modal" onMouseDown={e=>e.stopPropagation()}><AdminControlPanel role={role||"staff"} onClose={()=>setAdminOpen(false)} onNotice={x=>{setNotice(x);setTimeout(()=>setNotice(""),1800)}} onError={x=>setError(x)}/></div></div>}
  {quickOpen&&<div className="cs-modal-backdrop" onMouseDown={()=>setQuickOpen(false)}><div className="cs-command" onMouseDown={e=>e.stopPropagation()}><div className="command-input"><Search size={16}/><input autoFocus value={search} onChange={e=>setSearch(e.target.value)} placeholder="Open file…"/></div>{filtered.slice(0,40).map(f=><button key={f.path} onClick={()=>{setQuickOpen(false);open(f.path)}}>{iconFor(f.path)}<span>{f.path}</span><kbd>{languageLabel(f.path)}</kbd></button>)}</div></div>}
 </div>
}
