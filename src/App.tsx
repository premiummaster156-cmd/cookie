import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import cookieIconUrl from "../cookie-ai-icon.png";
import AuthPage, { type AuthUser } from "./Auth";
import CodeStudioPage from "./CodeStudioPage";
import { LiquidGlassBackdrop } from "./liquid-glass/React";

import {
  Archive, ArrowUp, Bell, Check, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Copy, Download,
  File as FileIcon, FilePlus2, FolderOpen, Globe2, Image as ImageIcon, Info, Keyboard, Library,
  LogOut, Menu, MessageSquare, MessageSquarePlus, MoreHorizontal, PanelLeft, Pin, Plus, Code2, Clock3,
  Wrench, ImagePlus, FolderKanban, CreditCard, Brain, Sparkles, BookOpen, BarChart3, FileSearch, LockKeyhole, ArrowLeft, PenLine, Orbit, GitBranch, Pencil,
  AlertCircle, RotateCcw, Search, Send, Settings as SettingsIcon, Share2, Square, Trash2, UserRound, ShieldAlert, ShieldCheck,
  Volume2, X, Zap, AppWindow, Smartphone, Monitor, SquareTerminal
} from "lucide-react";

type Role = "user" | "assistant";
type View = "chat" | "search" | "library" | "projects" | "code" | "gpts" | "gpt-chat" | "work" | "space" | "settings" | "help" | "moderation";
type SettingsTab = "general" | "personalization" | "data" | "notifications" | "voice" | "account" | "about";
type Attachment = { id:string; kind:"image"|"file"; name:string; mime:string; data:string; size:number };
type GeneratedFile = { name:string; path:string; content:string; kind?:string };
type GeneratedImage = { dataUrl:string; prompt:string; model?:string };
type SourceRef = { title:string; url:string; domain?:string; snippet?:string };
type ActivityStep = { id:string; label:string; detail:string; stage:string; done?:boolean; tool?:string; command?:string; output?:string; domain?:string; meta?:string };
type Message = { id:string; role:Role; content:string; attachments?:Attachment[]; files?:GeneratedFile[]; images?:GeneratedImage[]; sources?:SourceRef[]; activity?:ActivityStep[]; activityDuration?:number; createdAt:number };
type Chat = { id:string; title:string; messages:Message[]; model:string; temporary?:boolean; pinned?:boolean; archived?:boolean; updatedAt:number };

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
function Inline({text}:{text:string}){
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
  const resizeInput=useCallback(()=>{const t=textRef.current;if(!t)return;t.style.height="52px";const next=Math.min(220,Math.max(52,t.scrollHeight));t.style.height=next+"px"},[]);
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
  const [open,setOpen]=useState(true);
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

function ChatView({chat,onSend,loading,onStop,onVoice,onCopy,onRetry,onDelete,onShare,onDownload,onEdit,onFork,streamText="",streamStatus="",streamEvents=[],streamElapsed=0,spatialMode=false}:{chat:Chat|null;onSend:(text:string)=>void;loading:boolean;onStop:()=>void;onVoice:()=>void;onCopy:(m:Message)=>void;onRetry:(m:Message)=>void;onDelete:(m:Message)=>void;onShare:()=>void;onDownload:(f:GeneratedFile)=>void;onEdit:(m:Message)=>void;onFork:(m:Message)=>void;streamText?:string;streamStatus?:string;streamEvents?:ActivityStep[];streamElapsed?:number;activity?:ActivityStep[];activityDuration?:number;spatialMode?:boolean}){
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
    if(nearBottom||loading&&!streamText) el.scrollTop=el.scrollHeight;
  },[chat?.messages.length,loading,streamText]);
  const messages=chat?.messages||[];
  const starters=[
    ["Explain something","Teach me a difficult topic simply, then quiz me.",BookOpen],
    ["Research live","Research the latest information and cite your sources.",Globe2],
    ["Analyze a file","I’ll attach a file. Find the important points and explain them.",FileSearch],
    ["Build something","Help me build a production-ready solution step by step.",Code2]
  ];
  return <div className="chat-view"><div className="chat-scroll" ref={ref} role="log" aria-live="polite" aria-atomic="false" aria-label="Cookie conversation">{!messages.length?<div className="empty">{spatialMode&&<div className="spatial-hero" aria-hidden="true"><div className="spatial-core"><CookieIcon size={38}/></div><i/><i/><i/><span>SPATIAL WORKSPACE</span></div>}<div className="empty-cookie"><CookieIcon size={34}/></div><h1>What can I help with?</h1><p>Ask anything, or start with one of these.</p><div className="starter-prompts">{starters.map(([label,prompt,Icon])=>{const I=Icon as React.ComponentType<{size?:number}>;return <button key={String(label)} onClick={()=>onSend(String(prompt))}><span><I size={16}/><b>{String(label)}</b></span><ChevronRight size={15}/></button>})}</div></div>:<div className="messages">{messages.map(m=><div className={"message-row "+m.role} key={m.id}><div className="message-body">{m.role==="assistant"&&m.activity?.length?<ActivityTimeline steps={m.activity} elapsed={m.activityDuration||0}/>:null}{m.attachments?.length?<div className="sent-files">{m.attachments.map(a=><div className="sent-file" key={a.id}>{a.kind==="image"?<img src={a.data} alt={a.name}/>:<FileIcon size={17}/>}<span>{a.name}</span></div>)}</div>:null}{m.role==="assistant"?<Rich text={m.content}/>:<div className="user-content">{m.content}</div>}{m.images?.length?<div className="generated-images">{m.images.map((img,i)=><a className="generated-image" key={img.dataUrl+i} href={img.dataUrl} target="_blank" rel="noreferrer" download={"cookie-image-"+(i+1)+".png"}><img src={img.dataUrl} alt={img.prompt||"Generated image"}/><span>Open image</span></a>)}</div>:null}{m.files?.length?<div className="generated-list">{m.files.map(f=><button key={f.path} className="generated-file" onClick={()=>onDownload(f)}><FileIcon size={18}/><span><b>{f.name}</b><small>{f.path}</small></span><Download size={16}/></button>)}</div>:null}{m.sources?.length?<div className="message-sources"><div className="message-sources-head"><Globe2 size={13}/><span>Sources</span><b>{m.sources.length}</b></div><div className="message-sources-list">{m.sources.slice(0,6).map((src,i)=><a key={src.url+i} href={src.url} target="_blank" rel="noreferrer"><span className="source-domain">{src.domain||"web"}</span><strong>{src.title||src.domain||"Source"}</strong></a>)}</div></div>:null}<div className="message-tools"><span>{fmt(m.createdAt)}</span>{m.role==="user"&&<button onClick={()=>onEdit(m)} aria-label="Edit message"><Pencil size={14}/></button>}<button onClick={()=>onFork(m)} aria-label="Fork conversation from this message"><GitBranch size={14}/></button><button onClick={()=>onCopy(m)} aria-label="Copy"><Copy size={14}/></button>{m.role==="assistant"&&<button onClick={()=>onRetry(m)} aria-label="Retry"><RotateCcw size={14}/></button>}<button onClick={onShare} aria-label="Share"><Share2 size={14}/></button><button onClick={()=>onDelete(m)} aria-label="Delete"><Trash2 size={14}/></button></div></div></div>)}{loading&&<div className="message-row assistant streaming-row"><div className="message-body"><ActivityTimeline steps={streamEvents||[]} elapsed={streamElapsed||0} live/>{streamText&&<div className="stream-reply"><Rich text={streamText}/><span className="stream-caret" aria-hidden="true"/></div>}</div></div>}</div>}{showJump&&<button className="chat-jump-latest" onClick={jumpToLatest} aria-label="Jump to latest response"><ChevronDown size={17}/><span>Latest</span></button>}</div></div>;
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
  const initials=(u:any)=>String(u.name||u.username||u.email||"?").trim().split(/\\s+/).slice(0,2).map((x:string)=>x[0]).join("").toUpperCase()||"?";
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
      <div><span>Total</span><strong>{users.length}</strong></div>
      <div><span>Active</span><strong>{count("active")}</strong></div>
      <div><span>Suspended</span><strong>{count("suspended")}</strong></div>
      <div><span>Banned</span><strong>{count("banned")}</strong></div>
    </div>

    <div className="moderation-workspace">
      <section className="moderation-users">
        <div className="moderation-users-head">
          <div><strong>Accounts</strong><span>{loading?"Loading…":filtered.length+" shown"}</span></div>
          <div className="moderation-search"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search accounts"/></div>
        </div>
        <div className="moderation-list">
          {loading?<div className="moderation-loading"><span className="moderation-spinner"/><span>Loading accounts</span></div>:filtered.map(u=><button key={u.id} className={"moderation-user-row "+(selected?.id===u.id?"selected":"")} onClick={()=>setSelected(u)}>
            <span className="moderation-avatar">{initials(u)}</span>
            <span className="moderation-user-main"><b>{u.name||u.username||u.email}</b><small>{u.email}</small></span>
            <span className="moderation-user-meta"><span className={"moderation-user-status "+status(u)}><i/>{status(u)}</span><small>{u.role||"user"}</small></span>
            <ChevronRight size={16}/>
          </button>)}
        </div>
        {!loading&&!filtered.length&&<div className="moderation-empty-list"><Search size={22}/><strong>No matching accounts</strong><span>Try a different name, email, role or status.</span></div>}
      </section>

      <section className={"moderation-card "+(!selected?"is-empty":"")}>
        {!selected?<div className="moderation-empty">
          <div className="moderation-empty-icon"><ShieldCheck size={24}/></div>
          <strong>Ready to moderate</strong>
          <span>Select an account to review its status and available actions.</span>
        </div>:<>
          <div className="moderation-target">
            <div className="moderation-target-identity">
              <span className="moderation-target-avatar">{initials(selected)}</span>
              <div><span>Selected account</span><h2>{selected.name||selected.username||selected.email}</h2><small>{selected.email}</small></div>
            </div>
            <span className={"moderation-status "+status(selected)}><i/>{status(selected)}</span>
          </div>
          <div className="moderation-reason-head"><span>Action reason</span><small>Required for warnings and restrictions</small></div>
          <textarea className="moderation-reason" value={reason} onChange={e=>setReason(e.target.value)} placeholder="Describe what happened and why this action is appropriate…"/>
          <div className="moderation-controls">
            <label><span>Suspension duration</span><div className="moderation-days-input"><input inputMode="numeric" value={days} onChange={e=>setDays(e.target.value.replace(/\\D/g,"").slice(0,3)||"1")}/><small>days</small></div></label>
          </div>
          <div className="moderation-actions">
            <button className="moderation-action warn" onClick={()=>act("warn")} disabled={busy}><ShieldAlert size={15}/><span><b>Warn</b><small>Record a warning</small></span></button>
            {selected.status==="suspended"?<button className="moderation-action safe" onClick={()=>act("unsuspend")} disabled={busy}><Check size={15}/><span><b>Restore</b><small>Remove suspension</small></span></button>:<button className="moderation-action" onClick={()=>act("suspend")} disabled={busy}><Archive size={15}/><span><b>Suspend</b><small>Temporarily restrict</small></span></button>}
            {selected.status==="banned"?<button className="moderation-action safe" onClick={()=>act("unban")} disabled={busy}><Check size={15}/><span><b>Restore</b><small>Remove ban</small></span></button>:<button className="moderation-action danger" onClick={()=>act("ban")} disabled={busy}><Trash2 size={15}/><span><b>Ban</b><small>Block the account</small></span></button>}
          </div>
        </>}
      </section>
    </div>
  </div>;
}
