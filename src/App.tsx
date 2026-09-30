import React from "react";
import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import PerfectScrollbar from "perfect-scrollbar";
import "perfect-scrollbar/css/perfect-scrollbar.css";
import {
  ArrowUp, Copy, FileText, FileUp, ImagePlus,
  Camera, Images, Share2, Pin, Archive, Trash2, Paperclip, HelpCircle, Menu, MessageSquare, MoreHorizontal, CirclePlus,
  Search, Settings, X, PanelRight, SlidersHorizontal,
  ShieldCheck, Palette, Plus, Check, ChevronRight, ArrowLeft, Mail, CreditCard, RotateCcw, BarChart3, UserRound, LockKeyhole, Database, Bell, Volume2, UsersRound, Monitor, HardDrive, Megaphone, Flag, Info, LogOut, Globe2, SpellCheck, Smartphone, Keyboard, Type, Sparkles, Shuffle, TrendingUp, Brain, Gauge
} from "lucide-react";

type Attachment={id:string;kind:"image"|"file";name:string;mime:string;data:string};
type GeneratedFile={name:string;path:string;content:string;kind?:string};
type Msg={id:string;role:"user"|"assistant";content:string;attachments?:Attachment[];files?:GeneratedFile[];time?:string};
type View="chat"|"settings"|"account"|"help";

const COOKIE_ICON_URL="https://raw.githubusercontent.com/premiummaster156-cmd/cookie/main/cookie-ai-icon.png";
const MODELS=[
  {id:"standard",name:"CPT-1",desc:"Fast everyday assistant"},
  {id:"max",name:"CPT-2 MAX",desc:"Deep reasoning & coding"},
  {id:"ultra",name:"CPT-3 ULTRA",desc:"Maximum agentic capability"}
];
const id=()=>Math.random().toString(36).slice(2)+Date.now().toString(36);
const APP_LANGUAGES=[
  ["English","en"],["Uzbek","uz"],["Russian","ru"],["Turkish","tr"],["Kazakh","kk"],
  ["Kyrgyz","ky"],["Tajik","tg"],["Arabic","ar"],["Persian","fa"],["Hindi","hi"],
  ["Urdu","ur"],["Chinese","zh"],["Japanese","ja"],["Korean","ko"],["Spanish","es"],
  ["French","fr"],["German","de"],["Italian","it"],["Portuguese","pt"],["Indonesian","id"]
] as const;

function CookieIcon({size=22}:{size?:number}){
  return <img className="cookie-ai-icon" src={COOKIE_ICON_URL} width={size} height={size} alt="Cookie AI" draggable={false}/>;
}

