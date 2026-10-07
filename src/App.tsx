import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import cookieIconUrl from "../cookie-ai-icon.png";
import AuthPage, { type AuthUser } from "./Auth";
import CodeStudioPage from "./CodeStudioPage";
import HelpCenterPage from "./HelpCenterPage";
import LegalPage from "./LegalPage";
import { LiquidGlassBackdrop } from "./liquid-glass/React";

import {
  Archive, ArrowUp, Bell, Check, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Copy, Download,
  File as FileIcon, FilePlus2, FolderOpen, Globe2, Image as ImageIcon, Info, Keyboard, Library,
  LogOut, Menu, MessageSquare, MessageSquarePlus, MoreHorizontal, PanelLeft, Pin, Plus, Code2, Clock3,
  Wrench, ImagePlus, FolderKanban, CreditCard, Brain, Sparkles, BookOpen, BarChart3, FileSearch, LockKeyhole, ArrowLeft, PenLine, Orbit, GitBranch, Pencil,
  AlertCircle, RotateCcw, Search, Send, Settings as SettingsIcon, Share2, Square, Trash2, UserRound, ShieldAlert, ShieldCheck,
  Volume2, X, Zap, AppWindow, Smartphone, Monitor, SquareTerminal, Bookmark, Command, ExternalLink, Maximize2, Mail
 ,FileText} from "lucide-react";

type Role = "user" | "assistant";
type View = "chat" | "search" | "library" | "projects" | "code" | "gpts" | "gpt-chat" | "work" | "space" | "memory" | "settings" | "help" | "terms" | "privacy" | "moderation" | "admin";
type SettingsTab = "general" | "personalization" | "data" | "notifications" | "voice" | "account" | "about";
type Attachment = { id:string; kind:"image"|"file"; name:string; mime:string; data:string; size:number };
type GeneratedFile = { name:string; path:string; content:string; kind?:string };
type GeneratedImage = { dataUrl:string; prompt:string; model?:string };
type SourceRef = { title:string; url:string; domain?:string; snippet?:string };
type ActivityStep = { id:string; label:string; detail:string; stage:string; done?:boolean; tool?:string; command?:string; output?:string; domain?:string; meta?:string }; type ModerationNotification = { id:string; action:string; reason:string; createdAt:number; until:number; read:boolean };
type Message = { id:string; role:Role; content:string; attachments?:Attachment[]; files?:GeneratedFile[]; images?:GeneratedImage[]; sources?:SourceRef[]; activity?:ActivityStep[]; activityDuration?:number; createdAt:number };
type Chat = { id:string; title:string; messages:Message[]; model:string; temporary?:boolean; pinned?:boolean; archived?:boolean; updatedAt:number; branchOf?:string; branchMessageId?:string };
type SavedItem = { id:string; kind:string; title:string; content:string; url?:string; chatId?:string; createdAt:number };

const ICON = cookieIconUrl;
const MODELS = [
  { id:"standard", name:"CPT-1", detail:"Fast adaptive everyday AI", requiredPlan:"free" },
  { id:"max", name:"CPT-2 MAX", detail:"Deep reasoning + engineering", requiredPlan:"pro" },
  { id:"ultra", name:"CPT-3 ULTRA", detail:"Multimodal + agentic work", requiredPlan:"max" }
] as const;
function planRankClient(plan:string){const p=String(plan||"free").toLowerCase();return p==="max"?2:(p==="pro"||p==="plus")?1:0}
function modelRank(id:string){return id==="ultra"?2:id==="max"?1:0}
const LANG_CODES = ["en","uz","ru","tr","kk","ky","tg","ar","fa","hi","ur","zh","ja","ko","es","fr","de","it","pt","id"];
const LANGUAGES = ["English","Uzbek","Russian","Turkish","Kazakh","Kyrgyz","Tajik","Arabic","Persian","Hindi","Urdu","Chinese","Japanese","Korean","Spanish","French","German","Italian","Portuguese","Indonesian"];
const PERSONALITIES = ["Balanced","Friendly","Professional","Concise","Creative","Teacher"];
const COOKIE_SKILLS = [
  {id:"deep-research",name:"Deep Research",detail:"Break a question into research angles and compare evidence.",icon:"research",instruction:"Use a research-first workflow: identify the key subquestions, distinguish facts from assumptions, compare evidence, and surface uncertainty. Prefer current sources when web access is available."},
  {id:"ship-code",name:"Ship Code",detail:"Plan, implement, review, and harden production code.",icon:"code",instruction:"Act as a production engineer. Before changing code, understand the existing architecture and dependencies. Prefer complete, compatible changes, check edge cases and security, and finish with a concise validation summary."},
  {id:"study-mode",name:"Study Mode",detail:"Teach interactively instead of only giving answers.",icon:"study",instruction:"Teach actively. Start from the learner's level, explain concepts simply, use examples, ask occasional focused questions, and check understanding before moving on."},
  {id:"creative-director",name:"Creative Director",detail:"Develop polished concepts and iterate toward the strongest direction.",icon:"creative",instruction:"Think like a senior creative director. Generate several distinct directions, evaluate them against the brief, then refine the strongest one into an executable concept."},
  {id:"data-investigator",name:"Data Investigator",detail:"Inspect data quality before drawing conclusions.",icon:"data",instruction:"Analyze data rigorously. Check assumptions and data quality, distinguish correlation from causation, identify anomalies, and never invent missing measurements."}
] as const;


type ToolMode = "calculator"|"file-analysis"|"data-analysis"|"url-fetch"|"code-analysis"|"deep-research"|null;
type SkillId = typeof COOKIE_SKILLS[number]["id"] | null;

type GPTDefinition = {id:string;name:string;description:string;category:string;icon:"study"|"code"|"writer"|"research"|"data"|"creative";system:string;plan:"free"|"pro"|"max"};
const GPTS:GPTDefinition[]=[
  {id:"study-coach",name:"Study Coach",description:"Break down difficult topics, teach step by step, and quiz you when useful.",category:"Education",icon:"study",plan:"free",system:"You are Study Coach inside Cookie AI. Teach clearly and patiently, adapt explanations to the user's level, use examples, and prefer active learning. Ask focused follow-up questions only when necessary. Do not invent citations or facts."},
  {id:"code-expert",name:"Code Expert",description:"Senior-level programming help, debugging, architecture, and production-quality code.",category:"Programming",icon:"code",plan:"pro",system:"You are Code Expert inside Cookie AI. Act as a senior software engineer. Diagnose bugs systematically, respect the user's existing stack and conventions, produce complete production-quality code when requested, consider security and edge cases, and explain important implementation decisions briefly."},
  {id:"writing-partner",name:"Writing Partner",description:"Rewrite, draft, edit, and polish writing with a strong natural voice.",category:"Writing",icon:"writer",plan:"free",system:"You are Writing Partner inside Cookie AI. Help users draft, rewrite, edit, summarize, and polish writing. Preserve intent and voice unless asked to change them. Prefer natural human language over generic AI phrasing. Match requested tone and audience."},
  {id:"research-analyst",name:"Research Analyst",description:"Compare evidence, structure findings, and turn complex research questions into clear conclusions.",category:"Research",icon:"research",plan:"pro",system:"You are Research Analyst inside Cookie AI. Approach research questions carefully, distinguish evidence from inference, compare competing explanations, surface uncertainty, and structure findings for decision-making. When live sources are supplied, ground claims in those sources and never pretend you browsed when you did not."},
  {id:"data-analyst",name:"Data Analyst",description:"Understand tables, CSVs, trends, metrics, and business data with rigorous analysis.",category:"Data",icon:"data",plan:"pro",system:"You are Data Analyst inside Cookie AI. Analyze attached or provided data rigorously. State assumptions, check data quality, calculate useful statistics when possible, identify trends and anomalies, and communicate results clearly. Never fabricate measurements that were not available."},
  {id:"creative-studio",name:"Creative Studio",description:"Develop polished concepts, visual directions, campaigns, names, and creative ideas.",category:"Creative",icon:"creative",plan:"max",system:"You are Creative Studio inside Cookie AI. Develop original, high-quality creative concepts. Explore multiple directions, refine the strongest one, and keep the output practical enough to execute. Match the requested brand voice and constraints."}
];
const uid = () => (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)) + Date.now().toString(36);
const readJSON = <T,>(key:string, fallback:T):T => { try { return JSON.parse(localStorage.getItem(key) || "") as T; } catch { return fallback; } };
const saveJSON = (key:string, value:unknown) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };
const serializeChatForRemote = (chat:Chat):Chat => ({
  ...chat,
  messages: chat.messages.map(message => { const {images,...rest}=message; return rest; })
});
const serializeChatsForRemote = (items:Chat[]) => items.filter(chat=>!chat.temporary).map(serializeChatForRemote);
const titleFrom = (s:string) => { const x=s.replace(/\s+/g," ").trim(); return x ? x.slice(0,48) + (x.length>48 ? "…" : "") : "New chat"; };

function CookieIcon({size=24}:{size?:number}) {
  return <img className="cookie-icon" src={ICON} width={size} height={size} alt="Cookie AI" draggable={false}/>;
}
function Avatar({size="sm"}:{size?:"sm"|"md"|"lg"}) {
  return <div className={"avatar avatar-"+size}><span>CR</span></div>;
}

function CookieBootLoader({failed,message,onRetry}:{failed:boolean;message:string;onRetry:()=>void}){
  const [progress,setProgress]=useState(4);
  useEffect(()=>{
    if(failed){setProgress(100);return}
    let value=4;
    const timer=window.setInterval(()=>{
      value=Math.min(94,value+Math.random()*7+2);
      setProgress(Math.round(value));
    },240);
    return()=>window.clearInterval(timer);
  },[failed]);
  return <div className={"cookie-boot "+(failed?"failed":"")} onClick={failed?onRetry:undefined}>
    <div className="cookie-boot-center" aria-label="Cookie AI loading">
      <div className="cookie-boot-icon-wrap"><CookieIcon size={72}/></div>
      <div className="cookie-progress-track" aria-hidden="true"><div className="cookie-progress-fill" style={{width:progress+"%"}}/></div>
    </div>
  </div>;
}

function PublicShareView({chat,onOpenCookie}:{chat:Chat;onOpenCookie:()=>void}){
  return <div className="public-share">
    <div className="public-share-card">
      <header className="public-share-head">
        <div className="public-share-brand"><CookieIcon size={30}/><div><strong>Cookie AI</strong><span>Shared conversation</span></div></div>
        <button className="public-share-open" onClick={onOpenCookie}>Open Cookie AI</button>
      </header>
      <div className="public-share-title">{chat.title}</div>
      <div className="public-share-messages">
        {chat.messages.map(m=><div className={"public-share-message "+m.role} key={m.id}>
          <div className="public-share-avatar">{m.role==="assistant"?<CookieIcon size={21}/>:<Avatar/>}</div>
          <div className="public-share-body">
            <div className="public-share-author">{m.role==="assistant"?"Cookie":"You"}</div>
            {m.role==="assistant"?<>
  {m.activity?.length&&<ActivityTimeline steps={m.activity} elapsed={m.activityDuration||0}/>}
  <Rich text={m.content}/>
</>:<div className="user-content">{m.content}</div>}
          </div>
        </div>)}
      </div>
      <div className="public-share-foot">Shared from Cookie AI · Read-only conversation</div>
    </div>
  </div>;
}

function fmt(ts:number){ try{return new Intl.DateTimeFormat(undefined,{hour:"numeric",minute:"2-digit"}).format(ts)}catch{return ""} }
function safeTextParts(text:string){ return [text]; }
function normalizeChatMarkup(value:string){
  return String(value||"")
    .replace(/\\(?:rightarrow|to|Rightarrow|Longrightarrow)/g,"→")
    .replace(/\\(?:leftarrow|from|Leftarrow|Longleftarrow)/g,"←")
    .replace(/\\(?:leftrightarrow|Leftrightarrow)/g,"↔")
    .replace(/\\times/g,"×").replace(/\\cdot/g,"·")
    .replace(/\\leq/g,"≤").replace(/\\geq/g,"≥").replace(/\\neq/g,"≠")
    .replace(/\\pm/g,"±").replace(/\\div/g,"÷")
    .replace(/\\alpha/g,"α").replace(/\\beta/g,"β").replace(/\\gamma/g,"γ")
    .replace(/\\Delta/g,"Δ").replace(/\\delta/g,"δ")
    .replace(/\\sqrt\{([^{}]+)\}/g,"√($1)")
    .replace(/\$([^$\n]+)\$/g,"$1");
}
function Inline({text}:{text:string}){
  text=normalizeChatMarkup(text);
  const token=/(\`[^\`]+\`|\*\*[^*]+\*\*|__[^_]+__|(?<!\*)\*[^*]+\*(?!\*)|(?<!_)_[^_]+_(?!_)|\[[^\]]+\]\([^\)]+\))/g;
  return <>{text.split(token).map((p,i)=>{
    if(/^\`[^\`]+\`$/.test(p)) return <code key={i} className="inline-code">{p.slice(1,-1)}</code>;
    if(/^\*\*.*\*\*$/.test(p)||/^__.*__$/.test(p)) return <strong key={i}>{p.slice(2,-2)}</strong>;
    if(/^\*.*\*$/.test(p)||/^_.*_$/.test(p)) return <em key={i}>{p.slice(1,-1)}</em>;
    const link=p.match(/^\[([^\]]+)\]\(([^\)]+)\)$/);
    if(link) return <a key={i} href={link[2]} target="_blank" rel="noreferrer">{link[1]}</a>;
    return <React.Fragment key={i}>{p}</React.Fragment>;
  })}</>;
}
function CodeBlock({code,lang}:{code:string;lang:string}){
  const [copied,setCopied]=useState(false);
  const copy=async()=>{try{await navigator.clipboard.writeText(code)}catch{}setCopied(true);setTimeout(()=>setCopied(false),1400)};
  return <div className="code-block"><div className="code-head"><span>{lang||"code"}</span><button onClick={copy}>{copied?<><Check size={14}/>Copied</>:<><Copy size={14}/>Copy</>}</button></div><pre><code>{code}</code></pre></div>;
}
type VizDatum={label:string;value:number};
type VizSpec={type:"bar"|"line";title?:string;unit?:string;data:VizDatum[]};
function CookieViz({spec}:{spec:VizSpec}){
  const rows=spec.data.slice(0,12).map(x=>({label:String(x.label||"").slice(0,28),value:Number(x.value)})).filter(x=>Number.isFinite(x.value));
  if(rows.length<2)return null;
  const width=620,height=240,pad={l:42,r:18,t:34,b:44},innerW=width-pad.l-pad.r,innerH=height-pad.t-pad.b;
  const min=Math.min(0,...rows.map(x=>x.value)),max=Math.max(0,...rows.map(x=>x.value)),span=max-min||1;
  const y=(v:number)=>pad.t+(max-v)/span*innerH;
  return <figure className="cookie-viz"><figcaption><strong>{String(spec.title||"Visualization").slice(0,120)}</strong>{spec.unit&&<small>{String(spec.unit).slice(0,40)}</small>}</figcaption>
    <div className="cookie-viz-scroll"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={String(spec.title||"Data visualization")}>
      <line x1={pad.l} y1={y(0)} x2={width-pad.r} y2={y(0)} className="viz-axis"/>
      <line x1={pad.l} y1={pad.t} x2={pad.l} y2={height-pad.b} className="viz-axis"/>
      {spec.type==="bar" ? rows.map((d,i)=>{const slot=innerW/rows.length;const bw=Math.min(38,slot*.62);const x=pad.l+i*slot+(slot-bw)/2;const yy=d.value>=0?y(d.value):y(0);const hh=Math.abs(y(d.value)-y(0));return <g key={i}><rect x={x} y={yy} width={bw} height={Math.max(1,hh)} rx="5" className="viz-bar"/><text x={x+bw/2} y={height-16} textAnchor="middle" className="viz-label">{d.label}</text><text x={x+bw/2} y={Math.max(12,yy-6)} textAnchor="middle" className="viz-value">{d.value}</text></g>})
      : <><polyline points={rows.map((d,i)=>`${pad.l+(innerW*i/Math.max(1,rows.length-1))},${y(d.value)}`).join(" ")} className="viz-line" fill="none"/>{rows.map((d,i)=>{const x=pad.l+(innerW*i/Math.max(1,rows.length-1));return <g key={i}><circle cx={x} cy={y(d.value)} r="4" className="viz-dot"/><text x={x} y={height-16} textAnchor="middle" className="viz-label">{d.label}</text><text x={x} y={Math.max(12,y(d.value)-8)} textAnchor="middle" className="viz-value">{d.value}</text></g>})}</>}
    </svg></div>
  </figure>;
}

function Rich({text}:{text:string}){
  const fence="```";
  return <div className="rich">{text.split(new RegExp("("+fence+"[^]*?"+fence+")","g")).map((part,pi)=>{
    if(part.startsWith(fence)){
      const nl=part.indexOf("\n");
      const lang=nl>3?part.slice(3,nl).trim():"";
      const code=part.slice(nl>=0?nl+1:3,-3).replace(/^\n|\n$/g,"");
      if(/^cookie-(?:viz|chart)$/i.test(lang)){try{const spec=JSON.parse(code);if((spec?.type==="bar"||spec?.type==="line")&&Array.isArray(spec?.data))return <CookieViz key={pi} spec={{...spec,type:spec.type,data:spec.data as VizDatum[]}}/>}catch{}}
      return <CodeBlock key={pi} lang={lang} code={code}/>;
    }
    const lines=part.split("\n"); const nodes:React.ReactNode[]=[]; let list:React.ReactNode[]=[]; let listType:"ul"|"ol"|null=null;
    const flush=()=>{if(!listType||!list.length)return;nodes.push(listType==="ol"?<ol key={"ol"+nodes.length}>{list}</ol>:<ul key={"ul"+nodes.length}>{list}</ul>);list=[];listType=null};
    lines.forEach((line,li)=>{
      if(!line.trim()){flush();nodes.push(<div className="md-gap" key={"g"+li}/>);return;}
      const h=line.match(/^(#{1,6})\s+(.+)$/);
      if(h){flush();nodes.push(<div className={"md-heading md-h"+h[1].length} key={li}><Inline text={h[2]}/></div>);return;}
      const bullet=line.match(/^\s*[-*+]\s+(.+)$/);
      if(bullet){if(listType!=="ul"){flush();listType="ul"}list.push(<li key={li}><Inline text={bullet[1]}/></li>);return;}
      const num=line.match(/^\s*\d+[.)]\s+(.+)$/);
      if(num){if(listType!=="ol"){flush();listType="ol"}list.push(<li key={li}><Inline text={num[1]}/></li>);return;}
      const quote=line.match(/^\s*>\s?(.*)$/);
      if(quote){flush();nodes.push(<blockquote key={li}><Inline text={quote[1]}/></blockquote>);return;}
      if(/^\s*([-*_])(?:\s*\1){2,}\s*$/.test(line)){flush();nodes.push(<hr key={li}/>);return;}
      flush();nodes.push(<div className="md-line" key={li}><Inline text={line}/></div>);
    });
    flush(); return <React.Fragment key={pi}>{nodes}</React.Fragment>;
  })}</div>;
}
function ChatRow({chat,active,onOpen,onAction}:{chat:Chat;active:boolean;onOpen:()=>void;onAction:(action:"pin"|"archive"|"delete")=>void}){
  const [open,setOpen]=useState(false);
  const ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(!open)return;
    const close=(e:Event)=>{if(ref.current&&!ref.current.contains(e.target as Node))setOpen(false)};
    const closeOthers=()=>setOpen(false);
    document.addEventListener("pointerdown",close);
    window.addEventListener("cookie:close-chat-menus",closeOthers);
    return()=>{document.removeEventListener("pointerdown",close);window.removeEventListener("cookie:close-chat-menus",closeOthers)};
  },[open]);
  return <div ref={ref} className={"chat-row "+(active?"active":"")}><button className="chat-row-main" onClick={onOpen}><MessageSquare size={16}/><span>{chat.title}</span></button><button className="chat-row-more" onClick={()=>{window.dispatchEvent(new Event("cookie:close-chat-menus"));setOpen(v=>!v)}}><MoreHorizontal size={16}/></button>{open&&<div className="row-menu popover-pop"><button onClick={()=>{onAction("pin");setOpen(false)}}><Pin size={15}/>{chat.pinned?"Unpin":"Pin"}</button><button onClick={()=>{onAction("archive");setOpen(false)}}><Archive size={15}/>Archive</button><button className="danger" onClick={()=>{onAction("delete");setOpen(false)}}><Trash2 size={15}/>Delete</button></div>}</div>;
}

