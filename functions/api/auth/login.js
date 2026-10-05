import { json, readJson } from "../_lib.js";
import { createSession, dbAvailable, ensureD1AuthSchema, normalizeEmail, publicUser, verifyPassword, withCookies } from "./_auth.js";

export async function onRequestPost({ request, env }) {
  if (!dbAvailable(env)) return json({ error: "Cookie account database is not connected." }, 503);
  await ensureD1AuthSchema(env);
  const body = await readJson(request);
  const email = normalizeEmail(body?.email);
  const password = String(body?.password || "");
  const remember = body?.remember !== false;
  const user = await env.DB.prepare("SELECT * FROM users WHERE email=? LIMIT 1").bind(email).first();
  const now = Math.floor(Date.now() / 1000);

  if (!user) return json({ error: "Invalid email or password." }, 401);

  const accountStatus=String(user.account_status||"active").toLowerCase();
  const suspendedUntil=Number(user.suspended_until||0);
  if(accountStatus==="banned")return json({error:"This account has been banned."},403);
  if(accountStatus==="suspended"&&suspendedUntil>now)return json({error:"This account is temporarily suspended."},403);

  if (Number(user.locked_until || 0) > now) {
    return json({ error: "Too many unsuccessful attempts. Please try again later." }, 429);
  }

  const valid = user.password_hash && user.password_salt
    ? await verifyPassword(password, user.password_hash, user.password_salt)
    : false;

  if (!valid) {
    const failures = Number(user.login_failures || 0) + 1;
    const lockedUntil = failures >= 5 ? now + 15 * 60 : 0;
    await env.DB.prepare("UPDATE users SET login_failures=?,locked_until=?,updated_at=? WHERE id=?")
      .bind(Math.min(failures, 5), lockedUntil, now, user.id).run();
    return json({ error: "Invalid email or password." }, 401);
  }

  if (!user.email_verified) {
    return json({ error: "Verify your email before signing in.", codeRequired:true, email }, 403);
  }

  await env.DB.prepare("UPDATE users SET login_failures=0,locked_until=0,updated_at=? WHERE id=?")
    .bind(now, user.id).run();
  const response = json({ ok:true, user:publicUser(user) });
  return withCookies(response, [await createSession(env, user.id, remember)]);
}
