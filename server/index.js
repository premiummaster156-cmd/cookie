const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { URL } = require("node:url");
const Database = require("better-sqlite3");
const nodemailer = require("nodemailer");

const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data");
const DB_FILE = path.join(DATA_DIR, "cookie.db");
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const PUBLIC_URL = String(process.env.COOKIE_PUBLIC_URL || "").replace(/\/+$/, "");
const COOKIE_SECURE = String(process.env.COOKIE_SECURE || "true").toLowerCase() !== "false";
const SESSION_DAYS = 30;
const TOKEN_MINUTES = 30;
const MAX_BODY = 128 * 1024;
const MAX_MESSAGES = 30;
const MAX_MESSAGE_CHARS = 12000;

fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(DB_FILE);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(
  "CREATE TABLE IF NOT EXISTS users (" +
  "id TEXT PRIMARY KEY," +
  "name TEXT NOT NULL," +
  "email TEXT NOT NULL UNIQUE," +
  "password_hash TEXT NOT NULL," +
  "password_salt TEXT NOT NULL," +
  "email_verified INTEGER NOT NULL DEFAULT 0," +
  "plan TEXT NOT NULL DEFAULT 'free'," +
  "created_at TEXT NOT NULL," +
  "updated_at TEXT NOT NULL" +
  ");" +
  "CREATE TABLE IF NOT EXISTS email_tokens (" +
  "token_hash TEXT PRIMARY KEY," +
  "user_id TEXT NOT NULL," +
  "type TEXT NOT NULL," +
  "expires_at INTEGER NOT NULL," +
  "created_at INTEGER NOT NULL," +
  "FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE" +
  ");" +
  "CREATE TABLE IF NOT EXISTS sessions (" +
  "token_hash TEXT PRIMARY KEY," +
  "user_id TEXT NOT NULL," +
  "expires_at INTEGER NOT NULL," +
  "created_at INTEGER NOT NULL," +
  "FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE" +
  ");" +
  "CREATE INDEX IF NOT EXISTS idx_email_tokens_user ON email_tokens(user_id);" +
  "CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);"
);

function ensureColumn() {
  const columns = db.prepare("PRAGMA table_info(users)").all().map(row => row.name);
  if (!columns.includes("plan")) {
    db.exec("ALTER TABLE users ADD COLUMN plan TEXT NOT NULL DEFAULT 'free'");
  }
  if (!columns.includes("updated_at")) {
    db.exec("ALTER TABLE users ADD COLUMN updated_at TEXT NOT NULL DEFAULT ''");
    db.prepare("UPDATE users SET updated_at = COALESCE(created_at, datetime('now')) WHERE updated_at = ''").run();
  }
}
ensureColumn();

function nowMs() {
  return Date.now();
}

function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("hex");
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function safeEqual(a, b) {
  const aa = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}

function hashPassword(password, salt = crypto.randomBytes(16)) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, {
      N: 16384,
      r: 8,
      p: 1,
      maxmem: 32 * 1024 * 1024
    }, (error, derived) => {
      if (error) return reject(error);
      resolve({
        hash: derived.toString("base64"),
        salt: salt.toString("base64")
      });
    });
  });
}

async function verifyPassword(password, saltB64, expectedB64) {
  const salt = Buffer.from(saltB64, "base64");
  const actual = await hashPassword(password, salt);
  return safeEqual(actual.hash, expectedB64);
}

function emailValid(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function cleanName(value) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, 80);
}