function Composer({value,setValue,attachments,setAttachments,loading,onSend,onStop,onVoice,sendOnEnter,webSearch,setWebSearch,memoryEnabled,setMemoryEnabled,toolMode,setToolMode,plan,hideTools=false,hideWebSearch=false,onToolNotice,skillId=null,setSkillId,spatialMode=false,onSpatialMode,missionMode=false,onMissionMode}:{value:string;setValue:(v:string)=>void;attachments:Attachment[];setAttachments:React.Dispatch<React.SetStateAction<Attachment[]>>;loading:boolean;onSend:()=>void;onStop:()=>void;onVoice:()=>void;sendOnEnter:boolean;webSearch:boolean;setWebSearch:(v:boolean)=>void;memoryEnabled:boolean;setMemoryEnabled:(v:boolean)=>void;toolMode:ToolMode;setToolMode:(v:ToolMode)=>void;plan:string;hideTools?:boolean;hideWebSearch?:boolean;onToolNotice:(message:string)=>void;skillId?:SkillId;setSkillId?:(id:SkillId)=>void;spatialMode?:boolean;onSpatialMode?:()=>void;missionMode?:boolean;onMissionMode?:(enabled:boolean)=>void}){
  const [open,setOpen]=useState(false);
  const fileRef=useRef<HTMLInputElement>(null), imageRef=useRef<HTMLInputElement>(null), cameraRef=useRef<HTMLInputElement>(null), textRef=useRef<HTMLTextAreaElement>(null);
  const resizeInput=useCallback(()=>{const t=textRef.current;if(!t)return;t.style.height="52px";const next=Math.min(140,Math.max(52,t.scrollHeight));t.style.height=next+"px"},[]);
  useEffect(()=>{resizeInput()},[value,resizeInput]);
  const submit=useCallback(()=>{const t=textRef.current;if(t)t.style.height="52px";onSend()},[onSend]);
  const add=(list:FileList|null)=>{if(!list)return;Array.from(list).slice(0,10-attachments.length).forEach(file=>{const r=new FileReader();r.onload=()=>setAttachments(p=>[...p,{id:uid(),kind:file.type.startsWith("image/")?"image":"file",name:file.name,mime:file.type,data:String(r.result||""),size:file.size}]);r.readAsDataURL(file)})};
  return <div className="composer-wrap">
    {!!attachments.length&&<div className="attachment-strip">{attachments.map(a=><div className="attachment-card" key={a.id}>{a.kind==="image"?<img src={a.data} alt=""/>:<div className="file-icon"><FileIcon size={18}/></div>}<div><b>{a.name}</b><span>{Math.max(1,Math.round(a.size/1024))} KB</span></div><button onClick={()=>setAttachments(p=>p.filter(x=>x.id!==a.id))}><X size={14}/></button></div>)}</div>}
    <div className="composer" data-liquid-glass="composer"><LiquidGlassBackdrop className="composer-glass-layer" options={{profile:"bar",variant:"regular",preset:"balanced",scheme:"adaptive",radius:22,backdropSource:".cookie-ambient-scene"}}/>
      <div className="composer-left">
      <div className="attach-wrap"><button className="composer-icon" aria-label="Add" onClick={()=>setOpen(v=>!v)}><Plus size={21}/></button>{open&&<div className="attach-menu popover-pop">
        <LiquidGlassBackdrop className="menu-glass-layer" options={{profile:"panel",variant:"regular",preset:"balanced",scheme:"adaptive",radius:12,backdropSource:".cookie-ambient-scene"}}/>
        <button onClick={()=>{imageRef.current?.click();setOpen(false)}}><ImageIcon size={18}/><span>Photos & images</span></button>
        <button onClick={()=>{cameraRef.current?.click();setOpen(false)}}><ImageIcon size={18}/><span>Camera</span></button>
        <button onClick={()=>{fileRef.current?.click();setOpen(false)}}><FilePlus2 size={18}/><span>Upload files</span></button>
        <button onClick={()=>{setOpen(false);setValue("Create an image of ");requestAnimationFrame(()=>textRef.current?.focus())}}><ImagePlus size={18}/><span>Create image</span></button>
        {!hideWebSearch&&<button className={webSearch?"active":""} onClick={()=>{setWebSearch(!webSearch);setOpen(false);textRef.current?.focus()}}><Globe2 size={18}/><span>{webSearch?"Web research on":"Search the web"}</span></button>}
       </div>}</div>
      <textarea ref={textRef} value={value} onChange={e=>{setValue(e.target.value);requestAnimationFrame(resizeInput)}} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey&&sendOnEnter){e.preventDefault();submit()}}} onBlur={()=>requestAnimationFrame(resizeInput)} placeholder="Message Cookie" rows={1}/>
      <div className="composer-right">{loading?<button className="composer-icon stop" onClick={onStop}><Square size={14} fill="currentColor"/></button>:<button className="composer-icon" onClick={onVoice}><Volume2 size={19}/></button>}{loading?<span className="generating-pill">Generating…</span>:<button className={"send-button "+(!(value.trim()||attachments.length)?"disabled":"")} disabled={!value.trim()&&!attachments.length} onClick={submit}><ArrowUp size={19}/></button>}</div>
    </div>
     </div>
    <div className="composer-note">Cookie can make mistakes. Check important info.</div>
    <input hidden ref={imageRef} type="file" accept="image/*" multiple onChange={e=>{add(e.target.files);e.currentTarget.value=""}}/>
    <input hidden ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={e=>{add(e.target.files);e.currentTarget.value=""}}/>
    <input hidden ref={fileRef} type="file" multiple onChange={e=>{add(e.target.files);e.currentTarget.value=""}}/>
  </div>;
}
function activityIcon(stage:string,tool?:string){
  const t=String(tool||"").toLowerCase();
  if(stage==="command"||t.includes("terminal")||t.includes("command")) return <SquareTerminal size={13}/>;
  if(t.includes("web")||stage==="search") return <Globe2 size={13}/>;
  if(t.includes("image")) return <ImagePlus size={13}/>;
  if(t.includes("file")) return <FileSearch size={13}/>;
  if(t.includes("memory")) return <Brain size={13}/>;
  if(stage==="provider") return <Zap size={13}/>;
  if(stage==="thinking") return <Brain size={13}/>;
  return <Wrench size={13}/>;
}
function ActivityTimeline({steps,elapsed,live=false}:{steps:ActivityStep[];elapsed:number;live?:boolean}){
  const [open,setOpen]=useState(false);
  const [expanded,setExpanded]=useState<string|null>(null);
  if(!steps.length)return null;
  const mins=Math.floor(elapsed/60000);
  const secs=Math.floor((elapsed%60000)/1000);
  const duration=(mins?mins+"m ":"")+String(secs).padStart(2,"0")+"s";
  const hasWork=steps.some(s=>s.stage!=="thinking");
  const title=live?(hasWork?"Working…":"Thinking…"):"Worked for "+duration;
  const hasDetails=steps.some(s=>s.command||s.output||s.meta||s.domain);
  return <div className="activity-timeline">
    <button className="activity-summary" onClick={()=>setOpen(v=>!v)} type="button">
      {live&&<span className="activity-spinner"/>}
      <span className="activity-summary-copy"><b>{title}</b></span>
      {(open||hasDetails)&&<ChevronDown size={15} className={open?"rot":""}/>}
    </button>
    {open&&<div className="activity-steps">
      {steps.map((s,i)=>{
        const hasBlock=Boolean(s.command||s.output||s.meta||s.domain);
        const isOpen=expanded===s.id;
        return <div className={"activity-step-wrap "+(hasBlock?"has-block":"")} key={s.id||i}>
          <button className="activity-step" type="button" onClick={()=>hasBlock&&setExpanded(isOpen?null:s.id)}>
            <span className={"activity-step-icon "+(s.done?"done":"")}>
              {s.done?activityIcon(s.stage,s.tool):<span className="activity-inline-spinner"/>}
            </span>
            <span className="activity-step-copy"><b>{s.label}</b>{s.detail&&s.detail!==s.label&&<small>{s.detail}</small>}</span>
            {hasBlock&&<ChevronDown size={12} className={isOpen?"rot":""}/>}
          </button>
          {isOpen&&<div className="activity-detail">
            {s.domain&&<div className="activity-domains">{s.domain.split(" · ").filter(Boolean).map((d,j)=><span className="activity-domain" key={j}>{d}</span>)}</div>}
            {s.command&&<pre className="activity-terminal"><code>{s.command}</code></pre>}
            {s.output&&<pre className="activity-terminal activity-output"><strong>output</strong>{"\n"}{s.output}</pre>}
            {s.meta&&<div className="activity-meta">{s.meta}</div>}
          </div>}
        </div>;
      })}
    </div>}
  </div>;
}

function ChatView({chat,onSend,loading,onStop,onVoice,onCopy,onRetry,onDelete,onShare,onDownload,onEdit,onFork,onSave,onInspectSources,onQuickAction,streamText="",streamStatus="",streamEvents=[],streamElapsed=0,spatialMode=false}:{chat:Chat|null;onSend:(text:string)=>void;loading:boolean;onStop:()=>void;onVoice:()=>void;onCopy:(m:Message)=>void;onRetry:(m:Message)=>void;onDelete:(m:Message)=>void;onShare:()=>void;onDownload:(f:GeneratedFile)=>void;onEdit:(m:Message)=>void;onFork:(m:Message)=>void;onSave:(m:Message)=>void;onInspectSources:(m:Message)=>void;onQuickAction:(prompt:string)=>void;streamText?:string;streamStatus?:string;streamEvents?:ActivityStep[];streamElapsed?:number;activity?:ActivityStep[];activityDuration?:number;spatialMode?:boolean}){
  const ref=useRef<HTMLDivElement>(null);
  const [showJump,setShowJump]=useState(false);
  const jumpToLatest=useCallback(()=>{
    const el=ref.current;if(!el)return;
    el.scrollTo({top:el.scrollHeight,behavior:"smooth"});
    setShowJump(false);
  },[]);
  useEffect(()=>{
    const el=ref.current;
    if(!el)return;
    const onScroll=()=>{
      const distance=el.scrollHeight-el.scrollTop-el.clientHeight;
      setShowJump(distance>260);
    };
    onScroll();
    el.addEventListener("scroll",onScroll,{passive:true});
    return()=>el.removeEventListener("scroll",onScroll);
  },[]);
  useEffect(()=>{
    const el=ref.current;
    if(!el)return;
    const nearBottom=el.scrollHeight-el.scrollTop-el.clientHeight<160;
    if(nearBottom) el.scrollTop=el.scrollHeight;
  },[chat?.messages.length,loading,streamText]);
  const messages=chat?.messages||[];
  const starters=[
    ["Explain something","Teach me a difficult topic simply, then quiz me.",BookOpen],
    ["Research live","Research the latest information and cite your sources.",Globe2],
    ["Analyze a file","I’ll attach a file. Find the important points and explain them.",FileSearch],
    ["Build something","Help me build a production-ready solution step by step.",Code2]
  ];
  return <div className="chat-view"><div className="chat-scroll" ref={ref} role="log" aria-live="polite" aria-atomic="false" aria-label="Cookie conversation">{!messages.length?<div className="empty">{spatialMode&&<div className="spatial-hero" aria-hidden="true"><div className="spatial-core"><CookieIcon size={38}/></div><i/><i/><i/><span>SPATIAL WORKSPACE</span></div>}<div className="empty-cookie"><CookieIcon size={34}/></div><h1>What can I help with?</h1><p>Ask anything, or start with one of these.</p><div className="starter-prompts">{starters.map(([label,prompt,Icon])=>{const I=Icon as React.ComponentType<{size?:number}>;return <button key={String(label)} onClick={()=>onSend(String(prompt))}><span><I size={16}/><b>{String(label)}</b></span><ChevronRight size={15}/></button>})}</div></div>:<div className="messages">{messages.map(m=><div className={"message-row "+m.role} key={m.id}><div className="message-body">{m.role==="assistant"&&m.activity?.length?<ActivityTimeline steps={m.activity} elapsed={m.activityDuration||0}/>:null}{m.attachments?.length?<div className="sent-files">{m.attachments.map(a=><div className="sent-file" key={a.id}>{a.kind==="image"?<img src={a.data} alt={a.name}/>:<FileIcon size={17}/>}<span>{a.name}</span></div>)}</div>:null}{m.role==="assistant"?<Rich text={m.content}/>:<div className="user-content">{m.content}</div>}{m.images?.length?<div className="generated-images">{m.images.map((img,i)=><a className="generated-image" key={img.dataUrl+i} href={img.dataUrl} target="_blank" rel="noreferrer" download={"cookie-image-"+(i+1)+".png"}><img src={img.dataUrl} alt={img.prompt||"Generated image"}/><span>Open image</span></a>)}</div>:null}{m.files?.length?<div className="generated-list">{m.files.map(f=><button key={f.path} className="generated-file" onClick={()=>onDownload(f)}><FileIcon size={18}/><span><b>{f.name}</b><small>{f.path}</small></span><Download size={16}/></button>)}</div>:null}{m.sources?.length?<div className="message-sources"><button className="message-sources-head" type="button" onClick={()=>onInspectSources(m)}><Globe2 size={13}/><span>Sources</span><b>{m.sources.length}</b><ExternalLink size={12}/></button><div className="message-sources-list">{m.sources.slice(0,4).map((src,i)=><a key={src.url+i} href={src.url} target="_blank" rel="noreferrer"><span className="source-domain">{src.domain||"web"}</span><strong>{src.title||src.domain||"Source"}</strong></a>)}</div></div>:null}{m.role==="assistant"&&<div className="message-quick-actions"><button onClick={()=>onQuickAction("Continue from your last answer, adding the most useful next step.")}>Continue</button><button onClick={()=>onQuickAction("Rewrite your last answer in a simpler, clearer way.")}>Simplify</button><button onClick={()=>onQuickAction("Critically challenge your last answer and point out any weak assumptions.")}>Challenge</button></div>}<div className="message-tools"><span>{fmt(m.createdAt)}</span>{m.role==="user"&&<button onClick={()=>onEdit(m)} aria-label="Edit message"><Pencil size={14}/></button>}<button onClick={()=>onFork(m)} aria-label="Fork conversation from this message"><GitBranch size={14}/></button>{m.role==="assistant"&&<button onClick={()=>onSave(m)} aria-label="Save to workspace"><Bookmark size={14}/></button>}<button onClick={()=>onCopy(m)} aria-label="Copy"><Copy size={14}/></button>{m.role==="assistant"&&<button onClick={()=>onRetry(m)} aria-label="Retry"><RotateCcw size={14}/></button>}<button onClick={onShare} aria-label="Share"><Share2 size={14}/></button><button onClick={()=>onDelete(m)} aria-label="Delete"><Trash2 size={14}/></button></div></div></div>)}{loading&&<div className="message-row assistant streaming-row"><div className="message-body"><ActivityTimeline steps={streamEvents||[]} elapsed={streamElapsed||0} live/>{streamText&&<div className="stream-reply"><Rich text={streamText}/><span className="stream-caret" aria-hidden="true"/></div>}</div></div>}</div>}{showJump&&<button className="chat-jump-latest" onClick={jumpToLatest} aria-label="Jump to latest response"><ChevronDown size={17}/><span>Latest</span></button>}</div></div>;
}

