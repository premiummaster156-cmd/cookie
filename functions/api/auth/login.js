function b64ToBytes(value){return Uint8Array.from(atob(value),c=>c.charCodeAt(0));}
async function checkPassword(password, saltB64, expectedB64){
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(password),"PBKDF2",false,["deriveBits"]);
  const bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt:b64ToBytes(saltB64),iterations:120000,hash:"SHA-256"},key,256);
  const actual=btoa(String.fromCharCode(...new Uint8Array(bits)));
  return actual===expectedB64;
}
const cookie=(v,maxAge)=>"cookie_session="+v+"; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age="+maxAge;
export async function onRequestPost({request,env}){
  if(!env.DB)return Response.json({error:"Authentication database is not configured yet."},{status:503});
  let body;try{body=await request.json()}catch{return Response.json({error:"Invalid request."},{status:400})}
  const email=String(body?.email||"").trim().toLowerCase(),password=String(body?.password||"");
  const user=await env.DB.prepare("SELECT id,name,email,password_hash,password_salt,email_verified FROM users WHERE email=?1").bind(email).first();
  if(!user || !(await checkPassword(password,user.password_salt,user.password_hash)))return Response.json({error:"Invalid email or password."},{status:401});
  if(!user.email_verified)return Response.json({error:"Please verify your email before signing in."},{status:403});
  const token=[...crypto.getRandomValues(new Uint8Array(32))].map(b=>b.toString(16).padStart(2,"0")).join("");
  await env.DB.prepare("INSERT INTO sessions (token,user_id,expires_at,created_at) VALUES (?1,?2,datetime('now','+30 days'),datetime('now'))").bind(token,user.id).run();
  return Response.json({ok:true,user:{id:user.id,name:user.name,email:user.email}},{headers:{'Set-Cookie':cookie(token,60*60*24*30)}});
}
