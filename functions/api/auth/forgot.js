import { json, readJson } from "../_lib.js";
import { dbAvailable, normalizeEmail } from "./_auth.js";
import { issueEmailToken } from "./_tokens.js";
import { sendVerificationEmail } from "./_email.js";

export async function onRequestPost({ request, env }) {
  if (!dbAvailable(env)) return json({ error:"Cookie auth database is not connected." },503);
  const body=await readJson(request);
  const email=normalizeEmail(body?.email);
  const generic={ok:true,message:"If an account exists for that email, a password reset email will be sent."};
  if(!email) return json(generic);
  const user=await env.DB.prepare("SELECT * FROM users WHERE email=? LIMIT 1").bind(email).first();
  if(!user) return json(generic);
  const issued=await issueEmailToken(env,{userId:user.id,email,purpose:"reset"});
  if(!issued.ok) return json(generic);
  try{
    await sendVerificationEmail(request,env,{email,name:user.name,code:issued.code,token:issued.token,purpose:"reset"});
  }catch(error){
    console.error("[Cookie forgot password]",error);
  }
  return json(generic);
}