function ModerationPage({actorRole,onNotice,onError}:{actorRole:string;onNotice:(x:string)=>void;onError:(x:string)=>void}){
  const [users,setUsers]=useState<any[]>([]),[query,setQuery]=useState(""),[selected,setSelected]=useState<any|null>(null),[reason,setReason]=useState(""),[days,setDays]=useState("1"),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
  const load=async()=>{
    setLoading(true);
    try{
      const r=await fetch("/api/admin?mode=moderation",{credentials:"same-origin",cache:"no-store"}),d=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(d?.error||"Could not load moderation users.");
      setUsers(Array.isArray(d.users)?d.users:[]);
    }catch(e:any){onError(e?.message||"Could not load moderation users.");}
    finally{setLoading(false)}
  };
  useEffect(()=>{load()},[]);
  const act=async(action:string)=>{
    if(!selected||busy)return;
    if(["warn","suspend","ban"].includes(action)&&!reason.trim()){onError("Add a moderation reason first.");return}
    setBusy(true);
    try{
      const r=await fetch("/api/admin",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({action,email:selected.email,reason:reason.trim(),days:Number(days||1)})});
      const d=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(d?.error||"Moderation action failed.");
      onNotice(action==="warn"?"Warning recorded":action==="suspend"?"Account suspended":action==="ban"?"Account banned":"Account restored");
      setReason("");await load();setSelected(null);
    }catch(e:any){onError(e?.message||"Moderation action failed")}finally{setBusy(false)}
  };
  const filtered=users.filter(u=>{const q=query.trim().toLowerCase();return !q||[u.email,u.name,u.username,u.role,u.status].some(v=>String(v||"").toLowerCase().includes(q))}).slice(0,120);
  const count=(status:string)=>users.filter(u=>String(u.status||"active").toLowerCase()===status).length;
  const initials=(u:any)=>String(u.name||u.username||u.email||"?").trim().split(/\s+/).slice(0,2).map((x:string)=>x[0]).join("").toUpperCase()||"?";
  const status=(u:any)=>String(u.status||"active").toLowerCase();
  return <div className="moderation-page">
    <div className="moderation-hero">
      <div className="moderation-hero-copy">
        <span className="moderation-kicker"><ShieldAlert size={14}/> ACCOUNT SAFETY</span>
        <div className="moderation-title-row"><h1>Moderation</h1><span className="moderation-role">{actorRole}</span></div>
        <p>Review account activity and take action without touching plans, credits or roles.</p>
      </div>
      <button className="moderation-refresh" onClick={load} disabled={loading} aria-label="Refresh accounts"><RotateCcw size={15}/><span>{loading?"Refreshing":"Refresh"}</span></button>
    </div>
    <div className="moderation-overview">
      <div><span>Total</span><strong>{users.length}</strong></div><div><span>Active</span><strong>{count("active")}</strong></div><div><span>Suspended</span><strong>{count("suspended")}</strong></div><div><span>Banned</span><strong>{count("banned")}</strong></div>
    </div>
    <div className="moderation-workspace">
      <section className="moderation-users">
        <div className="moderation-users-head"><div><strong>Accounts</strong><span>{loading?"Loading…":filtered.length+" shown"}</span></div><div className="moderation-search"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search accounts"/></div></div>
        <div className="moderation-list">{loading?<div className="moderation-loading"><span className="moderation-spinner"/><span>Loading accounts</span></div>:filtered.map(u=><button key={u.id} className={"moderation-user-row "+(selected?.id===u.id?"selected":"")} onClick={()=>setSelected(u)}><span className="moderation-avatar">{initials(u)}</span><span className="moderation-user-main"><b>{u.name||u.username||u.email}</b><small>{u.email}</small></span><span className="moderation-user-meta"><span className={"moderation-user-status "+status(u)}><i/>{status(u)}</span><small>{u.role||"user"}</small></span><ChevronRight size={16}/></button>)}</div>
        {!loading&&!filtered.length&&<div className="moderation-empty-list"><Search size={22}/><strong>No matching accounts</strong><span>Try a different name, email, role or status.</span></div>}
      </section>
      {selected&&<section className="moderation-card">
          <div className="moderation-target"><div className="moderation-target-identity"><span className="moderation-target-avatar">{initials(selected)}</span><div><span>Selected account</span><h2>{selected.name||selected.username||selected.email}</h2><small>{selected.email}</small></div></div><span className={"moderation-status "+status(selected)}><i/>{status(selected)}</span></div>
          <div className="moderation-reason-head"><span>Action reason</span><small>Required for warnings and restrictions</small></div>
          <textarea className="moderation-reason" value={reason} onChange={e=>setReason(e.target.value)} placeholder="Describe what happened and why this action is appropriate…"/>
          <div className="moderation-controls"><label><span>Suspension duration</span><div className="moderation-days-input"><input inputMode="numeric" value={days} onChange={e=>setDays(e.target.value.replace(/\D/g,"").slice(0,3)||"1")}/><small>days</small></div></label></div>
          <div className="moderation-actions">
            <button className="moderation-action warn" onClick={()=>act("warn")} disabled={busy}><ShieldAlert size={15}/><span><b>Warn</b><small>Record a warning</small></span></button>
            {selected.status==="suspended"?<button className="moderation-action safe" onClick={()=>act("unsuspend")} disabled={busy}><Check size={15}/><span><b>Restore</b><small>Remove suspension</small></span></button>:<button className="moderation-action" onClick={()=>act("suspend")} disabled={busy}><Archive size={15}/><span><b>Suspend</b><small>Temporarily restrict</small></span></button>}
            {selected.status==="banned"?<button className="moderation-action safe" onClick={()=>act("unban")} disabled={busy}><Check size={15}/><span><b>Restore</b><small>Remove ban</small></span></button>:<button className="moderation-action danger" onClick={()=>act("ban")} disabled={busy}><Trash2 size={15}/><span><b>Ban</b><small>Block the account</small></span></button>}
          </div>
        </section>}
    </div>
  </div>;
}

function AdminPage({actorRole,onNotice,onError,focusAudit=false}:{actorRole:string;onNotice:(x:string)=>void;onError:(x:string)=>void;focusAudit?:boolean}){
  const [users,setUsers]=useState<any[]>([]),[stats,setStats]=useState<any>(null),[limits,setLimits]=useState<any>(null),[logs,setLogs]=useState<any[]>([]),[query,setQuery]=useState(""),[logQuery,setLogQuery]=useState(""),[selected,setSelected]=useState<any|null>(null),[plan,setPlan]=useState("free"),[role,setRole]=useState("user"),[credits,setCredits]=useState("0"),[expires,setExpires]=useState("0"),[delta,setDelta]=useState(""),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[logLoading,setLogLoading]=useState(false),[limitDraft,setLimitDraft]=useState<any>({});
  const loadLogs=async()=>{if(!["owner","admin"].includes(actorRole))return;setLogLoading(true);try{const r=await fetch("/api/admin?mode=audit",{credentials:"same-origin",cache:"no-store"}),d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d?.error||"Could not load audit logs.");setLogs(Array.isArray(d.logs)?d.logs:[])}catch(e:any){onError(e?.message||"Could not load audit logs.")}finally{setLogLoading(false)}};
  const load=async()=>{setLoading(true);try{const r=await fetch("/api/admin",{credentials:"same-origin",cache:"no-store"}),d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d?.error||"Could not load admin data.");setUsers(Array.isArray(d.users)?d.users:[]);setStats(d.stats||null);setLimits(d.limits||null);setLimitDraft(d.limits||{});if(["owner","admin"].includes(actorRole))await loadLogs();}catch(e:any){onError(e?.message||"Could not load admin data.")}finally{setLoading(false)}};
  useEffect(()=>{load()},[actorRole]);
  useEffect(()=>{if(!focusAudit||!["owner","admin"].includes(actorRole))return;const timer=window.setTimeout(()=>document.querySelector(".admin-audit")?.scrollIntoView({behavior:"smooth",block:"start"}),120);return()=>window.clearTimeout(timer)},[focusAudit,actorRole]);
  const choose=(u:any)=>{setSelected(u);setPlan(String(u.plan||"free"));setRole(String(u.role||"user"));setCredits(String(Number(u.credits||0)));setExpires(String(Number(u.planExpiresAt||0)));setDelta("")};
  const post=async(body:any,success:string)=>{setBusy(true);try{const r=await fetch("/api/admin",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify(body)}),d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d?.error||"Admin action failed.");onNotice(success);await load();if(selected){const email=selected.email;const fresh=(d?.user)||users.find(x=>x.email===email);if(fresh)choose(fresh)}}catch(e:any){onError(e?.message||"Admin action failed")}finally{setBusy(false)}};
  const save=()=>selected&&post({action:"user",email:selected.email,plan,role,credits:Number(credits||0),planExpiresAt:Number(expires||0)},"Account updated");
  const credit=()=>selected&&delta.trim()&&post({action:"credit",email:selected.email,delta:Number(delta)},Number(delta)>0?"Credits added":"Credits adjusted");
  const emailReset=()=>{if(!selected||busy)return;if(!window.confirm("Send a secure Cookie password reset email to "+selected.email+"?"))return;post({action:"reset_password",email:selected.email},"Password reset email sent");};
  const filtered=users.filter(u=>{const q=query.trim().toLowerCase();return !q||[u.email,u.name,u.username,u.plan,u.role].some(v=>String(v||"").toLowerCase().includes(q))});
  const filteredLogs=logs.filter(l=>{const q=logQuery.trim().toLowerCase();return !q||[l.action,l.actorEmail,l.actorName,l.actorRole,l.targetEmail,l.targetName,JSON.stringify(l.metadata||{})].some(v=>String(v||"").toLowerCase().includes(q))}).slice(0,500);
  const stat=(key:string)=>Number(stats?.[key]||0);
  const formatAudit=(ts:number)=>{try{return new Intl.DateTimeFormat(undefined,{dateStyle:"medium",timeStyle:"medium"}).format(ts*1000)}catch{return ""}};
  return <div className="admin-page">
    <div className="admin-hero"><div><span className="admin-kicker"><BarChart3 size={14}/> ADMIN CONTROL</span><div className="admin-title-row"><h1>Admin</h1><span className="admin-role">{actorRole}</span></div><p>Manage Cookie accounts, plans, credits, roles and platform limits.</p></div><button className="admin-refresh" onClick={load} disabled={loading}><RotateCcw size={15}/>{loading?"Refreshing":"Refresh"}</button></div>
    <div className="admin-stats"><div><span>Users</span><strong>{stat("users")}</strong></div><div><span>24h usage</span><strong>{(stats?.usage24h||[]).reduce((n:any,x:any)=>n+Number(x.count||0),0)}</strong></div><div><span>Free</span><strong>{Number((stats?.plans||[]).find((x:any)=>x.plan==="free")?.count||0)}</strong></div><div><span>Paid</span><strong>{(stats?.plans||[]).filter((x:any)=>x.plan!=="free").reduce((n:any,x:any)=>n+Number(x.count||0),0)}</strong></div></div>
    <div className="admin-layout"><section className="admin-users"><div className="admin-section-head"><div><b>Accounts</b><span>{filtered.length} shown</span></div><div className="admin-search"><Search size={14}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search accounts"/></div></div><div className="admin-user-list">{loading?<div className="admin-empty">Loading accounts…</div>:filtered.slice(0,200).map(u=><button key={u.id} className={"admin-user "+(selected?.id===u.id?"selected":"")} onClick={()=>choose(u)}><span className="admin-avatar">{String(u.name||u.username||u.email||"?").trim().slice(0,1).toUpperCase()}</span><span className="admin-user-copy"><b>{u.name||u.username||"Unnamed"}</b><small>{u.email}</small></span><span className="admin-user-meta"><b>{u.plan}</b><small>{u.credits} credits · {u.role}</small></span></button>)}{!loading&&!filtered.length&&<div className="admin-empty">No accounts found.</div>}</div></section>
      <section className="admin-editor">{selected?<><div className="admin-editor-head"><div><span>ACCOUNT</span><h2>{selected.name||selected.username||"Unnamed account"}</h2><p>{selected.email}</p></div><span className="admin-id">{selected.role}</span></div><div className="admin-fields"><label>Plan<select value={plan} onChange={e=>setPlan(e.target.value)}><option value="free">Free</option><option value="pro">Pro</option><option value="max">MAX</option></select></label><label>Role<select value={role} onChange={e=>setRole(e.target.value)}><option value="user">User</option><option value="vip">VIP</option><option value="staff">Staff</option><option value="admin">Admin</option><option value="owner">Owner</option></select></label><label>Credits<input type="number" value={credits} onChange={e=>setCredits(e.target.value)}/></label><label>Plan expiry (Unix seconds)<input type="number" value={expires} onChange={e=>setExpires(e.target.value)} placeholder="0 = none"/></label></div><div className="admin-credit-row"><input type="number" value={delta} onChange={e=>setDelta(e.target.value)} placeholder="+100 or -100"/><button onClick={credit} disabled={busy||!delta}>Adjust credits</button></div><div className="admin-actions"><button className="primary" onClick={save} disabled={busy}>Save account</button><button onClick={()=>post({action:"gift",email:selected.email,plan:"pro",days:30,credits:100},"30-day Pro + 100 credits gifted") } disabled={busy}>Gift 30-day Pro + 100</button><button onClick={emailReset} disabled={busy}><Mail size={15}/>Email password reset</button></div></>:<div className="admin-empty admin-editor-empty"><BarChart3 size={24}/><b>Select an account</b><span>Plans, credits and roles appear here.</span></div>}
      <div className="admin-limits"><div><b>Platform limits</b><span>Owner/admin controls</span></div>{limits&&<div className="admin-limit-grid">{["chat_limit_free","chat_limit_pro","chat_limit_max","image_limit_free","image_limit_pro","image_limit_max"].map(k=><label key={k}>{k.replaceAll("_"," ")}<input type="number" value={limitDraft[k]??limits[k]??10} onChange={e=>setLimitDraft((x:any)=>({...x,[k]:e.target.value}))}/></label>)}</div>}<button onClick={()=>post({action:"limits",limits:limitDraft},"Platform limits saved")} disabled={busy}>Save limits</button></div>
      </section></div>
    {["owner","admin"].includes(actorRole)&&<section className="admin-audit">
      <div className="admin-audit-head"><div><span>AUDIT</span><h2>Admin activity</h2><p>Every privileged account action is recorded here.</p></div><button className="admin-refresh" onClick={loadLogs} disabled={logLoading}><RotateCcw size={15}/>{logLoading?"Refreshing":"Refresh logs"}</button></div>
      <div className="admin-audit-tools"><div className="admin-audit-search"><Search size={14}/><input value={logQuery} onChange={e=>setLogQuery(e.target.value)} placeholder="Filter actions, accounts, actors"/></div><span>{filteredLogs.length} shown · {logs.length} loaded</span></div>
      <div className="admin-audit-list">{logLoading&&!logs.length?<div className="admin-empty">Loading audit log…</div>:filteredLogs.length?filteredLogs.map(l=><div className="admin-audit-row" key={l.id}>
        <div className="admin-audit-main"><strong>{String(l.action||"admin action").replaceAll("_"," ")}</strong><span>{l.actorName||l.actorEmail||"Unknown"} · {l.actorRole||"admin"}{l.targetEmail?" → "+l.targetEmail:""}</span></div>
        <div className="admin-audit-meta">{l.success?<span className="success">Success</span>:<span className="failure">Failed</span>}<time>{formatAudit(Number(l.createdAt||0))}</time></div>
        {l.metadata&&Object.keys(l.metadata).length>0&&<div className="admin-audit-detail">{Object.entries(l.metadata).slice(0,8).map(([k,v])=><span key={k}><b>{k.replaceAll("_"," ")}</b>{String(v)}</span>)}</div>}
      </div>):<div className="admin-empty">No matching audit entries.</div>}</div>
    </section>}
  </div>;
}