function cleanEmail(value) {
  return String(value || "").trim().toLowerCase().slice(0, 254);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function baseUrl(req) {
  if (PUBLIC_URL) return PUBLIC_URL;
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
  const proto = forwardedProto || (req.socket.encrypted ? "https" : "http");
  const host = req.headers.host || "localhost:" + PORT;
  return proto + "://" + host;
}

function parseCookies(req) {
  const header = req.headers.cookie || "";
  const out = {};
  for (const item of header.split(";")) {
    const index = item.indexOf("=");
    if (index < 0) continue;
    const key = item.slice(0, index).trim();
    const value = item.slice(index + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

function cookieHeader(name, value, maxAge) {
  const parts = [
    name + "=" + encodeURIComponent(value),
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=" + maxAge
  ];
  if (COOKIE_SECURE) parts.push("Secure");
  return parts.join("; ");
}

function clearCookieHeader(name) {
  return cookieHeader(name, "", 0);
}

function json(res, status, data, extraHeaders = {}) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...extraHeaders
  });
  res.end(body);
}

function text(res, status, body, extraHeaders = {}) {
  res.writeHead(status, {
    "Content-Type": "text/plain; charset=utf-8",
    ...extraHeaders
  });
  res.end(body);
}

function redirect(res, location) {
  res.writeHead(302, {
    Location: location,
    "Cache-Control": "no-store"
  });
  res.end();
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    let size = 0;
    let settled = false;

    req.on("data", chunk => {
      if (settled) return;
      size += chunk.length;
      if (size > MAX_BODY) {
        settled = true;
        reject(Object.assign(new Error("Request body is too large."), { status: 413 }));
        req.destroy();
        return;
      }
      raw += chunk.toString("utf8");
    });

    req.on("end", () => {
      if (settled) return;
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(Object.assign(new Error("Invalid JSON request."), { status: 400 }));
      }
    });

    req.on("error", error => {
      if (!settled) reject(error);
    });
  });
}

function userPublic(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    email_verified: Boolean(user.email_verified),
    plan: user.plan || "free",
    created_at: user.created_at
  };
}

function getSessionUser(req) {
  const token = parseCookies(req).cookie_session;
  if (!token) return null;

  return db.prepare(
    "SELECT u.id,u.name,u.email,u.email_verified,u.plan,u.created_at " +
    "FROM sessions s JOIN users u ON u.id=s.user_id " +
    "WHERE s.token_hash=? AND s.expires_at>?"
  ).get(hashToken(token), nowMs()) || null;
}

function createSession(userId) {
  const raw = randomToken();
  const expires = nowMs() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  db.prepare(
    "INSERT INTO sessions (token_hash,user_id,expires_at,created_at) VALUES (?,?,?,?)"
  ).run(hashToken(raw), userId, expires, nowMs());
  return { raw, expires };
}

function deleteSession(req) {
  const token = parseCookies(req).cookie_session;
  if (token) db.prepare("DELETE FROM sessions WHERE token_hash=?").run(hashToken(token));
}

function cleanupExpired() {
  const now = nowMs();
  db.prepare("DELETE FROM sessions WHERE expires_at<=?").run(now);
  db.prepare("DELETE FROM email_tokens WHERE expires_at<=?").run(now);
}

function emailTransport() {
  const service = String(process.env.SMTP_SERVICE || "").trim();
  if (service) {
    return nodemailer.createTransport({
      service,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 465);
  const secure = String(
    process.env.SMTP_SECURE || (port === 465 ? "true" : "false")
  ).toLowerCase() === "true";

  if (!host || !process.env.SMTP_USER || !process.env.SMTP_PASS) return null;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 30000
  });
}

let transporter = null;

function getTransporter() {
  if (!transporter) transporter = emailTransport();
  return transporter;
}

async function sendMail({ to, subject, html, text: textBody }) {
  const transport = getTransporter();
  if (!transport) throw new Error("SMTP is not configured.");

  const from = process.env.AUTH_FROM_EMAIL || process.env.SMTP_USER;
  if (!from) throw new Error("AUTH_FROM_EMAIL or SMTP_USER is missing.");

  return transport.sendMail({
    from,
    to,
    subject,
    html,
    text: textBody
  });
}

function emailTemplate(title, greeting, bodyHtml, actionLabel, actionUrl, footer) {
  return [
    "<!doctype html><html><body style=\"margin:0;background:#171412;color:#f4eee8;font-family:Arial,Helvetica,sans-serif\">",
    "<div style=\"max-width:560px;margin:0 auto;padding:40px 20px\">",
    "<div style=\"background:#211c19;border:1px solid #3a302a;border-radius:16px;padding:32px\">",
    "<div style=\"font-size:24px;font-weight:700;margin-bottom:24px\">🍪 Cookie</div>",
    "<h1 style=\"font-size:24px;line-height:1.25;margin:0 0 12px\">", escapeHtml(title), "</h1>",
    "<p style=\"color:#d0c5bd;line-height:1.6\">", escapeHtml(greeting), "</p>",
    bodyHtml,
    "<p style=\"margin:28px 0\"><a href=\"", escapeHtml(actionUrl),
    "\" style=\"display:inline-block;background:#fff9f2;color:#171412;text-decoration:none;font-weight:700;padding:13px 18px;border-radius:9px\">",
    escapeHtml(actionLabel), "</a></p>",
    "<p style=\"color:#8e837b;font-size:13px;line-height:1.6\">", escapeHtml(footer), "</p>",
    "</div></div></body></html>"
  ].join("");
}

