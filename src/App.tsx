import React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowUp, ChevronDown, Command, Copy, Download, FileCode2, Folder,
  HelpCircle, Image as ImageIcon, Menu, MessageSquare, MoreHorizontal,
  Paperclip, Plus, Search, Settings, Sparkles, SquarePen, Trash2, X,
  PanelRight, Sun, Moon, Check, ExternalLink, Zap, Code2, BrainCircuit
} from "lucide-react";

type Msg={id:string;role:"user"|"assistant";content:string;images?:string[]};
type FileItem={path:string;content:string;kind?:string};
const MODELS=[
 {id:"standard",name:"CPT-1",desc:"Fast everyday assistant",icon:Zap},
 {id:"max",name:"CPT-2 MAX",desc:"Deep reasoning & coding",icon:BrainCircuit},
 {id:"ultra",name:"CPT-3 ULTRA",desc:"Maximum agentic capability",icon:Sparkles}
];
const STARTERS=[
 {title:"Build something",desc:"Create a complete project",icon:Code2,prompt:"Build a complete project in my workspace."},
 {title:"Explain a topic",desc:"Learn something difficult",icon:BrainCircuit,prompt:"Explain a difficult topic simply and clearly."},
 {title:"Debug my code",desc:"Find and fix issues",icon:Code2,prompt:"Inspect my project and find the most important bug to fix."},
 {title:"Write for me",desc:"Draft polished content",icon:SquarePen,prompt:"Draft polished content for me."}
];
const id=()=>Math.random().toString(36).slice(2)+Date.now().toString(36);

