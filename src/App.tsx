import React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import PerfectScrollbar from "perfect-scrollbar";
import "perfect-scrollbar/css/perfect-scrollbar.css";
import {
  ArrowUp, ChevronDown, Check, Copy, FileText, FileUp, ImagePlus,
  HelpCircle, Menu, MessageSquare, MoreHorizontal, Paperclip, Plus,
  Search, Settings, X, PanelRight, SlidersHorizontal,
  Keyboard, ShieldCheck, Palette, MessageCircleQuestion, Wrench,
  Code2, Globe2, ScanSearch
} from "lucide-react";

type Attachment={id:string;kind:"image"|"file";name:string;mime:string;data:string};
type GeneratedFile={name:string;path:string;content:string;kind?:string};
type Msg={id:string;role:"user"|"assistant";content:string;attachments?:Attachment[];files?:GeneratedFile[];time?:string};
type View="chat"|"settings"|"help";

const COOKIE_ICON_URL="https://raw.githubusercontent.com/premiummaster156-cmd/cookie/main/cookie-ai-icon.png";
const MODELS=[
  {id:"standard",name:"CPT-1",desc:"Fast everyday assistant"},
  {id:"max",name:"CPT-2 MAX",desc:"Deep reasoning & coding"},
  {id:"ultra",name:"CPT-3 ULTRA",desc:"Maximum agentic capability"}
];
const id=()=>Math.random().toString(36).slice(2)+Date.now().toString(36);

function CookieIcon({size=22}:{size?:number}){
  return <img className="cookie-ai-icon" src={COOKIE_ICON_URL} width={size} height={size} alt="Cookie AI" draggable={false}/>;
}