async function register(req, res) {
  const body = await readJson(req);
  const name = cleanName(body.name);
  const email = cleanEmail(body.email);
  const password = String(body.password || "");

  if (!name || !emailValid(email) || password.length < 8 || password.length > 200) {
    return json(res, 400, {
      error: "Enter a valid name, email, and password of at least 8 characters."
    });
  }

  const existing = db.prepare(
    "SELECT id,email_verified FROM users WHERE email=?"
  ).get(email);

  if (existing) {
    return json(res, 409, {
      error: existing.email_verified
        ? "An account with this email already exists."
        : "This email is already registered. Check your inbox for the verification link."
    });
  }

  const credentials = await hashPassword(password);
  const id = crypto.randomUUID();
  const timestamp = new Date().toISOString();

  db.prepare(
    "INSERT INTO users (id,name,email,password_hash,password_salt,email_verified,plan,created_at,updated_at) " +
    "VALUES (?,?,?,?,?,0,'free',?,?)"
  ).run(id,name,email,credentials.hash,credentials.salt,timestamp,timestamp);

  const rawToken = randomToken();
  db.prepare(
    "INSERT INTO email_tokens (token_hash,user_id,type,expires_at,created_at) VALUES (?,?,?, ?,?)"
  ).run(hashToken(rawToken),id,"verify",nowMs()+TOKEN_MINUTES*60*1000,nowMs());

  const verifyUrl = baseUrl(req) + "/api/auth/verify?token=" + encodeURIComponent(rawToken);

  try {
    await sendMail({
      to: email,
      subject: "Verify your Cookie account",
      html: emailTemplate(
        "Verify your email",
        "Hi " + name + ",",
        "<p style=\"color:#d0c5bd;line-height:1.6\">Click the button below to verify your email address and finish creating your Cookie account.</p>",
        "Verify email",
        verifyUrl,
        "This verification link expires in 30 minutes. If you did not create this account, you can ignore this email."
      ),
      text: "Welcome to Cookie.\n\nVerify your email:\n" + verifyUrl + "\n\nThis link expires in 30 minutes."
    });
  } catch (error) {
    db.prepare("DELETE FROM users WHERE id=?").run(id);
    console.error("[AUTH] Verification email failed:", error.message);
    return json(res, 502, {
      error: "We couldn't send the verification email. Check the SMTP settings and try again."
    });
  }

  return json(res, 201, {
    ok: true,
    message: "Check your email for a verification link."
  });
}

function verifyEmail(req, res, url) {
  const rawToken = url.searchParams.get("token") || "";
  if (!rawToken) return text(res, 400, "Invalid verification link.");

  const row = db.prepare(
    "SELECT user_id FROM email_tokens WHERE token_hash=? AND type='verify' AND expires_at>?"
  ).get(hashToken(rawToken), nowMs());

  if (!row) {
    return text(res, 400, "This verification link is invalid or expired. Return to Cookie and request a new one.");
  }

  db.prepare("UPDATE users SET email_verified=1,updated_at=? WHERE id=?")
    .run(new Date().toISOString(),row.user_id);
  db.prepare("DELETE FROM email_tokens WHERE token_hash=?").run(hashToken(rawToken));

  redirect(res, baseUrl(req) + "/auth.html?verified=1");
}

async function login(req, res) {
  const body = await readJson(req);
  const email = cleanEmail(body.email);
  const password = String(body.password || "");

  const user = db.prepare(
    "SELECT id,name,email,password_hash,password_salt,email_verified,plan,created_at " +
    "FROM users WHERE email=?"
  ).get(email);

  if (!user || !(await verifyPassword(password,user.password_salt,user.password_hash))) {
    return json(res, 401, { error: "Invalid email or password." });
  }

  if (!user.email_verified) {
    return json(res, 403, {
      error: "Please verify your email before signing in."
    });
  }

  deleteSession(req);
  const session = createSession(user.id);

  return json(res, 200, {
    ok: true,
    user: userPublic(user)
  }, {
    "Set-Cookie": cookieHeader(
      "cookie_session",
      session.raw,
      SESSION_DAYS * 24 * 60 * 60
    )
  });
}