export default function App(){
  const [messages,setMessages]=useState<Msg[]>([]);
  const [input,setInput]=useState("");
  const [model,setModel]=useState("standard");
  const [sidebarOpen,setSidebarOpen]=useState(false);
  const [loading,setLoading]=useState(false);
  const [activityOpen,setActivityOpen]=useState(true);
  const [activityStep,setActivityStep]=useState(0);
  const [attachments,setAttachments]=useState<Attachment[]>([]);
  const [attachMenuOpen,setAttachMenuOpen]=useState(false);
  const [chatMenuOpen,setChatMenuOpen]=useState(false);
  const [chatTitle,setChatTitle]=useState("New chat");
  const [chatPinned,setChatPinned]=useState(false);
  const [chatArchived,setChatArchived]=useState(false);
  const [copiedMessage,setCopiedMessage]=useState<string|null>(null);
  const [messageMenuOpen,setMessageMenuOpen]=useState<string|null>(null);
  const [messageMenuPosition,setMessageMenuPosition]=useState<{top:number;left:number}|null>(null);
  const [view,setView]=useState<View>("chat");
  const [dark,setDark]=useState(true);
  const [accent,setAccent]=useState<"orange"|"cream"|"cocoa"|"blue">("blue");
  const [textSize,setTextSize]=useState<"small"|"medium"|"large">("medium");
  const [compact,setCompact]=useState(false);
  const [animations,setAnimations]=useState(true);
  const [keyboardHints,setKeyboardHints]=useState(true);
  const [appLanguage,setAppLanguage]=useState<"English"|"Uzbek"|"Russian"|"Turkish"|"Kazakh"|"Kyrgyz"|"Tajik"|"Arabic"|"Persian"|"Hindi"|"Urdu"|"Chinese"|"Japanese"|"Korean"|"Spanish"|"French"|"German"|"Italian"|"Portuguese"|"Indonesian">("English");
  const [autoCorrect,setAutoCorrect]=useState(true);
  const [haptics,setHaptics]=useState(true);
  const [autoSwitch,setAutoSwitch]=useState(true);
  const [autocomplete,setAutocomplete]=useState(true);
  const [trendingSearches,setTrendingSearches]=useState(true);
  const [memoryEnabled,setMemoryEnabled]=useState(true);
  const [memoryName,setMemoryName]=useState("");
  const [memoryOccupation,setMemoryOccupation]=useState("");
  const [memoryAbout,setMemoryAbout]=useState("");
  const [profileName,setProfileName]=useState("Cookie user");
  const [profileUsername,setProfileUsername]=useState("Cookie user");
  const [profileEmail,setProfileEmail]=useState("");
  const [aiPersonality,setAiPersonality]=useState("Balanced");
  const [search,setSearch]=useState("");
  const [headerScrolled,setHeaderScrolled]=useState(false);
  const imageRef=useRef<HTMLInputElement>(null);
  const cameraRef=useRef<HTMLInputElement>(null);
  const fileRef=useRef<HTMLInputElement>(null);
  const chatScroll=useRef<HTMLDivElement>(null);
  const chatMenuRef=useRef<HTMLDivElement>(null);
  const attachMenuRef=useRef<HTMLDivElement>(null);
  const messageMenuRef=useRef<HTMLDivElement>(null);
  const messageMenuButtonRef=useRef<HTMLButtonElement>(null);
  async function copyMessage(text:string,messageId:string){
    try{
      if(navigator.clipboard&&window.isSecureContext) await navigator.clipboard.writeText(text);
      else{
        const ta=document.createElement("textarea");
        ta.value=text;ta.style.position="fixed";ta.style.opacity="0";
        document.body.appendChild(ta);ta.select();document.execCommand("copy");ta.remove();
      }
      setCopiedMessage(messageId);
      setMessageMenuOpen(null);
      window.setTimeout(()=>setCopiedMessage(v=>v===messageId?null:v),1400);
    }catch{}
  }
  function openMessageMenu(messageId:string,button:HTMLButtonElement){
    if(messageMenuOpen===messageId){ setMessageMenuOpen(null); setMessageMenuPosition(null); return; }
    const r=button.getBoundingClientRect();
    const width=Math.min(154,window.innerWidth-16);
    const estimatedHeight=82;
    // Keep the popover attached to the three-dot control by aligning its
    // right edge with the button's right edge.
    const left=Math.max(8,Math.min(r.right-width,window.innerWidth-width-8));
    const top=r.top>=estimatedHeight+10 ? r.top-estimatedHeight-8 : r.bottom+8;
    setMessageMenuPosition({top,left});
    setMessageMenuOpen(messageId);
    setChatMenuOpen(false);
    setAttachMenuOpen(false);
  }
  function toggleChatMenu(){
    setChatMenuOpen(v=>!v);
    setAttachMenuOpen(false);
    setMessageMenuOpen(null);
    setMessageMenuPosition(null);
  }
  async function shareMessage(text:string){
    try{
      if(navigator.share)await navigator.share({title:"Cookie response",text});
      else if(navigator.clipboard)await navigator.clipboard.writeText(text);
      else window.prompt("Copy response",text);
    }catch{}
    setMessageMenuOpen(null);
  }

  useEffect(()=>{
    if(!messageMenuOpen)return;
    const closeOnScroll=()=>{setMessageMenuOpen(null);setMessageMenuPosition(null)};
    const onResize=()=>{setMessageMenuOpen(null);setMessageMenuPosition(null)};
    chatScroll.current?.addEventListener("scroll",closeOnScroll,{passive:true});
    window.addEventListener("resize",onResize);
    return ()=>{
      chatScroll.current?.removeEventListener("scroll",closeOnScroll);
      window.removeEventListener("resize",onResize);
    };
  },[messageMenuOpen]);

  useEffect(()=>{
    const onKeyDown=(e:KeyboardEvent)=>{
      if(e.key==="Escape"){
        setSidebarOpen(false);
        setChatMenuOpen(false);
        setAttachMenuOpen(false);
        setMessageMenuOpen(null);
        setMessageMenuPosition(null);
      }
    };
    const onPointerDown=(e:PointerEvent)=>{
      const target=e.target as Node;
      if(chatMenuOpen && !chatMenuRef.current?.contains(target)) setChatMenuOpen(false);
      if(attachMenuOpen && !attachMenuRef.current?.contains(target)) setAttachMenuOpen(false);
      if(messageMenuOpen && !messageMenuRef.current?.contains(target) && !messageMenuButtonRef.current?.contains(target)) { setMessageMenuOpen(null); setMessageMenuPosition(null); }
    };
    window.addEventListener("keydown",onKeyDown);
    document.addEventListener("pointerdown",onPointerDown);
    return ()=>{
      window.removeEventListener("keydown",onKeyDown);
      document.removeEventListener("pointerdown",onPointerDown);
    };
  },[chatMenuOpen,attachMenuOpen,messageMenuOpen]);

  useEffect(()=>{
    const hash=window.location.hash;
    if(!hash.startsWith("#share="))return;
    try{
      const raw=decodeURIComponent(escape(window.atob(hash.slice(7))));
      const shared=JSON.parse(raw);
      if(Array.isArray(shared.messages)){
        setMessages(shared.messages.map((m:any)=>({
          id:id(),
          role:m.role==="user"?"user":"assistant",
          content:String(m.content||""),
          time:m.time||""
        })));
        setChatTitle(typeof shared.title==="string"&&shared.title.trim()?shared.title:"Shared chat");
      }
    }catch{}
  },[]);

  useEffect(()=>{
    try{
      const p=JSON.parse(localStorage.getItem("cookie_preferences")||"{}");
      if(p.dark!==undefined)setDark(Boolean(p.dark));
      if(p.accent)setAccent(p.accent);
      if(p.textSize)setTextSize(p.textSize);
      if(p.compact!==undefined)setCompact(Boolean(p.compact));
      if(p.animations!==undefined)setAnimations(Boolean(p.animations));
      if(p.keyboardHints!==undefined)setKeyboardHints(Boolean(p.keyboardHints));
      if(p.appLanguage)setAppLanguage(p.appLanguage);
      if(p.autoCorrect!==undefined)setAutoCorrect(Boolean(p.autoCorrect));
      if(p.haptics!==undefined)setHaptics(Boolean(p.haptics));
      if(p.autoSwitch!==undefined)setAutoSwitch(Boolean(p.autoSwitch));
      if(p.autocomplete!==undefined)setAutocomplete(Boolean(p.autocomplete));
      if(p.trendingSearches!==undefined)setTrendingSearches(Boolean(p.trendingSearches));
      if(p.memoryEnabled!==undefined)setMemoryEnabled(Boolean(p.memoryEnabled));
      if(p.memoryName!==undefined)setMemoryName(String(p.memoryName));
      if(p.memoryOccupation!==undefined)setMemoryOccupation(String(p.memoryOccupation));
      if(p.memoryAbout!==undefined)setMemoryAbout(String(p.memoryAbout));
      if(p.profileName!==undefined)setProfileName(String(p.profileName));
      if(p.profileUsername!==undefined)setProfileUsername(String(p.profileUsername));
      if(p.profileEmail!==undefined)setProfileEmail(String(p.profileEmail));
      if(p.aiPersonality!==undefined)setAiPersonality(String(p.aiPersonality));
    }catch{}
  },[]);
  useEffect(()=>localStorage.setItem("cookie_preferences",JSON.stringify({
    dark,accent,textSize,compact,animations,keyboardHints,appLanguage,autoCorrect,haptics,
    autoSwitch,autocomplete,trendingSearches,memoryEnabled,memoryName,memoryOccupation,memoryAbout,
    profileName,profileUsername,profileEmail,aiPersonality
  })),[dark,accent,textSize,compact,animations,keyboardHints,appLanguage,autoCorrect,haptics,autoSwitch,autocomplete,trendingSearches,memoryEnabled,memoryName,memoryOccupation,memoryAbout,profileUsername,profileEmail,aiPersonality]);
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
    const el=chatScroll.current;
    const onScroll=()=>setHeaderScrolled(el.scrollTop>18);
    onScroll();
    el.addEventListener("scroll",onScroll,{passive:true});
    const ps=new PerfectScrollbar(el,{wheelPropagation:false,suppressScrollX:true,minScrollbarLength:28});
    return ()=>{
      el.removeEventListener("scroll",onScroll);
      ps.destroy();
    };
  },[view]);
  useEffect(()=>{
    if(view==="chat"&&chatScroll.current){
      const el=chatScroll.current;
      requestAnimationFrame(()=>{el.scrollTop=el.scrollHeight;});
    }
  },[messages,loading,view]);

  useEffect(()=>{
    if(!loading){setActivityStep(0);return;}
    setActivityOpen(true);
    const steps=[0,1,2,3];
    let i=0;
    const timer=window.setInterval(()=>{i=Math.min(i+1,steps.length-1);setActivityStep(i)},1100);
    return ()=>window.clearInterval(timer);
  },[loading]);

  async function send(raw=input){
    const text=raw.trim();
    if((!text&&!attachments.length)||loading)return;
    const now=new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"});
    const next=[...messages,{id:id(),role:"user" as const,content:text,attachments,time:now}];
    setMessages(next);
    setChatTitle(v=>v==="New chat"?(text.slice(0,42)+(text.length>42?"…":"")):v);
    setChatArchived(false);
    setInput("");setAttachments([]);setLoading(true);setView("chat");setAttachMenuOpen(false);setChatMenuOpen(false);setMessageMenuOpen(null);
    try{
      const r=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({messages:next.map(m=>({role:m.role,content:m.content})),preferences:{
        responseMode:model,language:(APP_LANGUAGES.find(x=>x[0]===appLanguage)?.[1]||"en"),
        answerLength:"auto",creativity:.7,autoSwitch,autocomplete,trendingSearches,
        memory:memoryEnabled?{name:memoryName,occupation:memoryOccupation,about:memoryAbout}:null,
        personality:aiPersonality,profile:{name:profileName,username:profileUsername,email:profileEmail}
      },attachments:attachments.map(a=>({kind:a.kind,name:a.name,mime:a.mime,data:a.data}))})});
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
  function openPicker(kind:"image"|"file"|"camera"){setAttachMenuOpen(false);requestAnimationFrame(()=>{(kind==="camera"?cameraRef:kind==="image"?imageRef:fileRef).current?.click()})}
  function removeAttachment(removeId:string){setAttachments(v=>v.filter(a=>a.id!==removeId))}
  function newChat(){setMessages([]);setInput("");setAttachments([]);setView("chat");setSidebarOpen(false);setChatMenuOpen(false);setChatTitle("New chat");setChatPinned(false);setChatArchived(false)}
  function openView(next:View){setView(next);setSidebarOpen(false);setAttachMenuOpen(false);setChatMenuOpen(false)}
  function renameChat(){const next=window.prompt("Rename chat",chatTitle);if(next?.trim())setChatTitle(next.trim().slice(0,80));setChatMenuOpen(false)}
  async function shareChat(){
    const payload={title:chatTitle,messages:messages.map((m)=>({role:m.role,content:m.content,time:m.time||""}))};
    const encoded=btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
    const shareUrl=window.location.origin+window.location.pathname+"#share="+encodeURIComponent(encoded);
    try{
      if(navigator.share)await navigator.share({title:chatTitle,url:shareUrl});
      else if(navigator.clipboard)await navigator.clipboard.writeText(shareUrl);
      else window.prompt("Copy this chat link",shareUrl);
    }catch{}
    setChatMenuOpen(false);
  }
  function archiveChat(){setChatArchived(true);setChatMenuOpen(false)}
  function deleteChat(){newChat()}
  function downloadFile(file:GeneratedFile){const blob=new Blob([file.content],{type:"text/plain;charset=utf-8"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=file.name||file.path.split("/").pop()||"cookie-file.txt";a.click();URL.revokeObjectURL(a.href)}


  if(view==="account"||view==="settings"){
    return <main className={"settings-shell "+(dark?"theme-dark":"theme-light")}>
      <AccountSettingsPage
        dark={dark} setDark={setDark} accent={accent} setAccent={setAccent}
        textSize={textSize} setTextSize={setTextSize} compact={compact} setCompact={setCompact}
        animations={animations} setAnimations={setAnimations} keyboardHints={keyboardHints} setKeyboardHints={setKeyboardHints}
        appLanguage={appLanguage} setAppLanguage={setAppLanguage} autoCorrect={autoCorrect} setAutoCorrect={setAutoCorrect}
        haptics={haptics} setHaptics={setHaptics} autoSwitch={autoSwitch} setAutoSwitch={setAutoSwitch}
        autocomplete={autocomplete} setAutocomplete={setAutocomplete} trendingSearches={trendingSearches} setTrendingSearches={setTrendingSearches}
        memoryEnabled={memoryEnabled} setMemoryEnabled={setMemoryEnabled} memoryName={memoryName} setMemoryName={setMemoryName}
        memoryOccupation={memoryOccupation} setMemoryOccupation={setMemoryOccupation} memoryAbout={memoryAbout} setMemoryAbout={setMemoryAbout}
        profileName={profileName} setProfileName={setProfileName}
        model={model} setModel={setModel} sessionMessages={messages.filter(m=>m.role==="assistant").length} profileUsername={profileUsername} setProfileUsername={setProfileUsername} profileEmail={profileEmail} setProfileEmail={setProfileEmail} aiPersonality={aiPersonality} setAiPersonality={setAiPersonality} goBack={()=>setView("chat")}
      />
    </main>;
  }

  return <main className={"app-shell "+(dark?"theme-dark":"theme-light")}>
    <aside className="sidebar">
      <div className="sidebar-top">
        <div className="brand-row">
          <button className="brand glass-control" onClick={()=>openView("chat")} aria-label="Cookie home"><CookieIcon size={34}/><span>Cookie</span></button>
          <button className="icon-btn sidebar-close" onClick={()=>setSidebarOpen(false)} aria-label="Close sidebar"><PanelRight size={19}/></button>
        </div>
        <button className="new-chat" onClick={newChat}><span className="plus"><Plus size={18}/></span><span>New chat</span>{keyboardHints&&<kbd>⌘ K</kbd>}</button>
        <button className={"nav-item "+(view==="chat"?"active":"")} onClick={()=>{setView("chat");setSidebarOpen(false);setChatMenuOpen(false);setAttachMenuOpen(false);}}><span className="nav-icon"><MessageSquare size={17}/></span><span>Chat</span></button>
        <div className="recent-block">
          <div className="section-label">Recent</div>
          {messages.length?<button className="recent-item active" onClick={()=>openView("chat")}>{messages[0].content}</button>:<div className="recent-empty">Your conversations will appear here.</div>}
        </div>
      </div>
      <div className="sidebar-bottom">
        <button className={"nav-item "+(view==="help"?"active":"")} onClick={()=>openView("help")}><span className="nav-icon"><HelpCircle size={17}/></span><span>Help & shortcuts</span></button>
        <button className="account" onClick={()=>openView("account")} aria-label="Open account settings">
          <span className="avatar">D</span>
          <span className="account-copy"><strong>Settings</strong><small>Cookie account</small></span>
          <span className="account-more"><MoreHorizontal size={15}/></span>
        </button>
      </div>
    </aside>

    {sidebarOpen&&<div className="sidebar-overlay" onClick={()=>setSidebarOpen(false)}/>}

    <section className="main">
      <header className="topbar">
        <button className={"icon-btn menu-btn "+(sidebarOpen?"active":"")} onClick={()=>{
  setSidebarOpen(v=>!v);
  setChatMenuOpen(false);
  setAttachMenuOpen(false);
  setMessageMenuOpen(null);
}} aria-label={sidebarOpen?"Close sidebar":"Open sidebar"}><Menu size={20}/></button>
        <button className={"mobile-brand "+(headerScrolled?"scrolled":"")} onClick={()=>openView("chat")} aria-label="Cookie home"><CookieIcon size={29}/><strong>Cookie</strong></button>
        <div className="topbar-spacer"/>
        {view==="chat"&&<div className={"topbar-actions "+(headerScrolled?"scrolled":"")}>
          <button className="icon-btn top-search" onClick={()=>setSearch(v=>v?"":" ")} aria-label="Search conversations"><Search size={18}/></button>
          <div ref={chatMenuRef} className="chat-session-menu-wrap">
            <button className={"icon-btn chat-session-more "+(chatMenuOpen?"active":"")} onClick={toggleChatMenu} aria-label="Chat options" aria-expanded={chatMenuOpen}><MoreHorizontal size={21}/></button>
            {chatMenuOpen&&<div className="chat-session-menu glass-panel" role="menu">
              <div className="chat-menu-heading">{chatTitle}{chatPinned?" · Pinned":""}</div>
              <button onClick={shareChat}><Share2 size={16}/><span>Share chat</span></button>
              <button onClick={renameChat}><FileText size={16}/><span>Rename chat</span></button>
              <button onClick={()=>{setChatPinned(v=>!v);setChatMenuOpen(false)}}><Pin size={16}/><span>{chatPinned?"Unpin chat":"Pin chat"}</span></button>
              <button onClick={()=>{setSearch(v=>v?"":" ");setChatMenuOpen(false)}}><Search size={16}/><span>Find in chat</span></button>
              <button onClick={archiveChat}><Archive size={16}/><span>Archive chat</span></button>
              <button className="danger" onClick={deleteChat}><Trash2 size={16}/><span>Delete chat</span></button>
            </div>}
          </div>
        </div>}
      </header>

      {view==="chat"&&<div ref={chatScroll} className="chat-scroll">
        <div className="chat-content">
          {search!==""&&<div className="large-search search-inline"><Search size={18}/><input autoFocus value={search.trim()===""?"":search} onChange={e=>setSearch(e.target.value)} placeholder="Search this conversation"/></div>}
          {chatArchived?
            <section className="session-archived">
              <Archive size={24}/>
              <h2>Chat archived</h2>
              <p>This chat is archived in the current Cookie session.</p>
              <button onClick={()=>setChatArchived(false)}>Return to chat</button>
            </section>
          :messages.length===0?
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
                  {m.files && m.files.length>0&&<div className="generated-files">{m.files.map(f=><button className="generated-file" key={f.path} onClick={()=>downloadFile(f)}><FileText size={18}/><span><b>{f.name||f.path.split("/").pop()}</b><small>{f.path} · Download file</small></span><ArrowUp className="download-arrow" size={15}/></button>)}</div>}
                  <span className="message-time">{m.time||""}</span>
                  {m.role==="assistant"&&<div className="message-tools">
                    <button onClick={()=>copyMessage(m.content,m.id)} className={copiedMessage===m.id?"copied":""}><Copy size={13}/> {copiedMessage===m.id?"Copied":"Copy"}</button>
                    <div className="message-actions-wrap">
                      <button
                        ref={messageMenuOpen===m.id?messageMenuButtonRef:null}
                        className={"message-more "+(messageMenuOpen===m.id?"active":"")}
                        onClick={e=>openMessageMenu(m.id,e.currentTarget)}
                        aria-label="Message actions"
                        aria-expanded={messageMenuOpen===m.id}
                      >
                        <MoreHorizontal size={15}/>
                      </button>
                      {messageMenuOpen===m.id&&messageMenuPosition&&createPortal(
                        <div ref={messageMenuRef} className="message-action-menu glass-popover" role="menu"
                          style={{top:messageMenuPosition.top,left:messageMenuPosition.left}}>
                          <button onClick={()=>copyMessage(m.content,m.id)}><Copy size={15}/><span>{copiedMessage===m.id?"Copied":"Copy response"}</span></button>
                          <button onClick={()=>shareMessage(m.content)}><Share2 size={15}/><span>Share response</span></button>
                        </div>,
                        document.body
                      )}
                    </div>
                  </div>}
                </div>
              </article>)}
            </section>
          }
          {loading&&<div className={"activity-panel "+(activityOpen?"open":"")}>
  <button className="activity-summary" onClick={()=>setActivityOpen(v=>!v)} aria-expanded={activityOpen}>
    <span className="activity-summary-icon"><SlidersHorizontal size={16}/></span>
    <span className="activity-summary-title">{["Preparing request","Processing request","Working on your request","Preparing response"][activityStep]}</span>
    <ChevronRight size={18} className="activity-chevron"/>
  </button>
  {activityOpen&&<div className="activity-details">
    {["Preparing request","Processing request","Working on your request","Preparing response"].map((label,i)=>
      <div className={"activity-step "+(i===activityStep?"current":"")+(i<activityStep?" done":"")} key={label}>
        <span className="activity-step-dot">{i<activityStep?<Check size={11}/>:i===activityStep?<span className="activity-pulse"/>:<span/>}</span>
        <span>{label}</span>
      </div>
    )}
    <div className="activity-note">Live tool events such as searches or file operations can appear here when the connected service reports them.</div>
  </div>}
</div>}
        </div>
      </div>}

      {view==="chat"&&<div className="composer-wrap">
        {attachments.length>0&&<div className="attachment-tray">{attachments.map(a=><div className={"attachment-chip "+a.kind} key={a.id}>{a.kind==="image"?<img src={a.data} alt={a.name}/>:<FileText size={16}/>}<span>{a.name}</span><button className="attachment-remove" onClick={()=>removeAttachment(a.id)} aria-label={"Remove "+a.name}><X size={14}/></button></div>)}</div>}
        <div className="composer">
          <div className="composer-main">
            <div className="composer-attachment">
              <div ref={attachMenuRef} className="composer-menu-wrap">
                <button className={"round-tool attachment-trigger "+(attachMenuOpen?"selected":"")} onClick={()=>{
  setAttachMenuOpen(v=>!v);
  setChatMenuOpen(false);
  setMessageMenuOpen(null);
}} aria-label="Add attachment" aria-expanded={attachMenuOpen}>
                  <CirclePlus size={22}/>
                </button>
                {attachMenuOpen&&<div className="composer-menu attachment-menu">
                  <button className="attachment-menu-item" onClick={()=>openPicker("camera")}>
                    <span className="attachment-menu-icon"><Camera size={22}/></span>
                    <span><b>Camera</b><small>Take a photo · up to {10-attachments.length}</small></span>
                  </button>
                  <button className="attachment-menu-item" onClick={()=>openPicker("image")}>
                    <span className="attachment-menu-icon"><Images size={22}/></span>
                    <span><b>Photos</b><small>Images only · up to {10-attachments.length}</small></span>
                  </button>
                  <button className="attachment-menu-item" onClick={()=>openPicker("file")}>
                    <span className="attachment-menu-icon"><FileUp size={22}/></span>
                    <span><b>Files</b><small>Files only · up to {10-attachments.length}</small></span>
                  </button>
                </div>}
              </div>
            </div>
            <textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send()}}} placeholder="Message Cookie..." aria-label="Message Cookie" spellCheck={autoCorrect} lang={appLanguage==="English"?"en":appLanguage==="Uzbek"?"uz":"ru"}/>
          </div>
          <div className="composer-toolbar">
            <div className="toolbar-left">{keyboardHints&&<span className="shortcut-hint">Shift + Enter for new line</span>}</div>
            <div className="toolbar-right"><button className="send-btn" disabled={(!input.trim()&&!attachments.length)||loading} onClick={()=>send()} aria-label="Send message"><ArrowUp size={19}/></button></div>
          </div>
        </div>
        <input ref={imageRef} hidden type="file" accept="image/*" multiple onChange={e=>attach(e,"image")}/>
        <input ref={cameraRef} hidden type="file" accept="image/*" capture="environment" onChange={e=>attach(e,"image")}/>
        <input ref={fileRef} hidden type="file" accept=".txt,.md,.json,.js,.jsx,.ts,.tsx,.css,.html,.py,.java,.c,.cpp,.h,.hpp,.csv,.xml,.yaml,.yml,.log,.pdf,.doc,.docx,.xls,.xlsx,.zip" multiple onChange={e=>attach(e,"file")}/>
        <div className="disclaimer">Cookie can make mistakes. Check important information.</div>
      </div>}
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