function SettingsPage({tab,setTab,settings,setSettings,profile,setProfile,setModel,authUser,onNavigate}:{tab:SettingsTab;setTab:(t:SettingsTab)=>void;settings:any;setSettings:React.Dispatch<React.SetStateAction<any>>;profile:any;setProfile:React.Dispatch<React.SetStateAction<any>>;setModel:(m:string)=>void;authUser:AuthUser;onNavigate:(view:View)=>void}){
  const tabs:[SettingsTab,string,React.ReactNode][]=[
    ["general","General",<SettingsIcon size={17}/>],["personalization","Personalization",<Brain size={17}/>],
    ["data","Data controls",<LockKeyhole size={17}/>],["notifications","Notifications",<Bell size={17}/>],
    ["voice","Voice",<Volume2 size={17}/>],["account","Account",<UserRound size={17}/>],["about","About",<Info size={17}/>]
  ];
  const [mobileHome,setMobileHome]=useState(tab==="general");
  const [saveState,setSaveState]=useState<""|"saving"|"saved"|"error">("");
  const [passwords,setPasswords]=useState({current:"",next:"",confirm:""});
  const [securityState,setSecurityState]=useState("");
  useEffect(()=>{if(tab!=="general")setMobileHome(false)},[tab]);
  const Toggle=({k}:{k:string})=><button type="button" className={"toggle "+(settings[k]?"on":"")} aria-pressed={!!settings[k]} onClick={()=>setSettings((s:any)=>({...s,[k]:!s[k]}))}><span/></button>;
  const openTab=(id:SettingsTab)=>{setTab(id);setMobileHome(false)};
  const Row=({title,desc,children,icon,button}:{title:string;desc:string;children?:React.ReactNode;icon?:React.ReactNode;button?:boolean})=><div className={"set-row "+(button?"set-row-button":"")}><div className="set-row-copy">{icon&&<span className="set-row-icon">{icon}</span>}<div><b>{title}</b><span>{desc}</span></div></div>{children&&<div className="set-row-control">{children}</div>}</div>;
  const GlassCard=({children,className=""}:{children:React.ReactNode;className?:string})=><div className={"settings-card settings-material-card "+className}>{children}</div>;

  const persistSettings=async(next:any)=>{
    setSettings(next);
    setSaveState("saving");
    try{
      const r=await fetch("/api/settings",{method:"PATCH",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({settings:next})});
      if(!r.ok)throw new Error();
      setSaveState("saved");window.setTimeout(()=>setSaveState(""),1400);
    }catch{setSaveState("error")}
  };
  const update=(key:string,value:any)=>{const next={...settings,[key]:value};setSettings(next);setSaveState("saving");window.clearTimeout((window as any).__cookieSettingsSave);(window as any).__cookieSettingsSave=window.setTimeout(async()=>{try{const r=await fetch("/api/settings",{method:"PATCH",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({settings:next})});if(!r.ok)throw new Error();setSaveState("saved");window.setTimeout(()=>setSaveState(""),1200)}catch{setSaveState("error")}},350)};
  const downloadData=async()=>{
    try{
      const r=await fetch("/api/settings?action=export",{credentials:"same-origin",cache:"no-store"});const d=await r.json();if(!r.ok)throw new Error(d?.error||"Could not export data.");
      const blob=new Blob([JSON.stringify({...d,settings},null,2)],{type:"application/json"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="cookie-data.json";a.click();URL.revokeObjectURL(url);
    }catch{setSaveState("error")}
  };
  const deleteChats=async()=>{
    if(settings.confirmDelete&&!window.confirm("Delete all saved Cookie chats from your account and this browser? This cannot be undone."))return;
    try{
      const r=await fetch("/api/settings",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"delete_chats"})});
      if(!r.ok)throw new Error();localStorage.removeItem("cookie_chats");location.reload();
    }catch{setSaveState("error")}
  };
  const changePassword=async()=>{
    setSecurityState("saving");
    if(passwords.next.length<10||passwords.next!==passwords.confirm){setSecurityState("New passwords must match and be at least 10 characters.");return}
    try{
      const r=await fetch("/api/settings",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"change_password",currentPassword:passwords.current,newPassword:passwords.next})});
      const d=await r.json();if(!r.ok)throw new Error(d?.error||"Could not change password.");
      setPasswords({current:"",next:"",confirm:""});setSecurityState("Password changed.");window.setTimeout(()=>setSecurityState(""),1800);
    }catch(e:any){setSecurityState(e?.message||"Could not change password.")}
  };
  const signOutOtherDevices=async()=>{
    if(!window.confirm("Sign out Cookie on every other device?"))return;
    try{const r=await fetch("/api/settings",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"sign_out_other_devices"})});if(!r.ok)throw new Error();setSecurityState("Other sessions signed out.");window.setTimeout(()=>setSecurityState(""),1800)}catch{setSecurityState("Could not sign out other sessions.")}
  };

  return <div className="settings-page">
    <aside><h2>Settings</h2><div className="settings-nav-group">{tabs.map(([id,label,icon])=><button className={tab===id?"selected":""} key={id} onClick={()=>openTab(id)}>{icon}<span>{label}</span><ChevronRight className="settings-nav-chevron" size={16}/></button>)}</div></aside>
    <div className={"settings-mobile-home "+(mobileHome?"show":"")}><div className="settings-home-heading"><div><span className="settings-eyebrow">Cookie AI</span><h1>Settings</h1></div><SettingsIcon size={24}/></div><div className="settings-home-list">{tabs.map(([id,label,icon])=><button key={id} onClick={()=>openTab(id)}><span className="settings-home-label"><span className={"settings-home-icon settings-home-"+id}>{icon}</span><span>{label}</span></span><ChevronRight size={18}/></button>)}</div></div>
    <main className={mobileHome?"mobile-hidden":""}>
      <button className="settings-mobile-back" onClick={()=>setMobileHome(true)} aria-label="Back to settings"><ChevronLeft size={18}/><span>{tabs.find(([id])=>id===tab)?.[1]||"Settings"}</span></button>

      {tab==="general"&&<section><h1>General</h1>
        <div className="settings-group"><div className="settings-group-title">Appearance</div><GlassCard>
          <Row title="Theme" desc="Choose how Cookie looks."><select value={settings.theme} onChange={e=>update("theme",e.target.value)}><option>System</option><option>Light</option><option>Dark</option></select></Row>
          <Row title="Accent color" desc="Choose the highlight color used by Cookie."><select value={settings.accent} onChange={e=>update("accent",e.target.value)}><option>Default</option><option>Blue</option><option>Green</option><option>Purple</option><option>Orange</option></select></Row>
          <Row title="Text size" desc="Adjust reading size in conversations."><select value={settings.fontSize} onChange={e=>update("fontSize",e.target.value)}><option>Default</option><option>Small</option><option>Large</option></select></Row>
          <Row title="Compact mode" desc="Use tighter spacing in chats and lists."><Toggle k="compact"/></Row><Row title="Animations" desc="Use motion and transitions throughout Cookie."><Toggle k="animations"/></Row>
        </GlassCard></div>
        <div className="settings-group"><div className="settings-group-title">Chat behavior</div><GlassCard>
          <Row title="Send on Enter" desc="Press Enter to send. Shift + Enter adds a new line."><Toggle k="sendOnEnter"/></Row><Row title="Show message times" desc="Display the time under each message."><Toggle k="timestamps"/></Row><Row title="Confirm before deleting" desc="Ask before removing chats or clearing history."><Toggle k="confirmDelete"/></Row>
        </GlassCard></div>
        <div className="settings-group"><div className="settings-group-title">Interface</div><GlassCard>
          <Row title="Interface language" desc="Choose Cookie's interface language."><select value={settings.language} onChange={e=>update("language",e.target.value)}>{LANGUAGES.map(l=><option key={l}>{l}</option>)}</select></Row>
          <Row title="Keyboard shortcuts" desc="Enable ⌘K / Ctrl+K and other shortcuts."><Toggle k="keyboard"/></Row>
          <Row title="Default model" desc="Model Cookie should use for new chats."><select value={settings.defaultModel||"standard"} onChange={e=>{update("defaultModel",e.target.value);setModel(e.target.value)}}>{MODELS.map(m=><option key={m.id} value={m.id} disabled={!((authUser.plan==="max"||authUser.role==="owner"||authUser.role==="admin")||modelRank(m.id)<=planRankClient(authUser.plan))}>{m.name}</option>)}</select></Row>
        </GlassCard></div>
        {saveState&&<div className="settings-sync-status">{saveState==="saving"?"Saving…":saveState==="saved"?"Saved to your account":"Couldn’t save changes."}</div>}
      </section>}

      {tab==="personalization"&&<section><h1>Personalization</h1>
        <div className="settings-group"><div className="settings-group-title">Response style</div><GlassCard>
          <Row title="AI personality" desc="How Cookie should sound."><select value={settings.personality} onChange={e=>update("personality",e.target.value)}>{PERSONALITIES.map(p=><option key={p}>{p}</option>)}</select></Row>
          <Row title="Reasoning effort" desc="Choose the response effort setting."><select value={settings.reasoning||"auto"} onChange={e=>update("reasoning",e.target.value)}><option value="auto">Auto</option><option value="fast">Fast</option><option value="deep">Deep</option></select></Row>
          <Row title="Answer length" desc="Control the default response length."><select value={settings.answerLength||"auto"} onChange={e=>update("answerLength",e.target.value)}><option value="auto">Auto</option><option value="short">Short</option><option value="detailed">Detailed</option></select></Row>
          <Row title="Memory" desc="Use relevant saved preferences in conversations."><Toggle k="memory"/></Row>
        </GlassCard></div>
        <div className="settings-group"><div className="settings-group-title">Custom instructions</div><GlassCard className="settings-instructions-card"><label className="settings-field-label">What should Cookie know about you?</label><textarea value={settings.instructions} onChange={e=>update("instructions",e.target.value)} placeholder="Tell Cookie about your preferences, goals, or how you like answers written…"/><span className="settings-field-hint">These instructions apply to your conversations while enabled.</span></GlassCard></div>
      </section>}

      {tab==="data"&&<section><h1>Data controls</h1>
        <div className="settings-group"><div className="settings-group-title">Storage</div><GlassCard>
          <Row title="Chat history" desc="Keep conversations in your Cookie account."><Toggle k="history"/></Row>
          <Row title="Product improvement preference" desc="Save your preference for whether eligible conversations may be considered for future product improvement."><Toggle k="improve"/></Row>
        </GlassCard></div>
        <div className="settings-group"><div className="settings-group-title">Your data</div><GlassCard>
          <Row title="Export account data" desc="Download account, chats, Memory, projects, saved items, and settings."><button className="settings-action-button" onClick={downloadData}><Download size={16}/>Export</button></Row>
        </GlassCard></div>
        <div className="settings-group settings-danger-group"><div className="settings-group-title">Delete data</div><div className="danger-zone settings-danger-card"><div><b>Delete all chats</b><span>Remove saved conversations from your Cookie account and this browser.</span></div><button onClick={deleteChats}>Delete all</button></div></div>
      </section>}

      {tab==="notifications"&&<section><h1>Notifications</h1><div className="settings-group"><div className="settings-group-title">Updates</div><GlassCard>
        <Row title="Responses ready" desc="Control response-completion notifications."><Toggle k="notifications"/></Row><Row title="Product updates" desc="Control optional Cookie update emails and notices."><Toggle k="updates"/></Row>
      </GlassCard></div></section>}

      {tab==="voice"&&<section><h1>Voice</h1><div className="settings-group"><div className="settings-group-title">Voice settings</div><GlassCard>
        <Row title="Preferred voice" desc="Voice used by Cookie when available."><select value={settings.voice} onChange={e=>update("voice",e.target.value)}><option>Arbor</option><option>Breeze</option><option>Cove</option><option>Ember</option><option>Juniper</option></select></Row><Row title="Voice captions" desc="Show text while speaking."><Toggle k="captions"/></Row>
      </GlassCard></div></section>}

      {tab==="account"&&<section><h1>Account</h1>
        <div className="settings-group"><div className="settings-group-title">Profile</div><div className="account-card settings-material-card"><Avatar size="lg"/><div className="account-identity"><b>{profile.name||"Cookie user"}</b><span>@{profile.username||"cookie-user"}</span><small>{profile.email||"No email saved"}</small></div><div className="account-meta"><span>{authUser.plan==="free"?"Free plan":authUser.plan}</span><b>{authUser.credits} credits</b></div></div></div>
        <div className="settings-group"><div className="settings-group-title">Profile details</div><GlassCard className="fields settings-fields-card"><label><span>Name</span><input value={profile.name} onChange={e=>setProfile((p:any)=>({...p,name:e.target.value}))}/></label><label><span>Username</span><input value={profile.username} onChange={e=>setProfile((p:any)=>({...p,username:e.target.value}))}/></label><label><span>Email</span><input value={profile.email} readOnly/></label><div className="settings-save-row"><button className="settings-primary-button" onClick={async()=>{setSaveState("saving");try{const r=await fetch("/api/auth/profile",{method:"PATCH",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({name:profile.name,username:profile.username})});const d=await r.json();if(!r.ok)throw new Error(d?.error);setProfile((p:any)=>({...p,name:d.user.name,username:d.user.username}));setSaveState("saved");setTimeout(()=>setSaveState(""),1500)}catch{setSaveState("error")}}} disabled={saveState==="saving"}>{saveState==="saving"?"Saving…":saveState==="saved"?"Saved":"Save profile"}</button>{saveState==="error"&&<span className="settings-save-error">Couldn’t save changes.</span>}</div></GlassCard></div>
        <div className="settings-group"><div className="settings-group-title">Security</div><GlassCard className="settings-security-card"><label><span>Current password</span><input type="password" value={passwords.current} onChange={e=>setPasswords(p=>({...p,current:e.target.value}))}/></label><label><span>New password</span><input type="password" value={passwords.next} onChange={e=>setPasswords(p=>({...p,next:e.target.value}))}/></label><label><span>Confirm new password</span><input type="password" value={passwords.confirm} onChange={e=>setPasswords(p=>({...p,confirm:e.target.value}))}/></label><div className="settings-security-actions"><button className="settings-primary-button" onClick={changePassword} disabled={securityState==="saving"}>{securityState==="saving"?"Changing…":"Change password"}</button><button className="settings-secondary-button" onClick={signOutOtherDevices}>Sign out other devices</button></div>{securityState&&securityState!=="saving"&&<span className="settings-security-status">{securityState}</span>}</GlassCard></div>
      </section>}

      {tab==="about"&&<section><h1>About</h1><div className="settings-group"><div className="about-card settings-material-card"><CookieIcon size={52}/><div><b>Cookie AI</b><span>AI workspace for chat, files, coding and everyday questions.</span><small>Cookie Preview • v4</small></div></div></div>
        <div className="settings-group"><div className="settings-group-title">Support & legal</div><GlassCard>
          <button className="settings-link-row" onClick={()=>onNavigate("help")}><span><CircleHelp size={18}/><b>Help Center</b><small>Browse Cookie help and guides.</small></span><ChevronRight size={19}/></button>
          <button className="settings-link-row" onClick={()=>window.dispatchEvent(new Event("cookie:open-command-palette"))}><span><Keyboard size={18}/><b>Keyboard shortcuts</b><small>Open ⌘K / Ctrl+K to search and navigate.</small></span><ChevronRight size={19}/></button>
          <button className="settings-link-row" onClick={()=>onNavigate("privacy")}><span><LockKeyhole size={18}/><b>Privacy Policy</b><small>Review how Cookie handles information.</small></span><ChevronRight size={19}/></button>
          <button className="settings-link-row" onClick={()=>onNavigate("terms")}><span><FileText size={18}/><b>Terms of Service</b><small>Review the rules for using Cookie.</small></span><ChevronRight size={19}/></button>
        </GlassCard></div>
      </section>}
    </main>
  </div>;
}

function GPTIcon({kind,size=20}:{kind:GPTDefinition["icon"];size?:number}){
  if(kind==="study") return <BookOpen size={size}/>;
  if(kind==="code") return <Code2 size={size}/>;
  if(kind==="writer") return <PenLine size={size}/>;
  if(kind==="research") return <Search size={size}/>;
  if(kind==="data") return <BarChart3 size={size}/>;
  return <Sparkles size={size}/>;
}

function GPTsPage({onOpen,plan}:{onOpen:(id:string)=>void;plan:string}){
  const [q,setQ]=useState("");
  const rank=plan.toLowerCase()==="max"?2:plan.toLowerCase()==="pro"||plan.toLowerCase()==="plus"?1:0;
  const filtered=GPTS.filter(g=>!q||g.name.toLowerCase().includes(q.toLowerCase())||g.description.toLowerCase().includes(q.toLowerCase())||g.category.toLowerCase().includes(q.toLowerCase()));
  return <div className="gpts-page">
    <header className="gpts-nav"><LiquidGlassBackdrop className="gpt-nav-glass-layer" options={{profile:"bar",variant:"regular",preset:"balanced",scheme:"adaptive",radius:0,backdropSource:".cookie-ambient-scene"}}/>
      <div className="gpts-nav-group">
        <button className="gpts-nav-icon" aria-label="Cookie home"><CookieIcon size={22}/></button>
        <div className="gpts-nav-title"><strong>GPTs</strong><span>Cookie AI</span></div>
      </div>
      <div className="gpts-nav-actions">
        <button className="gpts-nav-button" onClick={()=>document.querySelector<HTMLInputElement>(".gpts-search input")?.focus()}><Search size={17}/><span>Search</span></button>
      </div>
    </header>
    <main className="gpts-content">
      <section className="gpts-hero">
        <div className="gpts-hero-icon"><Sparkles size={22}/></div>
        <h1>Explore GPTs</h1>
        <p>Purpose-built Cookie assistants. Each one starts a clean conversation with its own instructions.</p>
        <label className="gpts-search">
          <Search size={18}/>
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search GPTs" aria-label="Search GPTs"/>
          {q&&<button type="button" aria-label="Clear search" onClick={()=>setQ("")}><X size={15}/></button>}
        </label>
      </section>
      <section className="gpts-featured">
        <div className="gpts-section-head"><div><h2>Featured</h2><span>Choose an assistant to start a fresh chat.</span></div><b>{filtered.length}</b></div>
        <div className="gpt-cards">
          {filtered.map(g=>{
            const locked=rank<(g.plan==="max"?2:g.plan==="pro"?1:0);
            return <button className={"gpt-card "+(locked?"locked":"")} key={g.id} onClick={()=>onOpen(g.id)} aria-label={locked?g.name+" requires "+g.plan+" plan":g.name}>
              <div className={"gpt-card-icon "+g.icon}><GPTIcon kind={g.icon} size={21}/></div>
              <div className="gpt-card-body">
                <div className="gpt-card-title"><strong>{g.name}</strong>{g.plan!=="free"&&<span className={"gpt-plan "+g.plan}>{g.plan.toUpperCase()}</span>}</div>
                <p>{g.description}</p>
                <span className="gpt-card-category">{g.category}</span>
              </div>
              <span className="gpt-card-arrow">{locked?<LockKeyhole size={15}/>:<ChevronRight size={17}/>}</span>
            </button>;
          })}
        </div>
        {!filtered.length&&<div className="gpts-empty"><Search size={20}/><strong>No GPTs found</strong><span>Try a different search.</span></div>}
      </section>
    </main>
  </div>;
}

function GPTChatPage({chat,gpt,onBack,onNewChat,onSend,loading,onStop,onVoice,onCopy,onRetry,onDelete,onDownload,sendOnEnter,value,setValue,attachments,setAttachments,webSearch,setWebSearch,streamText="",streamStatus="",streamEvents=[],streamElapsed=0}:{chat:Chat;gpt:GPTDefinition;onBack:()=>void;onNewChat:()=>void;onSend:()=>void;loading:boolean;onStop:()=>void;onVoice:()=>void;onCopy:(m:Message)=>void;onRetry:(m:Message)=>void;onDelete:(m:Message)=>void;onDownload:(f:GeneratedFile)=>void;sendOnEnter:boolean;value:string;setValue:(v:string)=>void;attachments:Attachment[];setAttachments:React.Dispatch<React.SetStateAction<Attachment[]>>;webSearch:boolean;setWebSearch:(v:boolean)=>void;streamText?:string;streamStatus?:string;streamEvents?:ActivityStep[];streamElapsed?:number}){
  return <div className="gpt-chat-shell">
    <header className="gpt-chat-top"><LiquidGlassBackdrop className="gpt-nav-glass-layer" options={{profile:"bar",variant:"regular",preset:"balanced",scheme:"adaptive",radius:0}}/>
      <button className="gpt-back" onClick={onBack} aria-label="Back to GPTs"><ArrowLeft size={17}/><span>GPTs</span></button>
      <div className="gpt-chat-identity">
        <div className={"gpt-card-icon "+gpt.icon}><GPTIcon kind={gpt.icon} size={18}/></div>
        <div><strong>{gpt.name}</strong><small>{gpt.category}</small></div>
      </div>
      <button className="gpt-chat-new" onClick={onNewChat}><MessageSquarePlus size={17}/><span>New chat</span></button>
    </header>
    <main className="gpt-chat-main">
      <ChatView chat={chat} onSend={onSend} loading={loading} onStop={onStop} onVoice={onVoice} onCopy={onCopy} onRetry={onRetry} onDelete={onDelete} onShare={()=>{}} onDownload={onDownload} onEdit={()=>{}} onFork={()=>{}} onSave={()=>{}} onInspectSources={()=>{}} onQuickAction={onSend} streamText={streamText} streamStatus={streamStatus} streamEvents={streamEvents} streamElapsed={streamElapsed}/>
      <div className="gpt-chat-composer">
        <Composer value={value} setValue={setValue} attachments={attachments} setAttachments={setAttachments} loading={loading} onSend={onSend} onStop={onStop} onVoice={onVoice} sendOnEnter={sendOnEnter} webSearch={webSearch} setWebSearch={setWebSearch} memoryEnabled={false} setMemoryEnabled={()=>{}} toolMode={null} setToolMode={()=>{}} plan="free" hideTools hideWebSearch onToolNotice={()=>{}}/>
      </div>
    </main>
  </div>;
}
function SpatialHub({chatCount,model,canCode,canModerate,onNavigate}:{chatCount:number;model:string;canCode:boolean;canModerate:boolean;onNavigate:(v:string)=>void}){
  const [camera,setCamera]=useState({x:0,y:0,rx:-10,ry:0});
  const [dragging,setDragging]=useState(false);
  const drag=useRef({x:0,y:0,cx:0,cy:0,rx:0,ry:0});
  const nodes=[
    {id:"chat",label:"Chat",detail:chatCount+" conversations",icon:<MessageSquare size={21}/>,x:0,y:0,z:90,core:true},
    {id:"work",label:"Work",detail:"Longer tasks",icon:<Zap size={20}/>,x:-31,y:-22,z:35},
    {id:"projects",label:"Projects",detail:"Your workspace",icon:<FolderKanban size={20}/>,x:31,y:-18,z:25},
    {id:"search",label:"Search",detail:"Conversations",icon:<Search size={19}/>,x:-38,y:22,z:5},
    {id:"library",label:"Library",detail:"Files & saves",icon:<Library size={19}/>,x:38,y:23,z:12},
    {id:"gpts",label:"GPTs",detail:"Specialists",icon:<Sparkles size={19}/>,x:0,y:39,z:28},
    ...(canCode?[{id:"code",label:"Code Studio",detail:"Build & review",icon:<Code2 size={20}/>,x:20,y:5,z:55}]:[]),
    ...(canModerate?[{id:"moderation",label:"Moderation",detail:"Staff tools",icon:<ShieldAlert size={19}/>,x:-22,y:38,z:18}]:[])
  ];
  const onDown=(e:React.PointerEvent<HTMLDivElement>)=>{
    if((e.target as HTMLElement).closest(".space-marker"))return;
    drag.current={x:e.clientX,y:e.clientY,cx:camera.x,cy:camera.y,rx:camera.rx,ry:camera.ry};
    setDragging(true); e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove=(e:React.PointerEvent<HTMLDivElement>)=>{
    if(!dragging)return;
    const dx=e.clientX-drag.current.x, dy=e.clientY-drag.current.y;
    setCamera({...camera,x:Math.max(-360,Math.min(360,drag.current.cx+dx)),y:Math.max(-260,Math.min(260,drag.current.cy+dy))});
  };
  const onUp=(e:React.PointerEvent<HTMLDivElement>)=>{setDragging(false);try{e.currentTarget.releasePointerCapture(e.pointerId)}catch{}};
  const reset=()=>setCamera({x:0,y:0,rx:-10,ry:0});
  return <div className={"space-page "+(dragging?"is-dragging":"")}>
    <div className="space-overlay-head"><div><span className="section-kicker"><Orbit size={14}/>Spatial workspace</span><h1>Cookie Space</h1><p>Drag to move around · scroll to zoom · tap a workspace to open it.</p></div><span className="space-model">{model}</span></div>
    <div className="space-map" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onWheel={e=>setCamera(v=>({...v,y:Math.max(-260,Math.min(260,v.y-e.deltaY*.35)),x:Math.max(-360,Math.min(360,v.x-e.deltaX*.35))}))} aria-label="Interactive Cookie spatial workspace">
      <div className="space-stars" aria-hidden="true"/><div className="space-floor" aria-hidden="true"/>
      <div className="space-camera" style={{transform:`translate3d(${camera.x}px,${camera.y}px,0) rotateX(${camera.rx}deg) rotateY(${camera.ry}deg)`}}>
        <div className="space-scene">
          <div className="space-orbit orbit-1"/><div className="space-orbit orbit-2"/><div className="space-orbit orbit-3"/><div className="space-axis axis-a"/><div className="space-axis axis-b"/>
          {nodes.map(n=><button key={n.id} className={"space-marker "+(n.core?"space-core":"")} style={{"--x":n.x+"%","--y":n.y+"%","--z":n.z+"px"} as React.CSSProperties} onClick={()=>onNavigate(n.id)}><span className="space-marker-icon">{n.core?<CookieIcon size={38}/>:n.icon}</span><span className="space-marker-name">{n.label}</span><span className="space-marker-detail">{n.detail}</span></button>)}
        </div>
      </div>
      <button className="space-reset" onClick={reset} aria-label="Center workspace">Center</button>
      <div className="space-hint">DRAG TO PAN</div>
    </div>
  </div>;
}
function Page({view,chats,onOpen,onPrompt,onDownload,files,savedItems}:{view:View;chats:Chat[];onOpen:(id:string)=>void;onPrompt:(p:string)=>void;onDownload:(f:GeneratedFile)=>void;files:GeneratedFile[];savedItems:SavedItem[]}){
  if(view==="search") return <div className="page"><h1>Search</h1><p>Search your conversations.</p><SearchPanel chats={chats} onOpen={onOpen}/></div>;
  if(view==="memory") return <MemoryPage/>;
  if(view==="library"){
    const attachments=savedItems.filter(x=>x.kind==="attachment");
    return <div className="page"><h1>Library</h1><p>Your generated files, uploaded images, and uploaded files.</p>
      {(files.length||attachments.length)?<div className="library-grid">
        {attachments.map(a=><button className="library-item" key={a.id} onClick={()=>{const el=document.createElement("a");el.href=a.content;el.download=a.title||"cookie-file";el.click()}}>{a.content.startsWith("data:image/")?<img className="library-thumb" src={a.content} alt=""/>:<FileIcon size={22}/>}<span><b>{a.title}</b><small>Uploaded attachment</small></span><Download size={16}/></button>)}
        {files.map(f=><button className="library-item" key={f.path} onClick={()=>onDownload(f)}><FileIcon size={22}/><span><b>{f.name}</b><small>{f.path}</small></span><Download size={16}/></button>)}
      </div>:<div className="page-empty"><FolderOpen size={40}/><h3>Your Library is empty</h3><span>Uploaded attachments and generated files will appear here.</span></div>}</div>;
  }
  if(view==="code") return <CodeStudioPage/>;
  if(view==="projects") return <ProjectsPage/>;
  if(view==="gpts") return <GPTsPage onOpen={()=>{}} plan="free"/>;
  if(view==="work") return <WorkPage onStart={onPrompt}/>;
  if(view==="help") return <div className="page"><h1>Help with Cookie</h1><p>Quick answers.</p><div className="help-grid">{[["Search","Use Search or ⌘K / Ctrl+K to find conversations."],["Files","Use + in the composer to attach images or files."],["Voice","Use the voice button and allow microphone access."],["Temporary chats","Start a temporary chat from the sidebar menu."]].map(([a,b])=><div className="help-item" key={a}><CircleHelp size={18}/><div><b>{a}</b><span>{b}</span></div></div>)}</div></div>;
  return null;
}
function WorkPage({onStart}:{onStart:(prompt:string)=>void}){
  const [value,setValue]=useState("");
  const ref=useRef<HTMLTextAreaElement>(null);
  const submit=()=>{const v=value.trim();if(!v)return;setValue("");if(ref.current)ref.current.style.height="56px";onStart(v)};
  useEffect(()=>{const t=ref.current;if(!t)return;t.style.height="56px";t.style.height=Math.min(220,Math.max(56,t.scrollHeight))+"px"},[value]);
  return <div className="work-page">
    <div className="work-intro">
      <div className="work-mark"><Zap size={18}/></div>
      <div><h1>What are you working on?</h1><p>Tell Cookie the goal. It will figure out the steps, tools, and depth itself.</p></div>
    </div>
    <div className="work-input"><LiquidGlassBackdrop className="work-glass-layer" options={{profile:"bar",variant:"regular",preset:"balanced",scheme:"adaptive",radius:24}}/>
      <textarea ref={ref} value={value} onChange={e=>setValue(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();submit()}}} placeholder="Describe the work…" rows={1}/>
      <button className={value.trim()?"ready":""} disabled={!value.trim()} onClick={submit} aria-label="Start work"><ArrowUp size={18}/></button>
    </div>
    <span className="work-hint">No templates. No scripted prompts. Just describe what you need.</span>
  </div>;
}
function SearchPanel({chats,onOpen}:{chats:Chat[];onOpen:(id:string)=>void}){
  const [q,setQ]=useState(""); const hits=chats.filter(c=>c.title.toLowerCase().includes(q.toLowerCase())||c.messages.some(m=>m.content.toLowerCase().includes(q.toLowerCase())));
  return <><div className="big-search"><Search size={19}/><input autoFocus placeholder="Search conversations" value={q} onChange={e=>setQ(e.target.value)}/></div><div className="search-list">{q&&hits.map(c=><button key={c.id} onClick={()=>onOpen(c.id)}><MessageSquare size={17}/><span><b>{c.title}</b><small>{c.messages.at(-1)?.content.slice(0,120)||"No messages yet"}</small></span><ChevronRight size={16}/></button>)}{q&&!hits.length&&<div className="page-empty">No results.</div>}</div></>;
}