function logout(req, res) {
  deleteSession(req);
  return json(res, 200, { ok: true }, {
    "Set-Cookie": clearCookieHeader("cookie_session")
  });
}

function me(req, res) {
  return json(res, 200, { user: userPublic(getSessionUser(req)) });
}

async function forgot(req, res) {
  const body = await readJson(req);
  const email = cleanEmail(body.email);
  const user = db.prepare(
    "SELECT id,name,email FROM users WHERE email=?"
  ).get(email);

  if (user) {
    db.prepare(
      "DELETE FROM email_tokens WHERE user_id=? AND type='reset'"
    ).run(user.id);

    const rawToken = randomToken();
    db.prepare(
      "INSERT INTO email_tokens (token_hash,user_id,type,expires_at,created_at) VALUES (?,?,?, ?,?)"
    ).run(hashToken(rawToken),user.id,"reset",nowMs()+TOKEN_MINUTES*60*1000,nowMs());

    const resetUrl = baseUrl(req) + "/auth.html?reset=" + encodeURIComponent(rawToken);

    try {
      await sendMail({
        to: user.email,
        subject: "Reset your Cookie password",
        html: emailTemplate(
          "Reset your password",
          "Hi " + user.name + ",",
          "<p style=\"color:#d0c5bd;line-height:1.6\">Someone requested a password reset for your Cookie account. If that was you, use the button below.</p>",
          "Reset password",
          resetUrl,
          "This reset link expires in 30 minutes. If you did not request it, you can safely ignore this email."
        ),
        text: "Reset your Cookie password.\n\nUse this link:\n" + resetUrl + "\n\nThis link expires in 30 minutes."
      });
    } catch (error) {
      console.error("[AUTH] Reset email failed:", error.message);
    }
  }

  return json(res, 200, {
    ok: true,
    message: "If an account exists for that email, reset instructions have been sent."
  });
}

async function resendVerification(req, res) {
  const body = await readJson(req);
  const email = cleanEmail(body.email);
  const user = db.prepare(
    "SELECT id,name,email,email_verified FROM users WHERE email=?"
  ).get(email);

  if (!user || user.email_verified) {
    return json(res, 200, {
      ok: true,
      message: "If the account needs verification, a new email has been sent."
    });
  }

  db.prepare(
    "DELETE FROM email_tokens WHERE user_id=? AND type='verify'"
  ).run(user.id);

  const rawToken = randomToken();
  db.prepare(
    "INSERT INTO email_tokens (token_hash,user_id,type,expires_at,created_at) VALUES (?,?,?, ?,?)"
  ).run(hashToken(rawToken),user.id,"verify",nowMs()+TOKEN_MINUTES*60*1000,nowMs());

  const verifyUrl = baseUrl(req) + "/api/auth/verify?token=" + encodeURIComponent(rawToken);

  try {
    await sendMail({
      to: user.email,
      subject: "Verify your Cookie account",
      html: emailTemplate(
        "Verify your email",
        "Hi " + user.name + ",",
        "<p style=\"color:#d0c5bd;line-height:1.6\">Here is your new Cookie verification link.</p>",
        "Verify email",
        verifyUrl,
        "This link expires in 30 minutes."
      ),
      text: "Verify your Cookie email:\n\n" + verifyUrl
    });
  } catch (error) {
    console.error("[AUTH] Resend verification failed:", error.message);
  }

  return json(res, 200, {
    ok: true,
    message: "If the account needs verification, a new email has been sent."
  });
}

