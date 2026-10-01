import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Archive, ArrowUp, Bell, Check, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Copy, Download,
  File as FileIcon, FilePlus2, FolderOpen, Globe2, Image as ImageIcon, Info, Keyboard, Library,
  LogOut, Menu, MessageSquare, MessageSquarePlus, MoreHorizontal, PanelLeft, Pin, Plus,
  RotateCcw, Search, Send, Settings as SettingsIcon, Share2, Sparkles, Square, Trash2, UserRound,
  Volume2, X, Zap
} from "lucide-react";

type Role = "user" | "assistant";
type View = "chat" | "search" | "library" | "gpts" | "work" | "settings" | "help";
type SettingsTab = "general" | "personalization" | "data" | "notifications" | "voice" | "account" | "about";
type Attachment = { id:string; kind:"image"|"file"; name:string; mime:string; data:string; size:number };
type GeneratedFile = { name:string; path:string; content:string; kind?:string };
type Message = { id:string; role:Role; content:string; attachments?:Attachment[]; files?:GeneratedFile[]; createdAt:number };
type Chat = { id:string; title:string; messages:Message[]; model:string; temporary?:boolean; pinned?:boolean; archived?:boolean; updatedAt:number };

const ICON = "https://raw.githubusercontent.com/premiummaster156-cmd/cookie/main/cookie-ai-icon.png";
const MODELS = [
  { id:"standard", name:"CPT-1", detail:"Fast everyday responses" },
  { id:"max", name:"CPT-2 MAX", detail:"More reasoning and coding" },
  { id:"ultra", name:"CPT-3 ULTRA", detail:"Highest Cookie capability" }
];
const LANG_CODES = ["en","uz","ru","tr","kk","ky","tg","ar","fa","hi","ur","zh","ja","ko","es","fr","de","it","pt","id"];
const LANGUAGES = ["English","Uzbek","Russian","Turkish","Kazakh","Kyrgyz","Tajik","Arabic","Persian","Hindi","Urdu","Chinese","Japanese","Korean","Spanish","French","German","Italian","Portuguese","Indonesian"];
const PERSONALITIES = ["Balanced","Friendly","Professional","Concise","Creative","Teacher"];
const uid = () => (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)) + Date.now().toString(36);
const readJSON = <T,>(key:string, fallback:T):T => { try { return JSON.parse(localStorage.getItem(key) || "") as T; } catch { return fallback; } };
const saveJSON = (key:string, value:unknown) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };
const titleFrom = (s:string) => { const x=s.replace(/\s+/g," ").trim(); return x ? x.slice(0,48) + (x.length>48 ? "…" : "") : "New chat"; };

