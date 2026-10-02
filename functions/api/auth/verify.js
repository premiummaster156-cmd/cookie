import { json, readJson } from "../_lib.js";
import { createSession, dbAvailable, normalizeEmail, publicUser, sha256, timingSafeEqual, withCookies } from "./_auth.js";

export async function onRequestPost({ request, env }) {
  if (!dbAvailable(env)) return json({ error: "Cookie auth database is not connected." }, 503);
  const body = await readJson(request);
  const token = String(body?.token || "").trim();
  const email = normalizeEmail(body?.email);
  const code = String(body?.code || "").trim();
  const now = Math.floor(Date.now() / 1000);
  let row = null;

  if (token) {
    row = await env.DB.prepare("SELECT * FROM email_tokens WHERE token_hash=? AND purpose='signup' AND used_at IS NULL AND expires_at>? LIMIT 1")
      .bind(await sha256(token), now).first();
  } else if (email && /^\d{6}$/.test(code)) {
    row = await env.DB.prepare("SELECT * FROM email_tokens WHERE email=? AND purpose='signup' AND used_at IS NULL AND expires_at>? ORDER BY created_at DESC LIMIT 1")
      .bind(email, now).first();
    if (row && Number(row.attempts || 0) >= 5) row = null;
  }

  if (!row) return json({ error: "That verification code or link is invalid or expired." }, 400);

  if (!token) {
    const ok = timingSafeEqual(await sha256(code), row.code_hash || "");
    if (!ok) {
      await env.DB.prepare("UPDATE email_tokens SET attempts=attempts+1 WHERE id=?").bind(row.id).run();
      return json({ error: "That verification code is incorrect." }, 400);
    }
  }

  await env.DB.prepare("UPDATE email_tokens SET used_at=? WHERE id=?").bind(now, row.id).run();
  await env.DB.prepare("UPDATE users SET email_verified=1,updated_at=? WHERE id=?").bind(now, row.user_id).run();
  const user = await env.DB.prepare("SELECT * FROM users WHERE id=?").bind(row.user_id).first();
  const response = json({ ok:true, user:publicUser(user) });
  return withCookies(response, [await createSession(env, user.id, true)]);
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") || "";
  if (!token) return json({ error:"A verification token is required." }, 400);
  const fake = new Request(request.url, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({token}) });
  return onRequestPost({ request:fake, env });
}