export default function App(){
  const [messages,setMessages]=useState<Msg[]>([]);
  const [input,setInput]=useState("");
  const [model,setModel]=useState("standard");
  const [modelOpen,setModelOpen]=useState(false);
  const [sidebarOpen,setSidebarOpen]=useState(false);
  const [loading,setLoading]=useState(false);
  const [attachments,setAttachments]=useState<Attachment[]>([]);
  const [attachMenuOpen,setAttachMenuOpen]=useState(false);
  const [toolsOpen,setToolsOpen]=useState(false);
  const [view,setView]=useState<View>("chat");
  const [dark,setDark]=useState(true);
  const [accent,setAccent]=useState<"orange"|"cream"|"cocoa">("cream");
  const [textSize,setTextSize]=useState<"small"|"medium"|"large">("medium");
  const [compact,setCompact]=useState(false);
  const [animations,setAnimations]=useState(true);
  const [keyboardHints,setKeyboardHints]=useState(true);
  const [search,setSearch]=useState("");
  const imageRef=useRef<HTMLInputElement>(null);
  const fileRef=useRef<HTMLInputElement>(null);
  const chatScroll=useRef<HTMLDivElement>(null);
  const active=useMemo(()=>MODELS.find(x=>x.id===model)||MODELS[0],[model]);

  useEffect(()=>{
    try{
      const p=JSON.parse(localStorage.getItem("cookie_preferences")||"{}");
      if(p.dark!==undefined)setDark(Boolean(p.dark));
      if(p.accent)setAccent(p.accent);
      if(p.textSize)setTextSize(p.textSize);
      if(p.compact!==undefined)setCompact(Boolean(p.compact));
      if(p.animations!==undefined)setAnimations(Boolean(p.animations));
      if(p.keyboardHints!==undefined)setKeyboardHints(Boolean(p.keyboardHints));
    }catch{}
  },[]);
  useEffect(()=>localStorage.setItem("cookie_preferences",JSON.stringify({dark,accent,textSize,compact,animations,keyboardHints})),[dark,accent,textSize,compact,animations,keyboardHints]);
  useEffect(()=>{
    document.body.classList.toggle("sidebar-open",sidebarOpen);
    return ()=>document.body.classList.remove("sidebar-open");
  },[sidebarOpen]);
  useEffect(()=>{
    document.documentElement.dataset.theme=dark?"dark":"light";
    document.documentElement.dataset.accent=accent;
    document.documentElement.dataset.textSize=textSize;
    document.body.classList.toggle("compact-messages",compact);
    document.body.classList.toggle("animations-off",!animations);
    document.body.classList.toggle("keyboard-hints-off",!keyboardHints);
  },[dark,accent,textSize,compact,animations,keyboardHints]);
  useEffect(()=>{
    if(view!=="chat"||!chatScroll.current)return;
    const ps=new PerfectScrollbar(chatScroll.current,{wheelPropagation:false,suppressScrollX:true,minScrollbarLength:28});
    return ()=>ps.destroy();
  },[view]);
  useEffect(()=>{
    if(view==="chat"&&chatScroll.current){
      const el=chatScroll.current;
      requestAnimationFrame(()=>{el.scrollTop=el.scrollHeight;});
    }
  },[messages,loading,view]);

  async function send(raw=input){
    const text=raw.trim();
    if((!text&&!attachments.length)||loading)return;
    const now=new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"});
    const next=[...messages,{id:id(),role:"user" as const,content:text,attachments,time:now}];
    setMessages(next);setInput("");setAttachments([]);setLoading(true);setView("chat");setAttachMenuOpen(false);setToolsOpen(false);
    try{
      const r=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({messages:next.map(m=>({role:m.role,content:m.content})),preferences:{responseMode:model,language:"auto",answerLength:"auto",creativity:.7},attachments:attachments.map(a=>({kind:a.kind,name:a.name,mime:a.mime,data:a.data}))})});
      const d=await r.json();
      if(!r.ok)throw Error(d.error||"Cookie could not answer.");
      setMessages(v=>[...v,{id:id(),role:"assistant",content:d.message||"Done.",files:Array.isArray(d.generatedFiles)?d.generatedFiles:[],time:new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}]);
    }catch(e){setMessages(v=>[...v,{id:id(),role:"assistant",content:"Error: "+(e instanceof Error?e.message:"Something went wrong.")}] );}
    finally{setLoading(false)}
  }
  async function attach(e:React.ChangeEvent<HTMLInputElement>,kind:"image"|"file"){
    const selected=Array.from(e.target.files||[]);
    const valid=selected.filter(f=>kind==="image"?f.type.startsWith("image/"):!f.type.startsWith("image/")).slice(0,10-attachments.length);
    const xs=await Promise.all(valid.map(f=>new Promise<Attachment>(res=>{
      const reader=new FileReader();reader.onload=()=>res({id:id(),kind,name:f.name,mime:f.type||"application/octet-stream",data:String(reader.result)});reader.readAsDataURL(f);
    })));
    setAttachments(v=>[...v,...xs].slice(0,10));e.target.value="";setAttachMenuOpen(false);
  }
  function openPicker(kind:"image"|"file"){setAttachMenuOpen(false);requestAnimationFrame(()=>{(kind==="image"?imageRef:fileRef).current?.click()})}
  function removeAttachment(removeId:string){setAttachments(v=>v.filter(a=>a.id!==removeId))}
  function newChat(){setMessages([]);setInput("");setAttachments([]);setView("chat");setSidebarOpen(false)}
  function openView(next:View){setView(next);setSidebarOpen(false);setModelOpen(false);setAttachMenuOpen(false);setToolsOpen(false)}
  function downloadFile(file:GeneratedFile){const blob=new Blob([file.content],{type:"text/plain;charset=utf-8"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=file.name||file.path.split("/").pop()||"cookie-file.txt";a.click();URL.revokeObjectURL(a.href)}
  function useTool(prompt:string){setInput(v=>v?`${v} ${prompt}`:prompt);setToolsOpen(false)}

  return <main className={"app-shell "+(dark?"theme-dark":"theme-light")}>
    <aside className="sidebar">
      <div className="sidebar-top">
        <div className="brand-row">
          <button className="brand" onClick={()=>openView("chat")} aria-label="Cookie home"><CookieIcon size={34}/><span>Cookie</span></button>
          <button className="icon-btn sidebar-close" onClick={()=>setSidebarOpen(false)} aria-label="Close sidebar"><PanelRight size={19}/></button>
        </div>
        <button className="new-chat" onClick={newChat}><span className="plus"><Plus size={18}/></span><span>New chat</span>{keyboardHints&&<kbd>⌘ K</kbd>}</button>
        <button className={"nav-item "+(view==="chat"?"active":"")} onClick={()=>openView("chat")}><span className="nav-icon"><MessageSquare size={17}/></span><span>Chat</span></button>
        <button className="nav-item" onClick={()=>setWorkspaceOpen(true)}><span className="nav-icon"><Folder size={17}/></span><span>Project files</span>{workspace.length>0&&<small className="nav-count">{workspace.length}</small>}</button>
        <div className="recent-block">
          <div className="section-label">Recent</div>
          {messages.length?<button className="recent-item active" onClick={()=>openView("chat")}>{messages[0].content}</button>:<div className="recent-empty">Your conversations will appear here.</div>}
        </div>
      </div>
      <div className="sidebar-bottom">
        <button className={"nav-item "+(view==="settings"?"active":"")} onClick={()=>openView("settings")}><span className="nav-icon"><Settings size={17}/></span><span>Settings</span></button>
        <button className={"nav-item "+(view==="help"?"active":"")} onClick={()=>openView("help")}><span className="nav-icon"><HelpCircle size={17}/></span><span>Help & shortcuts</span></button>
        <div className="account">
          <span className="avatar">D</span>
          <span className="account-copy"><strong>Cookie user</strong><small>Personal workspace</small></span>
          <span className="account-more">•••</span>
        </div>
      </div>
    </aside>

    {sidebarOpen&&<div className="sidebar-overlay" onClick={()=>setSidebarOpen(false)}/>}

    <section className="main">
      <header className="topbar">
        <button className="icon-btn menu-btn" onClick={()=>setSidebarOpen(true)} aria-label="Open sidebar"><Menu size={20}/></button>
        <div className="mobile-brand"><CookieIcon size={27}/><strong>Cookie</strong></div>
        {view==="chat"&&<div className="model-control">
          <button className="model-picker" onClick={()=>setModelOpen(v=>!v)} aria-expanded={modelOpen}>
            <span className="status-dot"/><span>{active.name}</span><ChevronDown className="chevron" size={15}/>
          </button>
          {modelOpen&&<div className="model-menu open">
            {MODELS.map(m=><button key={m.id} className={"model-option "+(m.id===model?"active":"")} onClick={()=>{setModel(m.id);setModelOpen(false)}}>
              <span><strong>{m.name}</strong><small>{m.desc}</small></span>{m.id===model&&<Check className="check-icon" size={16}/>}
            </button>)}
          </div>}
        </div>}
        <div className="topbar-spacer"/>
        {view==="chat"&&<button className="icon-btn top-search" onClick={()=>setSearch(v=>v?"": " ")} aria-label="Search conversations"><Search size={18}/></button>}
        {view==="chat"&&<button className="icon-btn" onClick={()=>setWorkspaceOpen(true)} aria-label="Project files"><Folder size={18}/></button>}
      </header>

      {view==="chat"&&<div ref={chatScroll} className="chat-scroll">
        <div className="chat-content">
          {search!==""&&<div className="large-search search-inline"><Search size={18}/><input autoFocus value={search.trim()===""?"":search} onChange={e=>setSearch(e.target.value)} placeholder="Search this conversation"/></div>}
          {messages.length===0?
            <section className="welcome">
              <CookieIcon size={92}/>
              <h1>How can I help?</h1>
              <p>Ask anything. Write, learn, plan, or just think out loud.</p>
            </section>
          :
            <section className="conversation">
              {messages.map(m=><article key={m.id} className={"message-row "+m.role}>
                <div className={m.role==="assistant"?"assistant-mark":"message-avatar"}>{m.role==="assistant"?<CookieIcon size={25}/>: "D"}</div>
                <div className="message-body">
                  {m.attachments && m.attachments.length>0&&<div className="message-attachments">{m.attachments.map(a=>a.kind==="image"?<img key={a.id} className="message-image" src={a.data} alt={a.name}/>:<div key={a.id} className="message-file"><FileText size={15}/><span>{a.name}</span></div>)}</div>}
                  <Message text={m.content}/>
                  {m.files && m.files.length>0&&<div className="generated-files">{m.files.map(f=><button className="generated-file" key={f.path} onClick={()=>downloadFile(f)}><FileText size={18}/><span><b>{f.name||f.path.split("/").pop()}</b><small>{f.path} · Download file</small></span><ArrowUp className="download-arrow" size={15}/></button>)}</div>
                  <span className="message-time">{m.time||""}</span>
                  {m.role==="assistant"&&<div className="message-tools"><button onClick={()=>navigator.clipboard?.writeText(m.content)}><Copy size={13}/> Copy</button><button><MoreHorizontal size={13}/> More</button></div>}
                </div>
              </article>)}
            </section>
          }
          {loading&&<div className="typing-row"><CookieIcon size={25}/><span>Cookie is working</span><i/><i/><i/></div>}
        </div>
      </div>}

      {view==="chat"&&<div className="composer-wrap">
        {attachments.length>0&&<div className="attachment-tray">{attachments.map(a=><div className={"attachment-chip "+a.kind} key={a.id}>{a.kind==="image"?<img src={a.data} alt={a.name}/>:<FileText size={16}/>}<span>{a.name}</span><button className="attachment-remove" onClick={()=>removeAttachment(a.id)} aria-label={"Remove "+a.name}><X size={14}/></button></div>)}</div>}
        <div className="composer">
          <div className="composer-main"><textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send()}}} placeholder="Message Cookie..." aria-label="Message Cookie"/></div>
          <div className="composer-toolbar">
            <div className="toolbar-left">
              <div className="composer-menu-wrap">
                <button className={"round-tool "+(attachMenuOpen?"selected":"")} onClick={()=>{setAttachMenuOpen(v=>!v);setToolsOpen(false)}} aria-label="Upload"><Paperclip size={19}/></button>
                {attachMenuOpen&&<div className="composer-menu attachment-menu">
                  <button onClick={()=>openPicker("image")}><ImagePlus size={17}/><span><b>Upload image</b><small>Images only · up to {10-attachments.length}</small></span></button>
                  <button onClick={()=>openPicker("file")}><FileUp size={17}/><span><b>Upload file</b><small>Non-image files only · up to {10-attachments.length}</small></span></button>
                  <div className="menu-limit">{attachments.length}/10 attachments · folders are not supported</div>
                </div>}
              </div>
              <div className="composer-menu-wrap">
                <button className={"tool-label "+(toolsOpen?"selected":"")} onClick={()=>{setToolsOpen(v=>!v);setAttachMenuOpen(false)}}><Wrench size={15}/><span>Tools</span><ChevronDown className="tiny-chevron" size={13}/></button>
                {toolsOpen&&<div className="composer-menu tools-menu">
                  <button onClick={()=>useTool("Create a downloadable file for me.")}><Code2 size={17}/><span><b>Create files</b><small>Generate code and downloadable files</small></span></button>
                  <button onClick={()=>useTool("Analyze the files or images I attached.")}><ScanSearch size={17}/><span><b>Analyze uploads</b><small>Inspect attached content</small></span></button>
                  <button onClick={()=>useTool("Help me debug or improve this code.")}><Wrench size={17}/><span><b>Code tools</b><small>Debug, review, refactor</small></span></button>
                  <button onClick={()=>useTool("Research this using available web knowledge and cite current sources when needed.")}><Globe2 size={17}/><span><b>Web research</b><small>Research current information</small></span></button>
                </div>}
              </div>
              {keyboardHints&&<span className="shortcut-hint">Shift + Enter for new line</span>}
            </div>
            <div className="toolbar-right"><button className="send-btn" disabled={(!input.trim()&&!attachments.length)||loading} onClick={()=>send()} aria-label="Send message"><ArrowUp size={19}/></button></div>
          </div>
        </div>
        <input ref={imageRef} hidden type="file" accept="image/*" multiple onChange={e=>attach(e,"image")}/>
        <input ref={fileRef} hidden type="file" accept=".txt,.md,.json,.js,.jsx,.ts,.tsx,.css,.html,.py,.java,.c,.cpp,.h,.hpp,.csv,.xml,.yaml,.yml,.log,.pdf,.doc,.docx,.xls,.xlsx,.zip" multiple onChange={e=>attach(e,"file")}/>
        <div className="disclaimer">Cookie can make mistakes. Check important information.</div>
      </div>}
      {view==="settings"&&<SettingsPage dark={dark} setDark={setDark} accent={accent} setAccent={setAccent} textSize={textSize} setTextSize={setTextSize} compact={compact} setCompact={setCompact} animations={animations} setAnimations={setAnimations} keyboardHints={keyboardHints} setKeyboardHints={setKeyboardHints} clearWorkspace={clearWorkspace}/>}
      {view==="help"&&<HelpPage/>}
    </section>

  </main>;
}