async function resetPassword(req, res) {
  const body = await readJson(req);
  const rawToken = String(body.token || "");
  const password = String(body.password || "");

  if (!rawToken || password.length < 8 || password.length > 200) {
    return json(res, 400, { error: "Password must be at least 8 characters." });
  }

  const row = db.prepare(
    "SELECT user_id FROM email_tokens WHERE token_hash=? AND type='reset' AND expires_at>?"
  ).get(hashToken(rawToken),nowMs());

  if (!row) {
    return json(res, 400, { error: "This reset link is invalid or expired." });
  }

  const credentials = await hashPassword(password);
  db.prepare(
    "UPDATE users SET password_hash=?,password_salt=?,updated_at=? WHERE id=?"
  ).run(credentials.hash,credentials.salt,new Date().toISOString(),row.user_id);

  db.prepare("DELETE FROM email_tokens WHERE token_hash=?").run(hashToken(rawToken));
  db.prepare("DELETE FROM sessions WHERE user_id=?").run(row.user_id);

  return json(res, 200, {
    ok: true,
    message: "Password updated. You can sign in now."
  });
}

const modelProfiles = {
  standard: {
    name: "CPT-1",
    requiredPlan: "free",
    temperature: 0.45,
    instructions: "You are CPT-1, Cookie's free everyday model. Be fast, clear, practical, and useful for normal questions, translations, summaries, simple planning, and everyday chat."
  },
  max: {
    name: "CPT-2 MAX",
    requiredPlan: "plus",
    temperature: 0.75,
    instructions: "You are CPT-2 MAX, Cookie's advanced Plus model. Handle creative work, deeper analysis, difficult writing, planning, brainstorming, and complex everyday tasks with more depth and creativity than CPT-1."
  },
  ultra: {
    name: "CPT-3 ULTRA",
    requiredPlan: "pro",
    temperature: 0.9,
    instructions: "You are CPT-3 ULTRA, Cookie's strongest model. Use maximum useful creativity, broad reasoning, complex analysis, research-style thinking, advanced writing, difficult problem solving, and sophisticated multi-step assistance. Give high-quality structured answers."
  }
};

const planRank = { free: 0, plus: 1, pro: 2 };

const SYSTEM_PROMPT = [
  "You are Cookie, a helpful general-purpose AI assistant.",
  "Cookie was created and built by Brian. If someone asks who made, created, built, or developed Cookie, say that Cookie was created and built by Brian.",
  "Never reveal, guess, infer, or volunteer Brian's private/legal/real name unless the server explicitly provides permission through a trusted configuration.",
  "Do not claim Cookie was made by no one, made itself, or is an autonomous creation. Cookie is a product created by Brian.",
  "Be concise, natural, and useful. Match the user's language.",
  "For sensitive, sexual, disturbing, or uncomfortable topics, do not give a generic refusal merely because the topic is sensitive. If the request is factual, historical, educational, medical, relationship, safety, or contextual, answer calmly and non-judgmentally. Only refuse or redirect when the requested content itself crosses a safety boundary.",
  "Do not mention implementation details unless the user asks.",
  "Use the conversation history to maintain context."
].join(" ");