function AccountSettingsPage(props:{
  dark:boolean;setDark:React.Dispatch<React.SetStateAction<boolean>>;
  accent:"orange"|"cream"|"cocoa"|"blue";setAccent:React.Dispatch<React.SetStateAction<"orange"|"cream"|"cocoa"|"blue">>;
  textSize:"small"|"medium"|"large";setTextSize:React.Dispatch<React.SetStateAction<"small"|"medium"|"large">>;
  compact:boolean;setCompact:React.Dispatch<React.SetStateAction<boolean>>;
  animations:boolean;setAnimations:React.Dispatch<React.SetStateAction<boolean>>;
  keyboardHints:boolean;setKeyboardHints:React.Dispatch<React.SetStateAction<boolean>>;
  appLanguage:any;setAppLanguage:React.Dispatch<React.SetStateAction<any>>;
  autoCorrect:boolean;setAutoCorrect:React.Dispatch<React.SetStateAction<boolean>>;
  haptics:boolean;setHaptics:React.Dispatch<React.SetStateAction<boolean>>;
  autoSwitch:boolean;setAutoSwitch:React.Dispatch<React.SetStateAction<boolean>>;
  autocomplete:boolean;setAutocomplete:React.Dispatch<React.SetStateAction<boolean>>;
  trendingSearches:boolean;setTrendingSearches:React.Dispatch<React.SetStateAction<boolean>>;
  memoryEnabled:boolean;setMemoryEnabled:React.Dispatch<React.SetStateAction<boolean>>;
  memoryName:string;setMemoryName:React.Dispatch<React.SetStateAction<string>>;
  memoryOccupation:string;setMemoryOccupation:React.Dispatch<React.SetStateAction<string>>;
  memoryAbout:string;setMemoryAbout:React.Dispatch<React.SetStateAction<string>>;
  profileName:string;setProfileName:React.Dispatch<React.SetStateAction<string>>;
  profileUsername:string;setProfileUsername:React.Dispatch<React.SetStateAction<string>>;
  profileEmail:string;setProfileEmail:React.Dispatch<React.SetStateAction<string>>;
  aiPersonality:string;setAiPersonality:React.Dispatch<React.SetStateAction<string>>;
  model:string;setModel:React.Dispatch<React.SetStateAction<string>>;
  sessionMessages:number;goBack:()=>void;
}){
  const [panel,setPanel]=useState<string|null>(null);
  const [draftName,setDraftName]=useState(props.profileName);
  const [draftUsername,setDraftUsername]=useState(props.profileUsername);
  const [draftEmail,setDraftEmail]=useState(props.profileEmail);
  const personalities=["Balanced","Friendly","Professional","Concise","Creative","Teacher"];
  const modelInfo=MODELS.find(m=>m.id===props.model)||MODELS[0];

  const Row=({icon:Icon,label,value,onClick}:{icon:any;label:string;value?:string;onClick?:()=>void})=>
    <button className="settings-mobile-row" onClick={onClick||(()=>setPanel(label))}>
      <span className="settings-mobile-row-icon"><Icon size={22}/></span>
      <span className="settings-mobile-row-copy"><strong>{label}</strong></span>
      {value&&<span className="settings-mobile-value">{value}</span>}
      <ChevronRight className="settings-mobile-chevron" size={21}/>
    </button>;

  const ToggleRow=({icon:Icon,label,value,onChange}:{icon:any;label:string;value:boolean;onChange:()=>void})=>
    <div className="settings-control-row">
      <span className="settings-mobile-row-icon"><Icon size={21}/></span>
      <div><strong>{label}</strong></div>
      <button className={"settings-inline-toggle "+(value?"on":"")} onClick={onChange} aria-pressed={value}><span/></button>
    </div>;

  if(panel==="Profile"){
    const displayName=props.profileName.trim()||"Cookie user";
    const initials=displayName.trim().split(/\\s+/).map(v=>v[0]).join("").slice(0,2).toUpperCase()||"C";
    return <div className="profile-edit-underlay">
      <div className="profile-edit-underlay-page">
        <div className="settings-reference-head">
          <span className="settings-reference-eyebrow">COOKIE SETTINGS</span>
          <h2>Settings</h2>
        </div>
        <section className="settings-reference-section settings-profile-section">
          <div className="settings-profile">
            <span className="settings-profile-avatar">{initials}</span>
            <div className="settings-profile-copy"><strong>{displayName}</strong><small>{props.profileEmail||"Local account"}</small></div>
            <button className="settings-profile-edit" aria-label="Edit profile"><UserRound size={18}/></button>
          </div>
          <div className="settings-upgrade"><div><strong>Do more with Cookie</strong><small>Get higher limits and access to advanced features.</small></div><button>Edit</button></div>
        </section>
        <section className="settings-reference-section">
          <h3>Customize Cookie</h3>
          <div className="settings-reference-card">
            <div className="settings-mobile-row"><span className="settings-mobile-row-icon"><UserRound size={22}/></span><span className="settings-mobile-row-copy"><strong>Personalization</strong></span><span className="settings-mobile-value">{props.aiPersonality}</span></div>
            <div className="settings-mobile-row"><span className="settings-mobile-row-icon"><Brain size={22}/></span><span className="settings-mobile-row-copy"><strong>Memory</strong></span><span className="settings-mobile-value">{props.memoryEnabled?"On":"Off"}</span></div>
          </div>
        </section>
      </div>
      <div className="profile-edit-backdrop" />
      <section className="profile-edit-modal" role="dialog" aria-modal="true" aria-labelledby="profile-edit-title">
        <button className="profile-edit-close" aria-label="Close profile editor" onClick={()=>setPanel(null)}><X size={34}/></button>
        <div className="profile-edit-hero">
          <div className="profile-edit-avatar">
            <span>{initials}</span>
            <button className="profile-edit-camera" aria-label="Change profile photo"><Camera size={25}/></button>
          </div>
          <h2 id="profile-edit-title">{displayName}</h2>
        </div>
        <div className="profile-edit-fields">
          <label>
            <span>Name</span>
            <input value={draftName} onChange={e=>setDraftName(e.target.value)} autoComplete="name" />
          </label>
          <label>
            <span>Username</span>
            <input value={draftUsername} onChange={e=>setDraftUsername(e.target.value)} autoComplete="username" />
          </label>
          <p>Your profile helps people recognize you in group chats.</p>
          <button className="profile-edit-save" onClick={()=>{
            const nextName=draftName.trim()||"Cookie user";
            const nextUsername=draftUsername.trim()||"Cookie user";
            props.setProfileName(nextName);
            props.setProfileUsername(nextUsername);
            setPanel(null);
          }}>Save profile</button>
          <button className="profile-edit-cancel" onClick={()=>setPanel(null)}>Cancel</button>
        </div>
      </section>
    </div>;
  }
}

