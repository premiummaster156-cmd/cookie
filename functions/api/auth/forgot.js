function token(){return [...crypto.getRandomValues(new Uint8Array(32))].map(b=>b.toString(16).padStart(2,"0")).join("")}
async function sendEmail(env,to,subject,html){
  if(!env.RESEND_API_KEY)throw new Error("missing email key");
  const r=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"Authorization":"Bearer "+env.RESEND_API_KEY,"Content-Type":"application/json"},body:JSON.stringify({from:env.AUTH_FROM_EMAIL||"Cookie <onboarding@resend.dev>",to:[to],subject,html})});
  if(!r.ok)throw new Error("email failed");
}
export async function onRequestPost({request,env}){
  if(!env.DB)return Response.json({error:"Authentication database is not configured yet."},{status:503});
  let body;try{body=await request.json()}catch{return Response.json({error:"Invalid request."},{status:400})}
  const email=String(body?.email||"").trim().toLowerCase();
  const user=await env.DB.prepare("SELECT id,name FROM users WHERE email=?1").bind(email).first();
  if(user){
    const t=token();
    await env.DB.prepare("INSERT INTO email_tokens (token,user_id,type,expires_at,created_at) VALUES (?1,?2,'reset',datetime('now','+30 minutes'),datetime('now'))").bind(t,user.id).run();
    const url=new URL(request.url).origin+"/auth.html?reset="+t;
    try{await sendEmail(env,email,"Reset your Cookie password",`<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto"><h2>Reset your Cookie password</h2><p>Hi ${String(user.name).replace(/[&<>]/g,"")},</p><p><a href="${url}" style="display:inline-block;padding:12px 18px;background:#fff9f2;color:#171412;text-decoration:none;border-radius:8px">Reset password</a></p><p>This link expires in 30 minutes.</p></div>`)}catch{}
  }
  return Response.json({ok:true,message:"If an account exists for that email, reset instructions have been sent."});
}
