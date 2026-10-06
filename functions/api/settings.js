import { json, readJson } from "./_lib.js";
import { dbAvailable, getSessionUser, sha256, verifyPassword, passwordHash, createSession, parseCookies, withCookies, clearCookie } from "./auth/_auth.js";

const DEFAULTS={
  theme:"Dark",language:"English",accent:"Default",fontSize:"Default",defaultModel:"standard",reasoning:"auto",answerLength:"auto",
  animations:true,compact:false,keyboard:true,sendOnEnter:true,timestamps:false,confirmDelete:true,personality:"Balanced",
  memory:true,instructions:"",history:true,improve:false,notifications:true,updates:false,voice:"Arbor",captions:true
};

function cleanSettings(value){
  const input=value&&typeof value==="object"?value:{};
  const out={...DEFAULTS};
  for(const [key,defaultValue] of Object.entries(DEFAULTS)){
    if(input[key]===undefined)continue;
    if(typeof defaultValue==="boolean")out[key]=Boolean(input[key]);
    else out[key]=String(input[key]).slice(0,2000);
  }
  return out;
}

async function current(request,env){
  if(!dbAvailable(env))return null;
  return getSessionUser(request,env);
}

export async function onRequestGet({request,env}){
  const user=await current(request,env);
  if(!user)return json({error:"Authentication required."},401);
  const row=await env.DB.prepare("SELECT settings_json,updated_at FROM user_settings WHERE user_id=? LIMIT 1").bind(user.id).first();
  let stored={};
  try{stored=row?.settings_json?JSON.parse(row.settings_json):{}}catch{}
  return json({ok:true,settings:cleanSettings(stored),updatedAt:Number(row?.updated_at||0)});
}

export async function onRequestPatch({request,env}){
  const user=await current(request,env);
  if(!user)return json({error:"Authentication required."},401);
  const body=await readJson(request);
  const next=cleanSettings(body?.settings);
  const now=Math.floor(Date.now()/1000);
  await env.DB.prepare(
    "INSERT INTO user_settings (user_id,settings_json,updated_at) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET settings_json=excluded.settings_json,updated_at=excluded.updated_at"
  ).bind(user.id,JSON.stringify(next),now).run();
  return json({ok:true,settings:next,updatedAt:now});
}

export async function onRequestPost({request,env}){
  const user=await current(request,env);
  if(!user)return json({error:"Authentication required."},401);
  const body=await readJson(request);
  const action=String(body?.action||"").trim();

  if(action==="delete_chats"){
    await env.DB.prepare("DELETE FROM chats WHERE user_id=?").bind(user.id).run();
    await env.DB.prepare("DELETE FROM chat_messages WHERE user_id=?").bind(user.id).run().catch(()=>{});
    await env.DB.prepare("DELETE FROM shared_chats WHERE user_id=?").bind(user.id).run().catch(()=>{});
    await env.DB.prepare("DELETE FROM saved_items WHERE user_id=?").bind(user.id).run().catch(()=>{});
    return json({ok:true});
  }

  if(action==="sign_out_other_devices"){
    const cookies=parseCookies(request);
    const token=cookies["__Host-cookie_session"]||cookies["cookie_session"];
    if(!token)return json({error:"Current session not found."},401);
    const hash=await sha256(token);
    await env.DB.prepare("DELETE FROM sessions WHERE user_id=? AND token_hash<>?").bind(user.id,hash).run();
    return json({ok:true});
  }

  if(action==="change_password"){
    const currentPassword=String(body?.currentPassword||"");
    const newPassword=String(body?.newPassword||"");
    if(newPassword.length<10)return json({error:"New password must be at least 10 characters."},400);
    if(currentPassword===newPassword)return json({error:"Choose a different password."},400);
    const row=await env.DB.prepare("SELECT password_hash,password_salt FROM users WHERE id=? LIMIT 1").bind(user.id).first();
    if(!row?.password_hash||!row?.password_salt)return json({error:"This account does not use a Cookie password. Use its sign-in provider or account recovery flow."},400);
    if(!(await verifyPassword(currentPassword,row.password_hash,row.password_salt)))return json({error:"Current password is incorrect."},403);
    const next=await passwordHash(newPassword);
    await env.DB.prepare("UPDATE users SET password_hash=?,password_salt=?,login_failures=0,locked_until=0,updated_at=? WHERE id=?").bind(next.hash,next.salt,Math.floor(Date.now()/1000),user.id).run();
    await env.DB.prepare("DELETE FROM sessions WHERE user_id=?").bind(user.id).run();
    const response=json({ok:true});
    return withCookies(response,[await createSession(env,user.id,true)]);
  }

  return json({error:"Unknown settings action."},400);
}
