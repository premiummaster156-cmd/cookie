import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Check, Eye, EyeOff, KeyRound, Loader2, Mail, ShieldCheck, UserRound } from "lucide-react";

const ICON = "https://raw.githubusercontent.com/premiummaster156-cmd/cookie/main/cookie-ai-icon.png";

export type AuthUser = {
  id:string;
  email:string;
  emailVerified:boolean;
  name:string;
  username:string;
  avatarUrl:string;
  plan:string;
  planExpiresAt:number;
  role:string;
  credits:number;
};

type Mode = "login"|"signup"|"verify"|"forgot"|"reset";

function ProviderMark({provider}:{provider:"google"|"github"|"discord"}) {
  if(provider==="google") return <svg className="auth-provider-svg google-svg" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.35 12.27c0-.71-.06-1.4-.18-2.05H12v3.88h5.23a4.47 4.47 0 0 1-1.94 2.93v2.43h3.14c1.84-1.7 2.92-4.2 2.92-7.19Z"/><path fill="#34A853" d="M12 21.5c2.63 0 4.84-.87 6.45-2.34l-3.14-2.43c-.87.58-1.98.92-3.31.92-2.54 0-4.7-1.72-5.47-4.03H3.28v2.5A9.74 9.74 0 0 0 12 21.5Z"/><path fill="#FBBC05" d="M6.53 13.62A5.86 5.86 0 0 1 6.22 12c0-.56.1-1.1.31-1.62v-2.5H3.28A9.75 9.75 0 0 0 2.25 12c0 1.57.38 3.05 1.03 4.12l3.25-2.5Z"/><path fill="#EA4335" d="M12 6.35c1.43 0 2.72.49 3.73 1.46l2.8-2.8C16.84 3.43 14.63 2.5 12 2.5a9.74 9.74 0 0 0-8.72 5.38l3.25 2.5C7.3 8.07 9.46 6.35 12 6.35Z"/></svg>;
  if(provider==="github") return <svg className="auth-provider-svg" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 .75a11.25 11.25 0 0 0-3.56 21.92c.56.1.77-.24.77-.54v-2.1c-3.14.68-3.8-1.33-3.8-1.33-.51-1.3-1.25-1.65-1.25-1.65-1.02-.7.08-.68.08-.68 1.13.08 1.73 1.16 1.73 1.16 1 1.72 2.63 1.22 3.27.93.1-.73.39-1.22.71-1.5-2.5-.28-5.13-1.25-5.13-5.56 0-1.23.44-2.23 1.16-3.02-.12-.28-.5-1.43.11-2.98 0 0 .95-.3 3.11 1.15a10.78 10.78 0 0 1 5.66 0c2.16-1.46 3.11-1.15 3.11-1.15.61 1.55.23 2.7.11 2.98.72.79 1.16 1.79 1.16 3.02 0 4.32-2.63 5.27-5.14 5.55.4.35.76 1.04.76 2.1v3.12c0 .3.2.65.78.54A11.25 11.25 0 0 0 12 .75Z"/></svg>;
  return <svg className="auth-provider-svg" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M19.54 5.32A16.4 16.4 0 0 0 15.5 4l-.5 1.02a13.7 13.7 0 0 0-6 0L8.5 4a16.4 16.4 0 0 0-4.04 1.32C1.9 9.2 1.2 13 1.55 16.75a16.3 16.3 0 0 0 4.95 2.5l1.2-1.64c-.66-.24-1.29-.54-1.89-.9l.46-.35c3.66 1.7 7.83 1.7 11.46 0l.47.35c-.6.36-1.24.66-1.9.9l1.2 1.64a16.3 16.3 0 0 0 4.95-2.5c.4-4.35-.68-8.12-2.91-11.43ZM8.1 15.1c-1.08 0-1.97-1-1.97-2.22s.87-2.22 1.97-2.22 1.97 1 1.97 2.22-.89 2.22-1.97 2.22Zm7.8 0c-1.08 0-1.97-1-1.97-2.22s.87-2.22 1.97-2.22 1.97 1 1.97 2.22-.89 2.22-1.97 2.22Z"/></svg>;
}

