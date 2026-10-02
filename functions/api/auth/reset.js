import { json, readJson } from "../_lib.js";
import { dbAvailable, passwordHash, sha256 } from "./_auth.js";

export async function onRequestPost({ request, env }) {
  if (!dbAvailable(env)) return json({error:"Cookie auth database is not connected."},503);
  const body=await readJson(request);
  const token=String(body?.token||"").trim();
  const password=String(body?.password||"");
  if(!token) return json({error:"Reset link is missing."},400);
  if(password.length<8) return json({error:"Use a password with at least 8 characters."},400);
  const now=Math.floor(Date.now()/1000);
  const row=await env.DB.prepare("SELECT * FROM email_tokens WHERE token_hash=? AND purpose='reset' AND used_at IS NULL AND expires_at>? LIMIT 1")
    .bind(await sha256(token),now).first();
  if(!row) return json({error:"That reset link is invalid or expired."},400);
  const hashed=await passwordHash(password);
  await env.DB.prepare("UPDATE users SET password_hash=?,password_salt=?,login_failures=0,locked_until=0,updated_at=? WHERE id=?")
    .bind(hashed.hash,hashed.salt,now,row.user_id).run();
  await env.DB.prepare("UPDATE email_tokens SET used_at=? WHERE id=?").bind(now,row.id).run();
  await env.DB.prepare("DELETE FROM sessions WHERE user_id=?").bind(row.user_id).run();
  return json({ok:true,message:"Your password has been reset. You can sign in now."});
}
