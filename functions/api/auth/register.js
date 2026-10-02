import { json, readJson } from "../_lib.js";
import { createSession, dbAvailable, normalizeEmail, passwordHash, publicUser, uniqueUsername, withCookies, randomToken } from "./_auth.js";
import { issueEmailToken } from "./_tokens.js";
import { sendVerificationEmail } from "./_email.js";

export async function onRequestPost({ request, env }) {
  if (!dbAvailable(env)) return json({ error: "Cookie auth database is not connected. Bind a D1 database as DB in Pages." }, 503);
  const body = await readJson(request);
  const email = normalizeEmail(body?.email);
  const password = String(body?.password || "");
  const name = String(body?.name || "").trim().slice(0, 80);

  if (!/^\S+@\S+\.\S+$/.test(email)) return json({ error: "Enter a valid email address." }, 400);
  if (password.length < 8) return json({ error: "Use a password with at least 8 characters." }, 400);

  const now = Math.floor(Date.now() / 1000);
  let user = await env.DB.prepare("SELECT * FROM users WHERE email=? LIMIT 1").bind(email).first();

  try {
    if (user) {
      if (user.email_verified) return json({ error: "An account already exists for this email." }, 409);
      const hashed = await passwordHash(password);
      await env.DB.prepare("UPDATE users SET name=?,password_hash=?,password_salt=?,updated_at=? WHERE id=?")
        .bind(name || user.name, hashed.hash, hashed.salt, now, user.id).run();
      user = await env.DB.prepare("SELECT * FROM users WHERE id=?").bind(user.id).first();
    } else {
      const username = await uniqueUsername(env, name || email);
      const hashed = await passwordHash(password);
      const id = randomToken(18);
      await env.DB.prepare(
        "INSERT INTO users (id,email,email_verified,name,username,avatar_url,password_hash,password_salt,plan,credits_remaining,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)"
      ).bind(id, email, 0, name, username, "", hashed.hash, hashed.salt, "free", 100, now, now).run();
      user = await env.DB.prepare("SELECT * FROM users WHERE id=?").bind(id).first();
    }

    const issued = await issueEmailToken(env, { userId:user.id, email, purpose:"signup" });
    if (!issued.ok) return json({ error: "Please wait " + issued.retryAfter + " seconds before requesting another code.", retryAfter: issued.retryAfter }, 429);
    await sendVerificationEmail(request, env, {
      email,
      name: user.name,
      code: issued.code,
      token: issued.token,
      purpose: "signup"
    });
    const response = json({ ok:true, needsVerification:true, email });
    return response;
  } catch (error) {
    console.error("[Cookie register]", error);
    return json({ error: "We could not create your account right now. Check your email configuration and try again." }, 502);
  }
}