function AccountMobileSection({title,children}:{title:string;children:React.ReactNode}){
  return <section className="account-mobile-section"><h3>{title}</h3><div className="account-mobile-card">{children}</div></section>;
}

function SettingGroup({title,desc,children}:{title:string;desc:string;children:React.ReactNode}){
  return <section className="setting-group"><h3>{title}</h3><p>{desc}</p>{children}</section>;
}
function Toggle({label,desc,value,setValue}:{label:string;desc:string;value:boolean;setValue:(v:boolean)=>void}){
  return <div className="toggle-row"><span><strong>{label}</strong><small>{desc}</small></span><button className={"toggle "+(value?"on":"")} onClick={()=>setValue(!value)} aria-pressed={value}><span/></button></div>;
}

function HelpCodeBlock({label,code}:{label:string;code:string}){
  const [copied,setCopied]=useState(false);
  async function copy(){
    try{
      if(navigator.clipboard)await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(()=>setCopied(false),1200);
    }catch{}
  }
  return <div className="help-code-block">
    <div className="help-code-head"><span>{label}</span><button onClick={copy}><Copy size={14}/>{copied?"Copied":"Copy"}</button></div>
    <pre><code>{code}</code></pre>
  </div>;
}

function HelpPage(){
  const topics=[
    ["Getting started","The essentials"],
    ["Chat & conversations","Chats, search, models"],
    ["Files & images","Uploads and attachments"],
    ["Generated files","Artifacts and downloads"],
    ["Models","Cookie model profiles"],
    ["Message actions","Copying and chat actions"],
    ["Settings & interface","Preferences and UI"],
    ["Privacy & limitations","What Cookie can and cannot do"]
  ];
  const [topic,setTopic]=useState("Getting started");
  const content:Record<string,{title:string;body:string[]}>={
    "Getting started":{title:"Getting started",body:[
      "Cookie is the AI assistant built into this website. The simplest way to use it is to open a chat, type what you need in the composer, and send the message. You do not need to translate your request into a special command language. You can ask a direct question, describe a problem, paste code, request an explanation, or give Cookie a larger goal and let it help you break that goal into useful steps. Cookie should respond as Cookie AI and should describe its capabilities accurately rather than pretending that an unavailable feature exists.",
      "The composer is the main control for everyday work. Enter sends a message, while Shift + Enter creates a new line so you can write longer prompts, examples, code, or structured instructions without sending them too early. The + attachment control is separate from the message text and is used when you want to provide images or files. The website also has a sidebar for navigation, recent conversations, Settings, and Help. On smaller screens the sidebar opens over the chat so the same navigation remains available without taking permanent space.",
      "Cookie is designed for many kinds of work. It can explain concepts, answer questions, summarize and rewrite text, translate, brainstorm, plan, reason through problems, help with programming, review or debug code, analyze supported images and files, and create downloadable artifacts when you ask for one. The important distinction is that Cookie should only claim to have done something when the website actually supplied the information or capability required to do it. For example, it should not claim that it opened a website, ran a program, or inspected a file if it did not actually receive that content or have that capability.",
      "A good request gives Cookie the goal and any constraints that matter. For coding, include the language, framework, error, expected behavior, or relevant files. For writing, describe the audience, tone, length, and format. For analysis, provide the source material and explain what you want extracted. If the request is large, Cookie can work through it in stages and return a useful result instead of forcing you to split everything into tiny prompts. You can also ask Cookie to revise an answer when the first result is not what you wanted.",
      "The New chat action starts a fresh conversation so a new task is not mixed with an earlier one. Help topics explain individual parts of the interface in more detail. Settings controls the presentation and behavior of the website, while the model selector controls which Cookie profile is used for the request. The product is still evolving, so the exact interface may change as features are improved. When in doubt, use the visible controls in the current Cookie website as the source of truth.",
      "Cookie can make mistakes. For important information, verify facts and review generated code or documents before relying on them. Cookie should be transparent about uncertainty, missing information, and limitations. It should never invent sources, tool results, files, tests, external actions, or completed work. The goal of the interface is to make the assistant useful and understandable: you provide the intent and context, Cookie provides the reasoning and output that its current capabilities actually support."
    ]},
    "Chat & conversations":{title:"Chat & conversations",body:[
      "The Chat view is the main working area of Cookie. Conversations are displayed as a chronological exchange between you and Cookie AI, with user messages and assistant responses kept visually distinct. The top area contains the Cookie identity and model control, while the sidebar provides navigation to the main chat, recent conversations, Settings, and Help. On mobile, the sidebar is intentionally hidden until you open it with the menu button, which keeps the conversation area usable on a narrow screen.",
      "Starting a new chat is useful whenever the subject changes enough that previous context could become distracting. A fresh chat clears the active conversation shown by the current interface and returns you to the normal chat view. The recent-chat area can be used to move between available conversation entries when that data exists in the current interface. Search is intended for finding content inside the current conversation rather than acting as a general web search engine. Cookie itself should not claim to browse the public internet unless an actual browsing capability is provided to it.",
      "The model selector lets you choose among Cookie's available profiles. The selected profile is sent with the request so the backend can apply the corresponding behavior. A model name in the Cookie interface is a Cookie product profile; it should not be interpreted as a promise that the underlying provider, model version, or infrastructure will remain unchanged forever. If a model has different limits or behavior, those differences should be explained by the product rather than guessed by the assistant.",
      "Conversation messages can contain text, uploaded attachments, and generated files. The three-dot More menu belongs to the current chat session. Its actions apply to the conversation as a whole, including sharing, renaming, pinning, finding content, archiving, and deleting the current chat. These are session/local UI actions rather than a persistent project workspace. If an action is local or session-based, Cookie should not describe it as permanent cloud storage. Similarly, if the interface does not expose a control, Cookie should not tell the user to click it. The Help center describes the controls that are actually part of the current product.",
      "For better results, treat a conversation as shared working context. Refer back to earlier requirements when asking for a revision, and tell Cookie what changed when the task moves in a new direction. If an answer is too short, ask for a deeper explanation; if it is too long, ask for a concise version. You can ask for a different format such as a checklist, table, code block, document outline, or downloadable file. Cookie should preserve relevant constraints from the active conversation while still asking for clarification when a requirement is genuinely ambiguous.",
      "The interface is intentionally designed to keep the chat readable instead of covering every capability with buttons. The product's internal capabilities are used when needed, while the user-facing UI stays focused on conversation, attachments, navigation, and results. This is why you may see Cookie create a downloadable file without seeing a separate Tools menu. The absence of a button does not mean the assistant cannot perform an internal operation; it means the website handles that operation behind the conversation."
    ]},
    "Files & images":{title:"Files & images",body:[
      "Cookie can work with user-provided images and supported files when those attachments are actually sent with the message. Press the + button beside the composer to open the attachment picker. Camera and Photos are image-oriented choices, while Files is intended for non-image files. The interface deliberately keeps those choices separate so selecting Upload image does not accidentally turn into a generic file picker, and selecting Upload file does not accept an image through the image path.",
      "There is a maximum of 10 uploaded images or files for a single message. The limit is counted across the attachment set, so adding several images and several files uses the same total allowance. Folder uploads are not supported. If you reach the limit, remove an attachment before adding another. The exact ability to inspect a file depends on whether usable content was successfully provided to the backend. Cookie should say when it cannot read or interpret an attachment instead of inventing what the file contains.",
      "Images can be useful for visual questions, screenshots, diagrams, photographs, interface problems, and other tasks where the content itself matters. Files can provide text, source code, documents, configuration, or other supported material. When you upload something, include a short instruction about what you want Cookie to do with it: summarize it, find an error, extract fields, compare sections, rewrite it, explain it, or use it as context for a larger task. A precise goal helps Cookie focus on the relevant content instead of guessing why an attachment was supplied.",
      "Uploaded content should be treated as task context, not as permission to invent access to your device. Cookie cannot claim to see other files, folders, applications, photos, messages, or private data that were not actually supplied through the website. Similarly, uploading one document does not automatically give Cookie access to an entire directory containing related documents. The product intentionally limits attachment behavior to the content that the user explicitly chooses to provide.",
      "When an attachment contains code, Cookie can review the supplied source and help identify errors, propose changes, explain architecture, or produce revised code. When an attachment contains prose or structured data, Cookie can summarize, transform, organize, or analyze it according to the request. For images, Cookie should describe only what it can actually observe. If a file is corrupted, unsupported, empty, or otherwise unreadable, the correct behavior is to explain that limitation and request another usable copy or a pasted excerpt.",
      "Attachments are associated with the message being composed. Generated files are a different concept: those are artifacts Cookie creates in response to a request and returns directly in the conversation. Keeping these two directions separate makes the interface predictable. You provide images/files through the attachment picker; Cookie returns generated artifacts through the assistant message. Neither mechanism should be described as a persistent workspace or folder manager."
    ]},
    "Generated files":{title:"Generated files",body:[
      "Cookie can create downloadable files when a task calls for an actual artifact rather than only an explanation. You can ask for source code, a configuration file, a text document, structured data, or another file that Cookie can generate from the information available in the conversation. The intended experience is simple: describe what you need, Cookie creates the artifact during its response, and the generated file appears directly inside the chat so you can download it.",
      "The generation process can use internal temporary file capabilities to create, read, update, and delete files while Cookie is working on the response. Those internal operations are implementation details and are not presented as a user-facing Tools menu. Cookie should use them when they improve reliability, especially when a request contains several related files or requires iterative changes. The assistant should focus its response on the result and should not force the user to manually activate an internal tool just to receive an artifact.",
      "Generated files are temporary response artifacts in the current product. The website does not expose the old Workspace or Project Files system, and it does not provide a persistent project filesystem through the chat interface. Therefore Cookie must not tell users that it saved a project into a permanent workspace, created a folder in a persistent project browser, or left a server-side file available forever unless a future version of the product explicitly adds that capability.",
      "When creating a code project, Cookie should think about the requested structure before producing the files. It can create multiple related files when that is necessary, keep imports and paths consistent, and include the important configuration files requested by the user. For a single-file request, it should avoid inventing unnecessary project structure. If the user asks for a particular filename or extension, the generated artifact should use that name where technically appropriate. If a requested format cannot be generated safely or accurately, Cookie should say so and provide the closest useful alternative rather than pretending.",
      "Generated files should contain the actual requested content, not a placeholder that merely describes what the file could contain. Cookie should not claim that a file was tested, executed, compiled, deployed, or validated unless that action actually occurred through an available capability. It can still explain what was checked by reasoning over the content, but it must distinguish static review from real execution. This rule is especially important for programming tasks, where a polished-looking file can still contain an error.",
      "The download action belongs to the assistant message that produced the artifact. If you want a revision, ask Cookie to modify the file and describe the change. Cookie can use the temporary generated-file state during the current response to refine related artifacts. For a new independent artifact, starting a new request or chat can provide a cleaner context. The Help page describes this behavior because generated files are a core result type of Cookie, not a replacement for a persistent workspace."
    ]},
    "Models":{title:"Models",body:[
      "Cookie presents its available model choices as product profiles so users can select the kind of assistance they want. The current profiles are CPT-1, CPT-2 MAX, and CPT-3 ULTRA. CPT-1 is positioned as the standard everyday profile, CPT-2 MAX as a profile intended for deeper reasoning and coding work, and CPT-3 ULTRA as the highest-capability profile for difficult multimodal and agentic tasks within the current Cookie product. These descriptions explain intended use; they are not guarantees that every response will be correct.",
      "The profile name is part of Cookie's own interface. It does not by itself reveal or guarantee the underlying model provider, exact model version, infrastructure, training data, or future availability. Those implementation details can change independently of the visible Cookie profile name. Cookie should identify itself as Cookie AI when asked who it is and should avoid confusing its product identity with the underlying service that supplies model inference.",
      "Choosing a stronger profile does not remove the need for clear instructions. Give the assistant the relevant context, expected result, constraints, examples, and source material. For a coding task, specify the language and environment and include the relevant files or error messages. For analysis, provide the material and the question you want answered. For a creative task, provide the desired audience and style. Better context generally gives Cookie a clearer target regardless of which profile is selected.",
      "The selected profile is sent with the chat request so the backend can apply the corresponding configuration. Cookie should follow the behavior associated with that profile without claiming capabilities that are not actually available. A model profile cannot magically grant access to your device, private accounts, external websites, or persistent storage. If the current website does not provide a capability, the assistant should state that limitation rather than using the model name as a reason to imply otherwise.",
      "The profiles are also not a promise that every task should use the largest setting. Everyday questions may not require the most demanding reasoning configuration, while complex code, long analysis, or difficult multi-step tasks may benefit from a deeper profile. The user remains in control of the selection. Cookie should describe the practical differences in terms of intended behavior and current product limits, not invent numerical benchmarks or unsupported claims about superiority.",
      "If a model request fails, returns an error, or behaves differently from expected, the correct response is to report the observed issue and continue with whatever information is actually available. Cookie should not fabricate a successful model switch, hidden retry, or completed computation. Model selection is one part of the product; the conversation, attachments, internal file capabilities, and interface all still follow their own current rules."
    ]},
    "Message actions":{title:"Chat actions",body:[
      "The three-dot menu belongs to the chat session, not to an individual AI response. It lives in the chat header so its actions operate on the whole conversation.",
      "Share chat uses the browser's sharing behavior when available and can fall back to copying the conversation transcript. Rename chat changes the title shown for the current session, while Pin chat marks the session locally in the current interface.",
      "Find in chat opens conversation search. Archive chat moves the current session into its archived state in this interface. Delete chat clears the current chat and starts a fresh session. These are session-level UI actions and are not promises of permanent cloud-account storage.",
      "Copy remains attached to an individual assistant response because Copy directly concerns that response's text. Keeping it separate prevents message operations from being mixed with conversation operations.",
      "If an action is not visible, use the controls actually present in the current Cookie interface. The product should never claim that a hidden menu or unavailable storage feature exists."
    ]},
    "Settings & interface":{title:"Settings & interface",body:[
      "Cookie's Settings area controls the presentation and interaction style of the website. The goal is to let you adjust the interface without changing the underlying identity of Cookie AI. Depending on the current version, Settings can include appearance, accent, text size, chat density, motion behavior, keyboard hints, and local-data controls. These settings affect the way the website behaves or looks; they should not be described as changing the underlying model into a different AI.",
      "Appearance controls are intended to make the interface comfortable across different environments. Text-size controls can make long answers easier to read, while density controls can change how much information is visible at once. Accent settings change interface emphasis rather than changing Cookie's personality or reasoning. The website is responsive, so controls and layouts can move between desktop and mobile forms while keeping the same basic functions available.",
      "Motion is treated as an interface preference. Cookie uses short transitions for views, menus, message interactions, and selected help content so changes have a visible relationship instead of appearing abruptly. If reduced motion is enabled by the operating system or product setting, animations should be reduced or disabled where appropriate. This is important for accessibility and also keeps the interface from becoming distracting during long conversations.",
      "Keyboard hints explain useful shortcuts without requiring the user to memorize them. Enter sends a message and Shift + Enter creates a new line. Other navigation actions may be available through the sidebar or visible buttons depending on the current interface. A shortcut should never be presented as the only way to perform an action when a visible control exists. Mobile users generally rely on touch controls, while desktop users can combine the same controls with keyboard interaction.",
      "The sidebar is a major part of Cookie's navigation model. It gives users access to chat navigation and product pages such as Settings and Help without turning every feature into a floating control inside the composer. Help itself uses a sidebar-style topic navigation so all major help subjects are visible at once. Selecting a topic changes the content area on the right, and the transition provides visual feedback that the selected page has changed.",
      "Cookie's interface is still a product under development. A visible control is the safest indication of what is currently supported. If a setting or button is absent, Cookie should not invent its location. Likewise, changing a visual preference should not be treated as evidence that a backend capability has changed. Settings control the experience around Cookie; the chat backend controls the assistant behavior; generated files and attachments are handled through their respective conversation flows."
    ]},
    "Privacy & limitations":{title:"Privacy & limitations",body:[
      "Cookie should be treated as an AI assistant with explicit product boundaries, not as an invisible observer of your device. The assistant receives the information that the website sends with a request, such as conversation context and user-selected attachments. It should not claim access to unrelated photos, folders, applications, browser tabs, private accounts, messages, microphone input, camera input, or device storage unless the current website explicitly provides that capability and the user actually uses it.",
      "The website currently supports user-selected image and file attachments with a maximum of 10 items per message, but that does not mean Cookie can inspect every file on a device. Folder uploads are not part of the current interface. Similarly, the generated-file system creates temporary response artifacts; it is not a persistent project workspace. These distinctions matter because an assistant can sound confident even when a capability is unavailable. Cookie's instructions explicitly require it to describe what it actually received and did.",
      "Cookie can also make ordinary AI mistakes. It may misunderstand a question, produce incorrect code, miss an important detail in a document, or give an answer that needs verification. For high-stakes areas such as medicine, law, finance, safety, or decisions with serious consequences, treat the response as assistance rather than final authority and verify important information with appropriate primary or professional sources. When uncertainty is material, Cookie should say what is uncertain instead of hiding the limitation behind confident language.",
      "The assistant should never fabricate tool use. If it did not browse a website, it should not say that it browsed one. If it did not execute code, it should not say that the code passed tests. If it did not receive a readable attachment, it should not pretend to have analyzed it. If it created a file but did not execute it, it should distinguish file generation from execution. These rules are part of Cookie's product behavior because trust depends on knowing the difference between an inferred answer and an observed result.",
      "The Cookie website itself can change as development continues. Buttons, model profiles, limits, and help topics may be updated. The Help center therefore describes the current product rather than promising that every feature will remain unchanged. When a visible interface conflicts with an old description, the current interface should be treated as authoritative and the assistant should avoid inventing an explanation for a feature that no longer exists.",
      "Privacy also means keeping the assistant's claims narrow. Cookie should use only the context it actually receives for the current task and should not imply hidden knowledge about the user. It should be transparent about what information came from the conversation, what came from an uploaded file, and what is simply reasoning. If you want Cookie to work with a particular document or image, provide that material directly and state what you want done. Clear boundaries make the assistant more predictable and make it easier for you to control what information is used."
    ]}
  };
  const selected=content[topic]||content["Getting started"];
  const examples:Record<string,string>={
    "Getting started":"# Start here\n\n## First message\nType what you need → Enter\nShift + Enter → new line\n+ → attachments",
    "Chat & conversations":"# Chat session\n\n## Session menu\n••• → Share\n••• → Rename\n••• → Pin\n••• → Find\n••• → Archive\n••• → Delete",
    "Files & images":"# Attachments\n\n## Add context\n+ → Camera\n+ → Photos\n+ → Files\nLimit → 10 items per message",
    "Generated files":"# Generated files\n\n## Result\nCookie creates the artifact\nDownload file → save the result",
    "Models":"# Profiles\n\n## Available\nCPT-1 → everyday\nCPT-2 MAX → deeper reasoning + coding\nCPT-3 ULTRA → maximum Cookie profile",
    "Message actions":"# Chat actions\n\n## Current session\n••• → Share · Rename · Pin · Find · Archive · Delete\nCopy → individual assistant response",
    "Settings & interface":"# Preferences\n\n## Appearance\nTheme → dark, light\nAccent → interface highlight\nText size → reading scale\n\n## Chat\nDensity · motion · keyboard hints",
    "Privacy & limitations":"# Boundary\n\n## What Cookie receives\nOnly information supplied to the current request.\nAttachments are explicit; folder access is not provided."
  };
  const sectionNames=["Overview","How it works","Details","Tips","Current behavior","Important"];
  return <div className="page-container help-page">
    <div className="page-heading"><span className="eyebrow">SUPPORT</span><h2>Help & shortcuts</h2><p>A practical guide to Cookie. Pick a topic and jump straight to what you need.</p></div>
    <div className="help-layout">
      <nav className="help-nav" aria-label="Help topics">
        <div className="help-nav-label">Topics</div>
        {topics.map(([name,desc],i)=><button key={name} style={{"--help-index":i} as React.CSSProperties} className={"help-topic "+(topic===name?"active":"")} onClick={()=>setTopic(name)}><span>{name}</span><small>{desc}</small></button>)}
      </nav>
      <article key={topic} className="help-content help-content-enter">
        <div className="help-content-head"><span className="eyebrow">COOKIE HELP</span><h3>{selected.title}</h3></div>
        <div className="help-article">
          {selected.body.map((p,i)=><section className="help-section" key={i}>
            <h4>{sectionNames[Math.min(i,sectionNames.length-1)]}</h4>
            <p className={i===0?"help-lead":""}>{p}</p>
          </section>)}
          <HelpCodeBlock label="Quick reference" code={examples[topic]||examples["Getting started"]}/>
        </div>
        <div className="help-note"><ShieldCheck size={16}/><span>Cookie can make mistakes. Verify important information.</span></div>
      </article>
    </div>
  </div>;
}
