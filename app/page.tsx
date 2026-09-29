'use client';

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const MODELS=[["standard","CPT-1","Fast everyday assistant"],["max","CPT-2 MAX","Deep reasoning & coding"],["ultra","CPT-3 ULTRA","Maximum agentic capability"]];
const STARTERS=[["Build a website","Create a complete project in my workspace"],["Explain something","Teach me a difficult topic simply"],["Debug code","Find and fix the bug in my code"],["Write something","Draft polished content for me"]];

type Msg={id:string;role:"user"|"assistant";content:string;images?:string[]};
type FileItem={path:string;content:string;kind?:string};
const id=()=>Math.random().toString(36).slice(2)+Date.now().toString(36);

export default function Home(){
 const [messages,setMessages]=useState<Msg[]>([]),[input,setInput]=useState(""),[model,setModel]=useState("standard"),[modelOpen,setModelOpen]=useState(false);
 const [workspace,setWorkspace]=useState<FileItem[]>([]),[drawer,setDrawer]=useState(false),[loading,setLoading]=useState(false),[images,setImages]=useState<string[]>([]),[panel,setPanel]=useState<"settings"|"help"|null>(null),[dark,setDark]=useState(true);
 const fileRef=useRef<HTMLInputElement>(null),bottom=useRef<HTMLDivElement>(null);
 useEffect(()=>{try{const x=JSON.parse(localStorage.getItem("cookie_workspace")||"[]");if(Array.isArray(x))setWorkspace(x)}catch{}},[]);
 useEffect(()=>localStorage.setItem("cookie_workspace",JSON.stringify(workspace)),[workspace]);
 useEffect(()=>bottom.current?.scrollIntoView({behavior:"smooth"}),[messages,loading]);
 const active=useMemo(()=>MODELS.find(x=>x[0]===model)||MODELS[0],[model]);

 async function send(raw=input){
  const text=raw.trim();if(!text||loading)return;
  const next=[...messages,{id:id(),role:"user" as const,content:text,images}];setMessages(next);setInput("");setImages([]);setLoading(true);
  try{const r=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({messages:next.map(m=>({role:m.role,content:m.content})),preferences:{responseMode:model,language:"auto",answerLength:"auto",creativity:.7},workspace,attachments:images.map(data=>({kind:"image",data}))})});const d=await r.json();if(!r.ok)throw Error(d.error||"Cookie could not answer.");if(Array.isArray(d.workspace))setWorkspace(d.workspace);setMessages(v=>[...v,{id:id(),role:"assistant",content:d.message||"Done."}]);}
  catch(e){setMessages(v=>[...v,{id:id(),role:"assistant",content:"Error: "+(e instanceof Error?e.message:"Something went wrong.")}]);}finally{setLoading(false)}
 }
 async function attach(e:React.ChangeEvent<HTMLInputElement>){const fs=Array.from(e.target.files||[]).filter(f=>f.type.startsWith("image/")).slice(0,4);const xs=await Promise.all(fs.map(f=>new Promise<string>(res=>{const r=new FileReader();r.onload=()=>res(String(r.result));r.readAsDataURL(f)})));setImages(v=>[...v,...xs]);e.target.value=""}
 function download(){const blob=new Blob([workspace.map(f=>"===== "+f.path+" =====\\n"+f.content).join("\\n\\n")],{type:"text/plain"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="cookie-project.txt";a.click()}
 return <main className={"app "+(dark?"dark":"light")}>
  <motion.aside className="sidebar" initial={{x:-35,opacity:0}} animate={{x:0,opacity:1}} transition={{duration:.4,ease:[.22,1,.36,1]}}>
   <div className="brand"><b>C</b><strong>Cookie</strong></div><button className="new" onClick={()=>setMessages([])}>＋ New chat</button>
   <nav><button className="active">⌕ <span>Chat</span></button><button onClick={()=>setDrawer(true)}>⌘ <span>Workspace</span></button><button onClick={()=>setPanel("settings")}>⚙ <span>Settings</span></button><button onClick={()=>setPanel("help")}>? <span>Help</span></button></nav>
   <small className="side-foot">Cookie Preview · Free demo</small>
  </motion.aside>
  <section className="shell">
   <header><span>Chat · {active[1]}</span><div className="model-wrap"><button className="model-btn" onClick={()=>setModelOpen(v=>!v)}>{active[1]}⌄</button><AnimatePresence>{modelOpen&&<motion.div className="model-menu" initial={{opacity:0,y:-8,scale:.97}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:-5}}>{MODELS.map(m=><button className={m[0]===model?"selected":""} key={m[0]} onClick={()=>{setModel(m[0]);setModelOpen(false)}}><b>{m[1]}</b><small>{m[2]}</small>{m[0]===model&&<i>✓</i>}</button>)}</motion.div>}</AnimatePresence></div></header>
   <div className="chat">
    {messages.length===0?<motion.div className="welcome" initial={{opacity:0,y:20}} animate={{opacity:1,y:0}}><motion.div className="orb" animate={{y:[0,-5,0],rotate:[0,2,0]}} transition={{duration:4,repeat:Infinity}}>C</motion.div><h1>What can I help you build?</h1><p>Ask Cookie anything — or give it a project and let it work.</p><div className="starters">{STARTERS.map(s=><motion.button whileHover={{y:-3}} whileTap={{scale:.97}} key={s[0]} onClick={()=>send(s[1])}><b>{s[0]}</b><small>{s[1]}</small></motion.button>)}</div></motion.div>:<div className="messages"><AnimatePresence initial={false}>{messages.map(m=><motion.article className={"msg "+m.role} key={m.id} initial={{opacity:0,y:18,scale:.98}} animate={{opacity:1,y:0,scale:1}} transition={{duration:.32}}><div className="avatar">{m.role==="assistant"?"C":"You"}</div><div className="bubble">{m.images?.map((x,i)=><img key={i} src={x} alt="attachment"/>)}<Message text={m.content}/></div></motion.article>)}</AnimatePresence></div>}
    {loading&&<motion.div className="typing" initial={{opacity:0}} animate={{opacity:1}}><i/><i/><i/> Cookie is thinking</motion.div>}<div ref={bottom}/>
   </div>
   <div className="composer-wrap">{images.length>0&&<motion.div className="thumbs" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}}>{images.map((x,i)=><div key={i}><img src={x}/><button onClick={()=>setImages(v=>v.filter((_,j)=>j!==i))}>×</button></div>)}</motion.div>}
    <motion.div className="composer" animate={{boxShadow:input?"0 0 0 1px #d9965a55,0 18px 50px #0005":"0 12px 40px #0004"}}><textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send()}}} placeholder="Message Cookie..."/><div className="bar"><button onClick={()=>fileRef.current?.click()}>＋ Attach</button><span>Enter to send</span><motion.button whileHover={{scale:1.06}} whileTap={{scale:.9}} className="send" disabled={loading||!input.trim()} onClick={()=>send()}>↑</motion.button></div></motion.div>
    <input hidden ref={fileRef} type="file" accept="image/*" multiple onChange={attach}/><small className="disclaimer">Cookie Preview · AI can make mistakes. Check important information.</small>
   </div>
  </section>
  <button className="workspace-trigger" onClick={()=>setDrawer(true)}>•••</button>
  <AnimatePresence>{drawer&&<><motion.div className="backdrop" initial={{opacity:0}} animate={{opacity:.45}} exit={{opacity:0}} onClick={()=>setDrawer(false)}/><motion.aside className="drawer" initial={{x:"100%"}} animate={{x:0}} exit={{x:"100%"}} transition={{duration:.42,ease:[.22,1,.36,1]}}><div className="drawer-head"><div><b>Project</b><small>{workspace.length} files · local workspace</small></div><button onClick={()=>setDrawer(false)}>×</button></div><div className="drawer-actions"><button onClick={download}>↓ <b>Download project</b><small>Export workspace</small></button></div><div className="files">{workspace.length?workspace.map(f=><div key={f.path}>◻ {f.path}<small>{f.content.length} chars</small></div>):<p>Your agent-created project files will appear here.</p>}</div></motion.aside></>}</AnimatePresence>
  <AnimatePresence>{panel&&<motion.div className="modal-bg" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}><motion.div className="modal" initial={{opacity:0,y:24,scale:.96}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:12}}><header><b>{panel==="settings"?"Settings":"Help"}</b><button onClick={()=>setPanel(null)}>×</button></header>{panel==="settings"?<div><label>Appearance <button onClick={()=>setDark(v=>!v)}>{dark?"Dark":"Light"} mode</button></label><p>Cookie is now a Next.js + React interface with component-level motion.</p></div>:<div><h3>Cookie workspace</h3><p>Ask Cookie to build projects, create files, edit them, and inspect the workspace. Changes are stored locally during the preview.</p></div>}</motion.div></motion.div>}</AnimatePresence>
 </main>
}
function Message({text}:{text:string}){return <div className="message-text">{text.split("\n").map((x,i)=><p key={i}>{x||" "}</p>)}</div>}