export default function App(){
 const reduce=useReducedMotion();
 const [messages,setMessages]=useState<Msg[]>([]);
 const [input,setInput]=useState("");
 const [model,setModel]=useState("standard");
 const [modelOpen,setModelOpen]=useState(false);
 const [workspace,setWorkspace]=useState<FileItem[]>([]);
 const [drawer,setDrawer]=useState(false);
 const [sidebar,setSidebar]=useState(true);
 const [loading,setLoading]=useState(false);
 const [images,setImages]=useState<string[]>([]);
 const [panel,setPanel]=useState<"settings"|"help"|null>(null);
 const [dark,setDark]=useState(true);
 const [query,setQuery]=useState("");
 const fileRef=useRef<HTMLInputElement>(null);
 const bottom=useRef<HTMLDivElement>(null);
 const active=useMemo(()=>MODELS.find(x=>x.id===model)||MODELS[0],[model]);

 useEffect(()=>{try{const x=JSON.parse(localStorage.getItem("cookie_workspace")||"[]");if(Array.isArray(x))setWorkspace(x)}catch{}},[]);
 useEffect(()=>localStorage.setItem("cookie_workspace",JSON.stringify(workspace)),[workspace]);
 useEffect(()=>bottom.current?.scrollIntoView({behavior:reduce?"auto":"smooth"}),[messages,loading,reduce]);

 async function send(raw=input){
   const text=raw.trim(); if(!text||loading)return;
   const next=[...messages,{id:id(),role:"user" as const,content:text,images}];
   setMessages(next);setInput("");setImages([]);setLoading(true);
   try{
     const r=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},
       body:JSON.stringify({messages:next.map(m=>({role:m.role,content:m.content})),preferences:{responseMode:model,language:"auto",answerLength:"auto",creativity:.7},workspace,attachments:images.map(data=>({kind:"image",data}))})});
     const d=await r.json();if(!r.ok)throw Error(d.error||"Cookie could not answer.");
     if(Array.isArray(d.workspace))setWorkspace(d.workspace);
     setMessages(v=>[...v,{id:id(),role:"assistant",content:d.message||"Done."}]);
   }catch(e){setMessages(v=>[...v,{id:id(),role:"assistant",content:"Error: "+(e instanceof Error?e.message:"Something went wrong.") }]);}
   finally{setLoading(false)}
 }
 async function attach(e:React.ChangeEvent<HTMLInputElement>){
   const fs=Array.from(e.target.files||[]).filter(f=>f.type.startsWith("image/")).slice(0,4);
   const xs=await Promise.all(fs.map(f=>new Promise<string>(res=>{const r=new FileReader();r.onload=()=>res(String(r.result));r.readAsDataURL(f)})));
   setImages(v=>[...v,...xs]);e.target.value="";
 }
 function newChat(){setMessages([]);setInput("");setImages([])}
 function download(){
   const blob=new Blob([workspace.map(f=>"===== "+f.path+" =====\n"+f.content).join("\n\n")],{type:"text/plain"});
   const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="cookie-project.txt";a.click();
 }
 const visibleFiles=workspace.filter(f=>f.path.toLowerCase().includes(query.toLowerCase()));

 return <main className={dark?"cookie dark":"cookie light"}>
   <AnimatePresence initial={false}>
    {sidebar&&<motion.aside className="sidebar" initial={{width:0,opacity:0}} animate={{width:260,opacity:1}} exit={{width:0,opacity:0}} transition={{duration:.22}}>
      <div className="sidebar-inner">
        <div className="brand-row">
          <div className="brand-mark">C</div><span className="brand-name">Cookie</span>
          <button className="icon-btn subtle" aria-label="Close sidebar" onClick={()=>setSidebar(false)}><PanelRight size={17}/></button>
        </div>
        <button className="new-chat" onClick={newChat}><Plus size={17}/><span>New chat</span><kbd>⌘ K</kbd></button>
        <div className="side-section">
          <div className="section-label">Workspace</div>
          <button className="side-item selected"><MessageSquare size={17}/><span>Chat</span></button>
          <button className="side-item" onClick={()=>setDrawer(true)}><Folder size={17}/><span>Project files</span>{workspace.length>0&&<em>{workspace.length}</em>}</button>
        </div>
        <div className="side-section">
          <div className="section-label">Recent</div>
          {messages.length>0?<button className="recent-chat"><span className="recent-dot"/><span>Current conversation</span></button>:<div className="empty-recent">Your conversations will appear here.</div>}
        </div>
        <div className="sidebar-spacer"/>
        <button className="side-item" onClick={()=>setPanel("settings")}><Settings size={17}/><span>Settings</span></button>
        <button className="side-item" onClick={()=>setPanel("help")}><HelpCircle size={17}/><span>Help & shortcuts</span></button>
        <div className="preview-card"><div><span className="status-dot"/>Preview</div><small>Free access · AI can make mistakes</small></div>
      </div>
    </motion.aside>}
   </AnimatePresence>

   <section className="main">
     <header className="topbar">
       <div className="top-left">
         {!sidebar&&<button className="icon-btn" aria-label="Open sidebar" onClick={()=>setSidebar(true)}><Menu size={18}/></button>}
         <span className="crumb">Chat</span><span className="slash">/</span>
         <div className="model-picker">
           <button className="model-trigger" onClick={()=>setModelOpen(v=>!v)} aria-expanded={modelOpen}>
             {React.createElement(active.icon,{size:15})}<span>{active.name}</span><ChevronDown size={14}/>
           </button>
           <AnimatePresence>{modelOpen&&<motion.div className="model-popover" initial={{opacity:0,y:-5,scale:.98}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:-4}} transition={{duration:.15}}>
             <div className="popover-label">Cookie models</div>
             {MODELS.map(m=><button className={"model-option "+(m.id===model?"chosen":"")} key={m.id} onClick={()=>{setModel(m.id);setModelOpen(false)}}>
               <span className="model-icon">{React.createElement(m.icon,{size:15})}</span><span><b>{m.name}</b><small>{m.desc}</small></span>{m.id===model&&<Check size={15}/>}
             </button>)}
           </motion.div>}</AnimatePresence>
         </div>
       </div>
       <div className="top-actions">
         <button className="icon-btn" aria-label="Search"><Search size={17}/></button>
         <button className="icon-btn" aria-label="Project files" onClick={()=>setDrawer(true)}><Folder size={17}/></button>
         <button className="avatar-menu" aria-label="Account menu">D</button>
       </div>
     </header>

     <div className="chat-scroll">
       {messages.length===0?
         <motion.div className="welcome" initial={{opacity:0,y:reduce?0:12}} animate={{opacity:1,y:0}} transition={{duration:.35}}>
           <div className="welcome-mark"><Sparkles size={25}/></div>
           <div className="eyebrow">COOKIE AI WORKSPACE</div>
           <h1>What are you working on?</h1>
           <p>Ask a question, share an image, or give Cookie a project to build.</p>
           <div className="starter-grid">
             {STARTERS.map((s,i)=><motion.button key={s.title} className="starter" whileHover={reduce?undefined:{y:-2}} whileTap={reduce?undefined:{scale:.985}} transition={{duration:.16}} onClick={()=>send(s.prompt)}>
               <span className="starter-icon">{React.createElement(s.icon,{size:17})}</span><span><b>{s.title}</b><small>{s.desc}</small></span><ArrowUp size={15}/>
             </motion.button>)}
           </div>
         </motion.div>
       :
         <div className="conversation">
           {messages.map(m=><motion.article key={m.id} className={"message "+m.role} initial={{opacity:0,y:reduce?0:10}} animate={{opacity:1,y:0}} transition={{duration:.22}}>
             <div className="message-meta">{m.role==="assistant"?<><span className="mini-mark">C</span><b>Cookie</b></>:<><span>You</span></>}</div>
             <div className="message-body">
               {m.images?.map((x,i)=><img className="message-image" key={i} src={x} alt="Uploaded attachment"/>)}
               <Message text={m.content}/>
               {m.role==="assistant"&&<div className="message-tools"><button><Copy size={13}/>Copy</button><button><MoreHorizontal size={13}/>More</button></div>}
             </div>
           </motion.article>)}
         </div>
       }
       {loading&&<div className="thinking"><span className="thinking-mark"><Sparkles size={13}/></span><span>Cookie is working</span><i/><i/><i/></div>}
       <div ref={bottom}/>
     </div>

     <div className="composer-zone">
       {images.length>0&&<div className="attachments">{images.map((x,i)=><div className="attachment" key={i}><img src={x} alt="Preview"/><button onClick={()=>setImages(v=>v.filter((_,j)=>j!==i))} aria-label="Remove attachment"><X size={12}/></button></div>)}</div>}
       <motion.div className="composer" animate={reduce?undefined:{borderColor:input?"rgba(196,145,91,.52)":"rgba(255,255,255,.10)"}}>
         <textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send()}}} placeholder="Message Cookie..." aria-label="Message Cookie"/>
         <div className="composer-bottom">
           <div className="composer-left">
             <button className="composer-btn" onClick={()=>fileRef.current?.click()}><Paperclip size={15}/><span>Attach</span></button>
             <span className="hint">Shift + Enter for new line</span>
           </div>
           <button className="send-btn" disabled={!input.trim()||loading} onClick={()=>send()} aria-label="Send message"><ArrowUp size={17}/></button>
         </div>
       </motion.div>
       <input ref={fileRef} hidden type="file" accept="image/*" multiple onChange={attach}/>
       <div className="composer-note">Cookie can make mistakes. Verify important information.</div>
     </div>
   </section>

   <button className="floating-files" onClick={()=>setDrawer(true)} aria-label="Open project files"><Folder size={17}/>{workspace.length>0&&<span>{workspace.length}</span>}</button>

   <AnimatePresence>
    {drawer&&<><motion.div className="overlay" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={()=>setDrawer(false)}/>
    <motion.aside className="workspace-panel" initial={{x:"100%"}} animate={{x:0}} exit={{x:"100%"}} transition={{duration:.25}}>
      <div className="panel-header"><div><span className="eyebrow">PROJECT</span><h2>Workspace</h2><p>{workspace.length} {workspace.length===1?"file":"files"} · local preview</p></div><button className="icon-btn" onClick={()=>setDrawer(false)} aria-label="Close workspace"><X size={18}/></button></div>
      <div className="panel-toolbar"><div className="search-box"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Find a file"/></div><button className="toolbar-btn" onClick={download} disabled={!workspace.length}><Download size={15}/></button></div>
      <div className="file-list">{visibleFiles.length?visibleFiles.map(f=><div className="file-row" key={f.path}><span className="file-icon">{f.kind==="folder"?<Folder size={15}/>:<FileCode2 size={15}/>}</span><span className="file-info"><b>{f.path}</b><small>{f.content.length.toLocaleString()} characters</small></span><button className="row-more" aria-label={"Actions for "+f.path}><MoreHorizontal size={15}/></button></div>):<div className="files-empty"><Folder size={28}/><b>No project files yet</b><p>Ask Cookie to create a project and its files will appear here.</p></div>}</div>
    </motion.aside></>}
   </AnimatePresence>

   <AnimatePresence>
    {panel&&<motion.div className="modal-overlay" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={()=>setPanel(null)}>
      <motion.section className="settings-modal" initial={{opacity:0,y:12,scale:.98}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:8}} onClick={e=>e.stopPropagation()}>
        <div className="modal-title"><div><span className="eyebrow">{panel==="settings"?"PREFERENCES":"SUPPORT"}</span><h2>{panel==="settings"?"Settings":"Help & shortcuts"}</h2></div><button className="icon-btn" onClick={()=>setPanel(null)}><X size={18}/></button></div>
        {panel==="settings"?<div className="settings-list">
          <div className="setting"><div><b>Appearance</b><small>Choose how Cookie looks.</small></div><button className="segmented" onClick={()=>setDark(v=>!v)}>{dark?<><Moon size={14}/>Dark</>:<><Sun size={14}/>Light</>}</button></div>
          <div className="setting"><div><b>Workspace</b><small>Projects are stored locally in this preview.</small></div><span className="setting-value">Local</span></div>
          <div className="setting"><div><b>AI model</b><small>Current model profile.</small></div><span className="setting-value">{active.name}</span></div>
        </div>:<div className="help-grid">
          <div className="help-card"><kbd>Enter</kbd><span>Send message</span></div><div className="help-card"><kbd>Shift</kbd><span>+ Enter for new line</span></div><div className="help-card"><kbd>⌘ K</kbd><span>New conversation</span></div><div className="help-card"><kbd>Esc</kbd><span>Close panels</span></div>
        </div>}
      </motion.section>
    </motion.div>}
   </AnimatePresence>
 </main>;
}

function Message({text}:{text:string}){return <div className="message-text">{text.split("\n").map((x,i)=><p key={i}>{x||" "}</p>)}</div>}