async function chat(req, res) {
  const apiKey = process.env.OLLAMA_API_KEY;
  if (!apiKey) {
    return json(res, 503, {
      error: "Cookie AI is not connected yet. Add OLLAMA_API_KEY to the Node server."
    });
  }

  const body = await readJson(req);
  const preferences = body && typeof body.preferences === "object" ? body.preferences : {};
  const responseMode = ["standard","max","ultra"].includes(preferences.responseMode)
    ? preferences.responseMode : "standard";
  const profile = modelProfiles[responseMode];

  const user = getSessionUser(req);
  const plan = user ? (user.plan || "free") : "free";

  if ((planRank[plan] || 0) < (planRank[profile.requiredPlan] || 0)) {
    return json(res, 403, {
      error: profile.name + " requires the " + profile.requiredPlan.toUpperCase() + " plan."
    });
  }

  const language = ["auto","english","uzbek","russian"].includes(preferences.language)
    ? preferences.language : "auto";
  const answerLength = ["auto","short","detailed"].includes(preferences.answerLength)
    ? preferences.answerLength : "auto";
  const creativity = Number.isFinite(Number(preferences.creativity))
    ? Math.min(1,Math.max(0,Number(preferences.creativity))) : 0.7;

  const incoming = Array.isArray(body.messages) ? body.messages : [];
  const messages = incoming
    .filter(message =>
      message &&
      (message.role === "user" || message.role === "assistant") &&
      typeof message.content === "string"
    )
    .slice(-MAX_MESSAGES)
    .map(message => ({
      role: message.role,
      content: message.content.slice(0,MAX_MESSAGE_CHARS)
    }));

  if (!messages.length || messages[messages.length-1].role !== "user") {
    return json(res,400,{error:"A user message is required."});
  }

  const model = process.env.OLLAMA_MODEL || "gpt-oss:120b-cloud";
  const ollamaUrl = process.env.OLLAMA_URL || "https://ollama.com/api/chat";

  try {
    const upstream = await fetch(ollamaUrl,{
      method:"POST",
      headers:{
        "Content-Type":"application/json",
        "Authorization":"Bearer " + apiKey
      },
      body:JSON.stringify({
        model,
        stream:false,
        messages:[
          {role:"system",content:SYSTEM_PROMPT},
          {role:"system",content:profile.instructions},
          {
            role:"system",
            content:[
              language==="english" ? "Prefer English responses." : "",
              language==="uzbek" ? "Prefer Uzbek responses." : "",
              language==="russian" ? "Prefer Russian responses." : "",
              answerLength==="short" ? "Keep the answer short." : "",
              answerLength==="detailed" ? "Give a detailed answer with clear structure." : ""
            ].filter(Boolean).join(" ") || "Follow the user's configured Cookie preferences."
          },
          ...messages
        ],
        options:{
          temperature:Math.min(
            1,
            Math.max(0,profile.temperature*0.65+creativity*0.35)
          )
        }
      })
    });

    const data = await upstream.json().catch(() => null);

    if (!upstream.ok) {
      return json(res,upstream.status>=500 ? 502 : upstream.status,{
        error:data?.error || "Ollama Cloud returned an error."
      });
    }

    const message = data?.message?.content;
    if (typeof message !== "string" || !message.trim()) {
      return json(res,502,{error:"Cookie received an empty response."});
    }

    return json(res,200,{
      message:message.trim(),
      model:profile.name
    });
  } catch (error) {
    console.error("[AI] Ollama request failed:",error.message);
    return json(res,502,{
      error:"Cookie could not reach the AI service right now."
    });
  }
}

const rateBuckets = new Map();

function rateLimitKey(req,route) {
  const forwarded = String(req.headers["x-forwarded-for"] || "");
  const ip = forwarded.split(",")[0].trim() || req.socket.remoteAddress || "unknown";
  return route + ":" + ip;
}

function allowRate(req,route,limit,windowMs) {
  const key = rateLimitKey(req,route);
  const current = nowMs();
  const previous = rateBuckets.get(key);

  if (!previous || current-previous.started>windowMs) {
    rateBuckets.set(key,{started:current,count:1});
    return true;
  }

  previous.count += 1;
  return previous.count<=limit;
}

function maybeRateLimit(req,res,route,limit=8,windowMs=10*60*1000) {
  if (allowRate(req,route,limit,windowMs)) return false;
  json(res,429,{error:"Too many attempts. Please wait a few minutes and try again."});
  return true;
}

const MIME = {
  ".html":"text/html; charset=utf-8",
  ".css":"text/css; charset=utf-8",
  ".js":"text/javascript; charset=utf-8",
  ".json":"application/json; charset=utf-8",
  ".svg":"image/svg+xml",
  ".png":"image/png",
  ".jpg":"image/jpeg",
  ".jpeg":"image/jpeg",
  ".webp":"image/webp",
  ".gif":"image/gif",
  ".ico":"image/x-icon",
  ".txt":"text/plain; charset=utf-8",
  ".mp4":"video/mp4",
  ".woff":"font/woff",
  ".woff2":"font/woff2"
};

