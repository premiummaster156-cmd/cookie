import {
  clearCookie, cookie, emailTemplate, getUser, initDb, json, passwordHash,
  publicUser, readJson, sendMail, sha256, token, TOKEN_TTL, cleanEmail,
  cleanName, validEmail, createSession, deleteSession, verifyPassword
} from "../_lib.js";

async function ensure(env) { await initDb(env); }

function baseUrl(request) {
  return new URL(request.url).origin;
}

export async function onRequestGet(ctx) {
  try {
    return await onRequestGetImpl(ctx);
  } catch (error) {
    console.error('[Cookie auth GET]', error);
    return json({ error: error?.message || 'Authentication service error.' }, 500);
  }
}

async function onRequestGetImpl({ request, env, params }) {
  await ensure(env);
  const action = params?.action || "";
  if (action === "me") return json({ user: publicUser(await getUser(request, env)) });
  if (action === "verify") {
    const raw = new URL(request.url).searchParams.get("token") || "";
    const row = await env.DB.prepare("SELECT user_id FROM email_tokens WHERE token_hash=? AND type='verify' AND expires_at>?").bind(await sha256(raw), Date.now()).first();
    if (!row) return new Response("This verification link is invalid or expired.", { status: 400, headers: {"Content-Type":"text/plain; charset=utf-8"} });
    await env.DB.batch([
      env.DB.prepare("UPDATE users SET email_verified=1,updated_at=? WHERE id=?").bind(new Date().toISOString(), row.user_id),
      env.DB.prepare("DELETE FROM email_tokens WHERE token_hash=?").bind(await sha256(raw))
    ]);
    return Response.redirect(baseUrl(request) + "/auth.html?verified=1", 302);
  }
  return json({ error: "Auth route not found." }, 404);
}

export async function onRequestPost(ctx) {
  try {
    return await onRequestPostImpl(ctx);
  } catch (error) {
    console.error('[Cookie auth POST]', error);
    return json({ error: error?.message || 'Authentication service error.' }, 500);
  }
}

