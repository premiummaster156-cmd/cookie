const json = (data, status = 200, headers = {}) => Response.json(data, { status, headers });
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function hashPassword(password, saltBytes) {
  const salt = saltBytes || crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 120000, hash: "SHA-256" }, key, 256);
  return { hash: btoa(String.fromCharCode(...new Uint8Array(bits))), salt: btoa(String.fromCharCode(...salt)) };
}

async function sendEmail(env, to, subject, html) {
  if (!env.RESEND_API_KEY) throw new Error("RESEND_API_KEY is not configured.");
  const from = env.AUTH_FROM_EMAIL || "Cookie <onboarding@resend.dev>";
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": "Bearer " + env.RESEND_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, html })
  });
  if (!r.ok) throw new Error("Email provider rejected the message.");
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: "Authentication database is not configured yet." }, 503);
  let body; try { body = await request.json(); } catch { return json({ error: "Invalid request." }, 400); }
  const name = String(body?.name || "").trim().slice(0, 80);
  const email = String(body?.email || "").trim().toLowerCase();
  const password = String(body?.password || "");
  if (!name || !emailPattern.test(email) || password.length < 8) return json({ error: "Enter a valid name, email, and password of at least 8 characters." }, 400);

  const existing = await env.DB.prepare("SELECT id, email_verified FROM users WHERE email = ?1").bind(email).first();
  if (existing) return json({ error: existing.email_verified ? "An account with this email already exists." : "This email is already registered. Check your inbox for the verification link." }, 409);

  const { hash, salt } = await hashPassword(password);
  const id = crypto.randomUUID();
  await env.DB.prepare("INSERT INTO users (id, name, email, password_hash, password_salt, email_verified, created_at) VALUES (?1,?2,?3,?4,?5,0,datetime('now'))").bind(id, name, email, hash, salt).run();

  const token = randomToken();
  await env.DB.prepare("INSERT INTO email_tokens (token, user_id, type, expires_at, created_at) VALUES (?1,?2,'verify',datetime('now','+30 minutes'),datetime('now'))").bind(token, id).run();
  const url = new URL(request.url);
  const verifyUrl = url.origin + "/api/auth/verify?token=" + token;
  try {
    await sendEmail(env, email, "Verify your Cookie account", `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto"><h2>Welcome to Cookie 🍪</h2><p>Hi ${name.replace(/[&<>]/g, "")},</p><p>Click below to verify your email address.</p><p><a href="${verifyUrl}" style="display:inline-block;padding:12px 18px;background:#fff9f2;color:#171412;text-decoration:none;border-radius:8px">Verify email</a></p><p>This link expires in 30 minutes.</p></div>`);
  } catch {
    await env.DB.prepare("DELETE FROM users WHERE id = ?1").bind(id).run();
    return json({ error: "We couldn't send the verification email. Check the email configuration and try again." }, 502);
  }
  return json({ ok: true, message: "Check your email for a verification link." }, 201);
}