function ProjectsPage(){
  type Project={id:string;name:string;description:string;created_at:number;updated_at:number};
  type ProjectFile={id:string;path:string;content:string;mime:string};
  const [projects,setProjects]=useState<Project[]>([]);
  const [active,setActive]=useState<Project|null>(null);
  const [files,setFiles]=useState<ProjectFile[]>([]);
  const [selected,setSelected]=useState<ProjectFile|null>(null);
  const [content,setContent]=useState("");
  const [name,setName]=useState("");
  const [description,setDescription]=useState("");
  const [path,setPath]=useState("");
  const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false);
  const load=async()=>{
    try{const r=await fetch("/api/projects",{credentials:"same-origin"});const d=await r.json();if(r.ok)setProjects(d.projects||[])}catch{}finally{setLoading(false)}
  };
  useEffect(()=>{load()},[]);
  const open=async(p:Project)=>{
    setActive(p);setSelected(null);setContent("");
    const r=await fetch("/api/projects/"+encodeURIComponent(p.id),{credentials:"same-origin"});const d=await r.json();
    if(r.ok)setFiles(d.files||[]);
  };
  const create=async()=>{
    if(!name.trim())return;
    const r=await fetch("/api/projects",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,description}),credentials:"same-origin"});
    const d=await r.json();if(r.ok){setProjects(p=>[d.project,...p]);setName("");setDescription("");open(d.project)}
  };
  const save=async()=>{
    if(!active||!path.trim())return;setSaving(true);
    try{
      const r=await fetch("/api/projects/"+encodeURIComponent(active.id)+"/files",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({path,content,mime:"text/plain"}),credentials:"same-origin"});
      if(r.ok){const d=await fetch("/api/projects/"+encodeURIComponent(active.id),{credentials:"same-origin"}).then(x=>x.json());setFiles(d.files||[]);const f=(d.files||[]).find((x:ProjectFile)=>x.path===path);if(f)setSelected(f);setProjects((p:Project[])=>p.map((x:Project)=>x.id===active.id?{...x,updated_at:Date.now()/1000}:x))}
    }finally{setSaving(false)}
  };
  const removeProject=async()=>{
    if(!active||!window.confirm("Delete this project and its files?"))return;
    await fetch("/api/projects/"+encodeURIComponent(active.id),{method:"DELETE",credentials:"same-origin"});
    setProjects(p=>p.filter(x=>x.id!==active.id));setActive(null);setFiles([]);setSelected(null);
  };
  if(active) return <div className="projects-page project-detail">
    <div className="projects-head"><button className="project-back" onClick={()=>{setActive(null);setSelected(null)}}><ChevronLeft size={17}/>Projects</button><button className="project-delete" onClick={removeProject}><Trash2 size={15}/>Delete</button></div>
    <div className="project-title"><FolderKanban size={28}/><div><h1>{active.name}</h1><p>{active.description||"Persistent workspace"}</p></div></div>
    <div className="project-workspace">
      <aside className="project-files"><div className="project-panel-title">Files</div>{files.map(f=><button key={f.id} className={selected?.id===f.id?"selected":""} onClick={()=>{setSelected(f);setPath(f.path);setContent(f.content)}}><Code2 size={15}/><span>{f.path}</span></button>)}{!files.length&&<small>No files yet.</small>}</aside>
      <section className="project-editor"><div className="editor-bar"><input value={path} onChange={e=>setPath(e.target.value)} placeholder="src/example.txt"/><button disabled={saving} onClick={save}>{saving?"Saving…":"Save file"}</button></div><textarea value={content} onChange={e=>setContent(e.target.value)} placeholder="Store project notes, code, prompts, or other text here…"/></section>
    </div>
  </div>;
  return <div className="projects-page"><div className="projects-heading"><div><div className="section-kicker"><FolderKanban size={15}/>Persistent workspace</div><h1>Projects</h1><p>Keep project context and files across sessions.</p></div></div>
    <div className="project-create"><input value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&create()} placeholder="New project name"/><input value={description} onChange={e=>setDescription(e.target.value)} placeholder="Short description"/><button onClick={create}><Plus size={17}/>Create</button></div>
    <div className="project-grid">{loading?<div className="page-empty">Loading projects…</div>:projects.length?projects.map(p=><button className="project-card" key={p.id} onClick={()=>open(p)}><div className="project-card-icon"><FolderKanban size={18}/></div><div><b>{p.name}</b><span>{p.description||"Persistent workspace"}</span></div><ChevronRight size={16}/></button>):<div className="page-empty">No projects yet. Create one above.</div>}</div>
  </div>;
}

function VoiceOverlay({onClose}:{onClose:()=>void}){
  const [on,setOn]=useState(false),[text,setText]=useState(""),rec=useRef<any>(null);
  const toggle=()=>{if(on){rec.current?.stop();setOn(false);return}const R=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;if(!R){setText("Voice input is not available in this browser.");return}const r=new R();r.lang="en-US";r.interimResults=true;r.continuous=true;r.onresult=(e:any)=>{let s="";for(let i=e.resultIndex;i<e.results.length;i++)s+=e.results[i][0].transcript;setText(s)};r.onend=()=>setOn(false);r.start();rec.current=r;setOn(true);setText("")};
  useEffect(()=>()=>rec.current?.stop(),[]);
  return <div className="voice-overlay"><button className="voice-close" onClick={onClose}><X/></button><div className={"voice-orb "+(on?"on":"")}><i/><i/><i/></div><h2>{on?"Listening…":"Voice with Cookie"}</h2><p>{text||"Talk naturally with Cookie."}</p><div className="voice-actions"><button onClick={toggle}>{on?<Square size={18}/>:<Volume2 size={20}/>}</button><button onClick={onClose}>Done</button></div></div>;
}


type InstallPromptEvent = Event & {
  prompt:()=>Promise<{outcome:"accepted"|"dismissed"}>;
};

function isCookieAppInstalled(){
  if((window as any).__COOKIE_NATIVE_APP__===true)return true;
  return window.matchMedia?.("(display-mode: standalone)").matches === true
    || window.matchMedia?.("(display-mode: window-controls-overlay)").matches === true
    || Boolean((navigator as any).standalone);
}

function InstallAppExperience({authUser}:{authUser:AuthUser}){
  const [deferredPrompt,setDeferredPrompt]=useState<InstallPromptEvent|null>(null);
  const [installed,setInstalled]=useState(false);
  const [open,setOpen]=useState(false);
  const [showSteps,setShowSteps]=useState(false);
  const [installing,setInstalling]=useState(false);
  const [ios,setIos]=useState(false);
  const [android,setAndroid]=useState(false);

  useEffect(()=>{
    setInstalled(isCookieAppInstalled());
    const ua=navigator.userAgent||"";
    const isAndroid=/Android/i.test(ua);
    const isIOS=/iPhone|iPad|iPod/i.test(ua) && !isAndroid;
    setIos(isIOS);
    setAndroid(isAndroid);
    const before=(event:Event)=>{
      event.preventDefault();
      setDeferredPrompt(event as InstallPromptEvent);
    };
    const installedHandler=()=>{
      setInstalled(true);
      setDeferredPrompt(null);
      setOpen(false);
      try{localStorage.setItem("cookie_install_installed","1")}catch{}
    };
    const openHandler=()=>setOpen(true);
    window.addEventListener("beforeinstallprompt",before as EventListener);
    window.addEventListener("appinstalled",installedHandler);
    window.addEventListener("cookie:open-install-app",openHandler);
    const remembered=Number(localStorage.getItem("cookie_install_snooze_until")||"0");
    const explicitlyInstalled=localStorage.getItem("cookie_install_installed")==="1";
    const timer=window.setTimeout(()=>{
      if(!isCookieAppInstalled()&&!explicitlyInstalled&&remembered<Date.now())setOpen(true);
    },650);
    return()=>{
      window.clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt",before as EventListener);
      window.removeEventListener("appinstalled",installedHandler);
      window.removeEventListener("cookie:open-install-app",openHandler);
    };
  },[]);

  const closeAndRemindLater=()=>{
    setOpen(false);
    setShowSteps(false);
    try{localStorage.setItem("cookie_install_snooze_until",String(Date.now()+14*24*60*60*1000))}catch{}
  };

  const install=async()=>{
    if(isCookieAppInstalled()){setInstalled(true);setOpen(false);return}
    if(ios){
      // iOS intentionally has no programmatic PWA install prompt. Safari owns
      // the Add to Home Screen action, so give the user an unmistakable guide.
      setInstalling(true);
      setShowSteps(true);
      setOpen(true);
      return;
    }
    if(deferredPrompt){
      try{
        await deferredPrompt.prompt();
        const result=await (deferredPrompt as any).userChoice;
        if(result?.outcome==="accepted"){
          setInstalled(true);
          try{localStorage.setItem("cookie_install_installed","1")}catch{}
          setOpen(false);
        }
      }catch{}
      setDeferredPrompt(null);
      return;
    }
    setShowSteps(true);
  };

  const primaryLabel=deferredPrompt?"Install Cookie app":ios?"Show iPhone install guide":android?"Install Cookie":"View install steps";

  if(installed)return null;

  return <div className={"install-app-layer "+(open?"open":"")} aria-hidden={!open}>
    {open&&<div className="install-app-scrim" onClick={closeAndRemindLater}/>}
    {open&&<section className="install-app-modal" role="dialog" aria-modal="true" aria-labelledby="cookie-install-title">
      <div className="install-app-glow" aria-hidden="true"/>
      <div className="install-app-top">
        <div className="install-app-mark"><CookieIcon size={44}/><span className="install-app-pulse"/></div>
        <button className="install-app-close" onClick={closeAndRemindLater} aria-label="Close install prompt"><X size={18}/></button>
      </div>
      <div className="install-app-copy">
        <div className="install-app-badge"><AppWindow size={13}/> Cookie app</div>
        <h2 id="cookie-install-title">{authUser.name ? "Welcome back, "+authUser.name+"." : "Welcome back."}</h2>
        <p>Use Cookie like a real app — open it from your home screen, desktop, or taskbar without hunting for the browser tab.</p>
      </div>

      <div className="install-app-benefits">
        <div><AppWindow size={17}/><span><b>Its own app window</b><small>Cleaner, focused workspace.</small></span></div>
        <div><Smartphone size={17}/><span><b>Phone + desktop</b><small>Use the same Cookie account anywhere.</small></span></div>
        <div><Zap size={17}/><span><b>One-tap access</b><small>Launch Cookie straight from your device.</small></span></div>
      </div>

      {!showSteps&&<div className="install-app-actions">
        <button className="install-app-primary" onClick={install}><Download size={17}/>{primaryLabel}</button>
        <button className="install-app-secondary" onClick={closeAndRemindLater}>Remind me later</button>
      </div>}

      {showSteps&&<div className="install-app-steps">
        <div className="install-app-step">
          <span>1</span>
          <div><b>{ios?"On iPhone or iPad":android?"Install Cookie on Android":"On this device"}</b><p>{ios?"Open Cookie in Safari, tap Share, then choose “Add to Home Screen” and tap Add.":android?"Open Cookie in Chrome and use the browser’s Install option if the native install prompt is unavailable.":"Use your browser's Install / Add to Home Screen option."}</p></div>
        </div>
        <div className="install-app-step">
          <span>2</span>
          <div><b>No app store required</b><p>Cookie can be installed directly from the web as a standalone app. There is no Google Play or App Store download involved.</p></div>
        </div>
        <button className="install-app-primary" onClick={closeAndRemindLater}>{ios?"Done — I’ll add Cookie from Safari":android?"Got it":"Got it"}</button>
      </div>}

      <div className="install-app-foot">{installing&&ios?<><Smartphone size={14}/> Safari controls the final Add to Home Screen step.</>:<><Monitor size={14}/> Install once, then launch Cookie like an app.</>}</div>
    </section>}
  </div>;
}

function NotificationFeed({items,onClose,onReadAll}:{items:ModerationNotification[];onClose:()=>void;onReadAll:()=>void}){
  const unread=items.filter(x=>!x.read).length;
  const titleOf=(action:string)=>action==="warn"?"Account warning":action==="suspend"?"Account suspended":action==="ban"?"Account banned":"Account restored";
  const detailOf=(item:ModerationNotification)=>{
    if(item.action==="suspend"&&item.until){return "Access is restricted until "+new Date(item.until).toLocaleString(undefined,{dateStyle:"medium",timeStyle:"short"})+".";}
    if(item.action==="ban")return "Access to Cookie has been blocked.";
    if(item.action==="unsuspend"||item.action==="unban")return "Your account restrictions have been removed.";
    return "A moderation warning was added to your account.";
  };
  return <div className="notification-sheet" role="dialog" aria-label="Notifications">
    <div className="notification-sheet-head"><div><strong>Notifications</strong><span>{unread?unread+" unread":"All caught up"}</span></div><div><button onClick={onReadAll} disabled={!unread}>Mark read</button><button onClick={onClose}>Close</button></div></div>
    <div className="notification-list">
      {!items.length?<div className="notification-empty">No notifications.</div>:items.map(item=><button key={item.id} className={"notification-row "+(!item.read?"unread":"")} onClick={()=>{if(!item.read)onReadAll()}}><span className="notification-row-main"><b>{titleOf(item.action)}</b><span>{detailOf(item)}</span>{item.reason&&<small>{item.reason}</small>}</span><time>{new Date(item.createdAt).toLocaleDateString(undefined,{month:"short",day:"numeric"})}</time></button>)}
    </div>
  </div>;
}