async function onRequestPostImpl({ request, env, params }) {
  await ensure(env);
  const action = params?.action || "";
  const body = await readJson(request);

  if (action === "register") {
    const name = cleanName(body.name);
    const email = cleanEmail(body.email);
    const password = String(body.password || "");
    if (!name || !validEmail(email) || password.length < 8 || password.length > 200) {
      return json({ error: "Enter your name, a valid email, and a password of at least 8 characters." }, 400);
    }
    const existing = await env.DB.prepare("SELECT id,email_verified FROM users WHERE email=?").bind(email).first();
    if (existing) return json({ error: existing.email_verified ? "An account with this email already exists." : "This email is already registered. Check your inbox for verification." }, 409);

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const pass = await passwordHash(password);
    const raw = token();
    await env.DB.prepare("INSERT INTO users (id,name,email,password_hash,password_salt,email_verified,plan,created_at,updated_at) VALUES (?,?,?,?,?,0,'free',?,?)")
      .bind(id,name,email,pass.hash,pass.salt,now,now).run();
    await env.DB.prepare("INSERT INTO email_tokens (token_hash,user_id,type,expires_at,created_at) VALUES (?,?,?,?,?)")
      .bind(await sha256(raw),id,"verify",Date.now()+TOKEN_TTL,Date.now()).run();

    const url = baseUrl(request) + "/api/auth/verify?token=" + encodeURIComponent(raw);
    try {
      await sendMail(env, {
        to: email,
        subject: "Verify your Cookie account",
        html: emailTemplate("Verify your email", "Hi " + name + ",", "<p style='color:#d0c5bd;line-height:1.6'>Click below to verify your Cookie account.</p>", "Verify email", url, "This link expires in 30 minutes."),
        text: "Verify your Cookie account:\n\n" + url
      });
    } catch (error) {
      await env.DB.batch([
        env.DB.prepare("DELETE FROM email_tokens WHERE user_id=?").bind(id),
        env.DB.prepare("DELETE FROM users WHERE id=?").bind(id)
      ]);
      console.error("[Cookie email]", error);
      const detail = String(error?.message || "Unknown SMTP error.")
        .replace(/(password|pass|secret|token)\s*[:=]\s*\S+/gi, "$1: [redacted]");
      return json({ error: "Verification email could not be sent. " + detail }, 502);
    }
    return json({ ok: true, message: "Verification email sent. Check your inbox before signing in." }, 201);
  }

  if (action === "login") {
    const email = cleanEmail(body.email);
    const password = String(body.password || "");
    const user = await env.DB.prepare("SELECT * FROM users WHERE email=?").bind(email).first();
    if (!user || !(await verifyPassword(password, user.password_salt, user.password_hash))) return json({ error: "Invalid email or password." }, 401);
    if (!user.email_verified) return json({ error: "Verify your email before signing in." }, 403);
    await deleteSession(request, env);
    const session = await createSession(env, user.id);
    return json({ ok: true, user: publicUser(user) }, 200, { "Set-Cookie": cookie("cookie_session", session.raw, 30 * 24 * 60 * 60) });
  }

  if (action === "logout") {
    await deleteSession(request, env);
    return json({ ok: true }, 200, { "Set-Cookie": clearCookie("cookie_session") });
  }

  if (action === "forgot") {
    const email = cleanEmail(body.email);
    const user = await env.DB.prepare("SELECT id,name,email FROM users WHERE email=?").bind(email).first();
    if (user) {
      await env.DB.prepare("DELETE FROM email_tokens WHERE user_id=? AND type='reset'").bind(user.id).run();
      const raw = token();
      await env.DB.prepare("INSERT INTO email_tokens (token_hash,user_id,type,expires_at,created_at) VALUES (?,?,?,?,?)")
        .bind(await sha256(raw),user.id,"reset",Date.now()+TOKEN_TTL,Date.now()).run();
      const url = baseUrl(request) + "/auth.html?reset=" + encodeURIComponent(raw);
      try {
        await sendMail(env, {
          to: user.email,
          subject: "Reset your Cookie password",
          html: emailTemplate("Reset your password", "Hi " + user.name + ",", "<p style='color:#d0c5bd;line-height:1.6'>Use the button below to choose a new password.</p>", "Reset password", url, "This link expires in 30 minutes."),
          text: "Reset your Cookie password:\n\n" + url
        });
      } catch (error) { console.error("[Cookie reset email]", error); }
    }
    return json({ ok: true, message: "If that email has a Cookie account, reset instructions have been sent." });
  }

  if (action === "resend-verification") {
    const email = cleanEmail(body.email);
    const user = await env.DB.prepare("SELECT id,name,email,email_verified FROM users WHERE email=?").bind(email).first();
    if (!user || user.email_verified) return json({ ok: true, message: "If the account needs verification, a new email has been sent." });
    await env.DB.prepare("DELETE FROM email_tokens WHERE user_id=? AND type='verify'").bind(user.id).run();
    const raw = token();
    await env.DB.prepare("INSERT INTO email_tokens (token_hash,user_id,type,expires_at,created_at) VALUES (?,?,?,?,?)")
      .bind(await sha256(raw),user.id,"verify",Date.now()+TOKEN_TTL,Date.now()).run();
    const url = baseUrl(request) + "/api/auth/verify?token=" + encodeURIComponent(raw);
    try {
      await sendMail(env, {
        to: user.email,
        subject: "Verify your Cookie account",
        html: emailTemplate("Verify your email", "Hi " + user.name + ",", "<p style='color:#d0c5bd;line-height:1.6'>Here is your new verification link.</p>", "Verify email", url, "This link expires in 30 minutes."),
        text: "Verify your Cookie email:\n\n" + url
      });
    } catch (error) { console.error("[Cookie resend]", error); }
    return json({ ok: true, message: "If the account needs verification, a new email has been sent." });
  }

  if (action === "reset") {
    const raw = String(body.token || "");
    const password = String(body.password || "");
    if (!raw || password.length < 8 || password.length > 200) return json({ error: "Password must be at least 8 characters." }, 400);
    const hash = await sha256(raw);
    const row = await env.DB.prepare("SELECT user_id FROM email_tokens WHERE token_hash=? AND type='reset' AND expires_at>?").bind(hash,Date.now()).first();
    if (!row) return json({ error: "This reset link is invalid or expired." }, 400);
    const pass = await passwordHash(password);
    await env.DB.batch([
      env.DB.prepare("UPDATE users SET password_hash=?,password_salt=?,updated_at=? WHERE id=?").bind(pass.hash,pass.salt,new Date().toISOString(),row.user_id),
      env.DB.prepare("DELETE FROM email_tokens WHERE token_hash=?").bind(hash),
      env.DB.prepare("DELETE FROM sessions WHERE user_id=?").bind(row.user_id)
    ]);
    return json({ ok: true, message: "Password updated. You can sign in now." });
  }

  return json({ error: "Auth route not found." }, 404);
}
