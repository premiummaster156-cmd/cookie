import { json, readJson } from "../_lib.js";
import { dbAvailable, normalizeEmail } from "./_auth.js";
import { issueEmailToken } from "./_tokens.js";
import { sendVerificationEmail } from "./_email.js";

export async function onRequestPost({ request, env }) {
  if (!dbAvailable(env)) return json({ error:"Cookie auth database is not connected." }, 503);
  const body=await readJson(request);
  const email=normalizeEmail(body?.email);
  if (!email) return json({error:"Enter your email address."},400);
  const user=await env.DB.prepare("SELECT * FROM users WHERE email=? LIMIT 1").bind(email).first();
  if (!user || user.email_verified) return json({ok:true,message:"If that account needs verification, a new email has been sent."});
  const issued=await issueEmailToken(env,{userId:user.id,email,purpose:"signup"});
  if(!issued.ok) return json({error:"Please wait "+issued.retryAfter+" seconds before requesting another code.",retryAfter:issued.retryAfter},429);
  try{
    await sendVerificationEmail(request,env,{email,name:user.name,code:issued.code,token:issued.token,purpose:"signup"});
    return json({ok:true,message:"A new verification email is on its way."});
  }catch(error){
    console.error("[Cookie resend verification]",error);
    return json({error:"The verification email could not be sent. Check SMTP settings."},502);
  }
}