function CommandPalette({open,query,setQuery,onClose,onRun,chats}:{open:boolean;query:string;setQuery:(v:string)=>void;onClose:()=>void;onRun:(id:string)=>void;chats:Chat[]}){
  const ref=useRef<HTMLInputElement>(null);
  useEffect(()=>{if(open)requestAnimationFrame(()=>ref.current?.focus())},[open]);
  if(!open)return null;
  const actions=[
    ["new-chat","New chat","Start a fresh conversation",PenLine,"⌘N"],
    ["search","Search chats","Find a conversation or message",Search,"⌘K"],
    ["work","Work","Start a structured task",Zap,""],
    ["workspace","Saved workspace","Open saved answers and sources",Bookmark,""],
    ["memory","Memory","Review what Cookie remembers",Brain,""],
    ["library","Library","Open generated files",Library,""],
    ["projects","Projects","Open project files",FolderKanban,""],
    ["gpts","GPTs","Open purpose-built assistants",Sparkles,""],
    ["space","Space","Open the spatial workspace",Orbit,""],
    ["settings","Settings","Open Cookie settings",SettingsIcon,""],
    ["focus","Focus mode","Distraction-free conversation",Maximize2,""]
  ] as const;
  const q=query.trim().toLowerCase();
  const filtered=actions.filter(x=>!q||x[1].toLowerCase().includes(q)||x[2].toLowerCase().includes(q));
  const chatHits=q?chats.filter(c=>c.title.toLowerCase().includes(q)||c.messages.some(m=>m.content.toLowerCase().includes(q))).slice(0,6):[];
  return <div className="command-palette-backdrop" role="dialog" aria-modal="true" aria-label="Cookie command center" onMouseDown={e=>{if(e.currentTarget===e.target)onClose()}}>
    <div className="command-palette">
      <div className="command-palette-search"><Command size={17}/><input ref={ref} value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search Cookie or jump to…" onKeyDown={e=>{if(e.key==="Escape")onClose()}}/><kbd>ESC</kbd></div>
      <div className="command-palette-list">
        {!filtered.length&&!chatHits.length?<div className="command-palette-empty">Nothing matched “{query}”.</div>:null}
        {!!filtered.length&&<div className="command-palette-label">Actions</div>}
        {filtered.map(([id,label,detail,Icon,shortcut])=><button key={id} className="command-item" onClick={()=>onRun(id)}><span className="command-item-icon"><Icon size={16}/></span><span><b>{label}</b><small>{detail}</small></span>{shortcut&&<kbd>{shortcut}</kbd>}</button>)}
        {!!chatHits.length&&<><div className="command-palette-label">Conversations</div>{chatHits.map(c=><button key={c.id} className="command-item" onClick={()=>onRun("chat:"+c.id)}><span className="command-item-icon"><MessageSquare size={16}/></span><span><b>{c.title}</b><small>{c.messages.at(-1)?.content.slice(0,90)||"No messages yet"}</small></span></button>)}</>}
      </div>
    </div>
  </div>;
}

function SourceInspector({message,onClose,onSave}:{message:Message|null;onClose:()=>void;onSave:(src:SourceRef)=>void}){
  if(!message)return null;
  return <div className="source-inspector-backdrop" role="dialog" aria-modal="true" aria-label="Research sources" onMouseDown={e=>{if(e.currentTarget===e.target)onClose()}}>
    <aside className="source-inspector"><header><div><span>RESEARCH</span><strong>{message.sources?.length||0} sources</strong></div><button onClick={onClose} aria-label="Close sources"><X size={17}/></button></header>
      <div className="source-inspector-list">{(message.sources||[]).map((src,i)=><article className="source-inspector-item" key={src.url+i}><div className="source-inspector-top"><span>{String(src.domain||"web")}</span><time>{i+1}</time></div><a href={src.url} target="_blank" rel="noreferrer" className="source-inspector-title">{src.title||src.domain||"Source"}</a>{src.snippet&&<p>{src.snippet}</p>}<div className="source-inspector-actions"><a href={src.url} target="_blank" rel="noreferrer">Open</a><button onClick={()=>onSave(src)}>Save</button></div></article>)}</div>
    </aside>
  </div>;
}

function WorkspaceShelf({items,onClose,onDelete}:{items:SavedItem[];onClose:()=>void;onDelete:(id:string)=>void}){
  return <section className="workspace-shelf" aria-label="Saved workspace"><div className="workspace-shelf-head"><div><span>SAVED WORKSPACE</span><strong>{items.length?items.length+" saved":"Nothing saved yet"}</strong></div><button onClick={onClose} aria-label="Close workspace"><X size={17}/></button></div>
    {!items.length?<div className="workspace-empty"><Bookmark size={22}/><span>Save useful answers or sources from any conversation.</span></div>:<div className="workspace-shelf-list">{items.map(item=><article key={item.id} className="workspace-item"><div className="workspace-item-meta"><span>{item.kind==="source"?"SOURCE":"ANSWER"}</span><time>{new Date(item.createdAt*1000).toLocaleDateString(undefined,{month:"short",day:"numeric"})}</time></div>{item.url?<a className="workspace-item-title" href={item.url} target="_blank" rel="noreferrer">{item.title||"Saved source"} <ExternalLink size={12}/></a>:<strong className="workspace-item-title">{item.title||"Saved answer"}</strong>}<p>{item.content.slice(0,520)}{item.content.length>520?"…":""}</p><button className="workspace-item-remove" onClick={()=>onDelete(item.id)}>Remove</button></article>)}</div>}
  </section>;
}

function BranchNavigator({chat,chats,onOpen}:{chat:Chat|null;chats:Chat[];onOpen:(id:string)=>void}){
  if(!chat)return null;
  const root=chat.branchOf?chats.find(c=>c.id===chat.branchOf)||null:chat;
  const branches=chats.filter(c=>c.branchOf===root?.id&&!c.archived);
  if(!chat.branchOf&&!branches.length)return null;
  return <details className="branch-navigator"><summary><GitBranch size={15}/><span>{chat.branchOf?"Branch":"Branches"}</span><ChevronDown size={13}/></summary>
    <div className="branch-popover">{root&&<button onClick={()=>onOpen(root.id)} className={root.id===chat.id?"active":""}><span><MessageSquare size={14}/><b>Original</b></span></button>}
      {branches.map(b=><button key={b.id} onClick={()=>onOpen(b.id)} className={b.id===chat.id?"active":""}><span><GitBranch size={14}/><b>{b.title.replace(/^Branch · /,"")}</b></span></button>)}
    </div>
  </details>;
}

function MemoryPage(){
  type Memory={id:string;key:string;value:string;createdAt:number;updatedAt:number};
  const [items,setItems]=useState<Memory[]>([]);
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[key,setKey]=useState(""),[value,setValue]=useState("");
  const load=async()=>{setLoading(true);try{const r=await fetch("/api/memory",{credentials:"same-origin",cache:"no-store"});const d=await r.json();if(r.ok)setItems(Array.isArray(d.memories)?d.memories:[])}catch{}finally{setLoading(false)}};
  useEffect(()=>{load()},[]);
  const add=async()=>{if(!key.trim()||!value.trim()||busy)return;setBusy(true);try{const r=await fetch("/api/memory",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({key,value})});const d=await r.json();if(r.ok&&d?.memory){setKey("");setValue("");setItems(p=>[d.memory,...p.filter(x=>x.key!==d.memory.key)])}}finally{setBusy(false)}};
  const remove=async(id:string)=>{setItems(p=>p.filter(x=>x.id!==id));try{await fetch("/api/memory",{method:"DELETE",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({id})})}catch{}};
  return <div className="memory-page"><div className="memory-head"><div><span>PERSONAL CONTEXT</span><h1>Memory</h1><p>Review and control the details Cookie can carry between conversations.</p></div><button className="memory-refresh" onClick={load} disabled={loading}><RotateCcw size={15}/>Refresh</button></div>
    <section className="memory-compose"><div><strong>Add a memory</strong><span>Store a preference, project detail, or recurring fact.</span></div><div className="memory-form"><input value={key} onChange={e=>setKey(e.target.value)} placeholder="What should Cookie remember?"/><textarea value={value} onChange={e=>setValue(e.target.value)} placeholder="Details…"/><button onClick={add} disabled={busy||!key.trim()||!value.trim()}>{busy?"Saving…":"Save memory"}</button></div></section>
    <section className="memory-list"><div className="memory-list-head"><strong>Remembered</strong><span>{loading?"Loading…":items.length+" entries"}</span></div>{loading?<div className="memory-loading">Loading memory…</div>:!items.length?<div className="memory-empty"><Brain size={22}/><span>Nothing is saved yet.</span></div>:items.map(item=><article className="memory-row" key={item.id}><div><strong>{item.key}</strong><p>{item.value}</p><small>Updated {new Date(item.updatedAt*1000).toLocaleDateString(undefined,{dateStyle:"medium"})}</small></div><button onClick={()=>remove(item.id)}>Forget</button></article>)}</section>
  </div>;
}

