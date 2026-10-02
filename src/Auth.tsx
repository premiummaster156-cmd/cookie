import React, { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, Eye, EyeOff, KeyRound, Loader2, Mail, ShieldCheck, UserRound } from "lucide-react";

export type AuthUser = {
  id:string;
  email:string;
  emailVerified:boolean;
  name:string;
  username:string;
  avatarUrl:string;
  plan:string;
  credits:number;
};

type Mode = "login"|"signup"|"verify"|"forgot"|"reset";

function ProviderMark({provider}:{provider:"google"|"github"|"discord"}) {
  if(provider==="google") return <span className="auth-provider-mark google-mark">G</span>;
  if(provider==="github") return <span className="auth-provider-mark github-mark" aria-hidden="true">●</span>;
  return <span className="auth-provider-mark discord-mark">●</span>;
}

async function api(path:string, body:Record<string,unknown>) {
  const r=await fetch(path,{method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json"},credentials:"same-origin",body:JSON.stringify(body)});
  let data:any={};
  try{data=await r.json()}catch{}
  if(!r.ok) throw Object.assign(new Error(data?.error||"Something went wrong."),{status:r.status,data});
  return data;
}

export default function AuthPage({onAuthenticated,configError}:{onAuthenticated:(user:AuthUser)=>void;configError?:string}) {
  const query=useMemo(()=>new URLSearchParams(location.search),[]);
  const initialVerify=query.get("verify")||"";
  const initialReset=query.get("reset")||"";
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
      const map:any={
        database_not_configured:"Cookie accounts are not configured yet.",
        oauth_denied:"The sign-in window was cancelled.",
        oauth_state:"The sign-in request expired. Please try again.",
        oauth_failed:"The provider sign-in could not be completed.",
        google_not_configured:"Google sign-in is not configured yet.",
        github_not_configured:"GitHub sign-in is not configured yet.",
        discord_not_configured:"Discord sign-in is not configured yet."
      };
      setError(map[oauthError]||"Sign-in could not be completed.");
      history.replaceState(null,"",location.pathname);
    }
  },[onAuthenticated,query]);

  useEffect(()=>{
    if(!initialVerify)return;
    const run=async()=>{
      setBusy(true);
      try{
        const d=await api("/api/auth/verify",{token:initialVerify});
        if(d?.user){ setMessage("Email verified. You are signed in."); onAuthenticated(d.user); return; }
      }catch(e:any){setError(e?.message||"That verification link is invalid or expired.");}
      finally{setBusy(false);}
    };
    run();
  },[initialVerify,onAuthenticated]);

  function clearNotice(){setError("");setMessage("")}
  function switchMode(next:Mode){clearNotice();setPassword("");setCode("");setMode(next)}
  async function submit(e:React.FormEvent){
    e.preventDefault(); clearNotice(); setBusy(true);
    try{
      if(mode==="login"){
        const d=await api("/api/auth/login",{email,password,remember:true});
        if(d?.user) onAuthenticated(d.user);
      } else if(mode==="signup"){
        const d=await api("/api/auth/register",{email,password,name});
        setEmail(String(d?.email||email)); setMode("verify"); setMessage("Check your email for the 6-digit code or secure verification link.");
      } else if(mode==="verify"){
        const d=await api("/api/auth/verify",token?{token}:{email,code});
        if(d?.user) onAuthenticated(d.user);
      } else if(mode==="forgot"){
        await api("/api/auth/forgot",{email});
        setMessage("If that account exists, a password reset email has been sent.");
      } else {
        const d=await api("/api/auth/reset",{token,password});
        setMessage(d?.message||"Password reset. You can sign in now.");
        setMode("login"); setPassword(""); setToken("");
      }
    }catch(err:any){
      setError(err?.message||"Something went wrong.");
      if(err?.status===403&&err?.data?.codeRequired){setMode("verify");setMessage("Verify your email before signing in. Enter the code from your email.")}
    }finally{setBusy(false)}
  }

  async function resend(){
    if(!email||busy)return;
    clearNotice(); setBusy(true);
    try{const d=await api("/api/auth/resend",{email});setMessage(d?.message||"A new verification email is on its way.")}
    catch(e:any){setError(e?.message||"Could not resend verification email.")}
    finally{setBusy(false)}
  }

  const title=mode==="login"?"Sign in":mode==="signup"?"Create your account":mode==="verify"?"Verify your email":mode==="forgot"?"Reset your password":"Choose a new password";
  const subtitle=mode==="login"?"Use your Cookie account to continue.":mode==="signup"?"Your chats, projects and preferences stay with your account.":mode==="verify"?"Enter the 6-digit code from your email.":"We’ll send a secure link to your email address.";

  return <div className="auth-shell">
    <header className="auth-brand">
      <div className="auth-cookie" aria-hidden="true">C</div>
      <span>Cookie</span>
    </header>

    <main className="auth-layout">
      <aside className="auth-intro">
        <p className="auth-overline">PERSONAL AI WORKSPACE</p>
        <h1>Everything you<br/><span>work on, together.</span></h1>
        <p className="auth-intro-text">Keep conversations, projects and your Cookie account in one place.</p>
      </aside>

      <section className="auth-card">
        <div className="auth-card-head">
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>

        {(mode==="login"||mode==="signup")&&<>
          <div className="auth-providers">
            <button className="auth-provider" onClick={()=>location.href="/api/auth/google"}><ProviderMark provider="google"/><span>Google</span></button>
            <button className="auth-provider" onClick={()=>location.href="/api/auth/github"}><ProviderMark provider="github"/><span>GitHub</span></button>
            <button className="auth-provider" onClick={()=>location.href="/api/auth/discord"}><ProviderMark provider="discord"/><span>Discord</span></button>
          </div>
          <div className="auth-divider"><span>or use email</span></div>
        </>}

        {(mode==="login"||mode==="signup"||mode==="forgot"||mode==="reset")&&
        <form onSubmit={submit} className="auth-form">
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
        {configError&&<div className="auth-config-note">Account setup is incomplete. Connect D1 and the email/provider secrets in Cloudflare Pages.</div>}

        <div className="auth-bottom">
          {mode==="login"&&<><span>New to Cookie?</span><button onClick={()=>switchMode("signup")}>Create an account</button></>}
          {mode==="signup"&&<><span>Already have an account?</span><button onClick={()=>switchMode("login")}>Sign in</button></>}
          {mode==="verify"&&<><span>Wrong email?</span><button onClick={()=>switchMode("signup")}>Start again</button></>}
          {mode==="forgot"&&<><span>Remember your password?</span><button onClick={()=>switchMode("login")}>Sign in</button></>}
          {mode==="reset"&&<><span>Back to sign in?</span><button onClick={()=>switchMode("login")}>Sign in</button></>}
        </div>
        <p className="auth-legal">By continuing, you agree to Cookie’s Terms and Privacy Policy.</p>
      </section>
    </main>
  </div>;
}
