import React,{useMemo,useState} from "react";
import {BookOpen,ChevronRight,CircleHelp,FileText,LockKeyhole,MessageSquare,Search,ShieldCheck,Sparkles,Upload,UserRound,Volume2,Wrench,X} from "lucide-react";
type Article={id:string;title:string;summary:string;body:React.ReactNode};
type Topic={id:string;title:string;description:string;icon:React.ReactNode;articles:Article[]};
const topics:Topic[]=[
{id:"start",title:"Getting started",description:"The essentials for using Cookie.",icon:<Sparkles size={18}/>,articles:[
{id:"start-cookie",title:"What is Cookie?",summary:"A quick overview of Cookie and what it can do.",body:<><p>Cookie is an AI workspace for conversations, research, files, coding, projects, and focused work.</p><h3>Start here</h3><ol><li>Open a new chat and describe what you need.</li><li>Attach a file or image when the task needs it.</li><li>For larger goals, use <b>Work</b> so Cookie can structure the task.</li></ol><p>You do not need to choose a tool first. Cookie can decide when a task needs search, calculation, file analysis, or other capabilities.</p></>},
{id:"first-chat",title:"Start your first chat",summary:"Get useful answers with a clear prompt.",body:<><p>Tell Cookie the goal, relevant context, and the format you want back.</p><h3>A useful prompt</h3><p>Say what you are trying to accomplish, include important constraints, and mention the audience or deadline when it matters.</p><p>You can ask Cookie to revise an answer instead of starting over.</p></>}
]},
{id:"account",title:"Account & login",description:"Sign in, profile, password, and account access.",icon:<UserRound size={18}/>,articles:[
{id:"login",title:"Sign in and account access",summary:"How Cookie accounts and access work.",body:<><p>Your account keeps your Cookie identity and account-level settings together. Use the sign-in flow shown by Cookie and keep access to your email address.</p><h3>Locked or restricted accounts</h3><p>An account can be restricted for security or moderation reasons. Cookie may show the reason and, for temporary restrictions, when access can return.</p></>},
{id:"password",title:"Reset your password",summary:"Use the secure reset email when you cannot sign in.",body:<><p>Use the password reset option on the sign-in screen. Cookie sends a time-limited reset link to the account email when available.</p><p>Never share a reset link or verification code with another person.</p></>}
]},
{id:"chat",title:"Chats",description:"Conversations, history, sharing, and temporary chats.",icon:<MessageSquare size={18}/>,articles:[
{id:"history",title:"Chat history",summary:"Manage conversations from the sidebar.",body:<><p>Your saved conversations appear in the sidebar. You can open, rename, pin, archive, or delete conversations where those controls are available.</p><p>Deleting a chat removes it from your Cookie chat history. Some security, billing, or moderation records may be kept separately when required for legitimate purposes.</p></>},
{id:"temporary",title:"Temporary chats",summary:"Use a chat when you do not want it in normal history.",body:<><p>Temporary chats are designed for conversations you do not want saved to normal chat history. Do not treat temporary mode as a promise of zero server-side processing or immediate deletion of every technical record.</p></>},
{id:"sharing",title:"Share a conversation",summary:"Create a read-only view of a conversation.",body:<><p>Shared conversations can be viewed by anyone who has the share link. Only share information you are comfortable exposing through that link.</p><p>Remove sharing when you no longer want the link to work, where that control is available.</p></>}
]},
{id:"models",title:"Models & responses",description:"Choosing models, effort, and getting better results.",icon:<BookOpen size={18}/>,articles:[
{id:"models",title:"Cookie models",summary:"Understand the model levels available in Cookie.",body:<><p>Cookie can offer different model levels for different plans. Higher levels may provide more reasoning depth, multimodal capability, or engineering performance.</p><p>Availability, limits, and model names can change as Cookie is updated.</p></>},
{id:"better-results",title:"Get better answers",summary:"Simple ways to improve results.",body:<><ul><li>Give Cookie the actual goal, not only the topic.</li><li>Include constraints and examples.</li><li>Ask for a specific output format.</li><li>Attach source material when accuracy depends on it.</li><li>Correct a wrong assumption and ask Cookie to continue.</li></ul></>}
]},
{id:"work",title:"Work & projects",description:"Longer tasks, projects, and organized work.",icon:<Wrench size={18}/>,articles:[
{id:"work-mode",title:"Use Work for larger goals",summary:"Let Cookie break a goal into steps.",body:<><p>Work is designed for tasks that involve several steps. Describe the outcome you want and let Cookie determine a practical workflow.</p><p>Review important outputs before using them in production or making consequential decisions.</p></>},
{id:"projects",title:"Projects",summary:"Keep related work together.",body:<><p>Use Projects to keep related conversations and work in one place. The exact project features available to you depend on the current Cookie release and account plan.</p></>}
]},
{id:"files",title:"Files & images",description:"Upload files, analyze documents, and work with images.",icon:<Upload size={18}/>,articles:[
{id:"uploads",title:"Upload a file",summary:"Give Cookie the material it needs for a task.",body:<><p>Use the attachment control in the composer to add supported files or images. Tell Cookie what you want it to do with the upload.</p><h3>Before uploading</h3><p>Remove sensitive information you do not need to share. File size and supported formats can vary by feature and plan.</p></>},
{id:"images",title:"Images",summary:"Ask Cookie to understand or create visual content.",body:<><p>Cookie can analyze supported images and, where enabled, generate images. Describe the visual result or the exact parts of an image you want analyzed.</p></>}
]},
{id:"search",title:"Search & research",description:"Current information, sources, and research workflows.",icon:<Search size={18}/>,articles:[
{id:"web",title:"When Cookie searches the web",summary:"Cookie can decide when live information is needed.",body:<><p>You do not need to manually select a search tool. Cookie can decide that a question needs current web information and use search when that capability is available.</p><p>For important claims, open the cited sources and verify the details yourself.</p></>},
{id:"sources",title:"Sources and citations",summary:"Understand where research answers come from.",body:<><p>When a response includes sources, use the source links and inspector to review the supporting material. A citation does not guarantee that every statement is correct, so check important facts at the original source.</p></>}
]},
{id:"memory",title:"Memory",description:"How saved preferences and memory work.",icon:<CircleHelp size={18}/>,articles:[
{id:"memory",title:"How Memory works",summary:"Cookie can retain useful information when Memory is enabled.",body:<><p>Memory can help Cookie use relevant information from previous interactions so you do not have to repeat it.</p><p>Review memory regularly. Do not save passwords, security codes, or other secrets as memory.</p>},
{id:"memory-controls",title:"Control your Memory",summary:"Review or remove saved memory.",body:<><p>Use Cookie's Memory settings to review saved items and remove information you no longer want retained as memory. Deleting a memory does not necessarily delete the original conversation or other copies of the information.</p></>}
]},
{id:"voice",title:"Voice",description:"Talk with Cookie using your microphone.",icon:<Volume2 size={18}/>,articles:[
{id:"voice",title:"Use Voice",summary:"Start and manage a voice conversation.",body:<><p>Open Voice and allow microphone access when your device asks. Speak naturally and pause when you want Cookie to respond.</p><p>Voice availability and limits can vary by device, account, and plan.</p></>}
]},
{id:"code",title:"Code Studio",description:"Build, edit, review, and manage code safely.",icon:<Wrench size={18}/>,articles:[
{id:"code-studio",title:"Code Studio basics",summary:"Work with a codebase without losing control.",body:<><p>Code Studio is designed for engineering work such as inspecting files, making changes, reviewing revisions, and validating code.</p><p>Review changes before deployment. Never place API keys, passwords, or private tokens in source files.</p>},
{id:"protected",title:"Protected files and revisions",summary:"Why some project files have extra protection.",body:<><p>Some files and configuration areas are protected to reduce accidental damage. Use revisions and review changes before accepting important modifications.</p></>}
]},
{id:"gpts",title:"GPTs",description:"Specialized assistants inside Cookie.",icon:<Sparkles size={18}/>,articles:[
{id:"gpts",title:"Use GPTs",summary:"Choose a specialized assistant for a task.",body:<><p>GPTs are specialized Cookie experiences with focused instructions, such as study, coding, writing, research, data, or creative work.</p><p>Choose one when its specialization matches your task. You can return to normal Chat at any time.</p></>}
]},
{id:"billing",title:"Plans & billing",description:"Plans, limits, and account usage.",icon:<FileText size={18}/>,articles:[
{id:"plans",title:"Plans and limits",summary:"Why features and limits can differ by account.",body:<><p>Cookie plans can have different model access, usage limits, and features. Limits may change as the service evolves.</p><p>Your account settings are the best place to see the plan and limits currently applied to you.</p></>}
]},
{id:"safety",title:"Safety & moderation",description:"Account restrictions and keeping Cookie safe.",icon:<ShieldCheck size={18}/>,articles:[
{id:"moderation",title:"Warnings, suspensions, and bans",summary:"What account restrictions mean.",body:<><p>Cookie may warn, temporarily suspend, or permanently restrict accounts that violate the Terms or abuse the service.</p><p>Temporary restrictions can include an end time. Permanent restrictions can require an administrator decision before access is restored.</p></>},
{id:"safe-use",title:"Safe use",summary:"Use Cookie responsibly.",body:<><p>Do not use Cookie to harm people, commit fraud, evade security controls, or create dangerous or illegal content. Do not rely on Cookie alone for medical, legal, financial, or other high-stakes decisions.</p></>}
]},
{id:"privacy",title:"Privacy & data",description:"Understand the basics of your data and privacy.",icon:<LockKeyhole size={18}/>,articles:[
{id:"privacy",title:"Privacy basics",summary:"What to know before using Cookie.",body:<><p>Cookie processes information needed to provide the service, including account information and content you choose to submit. Some features may create additional technical, security, or moderation records.</p><p>Read the <button className="help-inline-link" onClick={()=>window.dispatchEvent(new CustomEvent("cookie:open-legal",{detail:"privacy"}))}>Privacy Policy</button> for the full explanation.</p></>}
]},
{id:"troubleshoot",title:"Troubleshooting",description:"Fix common problems quickly.",icon:<CircleHelp size={18}/>,articles:[
{id:"not-working",title:"Cookie is not responding",summary:"What to check when a request fails.",body:<><ol><li>Check your internet connection.</li><li>Refresh Cookie and retry.</li><li>Try a new chat if the conversation is very large.</li><li>For uploads, confirm the file is supported and not too large.</li><li>If the problem persists, check for a service notice or contact support.</li></ol></>},
{id:"browser",title:"Browser or mobile issues",summary:"Quick fixes for Safari and mobile devices.",body:<><p>Refresh the page, make sure your browser is up to date, and confirm Cookie has the permissions it needs for features such as microphone access. On iPhone, use the latest supported iOS and Safari version available to you.</p></>}
]}
];
export default function HelpCenterPage({onClose,onLegal}:{onClose:()=>void;onLegal:(kind:"terms"|"privacy")=>void}){
 const [query,setQuery]=useState("");const [topicId,setTopicId]=useState("start");const [articleId,setArticleId]=useState("start-cookie");
 const topic=topics.find(t=>t.id===topicId)||topics[0];const article=topic.articles.find(a=>a.id===articleId)||topic.articles[0];
 const results=useMemo(()=>{const q=query.trim().toLowerCase();if(!q)return [];return topics.flatMap(t=>t.articles.filter(a=>(t.title+" "+a.title+" "+a.summary).toLowerCase().includes(q)).map(a=>({topic:t,article:a}))).slice(0,12)},[query]);
 const openArticle=(t:Topic,a:Article)=>{setTopicId(t.id);setArticleId(a.id);setQuery("")};
 return <div className="help-center">
  <header className="help-head"><div className="help-brand"><div className="help-logo"><BookOpen size={18}/></div><div><b>Cookie Help Center</b><span>Help, guides, and answers</span></div></div><button className="help-close" onClick={onClose} aria-label="Close help"><X size={18}/></button></header>
  <div className="help-hero"><span>HELP CENTER</span><h1>How can we help?</h1><p>Find clear answers about Cookie, from getting started to privacy and account controls.</p><label className="help-search"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search Cookie help" autoFocus/></label>
   {query&&<div className="help-search-results">{results.length?results.map(({topic:t,article:a})=><button key={t.id+a.id} onClick={()=>openArticle(t,a)}><span>{t.title}</span><b>{a.title}</b><small>{a.summary}</small><ChevronRight size={15}/></button>):<div className="help-no-results">No articles found.</div>}</div>}
  </div>
  <div className="help-body"><aside className="help-topics">{topics.map(t=><button key={t.id} className={topic.id===t.id?"active":""} onClick={()=>{setTopicId(t.id);setArticleId(t.articles[0].id)}}><span>{t.icon}<b>{t.title}</b></span><ChevronRight size={14}/></button>)}</aside>
   <main className="help-article"><div className="help-breadcrumb"><button onClick={()=>{setTopicId(topic.id);setArticleId(topic.articles[0].id)}}>{topic.title}</button><ChevronRight size={13}/><span>{article.title}</span></div><div className="help-article-head"><span>{topic.title}</span><h2>{article.title}</h2><p>{article.summary}</p></div><div className="help-article-body">{article.body}</div><div className="help-article-nav">{topic.articles.map(a=><button key={a.id} className={a.id===article.id?"active":""} onClick={()=>setArticleId(a.id)}>{a.title}</button>)}</div></main>
  </div>
  <footer className="help-foot"><span>Cookie Help Center</span><nav><button onClick={()=>onLegal("terms")}>Terms of Service</button><button onClick={()=>onLegal("privacy")}>Privacy Policy</button></nav></footer>
 </div>;
}