function CookieIcon({size=24}:{size?:number}) {
  return <img className="cookie-icon" src={ICON} width={size} height={size} alt="" draggable={false}/>;
}
function Avatar({size="sm"}:{size?:"sm"|"md"|"lg"}) {
  return <div className={"avatar avatar-"+size}><span>CR</span></div>;
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
function Rich({text}:{text:string}){
  const fence="```";
  return <div className="rich">{text.split(new RegExp("("+fence+"[^]*?"+fence+")","g")).map((part,pi)=>{
    if(part.startsWith(fence)){
      const nl=part.indexOf("\n");
      const lang=nl>3?part.slice(3,nl).trim():"";
      const code=part.slice(nl>=0?nl+1:3,-3).replace(/^\n|\n$/g,"");
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
  return <div className={"chat-row "+(active?"active":"")}><button className="chat-row-main" onClick={onOpen}><MessageSquare size={16}/><span>{chat.title}</span></button><button className="chat-row-more" onClick={()=>setOpen(v=>!v)}><MoreHorizontal size={16}/></button>{open&&<div className="row-menu"><button onClick={()=>{onAction("pin");setOpen(false)}}><Pin size={15}/>{chat.pinned?"Unpin":"Pin"}</button><button onClick={()=>{onAction("archive");setOpen(false)}}><Archive size={15}/>Archive</button><button className="danger" onClick={()=>{onAction("delete");setOpen(false)}}><Trash2 size={15}/>Delete</button></div>}</div>;
}

function Composer({value,setValue,attachments,setAttachments,loading,onSend,onStop,onVoice}:{value:string;setValue:(v:string)=>void;attachments:Attachment[];setAttachments:React.Dispatch<React.SetStateAction<Attachment[]>>;loading:boolean;onSend:()=>void;onStop:()=>void;onVoice:()=>void}){
  const [open,setOpen]=useState(false);
  const fileRef=useRef<HTMLInputElement>(null), imageRef=useRef<HTMLInputElement>(null), cameraRef=useRef<HTMLInputElement>(null), textRef=useRef<HTMLTextAreaElement>(null);
  useEffect(()=>{const t=textRef.current;if(t){t.style.height="0px";t.style.height=Math.min(220,Math.max(52,t.scrollHeight))+"px"}},[value]);
  const add=(list:FileList|null)=>{if(!list)return;Array.from(list).slice(0,10-attachments.length).forEach(file=>{const r=new FileReader();r.onload=()=>setAttachments(p=>[...p,{id:uid(),kind:file.type.startsWith("image/")?"image":"file",name:file.name,mime:file.type,data:String(r.result||""),size:file.size}]);r.readAsDataURL(file)})};
  return <div className="composer-wrap">
    {!!attachments.length&&<div className="attachment-strip">{attachments.map(a=><div className="attachment-card" key={a.id}>{a.kind==="image"?<img src={a.data} alt=""/>:<div className="file-icon"><FileIcon size={18}/></div>}<div><b>{a.name}</b><span>{Math.max(1,Math.round(a.size/1024))} KB</span></div><button onClick={()=>setAttachments(p=>p.filter(x=>x.id!==a.id))}><X size={14}/></button></div>)}</div>}
    <div className="composer">
      <div className="composer-left"><div className="attach-wrap"><button className="composer-icon" aria-label="Add" onClick={()=>setOpen(v=>!v)}><Plus size={21}/></button>{open&&<div className="attach-menu">
        <button onClick={()=>{imageRef.current?.click();setOpen(false)}}><ImageIcon size={18}/><span>Photos & images</span></button>
        <button onClick={()=>{cameraRef.current?.click();setOpen(false)}}><ImageIcon size={18}/><span>Camera</span></button>
        <button onClick={()=>{fileRef.current?.click();setOpen(false)}}><FilePlus2 size={18}/><span>Upload files</span></button>
        <button onClick={()=>{setValue((value ? value+"\n" : "")+"Search the web for ");setOpen(false);textRef.current?.focus()}}><Globe2 size={18}/><span>Search the web</span></button>
      </div>}</div></div>
      <textarea ref={textRef} value={value} onChange={e=>setValue(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();onSend()}}} placeholder="Message Cookie" rows={1}/>
      <div className="composer-right">{loading?<button className="composer-icon stop" onClick={onStop}><Square size={14} fill="currentColor"/></button>:<button className="composer-icon" onClick={onVoice}><Volume2 size={19}/></button>}{loading?<span className="generating-pill">Generating…</span>:<button className={"send-button "+(!(value.trim()||attachments.length)?"disabled":"")} disabled={!value.trim()&&!attachments.length} onClick={onSend}><ArrowUp size={19}/></button>}</div>
    </div>
    <div className="composer-note">Cookie can make mistakes. Check important info.</div>
    <input hidden ref={imageRef} type="file" accept="image/*" multiple onChange={e=>{add(e.target.files);e.currentTarget.value=""}}/>
    <input hidden ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={e=>{add(e.target.files);e.currentTarget.value=""}}/>
    <input hidden ref={fileRef} type="file" multiple onChange={e=>{add(e.target.files);e.currentTarget.value=""}}/>
  </div>;
}

function ChatView({chat,onSend,loading,onStop,onVoice,onCopy,onRetry,onDelete,onShare,onDownload}:{chat:Chat|null;onSend:(text:string)=>void;loading:boolean;onStop:()=>void;onVoice:()=>void;onCopy:(m:Message)=>void;onRetry:(m:Message)=>void;onDelete:(m:Message)=>void;onShare:()=>void;onDownload:(f:GeneratedFile)=>void}){
  const ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(ref.current)ref.current.scrollTop=ref.current.scrollHeight},[chat?.messages.length,loading]);
  const messages=chat?.messages||[];
  return <div className="chat-view"><div className="chat-scroll" ref={ref}>{!messages.length?<div className="empty"><CookieIcon size={44}/><h1>What can I help with?</h1><div className="starter-grid">{["Explain a difficult topic","Write a polished message","Help me code something","Brainstorm ideas"].map(x=><button key={x} onClick={()=>onSend(x)}>{x}<ChevronRight size={16}/></button>)}</div></div>:<div className="messages">{messages.map(m=><div className={"message-row "+m.role} key={m.id}><div className="message-avatar">{m.role==="assistant"?<CookieIcon size={23}/>:<Avatar/>}</div><div className="message-body"><div className="message-author">{m.role==="assistant"?"Cookie":"You"}</div>{m.attachments?.length?<div className="sent-files">{m.attachments.map(a=><div className="sent-file" key={a.id}>{a.kind==="image"?<img src={a.data} alt={a.name}/>:<FileIcon size={17}/>}<span>{a.name}</span></div>)}</div>:null}{m.role==="assistant"?<Rich text={m.content}/>:<div className="user-content">{m.content}</div>}{m.files?.length?<div className="generated-list">{m.files.map(f=><button key={f.path} className="generated-file" onClick={()=>onDownload(f)}><FileIcon size={18}/><span><b>{f.name}</b><small>{f.path}</small></span><Download size={16}/></button>)}</div>:null}<div className="message-tools"><span>{fmt(m.createdAt)}</span><button onClick={()=>onCopy(m)}><Copy size={14}/></button>{m.role==="assistant"&&<button onClick={()=>onRetry(m)}><RotateCcw size={14}/></button>}<button onClick={onShare}><Share2 size={14}/></button><button onClick={()=>onDelete(m)}><Trash2 size={14}/></button></div></div></div>)}{loading&&<div className="message-row assistant"><div className="message-avatar"><CookieIcon size={23}/></div><div className="message-body"><div className="message-author">Cookie</div><div className="thinking"><i/><i/><i/></div></div></div>}</div>}</div></div>;
}

function SettingsPage({tab,setTab,settings,setSettings,profile,setProfile}:{tab:SettingsTab;setTab:(t:SettingsTab)=>void;settings:any;setSettings:React.Dispatch<React.SetStateAction<any>>;profile:any;setProfile:React.Dispatch<React.SetStateAction<any>>}){
  const tabs:[SettingsTab,string,React.ReactNode][]=[["general","General",<SettingsIcon size={17}/>],["personalization","Personalization",<Plus size={17}/>],["data","Data controls",<Library size={17}/>],["notifications","Notifications",<Bell size={17}/>],["voice","Voice",<Volume2 size={17}/>],["account","Account",<UserRound size={17}/>],["about","About",<Info size={17}/>]];
  const Toggle=({k}:{k:string})=><button className={"toggle "+(settings[k]?"on":"")} onClick={()=>setSettings((s:any)=>({...s,[k]:!s[k]}))}><span/></button>;
  const Row=({title,desc,children}:{title:string;desc:string;children:React.ReactNode})=><div className="set-row"><div><b>{title}</b><span>{desc}</span></div>{children}</div>;
  return <div className="settings-page"><aside><h2>Settings</h2>{tabs.map(([id,label,icon])=><button className={tab===id?"selected":""} key={id} onClick={()=>setTab(id)}>{icon}{label}</button>)}</aside><main><div className="settings-mobile-back"><ChevronLeft size={17}/> Settings</div>
    {tab==="general"&&<section><h1>General</h1><div className="settings-card"><Row title="Appearance" desc="Choose your theme."><select value={settings.theme} onChange={e=>setSettings((s:any)=>({...s,theme:e.target.value}))}><option>System</option><option>Light</option><option>Dark</option></select></Row><Row title="Language" desc="Choose the interface language."><select value={settings.language} onChange={e=>setSettings((s:any)=>({...s,language:e.target.value}))}>{LANGUAGES.map(l=><option key={l}>{l}</option>)}</select></Row><Row title="Animations" desc="Use motion and transitions."><Toggle k="animations"/></Row><Row title="Compact mode" desc="Tighter spacing across Cookie."><Toggle k="compact"/></Row><Row title="Keyboard shortcuts" desc="Show shortcut hints."><Toggle k="keyboard"/></Row></div></section>}
    {tab==="personalization"&&<section><h1>Personalization</h1><div className="settings-card"><Row title="AI personality" desc="How Cookie should sound."><select value={settings.personality} onChange={e=>setSettings((s:any)=>({...s,personality:e.target.value}))}>{PERSONALITIES.map(p=><option key={p}>{p}</option>)}</select></Row><Row title="Memory" desc="Use saved preferences in conversations."><Toggle k="memory"/></Row></div><div className="settings-card standalone"><label>Custom instructions</label><textarea value={settings.instructions} onChange={e=>setSettings((s:any)=>({...s,instructions:e.target.value}))} placeholder="Tell Cookie what you'd like it to know about you…"/></div></section>}
    {tab==="data"&&<section><h1>Data controls</h1><div className="settings-card"><Row title="Chat history" desc="Save conversations locally in this browser."><Toggle k="history"/></Row><Row title="Improve Cookie" desc="Allow anonymized conversations to help improve Cookie."><Toggle k="improve"/></Row></div><div className="danger-zone"><div><b>Delete all chats</b><span>Remove locally saved conversations from this browser.</span></div><button onClick={()=>{localStorage.removeItem("cookie_chats");location.reload()}}>Delete all</button></div></section>}
    {tab==="notifications"&&<section><h1>Notifications</h1><div className="settings-card"><Row title="Responses ready" desc="Get notified when a response finishes."><Toggle k="notifications"/></Row><Row title="Product updates" desc="Occasional Cookie updates."><Toggle k="updates"/></Row></div></section>}
    {tab==="voice"&&<section><h1>Voice</h1><div className="settings-card"><Row title="Preferred voice" desc="Voice used by Cookie."><select value={settings.voice} onChange={e=>setSettings((s:any)=>({...s,voice:e.target.value}))}><option>Arbor</option><option>Breeze</option><option>Cove</option><option>Ember</option><option>Juniper</option></select></Row><Row title="Voice captions" desc="Show text while speaking."><Toggle k="captions"/></Row></div></section>}
    {tab==="account"&&<section><h1>Account</h1><div className="account-card"><Avatar size="lg"/><div><b>{profile.name||"Cookie user"}</b><span>@{profile.username||"cookie-user"}</span><small>{profile.email||"No email saved"}</small></div></div><div className="settings-card standalone fields"><label>Name<input value={profile.name} onChange={e=>setProfile((p:any)=>({...p,name:e.target.value}))}/></label><label>Username<input value={profile.username} onChange={e=>setProfile((p:any)=>({...p,username:e.target.value}))}/></label><label>Email<input value={profile.email} onChange={e=>setProfile((p:any)=>({...p,email:e.target.value}))}/></label></div></section>}
    {tab==="about"&&<section><h1>About Cookie</h1><div className="about-card"><CookieIcon size={48}/><div><b>Cookie AI</b><span>AI workspace for chat, files, coding and everyday questions.</span><small>Cookie Preview • v4</small></div></div><div className="settings-card"><Row title="Help center" desc="Learn how Cookie works."><ChevronRight size={18}/></Row><Row title="Keyboard shortcuts" desc="Search chats with ⌘K / Ctrl+K."><Keyboard size={18}/></Row><Row title="Privacy" desc="Review local data and controls."><CircleHelp size={18}/></Row></div></section>}
  </main></div>;
}

function Page({view,chats,onOpen,onPrompt,onDownload,files}:{view:View;chats:Chat[];onOpen:(id:string)=>void;onPrompt:(p:string)=>void;onDownload:(f:GeneratedFile)=>void;files:GeneratedFile[]}){
  if(view==="search") return <div className="page"><h1>Search</h1><p>Search your conversations.</p><SearchPanel chats={chats} onOpen={onOpen}/></div>;
  if(view==="library") return <div className="page"><h1>Library</h1><p>Your generated files and saved content.</p>{files.length?<div className="library-grid">{files.map(f=><button className="library-item" key={f.path} onClick={()=>onDownload(f)}><FileIcon size={22}/><span><b>{f.name}</b><small>{f.path}</small></span><Download size={16}/></button>)}</div>:<div className="page-empty"><FolderOpen size={40}/><h3>Your Library is empty</h3><span>Generated files will appear here.</span></div>}</div>;
  if(view==="gpts") return <div className="page"><h1>GPTs</h1><p>Specialized Cookie experiences.</p><div className="gpt-grid">{[["Study buddy","Guided learning and explanations."],["Code reviewer","Debug and improve your code."],["Writing partner","Draft polished writing."],["Idea maker","Brainstorm concepts fast."]].map(([a,b])=><button className="gpt-item" key={a} onClick={()=>onPrompt("Act as my "+a+". "+b)}><div className="gpt-icon"><Code2 size={18}/></div><div><b>{a}</b><span>{b}</span></div><ChevronRight size={17}/></button>)}</div></div>;
  if(view==="work") return <div className="work-page"><div className="work-label"><Zap size={16}/> Work</div><h1>Get work done with Cookie</h1><p>Turn a goal into a structured conversation.</p><div className="work-grid"><button onClick={()=>onPrompt("Plan this project step by step and help me complete it.")}>Plan a project</button><button onClick={()=>onPrompt("Break this task into actionable steps.")}>Break down a task</button></div></div>;
  if(view==="help") return <div className="page"><h1>Help with Cookie</h1><p>Quick answers.</p><div className="help-grid">{[["Search","Use Search or ⌘K / Ctrl+K to find conversations."],["Files","Use + in the composer to attach images or files."],["Voice","Use the voice button and allow microphone access."],["Temporary chats","Start a temporary chat from the sidebar menu."]].map(([a,b])=><div className="help-item" key={a}><CircleHelp size={18}/><div><b>{a}</b><span>{b}</span></div></div>)}</div></div>;
  return null;
}
function SearchPanel({chats,onOpen}:{chats:Chat[];onOpen:(id:string)=>void}){
  const [q,setQ]=useState(""); const hits=chats.filter(c=>c.title.toLowerCase().includes(q.toLowerCase())||c.messages.some(m=>m.content.toLowerCase().includes(q.toLowerCase())));
  return <><div className="big-search"><Search size={19}/><input autoFocus placeholder="Search conversations" value={q} onChange={e=>setQ(e.target.value)}/></div><div className="search-list">{q&&hits.map(c=><button key={c.id} onClick={()=>onOpen(c.id)}><MessageSquare size={17}/><span><b>{c.title}</b><small>{c.messages.at(-1)?.content.slice(0,120)||"No messages yet"}</small></span><ChevronRight size={16}/></button>)}{q&&!hits.length&&<div className="page-empty">No results.</div>}</div></>;
}

function VoiceOverlay({onClose}:{onClose:()=>void}){
  const [on,setOn]=useState(false),[text,setText]=useState(""),rec=useRef<any>(null);
  const toggle=()=>{if(on){rec.current?.stop();setOn(false);return}const R=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;if(!R){setText("Voice input is not available in this browser.");return}const r=new R();r.lang="en-US";r.interimResults=true;r.continuous=true;r.onresult=(e:any)=>{let s="";for(let i=e.resultIndex;i<e.results.length;i++)s+=e.results[i][0].transcript;setText(s)};r.onend=()=>setOn(false);r.start();rec.current=r;setOn(true);setText("")};
  useEffect(()=>()=>rec.current?.stop(),[]);
  return <div className="voice-overlay"><button className="voice-close" onClick={onClose}><X/></button><div className={"voice-orb "+(on?"on":"")}><i/><i/><i/></div><h2>{on?"Listening…":"Voice with Cookie"}</h2><p>{text||"Talk naturally with Cookie."}</p><div className="voice-actions"><button onClick={toggle}>{on?<Square size={18}/>:<Volume2 size={20}/>}</button><button onClick={onClose}>Done</button></div></div>;
}

export default function App(){
  const initial=readJSON<Chat[]>("cookie_chats",[]);
  const [chats,setChats]=useState<Chat[]>(initial);
  const [activeId,setActiveId]=useState(initial[0]?.id||"");
  const [view,setView]=useState<View>("chat");
  const [settingsTab,setSettingsTab]=useState<SettingsTab>("general");
  const [sidebar,setSidebar]=useState(false),[model,setModel]=useState(localStorage.getItem("cookie_model")||"standard"),[modelOpen,setModelOpen]=useState(false);
  const [text,setText]=useState(""),[attachments,setAttachments]=useState<Attachment[]>([]),[loading,setLoading]=useState(false),[voice,setVoice]=useState(false),[newOpen,setNewOpen]=useState(false),[profileOpen,setProfileOpen]=useState(false);
  const [temporary,setTemporary]=useState(false),[abort,setAbort]=useState<AbortController|null>(null),[toast,setToast]=useState("");
  const [profile,setProfile]=useState(readJSON("cookie_profile",{name:"Cookie user",username:"cookie-user",email:""}));
  const [settings,setSettings]=useState(readJSON("cookie_settings",{theme:"Dark",language:"English",animations:true,compact:false,keyboard:true,personality:"Balanced",memory:true,instructions:"",history:true,improve:false,notifications:true,updates:false,voice:"Arbor",captions:true}));
  const [files,setFiles]=useState<GeneratedFile[]>(readJSON("cookie_library",[]));
  const chat=chats.find(c=>c.id===activeId)||null;
  const recent=useMemo(()=>chats.filter(c=>!c.archived).sort((a,b)=>b.updatedAt-a.updatedAt),[chats]);
  useEffect(()=>saveJSON("cookie_chats",chats),[chats]); useEffect(()=>saveJSON("cookie_profile",profile),[profile]); useEffect(()=>saveJSON("cookie_settings",settings),[settings]); useEffect(()=>saveJSON("cookie_library",files),[files]); useEffect(()=>localStorage.setItem("cookie_model",model),[model]);
  useEffect(()=>{const theme=settings.theme==="System"?(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):settings.theme.toLowerCase();document.documentElement.dataset.theme=theme;document.body.classList.toggle("compact-mode",settings.compact);document.body.classList.toggle("motion-off",!settings.animations)},[settings]);
  useEffect(()=>{const k=(e:KeyboardEvent)=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="k"){e.preventDefault();setView("search");setSidebar(false)}if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="n"){e.preventDefault();createChat(false)}if(e.key==="Escape"){setModelOpen(false);setNewOpen(false);setProfileOpen(false);setVoice(false)}};addEventListener("keydown",k);return()=>removeEventListener("keydown",k)});
  function notify(message:string){setToast(message);window.setTimeout(()=>setToast(""),1800)}
  function createChat(temp:boolean){const c:Chat={id:uid(),title:temp?"Temporary chat":"New chat",messages:[],model,temporary:temp,updatedAt:Date.now()};setChats(p=>[c,...p]);setActiveId(c.id);setTemporary(temp);setText("");setAttachments([]);setView("chat");setSidebar(false);setNewOpen(false)}
  function updateChat(id:string,fn:(c:Chat)=>Chat){setChats(p=>p.map(c=>c.id===id?fn(c):c))}
  async function send(override?:string){
    const body=(override??text).trim(); if((!body&&!attachments.length)||loading)return;
    let c=chat;if(!c){const n:Chat={id:uid(),title:"New chat",messages:[],model,temporary,updatedAt:Date.now()};setChats(p=>[n,...p]);setActiveId(n.id);c=n}
    const user:Message={id:uid(),role:"user",content:body||"Please analyze these files.",attachments,createdAt:Date.now()};
    const msgs=[...c.messages,user];const ttl=(c.title==="New chat"||c.title==="Temporary chat")?titleFrom(body||attachments[0]?.name||"New chat"):c.title;updateChat(c.id,x=>({...x,title:ttl,messages:msgs,model,updatedAt:Date.now()}));setText("");setAttachments([]);setLoading(true);
    const ctl=new AbortController();setAbort(ctl);
    try{const languageIndex=LANGUAGES.indexOf(settings.language);const r=await fetch("/api/chat",{method:"POST",signal:ctl.signal,headers:{"Content-Type":"application/json"},body:JSON.stringify({model,messages:msgs.map(m=>({role:m.role,content:m.content})),attachments:user.attachments||[],preferences:{responseMode:model,language:LANG_CODES[languageIndex]||"auto",answerLength:"auto",creativity:.7,memory:settings.memory,personality:settings.personality,profile}})});const d=await r.json();if(!r.ok)throw new Error(d.error||"Cookie could not answer right now.");const a:Message={id:uid(),role:"assistant",content:String(d.message||""),files:Array.isArray(d.generatedFiles)?d.generatedFiles:[],createdAt:Date.now()};updateChat(c.id,x=>({...x,messages:[...msgs,a],updatedAt:Date.now()}));if(a.files?.length)setFiles(p=>[...a.files!,...p].filter((f,i,a)=>a.findIndex(x=>x.path===f.path)===i).slice(0,80))}catch(e:any){if(e?.name!=="AbortError"){const a:Message={id:uid(),role:"assistant",content:"I ran into a problem: "+(e?.message||"Unknown error."),createdAt:Date.now()};updateChat(c.id,x=>({...x,messages:[...msgs,a],updatedAt:Date.now()}))}}finally{setLoading(false);setAbort(null)}
  }
  function retry(m:Message){if(!chat||loading)return;const i=chat.messages.findIndex(x=>x.id===m.id);if(i<1)return;const prior=chat.messages[i-1];updateChat(chat.id,x=>({...x,messages:x.messages.slice(0,i-1),updatedAt:Date.now()}));setText(prior.content);setTimeout(()=>send(prior.content),0)}
  async function share(){if(!chat)return;const payload=JSON.stringify({title:chat.title,messages:chat.messages.map(m=>({role:m.role,content:m.content}))});const url=location.origin+location.pathname+"#share="+btoa(unescape(encodeURIComponent(payload)));try{await (navigator as any).share?.({title:chat.title,url})}catch{try{await navigator.clipboard.writeText(url)}catch{}}}
  async function copy(m:Message){try{await navigator.clipboard.writeText(m.content)}catch{}}
  function download(f:GeneratedFile){const url=URL.createObjectURL(new Blob([f.content],{type:"text/plain;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download=f.name;a.click();URL.revokeObjectURL(url)}
  const main=view==="chat"?<ChatView chat={chat} onSend={send} loading={loading} onStop={()=>abort?.abort()} onVoice={()=>setVoice(true)} onCopy={copy} onRetry={retry} onDelete={m=>chat&&updateChat(chat.id,c=>({...c,messages:c.messages.filter(x=>x.id!==m.id)}))} onShare={share} onDownload={download}/>:view==="settings"?<SettingsPage tab={settingsTab} setTab={setSettingsTab} settings={settings} setSettings={setSettings} profile={profile} setProfile={setProfile}/>:<Page view={view} chats={recent} onOpen={id=>{setActiveId(id);setView("chat");setSidebar(false)}} onPrompt={p=>{setView("chat");setText(p);setSidebar(false)}} onDownload={download} files={files}/>;
  return <div className="cookie-app">
    <div className={"sidebar-overlay "+(sidebar?"show":"")} onClick={()=>setSidebar(false)}/>
    <aside className={"sidebar "+(sidebar?"open":"")}>
      <div className="sidebar-head"><button className="brand" onClick={()=>setView("chat")}><CookieIcon size={23}/><span>Cookie</span></button><div><button className="side-icon hide-mobile" onClick={()=>setSidebar(false)}><PanelLeft size={18}/></button><button className="side-icon" onClick={()=>createChat(false)}><MessageSquarePlus size={18}/></button></div></div>
      <div className="switcher"><button className={view==="chat"?"active":""} onClick={()=>setView("chat")}><MessageSquare size={16}/>Chat</button><button className={view==="work"?"active":""} onClick={()=>setView("work")}><Zap size={16}/>Work</button></div>
      <div className="sidebar-scroll"><button className="nav-btn" onClick={()=>setView("search")}><Search size={18}/><span>Search</span><kbd>⌘K</kbd></button><button className="nav-btn" onClick={()=>setView("library")}><Library size={18}/><span>Library</span></button><button className="nav-btn" onClick={()=>setView("gpts")}><Sparkles size={18}/><span>GPTs</span></button><div className="side-label">Recent</div>{recent.map(c=><ChatRow key={c.id} chat={c} active={c.id===activeId} onOpen={()=>{setActiveId(c.id);setTemporary(!!c.temporary);setView("chat");setSidebar(false)}} onAction={a=>a==="pin"?updateChat(c.id,x=>({...x,pinned:!x.pinned})):a==="archive"?updateChat(c.id,x=>({...x,archived:true})):setChats(p=>p.filter(x=>x.id!==c.id))}/>)}</div>
      <div className="sidebar-foot"><button className="nav-btn" onClick={()=>setNewOpen(v=>!v)}><Plus size={18}/><span>Try something new</span><ChevronDown size={15}/></button>{newOpen&&<div className="new-menu"><button onClick={()=>createChat(true)}><Clock3 size={17}/><span><b>Temporary chat</b><small>Don't save this chat to history.</small></span></button><button onClick={()=>{setView("work");setNewOpen(false)}}><Zap size={17}/><span><b>Work</b><small>Structured tasks.</small></span></button></div>}<button className="account" onClick={()=>setProfileOpen(v=>!v)}><Avatar/><span><b>{profile.name||"Cookie user"}</b><small>Cookie Preview</small></span><MoreHorizontal size={17}/></button>{profileOpen&&<div className="profile-menu"><div className="profile-menu-head"><Avatar size="md"/><div><b>{profile.name}</b><span>@{profile.username}</span></div></div><button onClick={()=>{setSettingsTab("account");setView("settings");setProfileOpen(false)}}><UserRound size={16}/>Account</button><button onClick={()=>{setSettingsTab("general");setView("settings");setProfileOpen(false)}}><SettingsIcon size={16}/>Settings</button><button onClick={()=>{setView("help");setProfileOpen(false)}}><CircleHelp size={16}/>Help</button><div className="divider"/><button className="danger" onClick={()=>{localStorage.clear();location.reload()}}><LogOut size={16}/>Log out</button></div>}</div>
    </aside>
    <main className="main-shell">
      <header className="topbar"><div className="top-left"><button className="mobile-menu" onClick={()=>setSidebar(true)}><Menu size={20}/></button>{view!=="settings"&&<div className="model-wrap"><button className="model-picker" onClick={()=>setModelOpen(v=>!v)}><span>{MODELS.find(x=>x.id===model)?.name}</span><ChevronDown size={15}/></button>{modelOpen&&<div className="model-menu">{MODELS.map(x=><button key={x.id} className={x.id===model?"selected":""} onClick={()=>{setModel(x.id);setModelOpen(false)}}><span><b>{x.name}</b><small>{x.detail}</small></span>{x.id===model&&<Check size={16}/>}</button>)}</div>}</div>}{chat?.temporary&&view==="chat"&&<span className="temporary-chip"><Sparkles size={13}/>Temporary</span>}</div><div className="top-right">{chat&&view==="chat"&&<button className="top-icon" onClick={share}><Share2 size={18}/></button>}<button className="top-icon" onClick={()=>createChat(false)}><Plus size={19}/></button><button className="top-icon" onClick={()=>notify("More chat options are coming soon.")} aria-label="More options"><MoreHorizontal size={19}/></button></div></header>
      {view==="chat"&&<div className="chat-layer">{main}<Composer value={text} setValue={setText} attachments={attachments} setAttachments={setAttachments} loading={loading} onSend={()=>send()} onStop={()=>abort?.abort()} onVoice={()=>setVoice(true)}/></div>}
      {view!=="chat"&&main}
    </main>
    {voice&&<VoiceOverlay onClose={()=>setVoice(false)}/>}
  </div>;
}
