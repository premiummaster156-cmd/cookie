function b64(v){return Uint8Array.from(atob(v),c=>c.charCodeAt(0))}
async function hash(password,salt){const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(password),"PBKDF2",false,["deriveBits"]);const bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt,iterations:120000,hash:"SHA-256"},key,256);return btoa(String.fromCharCode(...new Uint8Array(bits)))}
export async function onRequestPost({request,env}){
  if(!env.DB)return Response.json({error:"Authentication database is not configured yet."},{status:503});
  let body;try{body=await request.json()}catch{return Response.json({error:"Invalid request."},{status:400})}
  const token=String(body?.token||""),password=String(body?.password||"");
  if(password.length<8)return Response.json({error:"Password must be at least 8 characters."},{status:400});
  const row=await env.DB.prepare("SELECT user_id FROM email_tokens WHERE token=?1 AND type='reset' AND expires_at>datetime('now')").bind(token).first();
  if(!row)return Response.json({error:"This reset link is invalid or expired."},{status:400});
  const salt=crypto.getRandomValues(new Uint8Array(16));const hashValue=await hash(password,salt);const saltValue=btoa(String.fromCharCode(...salt));
  await env.DB.prepare("UPDATE users SET password_hash=?1,password_salt=?2 WHERE id=?3").bind(hashValue,saltValue,row.user_id).run();
  await env.DB.prepare("DELETE FROM email_tokens WHERE token=?1").bind(token).run();
  await env.DB.prepare("DELETE FROM sessions WHERE user_id=?1").bind(row.user_id).run();
  return Response.json({ok:true,message:"Password updated. You can sign in now."});
}