function AuthenticatedApp({authUser,onLogout}:{authUser:AuthUser;onLogout:()=>void}){
  const initial=readJSON<Chat[]>("cookie_chats",[]);
  const [chats,setChats]=useState<Chat[]>(initial);
  const [activeId,setActiveId]=useState(initial[0]?.id||"");
  const [view,setView]=useState<View>("chat");
  const [adminAuditFocus,setAdminAuditFocus]=useState(false);
  const [settingsTab,setSettingsTab]=useState<SettingsTab>("general");
  const [sidebar,setSidebar]=useState(false),[model,setModel]=useState(localStorage.getItem("cookie_model")||"standard"),[modelOpen,setModelOpen]=useState(false),[effort,setEffort]=useState(localStorage.getItem("cookie_effort")||"standard");
  const [recentFilter,setRecentFilter]=useState<"all"|"pinned"|"temporary">("all"),[recentQuery,setRecentQuery]=useState(""),[moreOpen,setMoreOpen]=useState(false),[focusMode,setFocusMode]=useState(false),[commandOpen,setCommandOpen]=useState(false),[commandQuery,setCommandQuery]=useState(""),[workspaceOpen,setWorkspaceOpen]=useState(false),[savedItems,setSavedItems]=useState<SavedItem[]>([]),[sourceInspect,setSourceInspect]=useState<Message|null>(null);
  const [text,setText]=useState(""),[attachments,setAttachments]=useState<Attachment[]>([]),[webSearch,setWebSearch]=useState(false),[loading,setLoading]=useState(false),[voice,setVoice]=useState(false),[newOpen,setNewOpen]=useState(false),[profileOpen,setProfileOpen]=useState(false);
  const [temporary,setTemporary]=useState(false),[abort,setAbort]=useState<AbortController|null>(null),[toast,setToast]=useState("");
  const [deletedChatIds,setDeletedChatIds]=useState<string[]>(()=>readJSON<string[]>("cookie_deleted_chat_ids",[]));
  const [notifications,setNotifications]=useState<ModerationNotification[]>([]),[notificationsOpen,setNotificationsOpen]=useState(false);
  const [streamText,setStreamText]=useState(""),[streamStatus,setStreamStatus]=useState("");
  const [streamEvents,setStreamEvents]=useState<ActivityStep[]>([]);
  const [streamStartedAt,setStreamStartedAt]=useState(0);
  const [streamElapsed,setStreamElapsed]=useState(0);
  const streamEventsRef=useRef<ActivityStep[]>([]);
  const streamStartedAtRef=useRef(0);
  const [toolMode,setToolMode]=useState<ToolMode>(null);
  const [skillId,setSkillId]=useState<SkillId>(()=>readJSON<SkillId>("cookie_skill",null));
  const [spatialMode,setSpatialMode]=useState(false);
  const [missionMode,setMissionMode]=useState(false);
  const [selectedGPT,setSelectedGPT]=useState<GPTDefinition|null>(null);
  const [profile,setProfile]=useState({name:authUser.name||"Cookie user",username:authUser.username||"cookie-user",email:authUser.email||""});
  // Code Studio is an owner/developer control surface, not a normal user feature.
  // Keep it out of the main navigation for regular Cookie users.
  const accountRole=String((authUser as any).role||"user").toLowerCase();
  const accountPlanRank=planRankClient(authUser.plan);
  const privileged=accountRole==="owner"||accountRole==="admin"||authUser.email?.trim().toLowerCase()==="cookie.ai.noreply@gmail.com";
  const isModerator=privileged||accountRole==="staff";
  const [codeStudioAllowed,setCodeStudioAllowed]=useState(privileged);
  const canUseModel=(id:string)=>privileged||modelRank(id)<=accountPlanRank;
  const canSeeCodeStudio=privileged||codeStudioAllowed;
  useEffect(()=>{if(!canUseModel(model))setModel("standard")},[model,accountPlanRank,privileged]);
  useEffect(()=>localStorage.setItem("cookie_effort",effort),[effort]);
  useEffect(()=>{
    let cancelled=false;
    fetch("/api/codebase?action=access",{credentials:"same-origin",cache:"no-store"})
      .then(r=>{if(!r.ok)throw new Error();return r.json()})
      .then(d=>{if(!cancelled&&d?.canEdit)setCodeStudioAllowed(true)})
      .catch(()=>{if(!cancelled&&!privileged)setCodeStudioAllowed(false)});
    return()=>{cancelled=true};
  },[authUser.email,accountRole,privileged]);
  const [settings,setSettings]=useState(()=>({
    theme:"Dark",language:"English",accent:"Default",fontSize:"Default",defaultModel:"standard",reasoning:"auto",answerLength:"auto",
    animations:true,compact:false,keyboard:true,sendOnEnter:true,timestamps:false,confirmDelete:true,personality:"Balanced",
    memory:true,instructions:"",history:true,improve:false,notifications:true,updates:false,voice:"Arbor",captions:true,
    ...readJSON("cookie_settings",{})
  }));
  const [memoryEnabled,setMemoryEnabled]=useState(true);
  const [settingsServerReady,setSettingsServerReady]=useState(false);
  useEffect(()=>{
    let cancelled=false;
    fetch("/api/settings",{credentials:"same-origin",cache:"no-store"}).then(async r=>{const d=await r.json();if(!cancelled&&r.ok&&d?.settings){setSettings((s:any)=>({...s,...d.settings}));setSettingsServerReady(true)}}).catch(()=>{if(!cancelled)setSettingsServerReady(true)});
    return()=>{cancelled=true};
  },[]);
  useEffect(()=>saveJSON("cookie_settings",settings),[settings]);
  useEffect(()=>{
    if(!settingsServerReady)return;
    setMemoryEnabled(Boolean(settings.memory));
    const preferred=String(settings.defaultModel||"standard");
    if(canUseModel(preferred))setModel(preferred);
  },[settingsServerReady]);
  useEffect(()=>{
    if(!settingsServerReady)return;
    const timer=window.setTimeout(()=>fetch("/api/settings",{method:"PATCH",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({settings})}).catch(()=>{}),500);
    return()=>window.clearTimeout(timer);
  },[settings,settingsServerReady]);
  useEffect(()=>{
    const open=()=>setCommandOpen(true);
    window.addEventListener("cookie:open-command-palette",open);
    return()=>window.removeEventListener("cookie:open-command-palette",open);
  },[]);
  const loadSaved=useCallback(async()=>{try{const r=await fetch("/api/saved",{credentials:"same-origin",cache:"no-store"});const d=await r.json();if(r.ok&&Array.isArray(d?.items))setSavedItems(d.items)}catch{}},[]);
  const [serverSyncReady,setServerSyncReady]=useState(false);
  const [files,setFiles]=useState<GeneratedFile[]>(readJSON("cookie_library",[]));
  const chat=chats.find(c=>c.id===activeId)||null;
  useEffect(()=>{setTemporary(Boolean(chat?.temporary))},[chat?.id,chat?.temporary]);
  const recent=useMemo(()=>chats.filter(c=>!c.archived).sort((a,b)=>{if(Boolean(a.pinned)!==Boolean(b.pinned))return a.pinned?-1:1;return b.updatedAt-a.updatedAt}),[chats]);
  const sidebarRecents=useMemo(()=>recent.filter(c=>{const q=recentQuery.trim().toLowerCase();const matchesQuery=!q||c.title.toLowerCase().includes(q);const matchesFilter=recentFilter==="all"||(recentFilter==="pinned"&&Boolean(c.pinned))||(recentFilter==="temporary"&&Boolean(c.temporary));return matchesQuery&&matchesFilter}),[recent,recentFilter,recentQuery]);
  useEffect(()=>saveJSON("cookie_chats",chats.map(chat=>({...chat,messages:chat.messages.map(m=>{const {images,...rest}=m;return rest})}))),[chats]);
  useEffect(()=>saveJSON("cookie_deleted_chat_ids",deletedChatIds),[deletedChatIds]); useEffect(()=>saveJSON("cookie_profile",profile),[profile]);
  useEffect(()=>{
    let cancelled=false;
    (async()=>{
      try{
        const r=await fetch("/api/chats",{credentials:"same-origin",cache:"no-store"});
        const d=await r.json();
        if(cancelled)return;
        const remote:Chat[]=Array.isArray(d?.chats)?(d.chats as Chat[]):[];
        if(remote.length){
          setChats(remote);setActiveId(prev=>remote.some(x=>x.id===prev)?prev:remote[0]?.id||"");
        } else if(chats.length){
          await fetch("/api/chats",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({chats:serializeChatsForRemote(chats),deletedChatIds})});
        }
      }catch{}finally{if(!cancelled)setServerSyncReady(true)}
    })();
    return()=>{cancelled=true};
  },[]);
  useEffect(()=>{
    if(!serverSyncReady)return;
    const t=window.setTimeout(async()=>{
      try{
        const r=await fetch("/api/chats",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({chats:serializeChatsForRemote(chats),deletedChatIds})});
        if(r.ok&&deletedChatIds.length)setDeletedChatIds([]);
      }catch{}
    },500);
    return()=>window.clearTimeout(t);
  },[chats,deletedChatIds,serverSyncReady]);
 useEffect(()=>saveJSON("cookie_library",files),[files]); useEffect(()=>localStorage.setItem("cookie_model",model),[model]);
  useEffect(()=>{const theme=settings.theme==="System"?(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):settings.theme.toLowerCase();document.documentElement.dataset.theme=theme;document.documentElement.dataset.accent=settings.accent||"Default";document.documentElement.dataset.fontSize=settings.fontSize||"Default";document.body.classList.toggle("compact-mode",settings.compact);document.body.classList.toggle("motion-off",!settings.animations);document.body.classList.toggle("hide-timestamps",!settings.timestamps)},[settings]);
  useEffect(()=>{
    if(!(window as any).__COOKIE_NATIVE_APP__)return;
    const webkit=(window as any).webkit;
    try{webkit?.messageHandlers?.cookieAuth?.postMessage(true)}catch{}
    return()=>{try{webkit?.messageHandlers?.cookieAuth?.postMessage(false)}catch{}};
  },[]);
  const loadNotifications=useCallback(async()=>{
    try{
      const r=await fetch("/api/notifications",{credentials:"same-origin",cache:"no-store"});
      if(!r.ok)return;
      const d=await r.json();
      if(Array.isArray(d?.items))setNotifications(d.items);
    }catch{}
  },[]);
  useEffect(()=>{
    loadNotifications();
    const t=window.setInterval(loadNotifications,60000);
    return()=>window.clearInterval(t);
  },[loadNotifications]);
  useEffect(()=>{loadSaved()},[loadSaved]);
  const openNotifications=async()=>{
    setNotificationsOpen(v=>!v);
    if(notifications.some(x=>!x.read)){
      try{await fetch("/api/notifications",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({})})}catch{}
      setNotifications(items=>items.map(x=>({...x,read:true})));
    }
  };
  const markNotificationsRead=async()=>{
    try{await fetch("/api/notifications",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({})})}catch{}
    setNotifications(items=>items.map(x=>({...x,read:true})));
  };
  useEffect(()=>{if(view!=="chat"){setSidebar(false);setNotificationsOpen(false)}},[view]);
  useEffect(()=>{if(!moreOpen)return;const close=(e:Event)=>{const el=e.target as HTMLElement|null;if(!el?.closest(".more-wrap"))setMoreOpen(false)};document.addEventListener("pointerdown",close);return()=>document.removeEventListener("pointerdown",close)},[moreOpen]);
  useEffect(()=>{
    if(!loading||!streamStartedAt)return;
    const tick=()=>setStreamElapsed(Date.now()-streamStartedAt);
    tick();
    const t=window.setInterval(tick,500);
    return()=>window.clearInterval(t);
  },[loading,streamStartedAt]);
  useEffect(()=>{
    if(view==="code"&&!canSeeCodeStudio)setView("chat");
    if(view==="moderation"&&!isModerator)setView("chat");
  },[view,canSeeCodeStudio]);
  useEffect(()=>{const k=(e:KeyboardEvent)=>{if(settings.keyboard&&(e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="k"){e.preventDefault();setCommandQuery("");setCommandOpen(true);setSidebar(false)}if(settings.keyboard&&(e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="n"){e.preventDefault();createChat(false)}if(e.key==="Escape"){setModelOpen(false);setNewOpen(false);setProfileOpen(false);setVoice(false);setMoreOpen(false);setCommandOpen(false);setWorkspaceOpen(false);setSourceInspect(null)}};window.addEventListener("keydown",k);return()=>window.removeEventListener("keydown",k)},[settings.keyboard,model]);
  useEffect(()=>{
    const onNativeCommand=(event:Event)=>{
      const command=(event as CustomEvent<string>).detail;
      if(command==="new-chat"){createChat(false);return}
      if(command==="search"){setView("search");setSidebar(false);return}
      if(command==="library"){setView("library");setSidebar(false);return}
      if(command==="projects"){setView("projects");setSidebar(false);return}
      if(command==="code"){if(canSeeCodeStudio){setView("code");setSidebar(false)}return}
      if(command==="gpts"){setView("gpts");setSidebar(false);return}
      if(command==="work"){setView("work");setSidebar(false);return}
      if(command==="settings"){setSettingsTab("general");setView("settings");setSidebar(false);return}
      if(command.startsWith("model:")){
        const next=command.slice(6);
        if(MODELS.some(x=>x.id===next)) setModel(next);
        return;
      }
    };
    addEventListener("cookie:native-command",onNativeCommand as EventListener);
    return()=>removeEventListener("cookie:native-command",onNativeCommand as EventListener);
  },[model,canSeeCodeStudio]);
  const toastTimerRef=useRef<number|null>(null);
  useEffect(()=>()=>{if(toastTimerRef.current)window.clearTimeout(toastTimerRef.current)},[]);
  function notify(message:string){
    setToast(message);
    if(toastTimerRef.current)window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current=window.setTimeout(()=>setToast(""),1800);
  }
  const saveItem=async(item:{kind:string;title:string;content:string;url?:string;chatId?:string})=>{try{const r=await fetch("/api/saved",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify(item)});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d?.error||"Could not save this.");if(d?.item){setSavedItems(p=>[d.item,...p.filter(x=>x.id!==d.item.id)]);setWorkspaceOpen(true);notify("Saved to workspace")}}catch(e:any){notify(e?.message||"Could not save this.")}};
  const removeSaved=async(id:string)=>{setSavedItems(p=>p.filter(x=>x.id!==id));try{await fetch("/api/saved",{method:"DELETE",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({id})})}catch{}};
  const saveMessage=(m:Message)=>saveItem({kind:"message",title:chat?.title?chat.title+" · answer":"Saved answer",content:m.content,chatId:chat?.id});
  const saveSource=(src:SourceRef)=>saveItem({kind:"source",title:src.title||src.domain||"Saved source",content:src.snippet||src.url,url:src.url,chatId:chat?.id});
  const runQuickAction=(prompt:string)=>{if(!loading)send(prompt)};
  const runCommand=(id:string)=>{setCommandOpen(false);setCommandQuery("");if(id.startsWith("chat:")){const target=id.slice(5);const targetChat=chats.find(x=>x.id===target);if(targetChat){setActiveId(targetChat.id);setTemporary(Boolean(targetChat.temporary));setView("chat");setSidebar(false)}return}if(id==="new-chat"){createChat(false);return}if(id==="search"){setView("search");setSidebar(false);return}if(id==="work"){setView("work");setSidebar(false);return}if(id==="workspace"){setWorkspaceOpen(true);return}if(id==="memory"){setView("memory");setSidebar(false);return}if(id==="library"){setView("library");setSidebar(false);return}if(id==="projects"){setView("projects");setSidebar(false);return}if(id==="gpts"){setView("gpts");setSidebar(false);return}if(id==="space"){setView("space");setSidebar(false);return}if(id==="settings"){setSettingsTab("general");setView("settings");setSidebar(false);return}if(id==="focus"){setFocusMode(v=>!v);return}}
  const renameActiveChat=()=>{if(!chat)return;const next=window.prompt("Rename chat",chat.title)?.trim();if(next)updateChat(chat.id,x=>({...x,title:next.slice(0,120)}));setMoreOpen(false)}
  const toggleActivePin=()=>{if(!chat)return;updateChat(chat.id,x=>({...x,pinned:!x.pinned}));setMoreOpen(false)}
  const archiveActiveChat=()=>{if(!chat)return;updateChat(chat.id,x=>({...x,archived:true}));setMoreOpen(false);setView("chat")}
  const deleteActiveChat=()=>{if(!chat)return;if(settings.confirmDelete&&!window.confirm("Delete this chat?")){setMoreOpen(false);return}const id=chat.id;setChats(p=>p.filter(x=>x.id!==id));setDeletedChatIds(p=>p.includes(id)?p:[...p,id].slice(-80));setActiveId("");setMoreOpen(false);createChat(false)}
  function createChat(temp:boolean){const c:Chat={id:uid(),title:temp?"Temporary chat":"New chat",messages:[],model,temporary:temp,updatedAt:Date.now()};setChats(p=>[c,...p]);setActiveId(c.id);setTemporary(temp);setText("");setAttachments([]);setView("chat");setSidebar(false);setNewOpen(false)}
  function updateChat(id:string,fn:(c:Chat)=>Chat){setChats(p=>p.map(c=>c.id===id?fn(c):c))}
  async function send(override?:string, forcedGptId?:string){
    const body=(override??text).trim();
    if((!body&&!attachments.length)||loading)return;
    const activeGptId=forcedGptId||selectedGPT?.id||"";
    let c=chat;
    if(!c){
      const n:Chat={id:uid(),title:"New chat",messages:[],model,temporary,updatedAt:Date.now()};
      setChats(p=>[n,...p]);setActiveId(n.id);c=n;
    }
    const user:Message={id:uid(),role:"user",content:body,attachments,createdAt:Date.now()};
    const msgs=[...c.messages,user];
     if(attachments.length){
       const attachmentSaves=attachments.map(a=>fetch("/api/saved",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({kind:"attachment",title:a.name,content:a.data,chatId:c.id})}).then(async r=>r.ok?r.json():null).catch(()=>null));
       Promise.all(attachmentSaves).then(rows=>{const saved=rows.map(x=>x?.item).filter(Boolean);if(saved.length)setSavedItems(p=>[...saved,...p.filter(x=>!saved.some((s:any)=>s.id===x.id))].slice(0,120));});
     }
    const ttl=(c.title==="New chat"||c.title==="Temporary chat")?titleFrom(body||attachments[0]?.name||"New chat"):c.title;
    updateChat(c.id,x=>({...x,title:ttl,messages:msgs,model,updatedAt:Date.now()}));
    setText("");setAttachments([]);setWebSearch(false);setLoading(true);setStreamText("");setStreamStatus("Thinking…");
    const startedAt=Date.now();
    const initialActivity:ActivityStep={id:"thinking",stage:"thinking",label:"Thinking…",detail:"Understanding the request"};
    streamEventsRef.current=[initialActivity];
    streamStartedAtRef.current=startedAt;
    setStreamEvents([initialActivity]);
    setStreamStartedAt(startedAt);setStreamElapsed(0);
    const ctl=new AbortController();setAbort(ctl);
    let payload:any=null;
    try{
      const languageIndex=LANGUAGES.indexOf(settings.language);
      payload={
        model,
        chatId:c.id,
        gptId:activeGptId,
        messages:msgs.map(m=>({role:m.role,content:m.content})),
        attachments:user.attachments||[],
        preferences:{
          responseMode:model,
          language:LANG_CODES[languageIndex]||"auto",
          answerLength:settings.answerLength||"auto",
          creativity:.7,
          memory:activeGptId?false:memoryEnabled,
          personality:settings.personality,
          reasoning:effort==="light"?"fast":effort==="high"||effort==="ultra"?"deep":(settings.reasoning||"auto"),
          effort,
          instructions:settings.instructions||"",
          webSearch,
          mission:missionMode,
          tool:toolMode,
          skill:skillId,
          gptId:activeGptId,
          profile
        }
      };

      let r:Response|null=null;
      for(let attempt=0;attempt<2;attempt++){
        try{
          r=await fetch("/api/chat?stream=1",{
            method:"POST",
            signal:ctl.signal,
            cache:"no-store",
            headers:{"Content-Type":"application/json","Accept":"text/event-stream, application/json"},
            body:JSON.stringify(payload)
          });
          break;
        }catch(err:any){
          if(err?.name==="AbortError")throw err;
          if(attempt===0)await new Promise(res=>setTimeout(res,500));
        }
      }
      if(!r)throw new Error("Unable to connect to Cookie AI. Please try again.");

      const contentType=(r.headers.get("content-type")||"").toLowerCase();
      let doneData:any=null;
      let assembled="";
      if(contentType.includes("text/event-stream")){
        if(!r.body)throw new Error("Cookie returned no streaming response.");
        const reader=r.body.getReader();
        const decoder=new TextDecoder();
        let buffer="";
        const processLine=(line:string)=>{
          const trimmed=line.trim();
          if(!trimmed.startsWith("data:"))return;
          const raw=trimmed.slice(5).trim();
          if(!raw)return;
          let event:any;
          try{event=JSON.parse(raw)}catch{return};
          if(event.type==="delta"){
            const delta=String(event.delta||"");
            if(delta){assembled+=delta;setStreamText(prev=>prev+delta)}
          }else if(event.type==="status"){
            setStreamStatus(String(event.status||"Working…"));
          }else if(event.type==="activity"){
            const id=String(event.id||event.stage||"step");
            const step:ActivityStep={
              id,stage:String(event.stage||"work"),label:String(event.label||"Working"),
              detail:String(event.detail||""),done:event.done===true,tool:event.tool?String(event.tool):undefined,
              command:event.command?String(event.command):undefined,output:event.output?String(event.output):undefined,
              domain:event.domain?String(event.domain):undefined,meta:event.meta?String(event.meta):undefined
            };
            const existing=streamEventsRef.current.findIndex(x=>x.id===id);
            const next=streamEventsRef.current.slice();
            if(existing>=0) next[existing]=step;
            else next.push(step);
            streamEventsRef.current=next;
            setStreamEvents(next);
          }else if(event.type==="done"){
            doneData=event;
          }else if(event.type==="error"){
            throw new Error(String(event.error||"Cookie could not answer right now."));
          }
        };
        // The server's "done" event is authoritative. Do not wait for the HTTP
        // connection to close before rendering the completed answer; some proxies
        // keep the stream open briefly after sending the final SSE event.
        while(!doneData){
          const chunk=await reader.read();
          if(chunk.done)break;
          buffer+=decoder.decode(chunk.value,{stream:true});
          const lines=buffer.split("\n");
          buffer=lines.pop()||"";
          for(const line of lines){
            processLine(line);
            if(doneData)break;
          }
        }
        if(!doneData){
          buffer+=decoder.decode();
          if(buffer.trim())processLine(buffer);
        }
        if(doneData&&reader.cancel){
          try{await reader.cancel()}catch{}
        }
        const finalText=String(doneData?.message||assembled||"").trim();
        if(!finalText)throw new Error("Cookie returned an empty response.");
        const finalActivity=streamEventsRef.current.length?streamEventsRef.current.map(x=>({...x,done:true})):[{id:"thinking-final",stage:"thinking",label:"Thinking",detail:"Analyzed the request",done:true}];
        const finalDuration=streamStartedAtRef.current?Date.now()-streamStartedAtRef.current:0;
        const a:Message={
          id:uid(),
          role:"assistant",
          content:finalText,
          files:Array.isArray(doneData?.generatedFiles)?doneData.generatedFiles:[],
          images:Array.isArray(doneData?.generatedImages)?doneData.generatedImages:[],
          sources:Array.isArray(doneData?.sources)?doneData.sources:[],
          activity:finalActivity,
          activityDuration:finalDuration,
          createdAt:Date.now()
        };
        updateChat(c.id,x=>({...x,messages:[...msgs,a],updatedAt:Date.now()}));
        if(a.files?.length)setFiles(p=>[...a.files!,...p].filter((f,i,a)=>a.findIndex(x=>x.path===f.path)===i).slice(0,80));
      }else{
        let d:any=null;
        try{d=await r.json()}catch{throw new Error(r.ok?"Cookie returned an unreadable response.":"Cookie AI is temporarily unavailable.")}
        if(!r.ok)throw new Error(d?.error||"Cookie AI could not answer right now.");
        const a:Message={
          id:uid(),role:"assistant",content:String(d.message||""),
          files:Array.isArray(d.generatedFiles)?d.generatedFiles:[],
          images:Array.isArray(d.generatedImages)?d.generatedImages:[],
          sources:Array.isArray(d.sources)?d.sources:[],
          createdAt:Date.now()
        };
        updateChat(c.id,x=>({...x,messages:[...msgs,a],updatedAt:Date.now()}));
        if(a.files?.length)setFiles(p=>[...a.files!,...p].filter((f,i,a)=>a.findIndex(x=>x.path===f.path)===i).slice(0,80));
      }
    }catch(e:any){
      if(e?.name!=="AbortError"){
        const raw=String(e?.message||"Unknown error.");
        const networkFailure=/load failed|failed to fetch|networkerror|network request failed|stream/i.test(raw);
        let recovered=false;
        // Some mobile/proxy paths can drop a long-lived SSE connection even
        // though the same request works normally. Retry once through the
        // non-streaming API path before surfacing an error to the user.
        if(networkFailure){
          try{
            const fallback=await fetch("/api/chat",{
              method:"POST",
              signal:ctl.signal,
              cache:"no-store",
              headers:{"Content-Type":"application/json","Accept":"application/json"},
              body:JSON.stringify(payload)
            });
            const fallbackData=await fallback.json().catch(()=>null);
            if(fallback.ok&&fallbackData?.message){
              const a:Message={
                id:uid(),role:"assistant",content:String(fallbackData.message),
                files:Array.isArray(fallbackData.generatedFiles)?fallbackData.generatedFiles:[],
                images:Array.isArray(fallbackData.generatedImages)?fallbackData.generatedImages:[],
                sources:Array.isArray(fallbackData.sources)?fallbackData.sources:[],
                createdAt:Date.now()
              };
              updateChat(c.id,x=>({...x,messages:[...msgs,a],updatedAt:Date.now()}));
              if(a.files?.length)setFiles(p=>[...p,...a.files!].filter((f,i,a)=>a.findIndex(x=>x.path===f.path)===i).slice(0,80));
              recovered=true;
            }
          }catch{}
        }
        if(!recovered){
          setStreamText("");setStreamStatus("");
          const message=networkFailure
            ?"Cookie could not connect right now. Please try again."
            :"Cookie could not complete the response right now. Please try again.";
          const a:Message={id:uid(),role:"assistant",content:"I ran into a problem: "+message,createdAt:Date.now()};
          updateChat(c.id,x=>({...x,messages:[...msgs,a],updatedAt:Date.now()}));
        }else{
          setStreamText("");setStreamStatus("");
        }
      }
    }finally{
      setStreamText("");setStreamStatus("");setLoading(false);setAbort(null);setStreamStartedAt(0);setStreamElapsed(0);setStreamEvents([]);
      streamEventsRef.current=[];streamStartedAtRef.current=0;
    }
  }
  function openGPT(id:string){
    const g=GPTS.find(x=>x.id===id); if(!g)return;
    const rank=authUser.plan.toLowerCase()==="max"?2:authUser.plan.toLowerCase()==="pro"||authUser.plan.toLowerCase()==="plus"?1:0;
    const required=g.plan==="max"?2:g.plan==="pro"?1:0;
    if(rank<required){notify(g.name+" requires a "+g.plan.toUpperCase()+" plan.");return}
    const c:Chat={id:uid(),title:g.name,messages:[],model:"standard",temporary:false,updatedAt:Date.now()};
    setChats(p=>[c,...p]);setActiveId(c.id);setSelectedGPT(g);setText("");setAttachments([]);setToolMode(null);setView("gpt-chat");setSidebar(false);
  }
  function newGPTChat(){
    if(!selectedGPT)return;
    const c:Chat={id:uid(),title:selectedGPT.name,messages:[],model:"standard",temporary:false,updatedAt:Date.now()};
    setChats(p=>[c,...p]);setActiveId(c.id);setText("");setAttachments([]);setToolMode(null);setView("gpt-chat");setSidebar(false);
  }

  function retry(m:Message){if(!chat||loading)return;const i=chat.messages.findIndex(x=>x.id===m.id);if(i<1)return;const prior=chat.messages[i-1];updateChat(chat.id,x=>({...x,messages:x.messages.slice(0,i-1),updatedAt:Date.now()}));setText(prior.content);setTimeout(()=>send(prior.content),0)}
  function editMessage(m:Message){
    if(!chat||loading||m.role!=="user")return;
    const i=chat.messages.findIndex(x=>x.id===m.id);if(i<0)return;
    updateChat(chat.id,x=>({...x,messages:x.messages.slice(0,i),updatedAt:Date.now()}));
    setText(m.content);setAttachments(m.attachments||[]);setView("chat");setSidebar(false);
  }
  function forkMessage(m:Message){
    if(!chat||loading)return;
    const i=chat.messages.findIndex(x=>x.id===m.id);if(i<0)return;
    const fork:Chat={id:uid(),title:"Branch · "+titleFrom(chat.title),messages:chat.messages.slice(0,i+1),model:chat.model,temporary:false,updatedAt:Date.now(),branchOf:chat.id,branchMessageId:m.id};
    setChats(p=>[fork,...p]);setActiveId(fork.id);setTemporary(false);setText("");setAttachments([]);setView("chat");setSidebar(false);
  }

  async function share(){
    if(!chat)return;
    try{
      const r=await fetch("/api/chats?share=1",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({title:chat.title,messages:chat.messages.map(m=>({id:m.id,role:m.role,content:m.content,createdAt:m.createdAt}))})});
      const d=await r.json().catch(()=>({}));
      if(!r.ok||!d?.url)throw new Error(d?.error||"Could not create share link.");
      const url=String(d.url);
      try{
        if((navigator as any).share){await (navigator as any).share({title:chat.title,text:"Shared from Cookie AI",url});return}
      }catch{}
      try{await navigator.clipboard.writeText(url);notify("Short share link copied")}catch{window.prompt("Copy this Cookie share link:",url)}
    }catch(e:any){notify(e?.message||"Could not create share link.")}
  }
  async function copy(m:Message){try{await navigator.clipboard.writeText(m.content);notify("Copied to clipboard")}catch{notify("Could not copy this message")}}
  function download(f:GeneratedFile){const url=URL.createObjectURL(new Blob([f.content],{type:"text/plain;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download=f.name;a.click();URL.revokeObjectURL(url)}
  if(view==="gpt-chat"&&selectedGPT&&chat) return <GPTChatPage chat={chat} gpt={selectedGPT} onBack={()=>{setSelectedGPT(null);setView("gpts")}} onNewChat={newGPTChat} onSend={()=>send(undefined,selectedGPT.id)} loading={loading} onStop={()=>abort?.abort()} onVoice={()=>setVoice(true)} onCopy={copy} onRetry={retry} onDelete={m=>updateChat(chat.id,c=>({...c,messages:c.messages.filter(x=>x.id!==m.id)}))} onDownload={download} sendOnEnter={settings.sendOnEnter} value={text} setValue={setText} attachments={attachments} setAttachments={setAttachments} webSearch={webSearch} setWebSearch={setWebSearch} streamText={streamText} streamStatus={streamStatus} streamEvents={streamEvents} streamElapsed={streamElapsed}/>;
  const main=view==="chat"?<ChatView chat={chat} onSend={send} loading={loading} onStop={()=>abort?.abort()} onVoice={()=>setVoice(true)} onCopy={copy} onRetry={retry} onDelete={m=>chat&&updateChat(chat.id,c=>({...c,messages:c.messages.filter(x=>x.id!==m.id)}))} onShare={share} onDownload={download} onEdit={editMessage} onFork={forkMessage} onSave={saveMessage} onInspectSources={setSourceInspect} onQuickAction={runQuickAction} streamText={streamText} streamStatus={streamStatus} streamEvents={streamEvents} streamElapsed={streamElapsed} spatialMode={spatialMode}/>:view==="settings"?<SettingsPage tab={settingsTab} setTab={setSettingsTab} settings={settings} setSettings={setSettings} profile={profile} setProfile={setProfile} setModel={setModel} authUser={authUser} onNavigate={v=>setView(v)}/>:view==="help"?<HelpCenterPage onClose={()=>setView("chat")} onLegal={kind=>setView(kind)}/>:view==="terms"?<LegalPage kind="terms" onBack={()=>setView("help")} onNavigate={kind=>setView(kind)}/>:view==="privacy"?<LegalPage kind="privacy" onBack={()=>setView("help")} onNavigate={kind=>setView(kind)}/>:view==="moderation"?<ModerationPage actorRole={accountRole} onNotice={notify} onError={notify}/>:view==="admin"&&privileged?<AdminPage actorRole={accountRole} onNotice={notify} onError={notify} focusAudit={adminAuditFocus}/>:view==="space"?<SpatialHub chatCount={chats.length} model={MODELS.find(x=>x.id===model)?.name||"CPT-1"} canCode={canSeeCodeStudio} canModerate={isModerator} onNavigate={v=>{setView(v as View);setSidebar(false)}}/>:view==="gpts"?<GPTsPage onOpen={openGPT} plan={authUser.plan}/>:<Page view={view} chats={recent} onOpen={id=>{const target=chats.find(x=>x.id===id);if(!target)return;setActiveId(target.id);setTemporary(Boolean(target.temporary));setView("chat");setSidebar(false)}} onPrompt={p=>{setView("chat");setText(p);setSidebar(false)}} onDownload={download} files={files} savedItems={savedItems}/>;
  if(String(view)==="code"&&canSeeCodeStudio) return <CodeStudioPage onExit={()=>setView("chat")}/>;
  return <><CommandPalette open={commandOpen} query={commandQuery} setQuery={setCommandQuery} onClose={()=>setCommandOpen(false)} onRun={runCommand} chats={chats}/><div className={"cookie-app "+(focusMode&&view==="chat"?"focus-mode":"")}><div className="cookie-ambient-scene" aria-hidden="true"/><button className="mobile-nav-launcher" onClick={()=>setSidebar(true)} aria-label="Open Cookie navigation"><Menu size={20}/></button>
    <div className={"sidebar-overlay "+(sidebar?"show":"")} onClick={()=>setSidebar(false)}/>
    <aside className={"sidebar "+(sidebar?"open":"")}>
      <LiquidGlassBackdrop className="sidebar-glass-layer" options={{profile:"panel",variant:"regular",preset:"balanced",scheme:"adaptive",radius:24,backdropSource:".cookie-ambient-scene"}}/>
      <div className="sidebar-head"><button className="brand" onClick={()=>{setView("chat");setSidebar(false)}}><CookieIcon size={23}/><span>Cookie</span></button><div><button className="side-icon hide-mobile" onClick={()=>setSidebar(false)}><PanelLeft size={18}/></button><button className="side-icon" onClick={()=>createChat(false)} aria-label="New chat"><PenLine size={20}/></button></div></div>
      <div className="switcher"><button className={view==="chat"?"active":""} onClick={()=>{setView("chat");setSidebar(false)}}><MessageSquare size={16}/>Chat</button><button className={view==="work"?"active":""} onClick={()=>{setView("work");setSidebar(false)}}><Zap size={16}/>Work</button></div>
      <div className="sidebar-scroll"><button className={"nav-btn "+(view==="search"?"active":"")} onClick={()=>{setView("search");setSidebar(false)}}><Search size={18}/><span>Search</span><kbd>⌘K</kbd></button><button className={"nav-btn "+(view==="library"?"active":"")} onClick={()=>{setView("library");setSidebar(false)}}><Library size={18}/><span>Library</span></button><button className={"nav-btn "+(view==="projects"?"active":"")} onClick={()=>{setView("projects");setSidebar(false)}}><FolderKanban size={18}/><span>Projects</span></button><button className={"nav-btn "+(view==="memory"?"active":"")} onClick={()=>{setView("memory");setSidebar(false)}}><Brain size={18}/><span>Memory</span></button><button className={"nav-btn "+(view==="space"?"active":"")} onClick={()=>{setView("space");setSidebar(false)}}><Orbit size={18}/><span>Space</span></button><button className={"nav-btn "+(view==="help"?"active":"")} onClick={()=>{setView("help");setSidebar(false)}}><CircleHelp size={18}/><span>Help Center</span></button>{isModerator&&<button className={"nav-btn "+(view==="moderation"?"active":"")} onClick={()=>{setView("moderation");setSidebar(false)}}><ShieldAlert size={18}/><span>Moderation</span></button>}{privileged&&<div className="sidebar-admin-section"><div className="side-label">Administration</div><button className={"nav-btn "+(view==="admin"&&!adminAuditFocus?"active":"")} onClick={()=>{setAdminAuditFocus(false);setView("admin");setSidebar(false)}}><ShieldCheck size={18}/><span>Admin Control</span></button><button className={"nav-btn "+(view==="admin"&&adminAuditFocus?"active":"")} onClick={()=>{setAdminAuditFocus(true);setView("admin");setSidebar(false)}}><FileSearch size={18}/><span>Audit Logs</span></button></div>}{canSeeCodeStudio&&<button className={"nav-btn "+(String(view)==="code"?"active":"")} onClick={()=>{setView("code");setSidebar(false)}}><Code2 size={18}/><span>Code Studio</span></button>}<button className={"nav-btn "+(view==="gpts"||view==="gpt-chat"?"active":"")} onClick={()=>{setView("gpts");setSidebar(false)}}><Sparkles size={18}/><span>GPTs</span></button><button className="nav-btn install-app-nav" onClick={()=>{window.dispatchEvent(new Event("cookie:open-install-app"));setSidebar(false)}}><Download size={18}/><span>Install app</span></button><div className="side-recents-head"><div className="side-label">Recent</div><span>{sidebarRecents.length}</span></div><div className="recent-filter-row"><button className={recentFilter==="all"?"active":""} onClick={()=>setRecentFilter("all")}>All</button><button className={recentFilter==="pinned"?"active":""} onClick={()=>setRecentFilter("pinned")}><Pin size={11}/>Pinned</button><button className={recentFilter==="temporary"?"active":""} onClick={()=>setRecentFilter("temporary")}><Clock3 size={11}/>Temp</button></div><div className="recent-search"><Search size={13}/><input value={recentQuery} onChange={e=>setRecentQuery(e.target.value)} placeholder="Filter chats"/></div>{sidebarRecents.map(c=><ChatRow key={c.id} chat={c} active={c.id===activeId} onOpen={()=>{setActiveId(c.id);setTemporary(!!c.temporary);setView("chat");setSidebar(false)}} onAction={a=>a==="pin"?updateChat(c.id,x=>({...x,pinned:!x.pinned})):a==="archive"?updateChat(c.id,x=>({...x,archived:true})):( !settings.confirmDelete || window.confirm("Delete this chat?") ) && (setChats(p=>p.filter(x=>x.id!==c.id)),setDeletedChatIds(p=>p.includes(c.id)?p:[...p,c.id].slice(-80)))}/>)}</div>
      <div className="sidebar-foot"><button className="nav-btn" onClick={()=>setNewOpen(v=>!v)}><Plus size={18}/><span>Try something new</span><ChevronDown size={15}/></button>{newOpen&&<div className="new-menu popover-pop"><LiquidGlassBackdrop className="menu-glass-layer" options={{profile:"panel",variant:"regular",preset:"balanced",scheme:"adaptive",radius:12}}/><button onClick={()=>createChat(true)}><Clock3 size={17}/><span><b>Temporary chat</b><small>Don't save this chat to history.</small></span></button><button onClick={()=>{setView("work");setNewOpen(false);setSidebar(false)}}><Zap size={17}/><span><b>Work</b><small>Structured tasks.</small></span></button></div>}<button className={"account "+(view==="settings"&&settingsTab==="account"?"active":"")} aria-label="Open account settings" onClick={()=>{setSettingsTab("account");setView("settings");setProfileOpen(false);setSidebar(false)}}><Avatar/><span><b>{profile.name||"Cookie user"}</b><small>{profile.username?("@"+profile.username):"Cookie account"}</small></span><MoreHorizontal size={17}/></button></div>
    </aside>
    <main className="main-shell">
      <header className="topbar"><LiquidGlassBackdrop className="topbar-glass-layer" options={{profile:"bar",variant:"regular",preset:"balanced",scheme:"adaptive",radius:0}}/><div className="top-left"><button className="mobile-menu" onClick={()=>setSidebar(true)} aria-label="Open Cookie navigation"><Menu size={19}/></button><BranchNavigator chat={chat} chats={chats} onOpen={id=>{const target=chats.find(x=>x.id===id);if(!target)return;setActiveId(target.id);setTemporary(Boolean(target.temporary));setView("chat");setSidebar(false)}}/>{view!=="settings"&&<div className="model-wrap"><button className="model-picker" onClick={()=>setModelOpen(v=>!v)}><span>{MODELS.find(x=>x.id===model)?.name}</span><ChevronDown size={15}/></button>{modelOpen&&<div className="model-menu popover-pop"><LiquidGlassBackdrop className="menu-glass-layer" options={{profile:"panel",variant:"regular",preset:"balanced",scheme:"adaptive",radius:12}}/>{MODELS.map(x=>{
  const available=canUseModel(x.id);
  return <button key={x.id} disabled={!available} className={x.id===model?"selected":""} onClick={()=>{if(!available){notify(x.requiredPlan.toUpperCase()+" plan required.");return}setModel(x.id);setModelOpen(false)}}>
    <span><b>{x.name}</b><small>{available?x.detail:x.detail+" · "+x.requiredPlan.toUpperCase()}</small></span>{x.id===model&&<Check size={16}/>}
  </button>
})}<div className="model-effort-section"><div className="model-effort-head"><span>Effort</span><small>Balance speed and depth</small></div><div className="model-effort-grid">{([["light","Light","Fast"],["standard","Standard","Balanced"],["high","High","Deeper"],["ultra","Ultra","Maximum"]] as const).map(([id,label,detail])=><button key={id} className={effort===id?"selected":""} onClick={()=>{setEffort(id);setModelOpen(false)}}><span><b>{label}</b><small>{detail}</small></span>{effort===id&&<Check size={14}/>}</button>)}</div></div></div>}</div>}{chat?.temporary&&view==="chat"&&<span className="temporary-chip"><Clock3 size={13}/>Temporary</span>}</div><div className="top-right"><button className={"top-icon "+(workspaceOpen?"active":"")} onClick={()=>{setWorkspaceOpen(v=>!v);setNotificationsOpen(false)}} aria-label="Saved workspace"><Bookmark size={18}/></button><button className={"top-icon notification-trigger "+(notifications.some(x=>!x.read)?"has-unread":"")} onClick={openNotifications} aria-label="Notifications"><Bell size={18}/>{notifications.some(x=>!x.read)&&<span className="notification-dot" aria-hidden="true"/>}</button>{chat&&view==="chat"&&<button className="top-icon" onClick={share}><Share2 size={18}/></button>}<button className="top-icon" onClick={()=>createChat(false)} aria-label="New chat"><PenLine size={19}/></button><div className="more-wrap"><button className="top-icon" onClick={()=>setMoreOpen(v=>!v)} aria-label="More options"><MoreHorizontal size={19}/></button>{moreOpen&&<div className="top-more-menu popover-pop"><LiquidGlassBackdrop className="menu-glass-layer" options={{profile:"panel",variant:"regular",preset:"balanced",scheme:"adaptive",radius:12}}/><button disabled={!chat} onClick={renameActiveChat}><Pencil size={15}/>Rename</button><button disabled={!chat} onClick={toggleActivePin}><Pin size={15}/>{chat?.pinned?"Unpin":"Pin"}</button><button onClick={()=>{setFocusMode(v=>!v);setMoreOpen(false)}}><PanelLeft size={15}/>{focusMode?"Exit focus mode":"Focus mode"}</button><button disabled={!chat} onClick={archiveActiveChat}><Archive size={15}/>Archive</button><button className="danger" disabled={!chat} onClick={deleteActiveChat}><Trash2 size={15}/>Delete</button></div>}</div></div></header>
      {notificationsOpen&&<NotificationFeed items={notifications} onClose={()=>setNotificationsOpen(false)} onReadAll={markNotificationsRead}/>}
      {workspaceOpen&&<WorkspaceShelf items={savedItems} onClose={()=>setWorkspaceOpen(false)} onDelete={removeSaved}/>}

      {view==="chat"&&<div className="chat-layer">{main}<Composer value={text} setValue={setText} attachments={attachments} setAttachments={setAttachments} loading={loading} onSend={()=>send()} onStop={()=>abort?.abort()} onVoice={()=>setVoice(true)} sendOnEnter={settings.sendOnEnter} webSearch={webSearch} setWebSearch={setWebSearch} memoryEnabled={memoryEnabled} setMemoryEnabled={(v)=>{setMemoryEnabled(v);setSettings((s:any)=>({...s,memory:v}))}} toolMode={toolMode} setToolMode={setToolMode} plan={authUser.plan} onToolNotice={notify} skillId={skillId} setSkillId={setSkillId} spatialMode={spatialMode} onSpatialMode={()=>setSpatialMode(v=>!v)} missionMode={missionMode} onMissionMode={setMissionMode}/></div>}
      {view!=="chat"&&main}
      {sourceInspect&&<SourceInspector message={sourceInspect} onClose={()=>setSourceInspect(null)} onSave={saveSource}/>}
    </main>
    {voice&&<VoiceOverlay onClose={()=>setVoice(false)}/>}<InstallAppExperience authUser={authUser}/>{toast&&<div className="toast" role="status">{toast}</div>}
  </div></>
}

export default function App(){
  const [shareRequested]=useState(()=>/^#share=[a-f0-9]{32}$/i.test(location.hash));
  const [sharedChat,setSharedChat]=useState<Chat|null>(null);
  const [shareLoading,setShareLoading]=useState(()=>/^#share=[a-f0-9]{32}$/i.test(location.hash));
  const [shareError,setShareError]=useState("");
  const [authUser,setAuthUser]=useState<AuthUser|null>(null);
  const [authLoading,setAuthLoading]=useState(true);
  const [authError,setAuthError]=useState("");
  const [authBootError,setAuthBootError]=useState("");
  const [authAttempt,setAuthAttempt]=useState(0);

  const handleAuthenticated=useCallback((user:AuthUser)=>{
    setAuthUser(user);setAuthError("");setAuthBootError("");setAuthLoading(false);
    try{localStorage.setItem("cookie_profile",JSON.stringify({name:user.name,username:user.username,email:user.email}))}catch{}
  },[]);

  useEffect(()=>{
    if(!shareRequested){setShareLoading(false);return}
    let cancelled=false;
    const id=location.hash.slice("#share=".length);
    fetch("/api/chats?share="+encodeURIComponent(id),{cache:"no-store"})
      .then(async r=>{
        const d=await r.json().catch(()=>({}));
        if(cancelled)return;
        if(!r.ok)throw new Error(d?.error||"This share link is unavailable.");
        setSharedChat({id:"shared-"+id,title:String(d.title||"Shared Cookie chat"),messages:Array.isArray(d.messages)?d.messages:[],model:"standard",updatedAt:Number(d.createdAt)||Date.now()});
      })
      .catch((e:any)=>{if(!cancelled)setShareError(e?.message||"This share link is unavailable.")})
      .finally(()=>{if(!cancelled)setShareLoading(false)});
    return()=>{cancelled=true};
  },[shareRequested]);

  useEffect(()=>{
    let cancelled=false;
    setAuthLoading(true);setAuthBootError("");
    fetch("/api/auth/me",{credentials:"same-origin",cache:"no-store"})
      .then(async r=>{
        const d=await r.json().catch(()=>({}));
        if(cancelled)return;
        if(r.ok&&d?.authenticated&&d.user){handleAuthenticated(d.user);return}
        setAuthLoading(false);
        if(r.status===503)setAuthError(d?.error||"Account service is not configured.");
        else if(![401,403].includes(r.status)&&!r.ok)setAuthBootError(d?.error||"The account service returned an unexpected response.");
      })
      .catch((e:any)=>{if(!cancelled){setAuthLoading(false);setAuthBootError(e?.message||"Couldn't reach Cookie's account service.")}});
    return()=>{cancelled=true};
  },[handleAuthenticated,authAttempt]);

  if(shareRequested&&shareLoading) return <CookieBootLoader failed={false} message="" onRetry={()=>location.reload()}/>;
  if(shareRequested&&sharedChat) return <PublicShareView chat={sharedChat} onOpenCookie={()=>{history.replaceState({}, "", location.pathname+location.search);location.reload()}}/>;
  if(shareRequested&&shareError) return <div className="public-share-error"><CookieIcon size={44}/><h1>Share link unavailable</h1><p>{shareError}</p><button onClick={()=>{history.replaceState({}, "", location.pathname+location.search);location.reload()}}>Open Cookie AI</button></div>;
  if(authLoading||authBootError) return <CookieBootLoader failed={Boolean(authBootError)} message={authBootError} onRetry={()=>{setAuthBootError("");setAuthLoading(true);setAuthAttempt(v=>v+1)}}/>;
  if(!authUser) return <AuthPage onAuthenticated={handleAuthenticated} configError={authError}/>;
  return <AuthenticatedApp authUser={authUser} onLogout={()=>{setAuthUser(null);setAuthLoading(false)}}/>;
}