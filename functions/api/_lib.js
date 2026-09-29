const SESSION_TTL = 30 * 24 * 60 * 60 * 1000;
const TOKEN_TTL = 30 * 60 * 1000;

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers }
  });
}

export async function readJson(request) {
  try { return await request.json(); } catch { return {}; }
}

export function cleanEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export function cleanName(value) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, 80);
}

export function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function cookie(name, value, maxAge) {
  return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

export function clearCookie(name) {
  return `${name}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

function bytesToHex(bytes) {
  return [...bytes].map(b => b.toString(16).padStart(2, "0")).join("");
}

function randomBytes(size = 32) {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return bytes;
}

export function token() {
  return bytesToHex(randomBytes(32));
}

export async function sha256(value) {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return bytesToHex(new Uint8Array(hash));
}

export async function passwordHash(password, saltHex = bytesToHex(randomBytes(16))) {
  const salt = new Uint8Array(saltHex.match(/.{2}/g).map(x => parseInt(x, 16)));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    key,
    256
  );
  return { salt: saltHex, hash: bytesToHex(new Uint8Array(bits)) };
}

export async function verifyPassword(password, salt, expected) {
  const result = await passwordHash(password, salt);
  return result.hash === expected;
}

export function sessionFromRequest(request) {
  const raw = request.headers.get("Cookie") || "";
  const match = raw.match(/(?:^|;\s*)cookie_session=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

export async function getUser(request, env) {
  if (!env.DB) throw new Error("Cookie auth database is not configured.");
  const raw = sessionFromRequest(request);
  if (!raw) return null;
  const hash = await sha256(raw);
  const row = await env.DB.prepare(
    "SELECT u.id,u.name,u.email,u.email_verified,u.plan,u.created_at,s.expires_at " +
    "FROM sessions s JOIN users u ON u.id=s.user_id " +
    "WHERE s.token_hash=? AND s.expires_at>?"
  ).bind(hash, Date.now()).first();
  return row || null;
}

export function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerified: Boolean(user.email_verified),
    plan: user.plan || "free",
    createdAt: user.created_at
  };
}

export async function initDb(env) {
  if (!env.DB) throw new Error("DB binding is missing.");
  await env.DB.batch([
    env.DB.prepare("CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, password_salt TEXT NOT NULL, email_verified INTEGER NOT NULL DEFAULT 0, plan TEXT NOT NULL DEFAULT 'free', created_at TEXT NOT NULL, updated_at TEXT NOT NULL)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS email_tokens (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, type TEXT NOT NULL, expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL)")
  ]);
}

export async function createSession(env, userId) {
  const raw = token();
  const hash = await sha256(raw);
  const now = Date.now();
  const expires = now + SESSION_TTL;
  await env.DB.prepare(
    "INSERT INTO sessions (token_hash,user_id,expires_at,created_at) VALUES (?,?,?,?)"
  ).bind(hash, userId, expires, now).run();
  return { raw, expires };
}

export async function deleteSession(request, env) {
  const raw = sessionFromRequest(request);
  if (!raw || !env.DB) return;
  await env.DB.prepare("DELETE FROM sessions WHERE token_hash=?").bind(await sha256(raw)).run();
}

export async function sendMail(env, { to, subject, html, text }) {
  const host = env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(env.SMTP_PORT || 465);
  const username = String(env.SMTP_USER || "").trim();
  // Google displays App Passwords with spaces; Gmail expects the 16-character value without spaces.
  const password = String(env.SMTP_PASS || "").replace(/\s+/g, "");
  const from = String(env.AUTH_FROM_EMAIL || username).trim();
  if (!username || !password || !from) throw new Error("SMTP settings are missing.");

  const { connect } = await import("cloudflare:sockets");
  const socket = connect({ hostname: host, port }, { secureTransport: "on" });
  await socket.opened;

  const reader = socket.readable.getReader();
  const writer = socket.writable.getWriter();
  const decoder = new TextDecoder();
  let buffer = "";

  async function readResponse() {
    while (true) {
      const idx = buffer.indexOf("\r\n");
      if (idx !== -1) {
        const line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        if (/^\d{3} /.test(line)) {
          const code = Number(line.slice(0, 3));
          if (code >= 400) throw new Error("SMTP " + code + ": " + line.slice(4));
          return line;
        }
      }
      const { value, done } = await reader.read();
      if (done) throw new Error("SMTP connection closed unexpectedly.");
      buffer += decoder.decode(value, { stream: true });
    }
  }

  async function command(line) {
    await writer.write(new TextEncoder().encode(line + "\r\n"));
    return readResponse();
  }

  function b64(value) {
    const bytes = new TextEncoder().encode(String(value));
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  }

  try {
    await readResponse();
    await command("EHLO cookie.ai");
    await command("AUTH LOGIN");
    await command(b64(username));
    await command(b64(password));
    await command("MAIL FROM:<" + from.replace(/^.*<|>.*$/g, "") + ">");
    await command("RCPT TO:<" + to + ">");
    await writer.write(new TextEncoder().encode(
      "DATA\r\n"
    ));
    await readResponse();

    const safeSubject = subject.replace(/[\r\n]/g, " ");
    const fromHeader = from.includes("<") ? from : "Cookie <" + from + ">";
    const body =
      "From: " + fromHeader + "\r\n" +
      "To: " + to + "\r\n" +
      "Subject: " + safeSubject + "\r\n" +
      "MIME-Version: 1.0\r\n" +
      "Content-Type: multipart/alternative; boundary=\"COOKIE_BOUNDARY\"\r\n" +
      "\r\n" +
      "--COOKIE_BOUNDARY\r\n" +
      "Content-Type: text/plain; charset=UTF-8\r\n\r\n" +
      text + "\r\n\r\n" +
      "--COOKIE_BOUNDARY\r\n" +
      "Content-Type: text/html; charset=UTF-8\r\n\r\n" +
      html + "\r\n\r\n" +
      "--COOKIE_BOUNDARY--\r\n";
    const stuffed = body.split("\r\n").map(line => line.startsWith(".") ? "." + line : line).join("\r\n");
    await writer.write(new TextEncoder().encode(stuffed + "\r\n.\r\n"));
    await readResponse();
    await command("QUIT");
  } finally {
    try { writer.releaseLock(); } catch {}
    try { reader.releaseLock(); } catch {}
    try { socket.close(); } catch {}
  }
}

export function emailTemplate(title, intro, body, buttonText, url, footer) {
  return `<!doctype html><html><body style="margin:0;background:#171412;color:#f4eee8;font-family:Arial,sans-serif;padding:32px">
  <div style="max-width:560px;margin:auto;background:#211c19;border:1px solid #3a302a;padding:32px;border-radius:16px">
    <div style="font-size:24px;font-weight:700">🍪 Cookie</div>
    <h1 style="font-size:25px;margin:28px 0 10px">${title}</h1>
    <p style="color:#d0c5bd">${intro}</p>
    ${body}
    <p style="margin:28px 0"><a href="${url}" style="display:inline-block;background:#fff9f2;color:#1b1714;text-decoration:none;padding:13px 18px;border-radius:9px;font-weight:700">${buttonText}</a></p>
    <p style="font-size:12px;color:#81766f;line-height:1.5">${footer}</p>
  </div></body></html>`;
}

export { TOKEN_TTL };