async function api(path:string, body:Record<string,unknown>) {
  const r=await fetch(path,{method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json"},credentials:"same-origin",body:JSON.stringify(body)});
  let data:any={}; try{data=await r.json()}catch{}
  if(!r.ok) throw Object.assign(new Error(data?.error||"Something went wrong."),{status:r.status,data});
  return data;
}

function CookieLanding({onStart,onSignIn}:{onStart:()=>void;onSignIn:()=>void}) {
  const [active,setActive]=useState("Research");
  const [rotation,setRotation]=useState({x:-11,y:18});
  const dragRef=useRef({dragging:false,pointerId:0,startX:0,startY:0,startXRot:-11,startYRot:18});

  const orbitItems=[
    {name:"Chat",tag:"THINK",detail:"Fast, focused conversation"},
    {name:"Research",tag:"DISCOVER",detail:"Compare sources and build context"},
    {name:"Code",tag:"BUILD",detail:"Plan, write, review, ship"},
    {name:"Files",tag:"UNDERSTAND",detail:"Read documents and data"},
    {name:"Projects",tag:"CREATE",detail:"Keep work connected over time"}
  ];

  const activeItem=orbitItems.find(item=>item.name===active)||orbitItems[1];

  const startDrag=(e:React.PointerEvent<HTMLDivElement>)=>{
    dragRef.current={
      dragging:true,
      pointerId:e.pointerId,
      startX:e.clientX,
      startY:e.clientY,
      startXRot:rotation.x,
      startYRot:rotation.y
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const moveDrag=(e:React.PointerEvent<HTMLDivElement>)=>{
    const d=dragRef.current;
    if(!d.dragging||d.pointerId!==e.pointerId)return;
    const nextX=Math.max(-34,Math.min(22,d.startXRot-(e.clientY-d.startY)*0.18));
    const nextY=d.startYRot+(e.clientX-d.startX)*0.2;
    setRotation({x:nextX,y:nextY});
  };
  const endDrag=(e:React.PointerEvent<HTMLDivElement>)=>{
    if(dragRef.current.pointerId===e.pointerId){
      dragRef.current.dragging=false;
      try{e.currentTarget.releasePointerCapture(e.pointerId)}catch{}
    }
  };

  return <div className="cookie-landing">
    <header className="cookie-landing-nav">
      <button className="cookie-landing-brand" onClick={()=>window.scrollTo({top:0,behavior:"smooth"})} aria-label="Cookie home">
        <img src={ICON} alt="" draggable={false}/><span>Cookie</span>
      </button>
      <nav className="cookie-landing-navlinks" aria-label="Landing page">
        <a href="#capabilities">Capabilities</a>
        <a href="#space">Cookie Space</a>
        <a href="#principles">Why Cookie</a>
      </nav>
      <button className="cookie-landing-signin" onClick={onSignIn}>Sign in <ArrowRight size={14}/></button>
    </header>

    <main>
      <section className="cookie-landing-hero">
        <div className="cookie-landing-hero-copy">
          <div className="cookie-landing-kicker"><span className="cookie-kicker-line"/><span>COOKIE AI · A MODERN AI WORKSPACE</span></div>
          <h1>Intelligence<br/><em>that moves with you.</em></h1>
          <p>Think, research, code, create, and work with your files in one continuous space. Cookie stays close to the task instead of making you manage the tool.</p>
          <div className="cookie-landing-actions">
            <button className="cookie-landing-primary" onClick={onStart}>Start with Cookie <ArrowRight size={17}/></button>
            <a className="cookie-landing-text" href="#capabilities">Explore the workspace</a>
          </div>
          <div className="cookie-landing-proof">
            <span>FREE TO START</span><i/> <span>WEB + MOBILE + DESKTOP</span><i/> <span>BUILT FOR REAL WORK</span>
          </div>
        </div>

        <div className="cookie-landing-hero-visual">
          <div className="cookie-hero-grid" aria-hidden="true"/>
          <div className="cookie-hero-halo halo-one" aria-hidden="true"/>
          <div className="cookie-hero-halo halo-two" aria-hidden="true"/>
          <div
            className="cookie-orbit-scene"
            style={{transform:`perspective(1200px) rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`}}
            onPointerDown={startDrag}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            role="img"
            aria-label="Interactive Cookie AI workspace constellation. Drag to rotate."
          >
            <div className="cookie-orbit-plane plane-back" aria-hidden="true"/>
            <div className="cookie-orbit-plane plane-mid" aria-hidden="true"/>
            <div className="cookie-orbit-ring ring-a" aria-hidden="true"/>
            <div className="cookie-orbit-ring ring-b" aria-hidden="true"/>
            <div className="cookie-orbit-ring ring-c" aria-hidden="true"/>
            <div className="cookie-orbit-center">
              <div className="cookie-orbit-center-glow" aria-hidden="true"/>
              <div className="cookie-orbit-core"><img src={ICON} alt="" draggable={false}/></div>
              <strong>Cookie AI</strong>
              <span>ONE INTELLIGENT SPACE</span>
            </div>
            {orbitItems.map((item,i)=><button
              key={item.name}
              type="button"
              className={`cookie-orbit-node node-${i} ${active===item.name?"is-active":""}`}
              onClick={(e)=>{e.stopPropagation();setActive(item.name)}}
              aria-pressed={active===item.name}
              aria-label={item.name+" capability"}
            >
              <span className="cookie-orbit-node-dot" aria-hidden="true"/>
              <b>{item.name}</b>
              <small>{item.tag}</small>
            </button>)}
          </div>
          <div className="cookie-hero-visual-note"><span>DRAG</span><i/> <span>ROTATE</span><i/> <span>SELECT A CAPABILITY</span></div>
        </div>
      </section>

      <section className="cookie-landing-focus" aria-live="polite">
        <div className="cookie-focus-label">IN FOCUS · {activeItem.tag}</div>
        <div className="cookie-focus-name">{activeItem.name}</div>
        <p>{activeItem.detail}</p>
        <button type="button" onClick={onStart}>Try it in Cookie <ArrowRight size={15}/></button>
      </section>

      <section className="cookie-landing-capabilities" id="capabilities">
        <div className="cookie-section-intro">
          <span>01 / CAPABILITIES</span>
          <h2>Less tool switching.<br/><em>More momentum.</em></h2>
          <p>Cookie brings the pieces of real work closer together, so the workflow can stay in one place.</p>
        </div>
        <div className="cookie-capability-list">
          <button type="button" onClick={()=>{setActive("Chat");onStart()}} className="cookie-capability-row">
            <span className="cookie-capability-index">01</span><span><b>Chat</b><small>Ask, plan, explain, brainstorm.</small></span><ArrowRight size={17}/>
          </button>
          <button type="button" onClick={()=>{setActive("Research");onStart()}} className="cookie-capability-row">
            <span className="cookie-capability-index">02</span><span><b>Research</b><small>Search, compare evidence, synthesize findings.</small></span><ArrowRight size={17}/>
          </button>
          <button type="button" onClick={()=>{setActive("Code");onStart()}} className="cookie-capability-row">
            <span className="cookie-capability-index">03</span><span><b>Code</b><small>Build with a production-minded workflow.</small></span><ArrowRight size={17}/>
          </button>
          <button type="button" onClick={()=>{setActive("Files");onStart()}} className="cookie-capability-row">
            <span className="cookie-capability-index">04</span><span><b>Files</b><small>Bring documents, images, and data into context.</small></span><ArrowRight size={17}/>
          </button>
          <button type="button" onClick={()=>{setActive("Projects");onStart()}} className="cookie-capability-row">
            <span className="cookie-capability-index">05</span><span><b>Projects</b><small>Keep longer-running work connected.</small></span><ArrowRight size={17}/>
          </button>
        </div>
      </section>

      <section className="cookie-landing-space" id="space">
        <div className="cookie-space-copy">
          <span>02 / COOKIE SPACE</span>
          <h2>A workspace<br/><em>with depth.</em></h2>
          <p>Cookie Space gives your work room to spread out. Move through connected areas instead of forcing every task into a single flat view.</p>
          <button className="cookie-landing-text" type="button" onClick={onStart}>Enter Cookie Space <ArrowRight size={15}/></button>
        </div>
        <div className="cookie-space-stage" aria-label="Cookie Space concept preview">
          <div className="cookie-space-backdrop" aria-hidden="true"/>
          <div className="cookie-space-axis axis-x" aria-hidden="true"/>
          <div className="cookie-space-axis axis-y" aria-hidden="true"/>
          <div className="cookie-space-word word-chat" onClick={()=>setActive("Chat")}>CHAT</div>
          <div className="cookie-space-word word-research" onClick={()=>setActive("Research")}>RESEARCH</div>
          <div className="cookie-space-word word-code" onClick={()=>setActive("Code")}>CODE</div>
          <div className="cookie-space-word word-files" onClick={()=>setActive("Files")}>FILES</div>
          <div className="cookie-space-word word-projects" onClick={()=>setActive("Projects")}>PROJECTS</div>
          <div className="cookie-space-core"><img src={ICON} alt="" draggable={false}/><span>COOKIE</span></div>
        </div>
      </section>

      <section className="cookie-landing-principles" id="principles">
        <div className="cookie-principle">
          <span>03 / CALM BY DEFAULT</span>
          <h3>Quiet when you are thinking.<br/><em>Powerful when you are working.</em></h3>
        </div>
        <div className="cookie-principle">
          <span>04 / DESIGNED FOR DEPTH</span>
          <h3>Beautiful surfaces matter.<br/><em>But the work stays in front.</em></h3>
        </div>
        <div className="cookie-principle">
          <span>05 / EVERY SCREEN</span>
          <h3>Responsive from a phone<br/><em>to a wide desktop.</em></h3>
        </div>
      </section>

      <section className="cookie-landing-bottom">
        <img src={ICON} alt="" draggable={false}/>
        <h2>Start with the work.</h2>
        <p>Cookie is ready when you are.</p>
        <button onClick={onStart}>Get started <ArrowRight size={16}/></button>
      </section>
    </main>

    <footer className="cookie-landing-footer">
      <span>© {new Date().getFullYear()} Cookie AI</span>
      <span>Think · Research · Build · Create</span>
    </footer>
  </div>;
}

export default function AuthPage({onAuthenticated,configError}:{onAuthenticated:(user:AuthUser)=>void;configError?:string}) {
  const query=useMemo(()=>new URLSearchParams(location.search),[]);
  const initialVerify=query.get("verify")||"";
  const initialReset=query.get("reset")||"";
  const [showAuth,setShowAuth]=useState(Boolean(initialVerify||initialReset));
  const [mode,setMode]=useState<Mode>(initialVerify?"verify":initialReset?"reset":"login");
  const [email,setEmail]=useState("");
  const [name,setName]=useState("");
  const [password,setPassword]=useState("");
  const [code,setCode]=useState("");
  const [token,setToken]=useState(initialVerify||initialReset);
  const [showPassword,setShowPassword]=useState(false);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [error,setError]=useState(configError||"");

  useEffect(()=>{
    const oauthError=query.get("auth_error");
    if(query.get("auth")==="success"){
      fetch("/api/auth/me",{credentials:"same-origin"}).then(r=>r.json()).then(d=>{
        if(d?.authenticated&&d.user) onAuthenticated(d.user);
        else setError("OAuth completed, but Cookie could not load the account session.");
      }).catch(()=>setError("OAuth completed, but the account session could not be loaded."));
    } else if(oauthError){
      const map:any={database_not_configured:"Cookie accounts are not configured yet.",oauth_denied:"The sign-in window was cancelled.",oauth_state:"The sign-in request expired. Please try again.",oauth_failed:"The provider sign-in could not be completed.",google_not_configured:"Google sign-in is not configured yet.",github_not_configured:"GitHub sign-in is not configured yet.",discord_not_configured:"Discord sign-in is not configured yet."};
      setError(map[oauthError]||"Sign-in could not be completed."); history.replaceState(null,"",location.pathname);
    }
  },[onAuthenticated,query]);

  useEffect(()=>{
    if(!initialVerify)return;
    const run=async()=>{setBusy(true);try{const d=await api("/api/auth/verify",{token:initialVerify});if(d?.user){setMessage("Email verified. You are signed in.");onAuthenticated(d.user);return}}catch(e:any){setError(e?.message||"That verification link is invalid or expired.")}finally{setBusy(false)}};
    run();
  },[initialVerify,onAuthenticated]);

  function clearNotice(){setError("");setMessage("")}
  function switchMode(next:Mode){clearNotice();setPassword("");setCode("");setMode(next)}
  async function submit(e:React.FormEvent){
    e.preventDefault();clearNotice();setBusy(true);
    try{
      if(mode==="login"){const d=await api("/api/auth/login",{email,password,remember:true});if(d?.user)onAuthenticated(d.user)}
      else if(mode==="signup"){const d=await api("/api/auth/register",{email,password,name});setEmail(String(d?.email||email));setMode("verify");setMessage("Check your email for the 6-digit code or secure verification link.")}
      else if(mode==="verify"){const d=await api("/api/auth/verify",token?{token}:{email,code});if(d?.user)onAuthenticated(d.user)}
      else if(mode==="forgot"){await api("/api/auth/forgot",{email});setMessage("If that account exists, a password reset email has been sent.")}
      else {const d=await api("/api/auth/reset",{token,password});setMessage(d?.message||"Password reset. You can sign in now.");setMode("login");setPassword("");setToken("")}
    }catch(err:any){setError(err?.message||"Something went wrong.");if(err?.status===403&&err?.data?.codeRequired){setMode("verify");setMessage("Verify your email before signing in. Enter the code from your email.")}}
    finally{setBusy(false)}
  }
  async function resend(){if(!email||busy)return;clearNotice();setBusy(true);try{const d=await api("/api/auth/resend",{email});setMessage(d?.message||"A new verification email is on its way.")}catch(e:any){setError(e?.message||"Could not resend verification email.")}finally{setBusy(false)}}

  if(!showAuth) return <CookieLanding onStart={()=>{setShowAuth(true);setMode("signup")}} onSignIn={()=>{setShowAuth(true);setMode("login")}}/>;

  const title=mode==="login"?"Sign in":mode==="signup"?"Create your account":mode==="verify"?"Verify your email":mode==="forgot"?"Reset your password":"Choose a new password";
  const subtitle=mode==="login"?"Sign in to your Cookie account.":mode==="signup"?"Create an account to keep your chats and projects synced.":mode==="verify"?"Enter the 6-digit code from your email.":"We’ll send a secure link to your email address.";

  return <div className="auth-shell">
    <header className="auth-brand"><button className="auth-brand-home" onClick={()=>setShowAuth(false)} aria-label="Back to Cookie home"><img src={ICON} className="auth-brand-icon" alt="" draggable={false}/><span>Cookie</span></button></header>
    <main className="auth-layout">
      <section className="auth-card">
        <img className="auth-card-icon" src={ICON} alt="" draggable={false}/>
        <div className="auth-card-head"><h2>{title}</h2><p>{subtitle}</p></div>

        {(mode==="login"||mode==="signup")&&<div className="auth-providers" aria-label="Social sign in options">
          <a className="auth-provider" href="/api/auth/google"><ProviderMark provider="google"/><span>Google</span></a>
          <a className="auth-provider" href="/api/auth/github"><ProviderMark provider="github"/><span>GitHub</span></a>
          <a className="auth-provider" href="/api/auth/discord"><ProviderMark provider="discord"/><span>Discord</span></a>
        </div>}

        {(mode==="login"||mode==="signup")&&<>
          <div className="auth-divider"><span>Email verification</span></div>
        </>}

        {(mode==="login"||mode==="signup"||mode==="forgot"||mode==="reset")&&<form onSubmit={submit} className="auth-form">
          {mode==="signup"&&<label><span>Name</span><div className="auth-input"><UserRound size={16}/><input value={name} onChange={e=>setName(e.target.value)} placeholder="Your name" autoComplete="name" required/></div></label>}
          <label><span>Email</span><div className="auth-input"><Mail size={16}/><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required/></div></label>
          {mode!=="forgot"&&<label><span>{mode==="reset"?"New password":"Password"}</span><div className="auth-input"><KeyRound size={16}/><input type={showPassword?"text":"password"} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Your password" autoComplete={mode==="login"?"current-password":"new-password"} minLength={8} required/><button type="button" className="auth-eye" aria-label={showPassword?"Hide password":"Show password"} onClick={()=>setShowPassword(v=>!v)}>{showPassword?<EyeOff size={16}/>:<Eye size={16}/>}</button></div></label>}
          {mode==="login"&&<div className="auth-row-links"><button type="button" onClick={()=>switchMode("forgot")}>Forgot password?</button></div>}
          <button className="auth-submit" disabled={busy}>{busy?<Loader2 className="spin" size={17}/>:<ArrowRight size={17}/>}<span>{mode==="signup"?"Create account":mode==="reset"?"Reset password":mode==="forgot"?"Email reset link":"Sign in"}</span></button>
        </form>}

        {mode==="verify"&&<form onSubmit={submit} className="auth-form">
          <label><span>Email</span><div className="auth-input"><Mail size={16}/><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required/></div></label>
          <label><span>Verification code</span><input className="auth-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={e=>{setToken("");setCode(e.target.value.replace(/\D/g,"").slice(0,6))}} placeholder="000000" required={!token}/></label>
          <button className="auth-submit" disabled={busy}>{busy?<Loader2 className="spin" size={17}/>:<ShieldCheck size={17}/>}<span>Verify email</span></button>
          <button type="button" className="auth-secondary" onClick={resend} disabled={busy}><Mail size={15}/> Resend code</button>
        </form>}

        {(error||message)&&<div className={"auth-notice "+(error?"error":"success")} role="status">{error||message}</div>}
        {configError&&<div className="auth-config-note">Account setup is incomplete. Check the account database and email configuration.</div>}
        <div className="auth-bottom">
          {mode==="login"&&<><span>New to Cookie?</span><button type="button" onClick={()=>switchMode("signup")}>Create an account</button></>}
          {mode==="signup"&&<><span>Already have an account?</span><button type="button" onClick={()=>switchMode("login")}>Sign in</button></>}
          {mode==="verify"&&<><span>Wrong email?</span><button type="button" onClick={()=>switchMode("signup")}>Start again</button></>}
          {mode==="forgot"&&<><span>Remember your password?</span><button type="button" onClick={()=>switchMode("login")}>Sign in</button></>}
          {mode==="reset"&&<><span>Back to sign in?</span><button type="button" onClick={()=>switchMode("login")}>Sign in</button></>}
        </div>
        <p className="auth-legal">By continuing, you agree to Cookie’s Terms and Privacy Policy.</p>
      </section>
    </main>
  </div>;
}