function Message({text}:{text:string}){
  const lines=text.split("\n");
  const inline=(value:string)=>{
    const parts=value.split(/(\*\*[^*]+\*\*|\`[^\`]+\`)/g);
    return parts.map((part,i)=>{
      if(/^\*\*[^*]+\*\*$/.test(part))return <strong key={i}>{part.slice(2,-2)}</strong>;
      if(/^\`[^\`]+\`$/.test(part))return <code key={i}>{part.slice(1,-1)}</code>;
      return <React.Fragment key={i}>{part}</React.Fragment>;
    });
  };
  return <div className="message-content">{lines.map((line,i)=>{
    const heading=line.match(/^\*\*(.+?)\*\*:?$/);
    const numbered=line.match(/^(\d+)\.\s+(.*)$/);
    if(heading)return <h3 key={i}>{inline(heading[1])}</h3>;
    if(numbered)return <p className="rich-list-item" key={i}><strong>{numbered[1]}.</strong> {inline(numbered[2])}</p>;
    return <p key={i}>{line?inline(line):" "}</p>;
  })}</div>;
}

function SettingsPage(props:{
  dark:boolean;setDark:(v:boolean)=>void;accent:"orange"|"cream"|"cocoa";setAccent:(v:"orange"|"cream"|"cocoa")=>void;
  textSize:"small"|"medium"|"large";setTextSize:(v:"small"|"medium"|"large")=>void;
  compact:boolean;setCompact:(v:boolean)=>void;animations:boolean;setAnimations:(v:boolean)=>void;
  keyboardHints:boolean;setKeyboardHints:(v:boolean)=>void;
}){
  const [tab,setTab]=useState("Appearance");
  const tabs=[["Appearance",Palette],["Chat",MessageSquare],["Interface",SlidersHorizontal],["Privacy",ShieldCheck]];
  return <div className="page-container settings-page">
    <div className="page-heading"><span className="eyebrow">PREFERENCES</span><h2>Settings</h2><p>Customize Cookie's workspace, conversation behavior, and local data.</p></div>
    <div className="settings-layout">
      <nav className="settings-nav">{tabs.map(([name,Icon])=><button key={String(name)} className={"setting-tab "+(tab===name?"active":"")} onClick={()=>setTab(String(name))}><Icon size={16}/><span>{String(name)}</span></button>)}</nav>
      <div className="setting-content">
        {tab==="Appearance"&&<><SettingGroup title="Theme" desc="Choose the appearance used across Cookie."><div className="theme-options">
          {["dark","light","system"].map(x=><button key={x} className={"theme-card "+((x==="dark"&&props.dark)||(x==="light"&&!props.dark)?"active":"")} onClick={()=>props.setDark(x!=="light")}><span className={"theme-preview "+x+"-preview"}/><strong>{x[0].toUpperCase()+x.slice(1)}</strong><small>{x==="dark"?"Near-black workspace":x==="light"?"Bright workspace":"Follow device preference"}</small></button>)}
        </div></SettingGroup><SettingGroup title="Accent" desc="Pick the restrained highlight color used for controls and focus."><div className="accent-row">
          {(["orange","cream","cocoa"] as const).map(x=><button key={x} aria-label={x+" accent"} className={"accent-swatch "+x+" "+(props.accent===x?"selected":"")} onClick={()=>props.setAccent(x)}/>)}
        </div></SettingGroup><SettingGroup title="Text size" desc="Adjust reading size without changing the layout."><div className="choice-grid">{(["small","medium","large"] as const).map(x=><button key={x} className={"choice-card "+(props.textSize===x?"selected":"")} onClick={()=>props.setTextSize(x)}><strong>{x[0].toUpperCase()+x.slice(1)}</strong><small>{x==="small"?"Compact":x==="medium"?"Default":"More comfortable"}</small></button>)}</div></SettingGroup></>}
        {tab==="Chat"&&<><SettingGroup title="Conversation density" desc="Control how much vertical space messages use."><Toggle label="Compact messages" desc="Reduce the gap between messages." value={props.compact} setValue={props.setCompact}/></SettingGroup><SettingGroup title="Keyboard" desc="Control the hints shown around the composer."><Toggle label="Keyboard hints" desc="Show shortcuts such as ⌘ K and Shift + Enter." value={props.keyboardHints} setValue={props.setKeyboardHints}/></SettingGroup><SettingGroup title="Motion" desc="Keep transitions subtle and functional."><Toggle label="Interface animations" desc="Disable non-essential transitions and entrance effects." value={props.animations} setValue={props.setAnimations}/></SettingGroup></>}
        {tab==="Interface"&&<><SettingGroup title="Workspace layout" desc="Cookie keeps the conversation centered and leaves tools out of the way until you need them."><div className="data-status"><Check size={16}/> Centered chat · fixed composer · right-side workspace</div></SettingGroup><SettingGroup title="Model" desc="Choose the model from the selector in the chat header."><div className="choice-grid">{MODELS.map(m=><button key={m.id} className="choice-card"><strong>{m.name}</strong><small>{m.desc}</small></button>)}</div></SettingGroup></>}
        {tab==="Privacy"&&<>{/* privacy controls */}<SettingGroup title="Uploads" desc="Attachments stay in the current conversation and are submitted only with your message."><div className="data-status"><ShieldCheck size={16}/> Up to 10 attachments per message · no folder uploads</div></SettingGroup><SettingGroup title="Restore interface defaults" desc="Reset visual preferences for Cookie."><button className="secondary-btn" onClick={()=>{props.setDark(true);props.setAccent("cream");props.setTextSize("medium");props.setCompact(false);props.setAnimations(true);props.setKeyboardHints(true)}}>Restore defaults</button></SettingGroup></>}}
      </div>
    </div>
  </div>;
}

function SettingGroup({title,desc,children}:{title:string;desc:string;children:React.ReactNode}){
  return <section className="setting-group"><h3>{title}</h3><p>{desc}</p>{children}</section>;
}
function Toggle({label,desc,value,setValue}:{label:string;desc:string;value:boolean;setValue:(v:boolean)=>void}){
  return <div className="toggle-row"><span><strong>{label}</strong><small>{desc}</small></span><button className={"toggle "+(value?"on":"")} onClick={()=>setValue(!value)} aria-pressed={value}><span/></button></div>;
}

function HelpPage(){
  const faqs=[
    ["How do I send a message?","Type in the composer and press Enter. Use Shift + Enter when you want a new line."],
    ["What can Cookie work with?","Cookie can answer questions, reason through coding tasks, inspect images and files, and create downloadable files directly in chat."],
    ["How does Project files work?","Ask Cookie to create files when you need them. Generated files appear directly in the chat and can be downloaded with one tap."],
    ["How do I switch models?","Use the model selector in the chat header. Each Cookie model is shown with its capability description."],
    ["Can I change the interface?","Yes. Settings includes appearance, chat density, keyboard hints, motion, text size, accent, and local-data controls."]
  ];
  return <div className="page-container help-page">
    <div className="page-heading"><span className="eyebrow">SUPPORT</span><h2>Help & shortcuts</h2><p>Everything you need to move around Cookie quickly.</p></div>
    <div className="help-shortcuts">
      <div className="shortcut-card"><Keyboard size={18}/><div><strong>Enter</strong><span>Send message</span></div></div>
      <div className="shortcut-card"><Keyboard size={18}/><div><strong>Shift + Enter</strong><span>New line</span></div></div>
      <div className="shortcut-card"><Keyboard size={18}/><div><strong>⌘ K</strong><span>Start a new chat</span></div></div>
      <div className="shortcut-card"><MessageCircleQuestion size={18}/><div><strong>Model menu</strong><span>Switch Cookie model</span></div></div>
    </div>
    <section className="faq-list">{faqs.map(([q,a])=><details key={q}><summary>{q}</summary><p>{a}</p></details>)}</section>
    <div className="help-footer"><ShieldCheck size={17}/><span>Important information should still be verified. Cookie can make mistakes.</span></div>
  </div>;
}