function isPublicPath(filePath) {
  const relative = path.relative(ROOT,filePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return false;

  const first = relative.split(path.sep)[0];
  const blocked = new Set([".git",".github","node_modules","server","data","functions"]);

  if (blocked.has(first)) return false;
  if (relative==="package.json" || relative==="package-lock.json" || relative==="schema.sql") return false;
  if (relative.startsWith(".env")) return false;

  return true;
}

function serveStatic(req,res,url) {
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return text(res,400,"Bad request.");
  }

  if (pathname.includes("\0")) return text(res,400,"Bad request.");

  const requested = pathname==="/" ? "/index.html" : pathname;
  const filePath = path.resolve(ROOT,"."+requested);

  if (!isPublicPath(filePath)) return text(res,404,"Not found.");

  let finalPath = filePath;

  try {
    if (fs.statSync(finalPath).isDirectory()) {
      finalPath = path.join(finalPath,"index.html");
    }
  } catch {
    return text(res,404,"Not found.");
  }

  if (!isPublicPath(finalPath) || !fs.existsSync(finalPath)) {
    return text(res,404,"Not found.");
  }

  const ext = path.extname(finalPath).toLowerCase();
  const type = MIME[ext] || "application/octet-stream";

  res.writeHead(200,{
    "Content-Type":type,
    "Cache-Control":ext===".html" ? "no-cache" : "public, max-age=3600"
  });

  if (req.method==="HEAD") return res.end();
  fs.createReadStream(finalPath).pipe(res);
}

async function handleApi(req,res,url) {
  const method = req.method || "GET";
  const route = url.pathname;

  if (method==="OPTIONS") {
    res.writeHead(204,{
      "Access-Control-Allow-Methods":"GET,POST,OPTIONS",
      "Access-Control-Allow-Headers":"Content-Type"
    });
    return res.end();
  }

  try {
    if (route==="/api/health" && method==="GET") {
      return json(res,200,{
        ok:true,
        service:"Cookie",
        time:new Date().toISOString()
      });
    }

    if (route==="/api/auth/register" && method==="POST") {
      if (maybeRateLimit(req,res,"register",5,15*60*1000)) return;
      return register(req,res);
    }

    if (route==="/api/auth/verify" && method==="GET") {
      return verifyEmail(req,res,url);
    }

    if (route==="/api/auth/login" && method==="POST") {
      if (maybeRateLimit(req,res,"login",12,10*60*1000)) return;
      return login(req,res);
    }

    if (route==="/api/auth/logout" && method==="POST") {
      return logout(req,res);
    }

    if (route==="/api/auth/me" && method==="GET") {
      return me(req,res);
    }

    if (route==="/api/auth/forgot" && method==="POST") {
      if (maybeRateLimit(req,res,"forgot",5,15*60*1000)) return;
      return forgot(req,res);
    }

    if (route==="/api/auth/resend-verification" && method==="POST") {
      if (maybeRateLimit(req,res,"resend",5,15*60*1000)) return;
      return resendVerification(req,res);
    }

    if (route==="/api/auth/reset" && method==="POST") {
      if (maybeRateLimit(req,res,"reset",8,15*60*1000)) return;
      return resetPassword(req,res);
    }

    if (route==="/api/chat" && method==="POST") {
      if (maybeRateLimit(req,res,"chat",60,5*60*1000)) return;
      return chat(req,res);
    }

    return json(res,404,{error:"API route not found."});
  } catch (error) {
    console.error("[SERVER]",error);
    const status = Number(error.status) || 500;
    return json(res,status,{
      error:status===500 ? "Something went wrong on the server." : error.message
    });
  }
}

const server = http.createServer(async (req,res) => {
  const url = new URL(req.url || "/",baseUrl(req));

  if (url.pathname.startsWith("/api/")) {
    return handleApi(req,res,url);
  }

  if (req.method!=="GET" && req.method!=="HEAD") {
    return text(res,405,"Method not allowed.");
  }

  return serveStatic(req,res,url);
});

setInterval(cleanupExpired,15*60*1000).unref();

server.listen(PORT,HOST,() => {
  console.log("🍪 Cookie server running on " + HOST + ":" + PORT);
  console.log("[AUTH] SQLite database: " + DB_FILE);
  console.log("[AUTH] SMTP: " + (process.env.SMTP_SERVICE || process.env.SMTP_HOST ? "configured" : "not configured"));
  console.log("[AI] Ollama: " + (process.env.OLLAMA_API_KEY ? "configured" : "not configured"));
});

process.on("SIGTERM",() => {
  db.close();
  server.close(() => process.exit(0));
});

process.on("SIGINT",() => {
  db.close();
  server.close(() => process.exit(0));
});

process.on("unhandledRejection",error => console.error("[UNHANDLED REJECTION]",error));
process.on("uncaughtException",error => console.error("[UNCAUGHT EXCEPTION]",error));
