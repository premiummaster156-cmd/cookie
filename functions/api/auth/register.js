import { json, readJson } from "../_lib.js";
import { dbAvailable, normalizeEmail, passwordHash, uniqueUsername, randomToken } from "./_auth.js";
import { issueEmailToken } from "./_tokens.js";
import { sendVerificationEmail } from "./_email.js";

export async function onRequestPost({ request, env }) {
  console.log("[Cookie register] entered");
  if (!dbAvailable(env)) {
    console.error("[Cookie register] DB binding unavailable");
    return json({ error: "Cookie auth database is not connected. Bind a D1 database as DB in Pages." }, 503);
  }

  const body = await readJson(request);
  const email = normalizeEmail(body?.email);
  const password = String(body?.password || "");
  const name = String(body?.name || "").trim().slice(0, 80);

  if (!/^\S+@\S+\.\S+$/.test(email)) return json({ error: "Enter a valid email address." }, 400);
  if (password.length < 8) return json({ error: "Use a password with at least 8 characters." }, 400);

  const now = Math.floor(Date.now() / 1000);

  try {
    // Keep production D1 auth resilient when an older users table exists.
    // Add only columns that are actually missing, then continue normally.
    const info = await env.DB.prepare("PRAGMA table_info(users)").all();
    const existing = new Set((info.results || []).map(column => String(column.name)));
    const missing = [
      ["email", "TEXT DEFAULT ''"],
      ["email_verified", "INTEGER NOT NULL DEFAULT 0"],
      ["name", "TEXT NOT NULL DEFAULT ''"],
      ["username", "TEXT NOT NULL DEFAULT ''"],
      ["avatar_url", "TEXT NOT NULL DEFAULT ''"],
      ["password_hash", "TEXT"],
      ["password_salt", "TEXT"],
      ["plan", "TEXT NOT NULL DEFAULT 'free'"],
      ["credits_remaining", "INTEGER NOT NULL DEFAULT 100"],
      ["login_failures", "INTEGER NOT NULL DEFAULT 0"],
      ["locked_until", "INTEGER NOT NULL DEFAULT 0"],
      ["created_at", "INTEGER NOT NULL DEFAULT 0"],
      ["updated_at", "INTEGER NOT NULL DEFAULT 0"]
    ];
    for (const [name, definition] of missing) {
      if (!existing.has(name)) {
        await env.DB.prepare("ALTER TABLE users ADD COLUMN " + name + " " + definition).run();
      }
    }
    await env.DB.prepare("UPDATE users SET username='user-' || substr(id,1,12) WHERE username='' OR username IS NULL").run();
    await env.DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username)").run();


    let user = await env.DB.prepare("SELECT * FROM users WHERE email=? LIMIT 1").bind(email).first();
    console.log("[Cookie register] database ready");

    if (user) {
      if (user.email_verified) return json({ error: "An account already exists for this email." }, 409);

      const hashed = await passwordHash(password);
      await env.DB.prepare(
        "UPDATE users SET name=?,password_hash=?,password_salt=?,updated_at=? WHERE id=?"
      ).bind(name || user.name, hashed.hash, hashed.salt, now, user.id).run();

      user = await env.DB.prepare("SELECT * FROM users WHERE id=?").bind(user.id).first();
    } else {
      const username = await uniqueUsername(env, name || email);
      const hashed = await passwordHash(password);
      const id = randomToken(18);

      await env.DB.prepare(
        "INSERT INTO users (id,email,email_verified,name,username,avatar_url,password_hash,password_salt,plan,credits_remaining,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)"
      ).bind(
        id, email, 0, name, username, "", hashed.hash, hashed.salt, "free", 100, now, now
      ).run();

      user = await env.DB.prepare("SELECT * FROM users WHERE id=?").bind(id).first();
    }

    const issued = await issueEmailToken(env, { userId: user.id, email, purpose: "signup" });
    if (!issued.ok) {
      return json({
        error: "Please wait " + issued.retryAfter + " seconds before requesting another code.",
        retryAfter: issued.retryAfter
      }, 429);
    }

    console.log("[Cookie register] sending verification email");
    await sendVerificationEmail(request, env, {
      email,
      name: user.name,
      code: issued.code,
      token: issued.token,
      purpose: "signup"
    });

    console.log("[Cookie register] verification email sent");
    return json({ ok: true, needsVerification: true, email });
  } catch (error) {
    console.error("[Cookie register] failure", {
      name: error?.name,
      code: error?.code,
      responseCode: error?.responseCode,
      message: error?.message
    });

    const message = String(error?.message || "");
    const code = String(error?.code || "");
    const responseCode = Number(error?.responseCode || 0);

    if (message.includes("no such column") || message.includes("SQLITE_ERROR") || code === "D1_ERROR") {
      return json({
        error: "Cookie database schema is out of date. Apply the latest D1 migrations, then try again."
      }, 503);
    }

    if (code === "EAUTH" || responseCode === 535) {
      return json({ error: "SMTP authentication failed. Check the SMTP password/app password." }, 502);
    }

    if (code === "ENOTFOUND" || code === "EAI_AGAIN") {
      return json({ error: "SMTP host could not be resolved. Check SMTP_HOST." }, 502);
    }

    return json({
      error: "Email delivery failed. Check the Cloudflare Pages Function logs for the exact error."
    }, 502);
  }
}
