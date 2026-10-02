const encoder = new TextEncoder();
function bytesToB64(bytes) {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\\+/g, "-").replace(/\\//g, "_").replace(/=+$/g, "");
}
function b64ToBytes(value) {
  const s = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const padded = s + "=".repeat((4 - (s.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, ch => ch.charCodeAt(0));
}
export async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", typeof value === "string" ? encoder.encode(value) : value);
  return bytesToB64(new Uint8Array(digest));
}
export function randomToken(bytes = 32) {
  const data = new Uint8Array(bytes);
  crypto.getRandomValues(data);
  return bytesToB64(data);
}
export function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}
export function safeNext(value) {
  const next = String(value || "/").trim();
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}
export function parseCookies(request) {
  const raw = request.headers.get("Cookie") || "";
  const out = {};
  for (const part of raw.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const key = part.slice(0, i).trim();
    const value = part.slice(i + 1).trim();
    if (key) out[key] = value;
  }
  return out;
}
export function cookie(name, value, options = {}) {
  const attrs = [
    `${name}=${value || ""}`,
    `Path=${options.path || "/"}`,
    `Max-Age=${options.maxAge ?? 0}`,
    `SameSite=${options.sameSite || "Lax"}`
  ];
  if (options.httpOnly !== false) attrs.push("HttpOnly");
  if (options.secure !== false) attrs.push("Secure");
  if (options.domain) attrs.push(`Domain=${options.domain}`);
  return attrs.join("; ");
}
export function clearCookie(name) {
  return cookie(name, "", { maxAge: 0 });
}
export function withCookies(response, cookies = []) {
  const headers = new Headers(response.headers);
  for (const value of cookies) headers.append("Set-Cookie", value);
  headers.set("Cache-Control", "no-store");
  return new Response(response.body, { status: response.status, headers });
}
export function dbAvailable(env) {
  return Boolean(env?.DB && typeof env.DB.prepare === "function");
}
export function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email || "",
    emailVerified: Boolean(row.email_verified),
    name: row.name || "",
    username: row.username || "",
    avatarUrl: row.avatar_url || "",
    plan: row.plan || "free",
    credits: Number(row.credits_remaining ?? 0)
  };
}
export async function getSessionUser(request, env) {
  if (!dbAvailable(env)) return null;
  const token = parseCookies(request).__Host-cookie_session || parseCookies(request).cookie_session;
  if (!token) return null;
  const hash = await sha256(token);
  const now = Math.floor(Date.now() / 1000);
  const row = await env.DB.prepare(
    `SELECT u.id,u.email,u.email_verified,u.name,u.username,u.avatar_url,u.plan,u.credits_remaining
     FROM sessions s JOIN users u ON u.id=s.user_id
     WHERE s.token_hash=? AND s.expires_at>? LIMIT 1`
  ).bind(hash, now).first();
  return row ? { ...publicUser(row), _row: row } : null;
}
export async function createSession(env, userId, remember = true) {
  const raw = randomToken(32);
  const hash = await sha256(raw);
  const maxAge = remember ? 60 * 60 * 24 * 30 : 60 * 60 * 24;
  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare("INSERT INTO sessions (id,user_id,token_hash,created_at,expires_at) VALUES (?,?,?,?,?)")
    .bind(randomToken(16), userId, hash, now, now + maxAge).run();
  await env.DB.prepare("DELETE FROM sessions WHERE expires_at<=? OR user_id=? AND expires_at<?")
    .bind(now, userId, now - 60 * 60 * 24 * 60).run();
  return cookie("__Host-cookie_session", raw, { maxAge, sameSite: "Lax" });
}
export async function revokeSession(request, env) {
  if (!dbAvailable(env)) return clearCookie("__Host-cookie_session");
  const token = parseCookies(request).__Host-cookie_session;
  if (token) await env.DB.prepare("DELETE FROM sessions WHERE token_hash=?").bind(await sha256(token)).run();
  return clearCookie("__Host-cookie_session");
}
export async function passwordHash(password, saltB64) {
  const salt = saltB64 ? b64ToBytes(saltB64) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 600000, hash: "SHA-256" },
    key,
    256
  );
  return { hash: bytesToB64(new Uint8Array(bits)), salt: bytesToB64(salt) };
}
export async function verifyPassword(password, hash, salt) {
  const next = await passwordHash(password, salt);
  return timingSafeEqual(next.hash, hash);
}
export function timingSafeEqual(a, b) {
  const aa = encoder.encode(String(a));
  const bb = encoder.encode(String(b));
  if (aa.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < aa.length; i++) diff |= aa[i] ^ bb[i];
  return diff === 0;
}
export function usernameBase(nameOrEmail) {
  const raw = String(nameOrEmail || "cookie-user").toLowerCase();
  return raw.replace(/@.*/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24) || "cookie-user";
}
export async function uniqueUsername(env, desired) {
  const base = usernameBase(desired);
  let username = base;
  for (let i = 0; i < 20; i++) {
    const row = await env.DB.prepare("SELECT id FROM users WHERE username=? LIMIT 1").bind(username).first();
    if (!row) return username;
    username = base.slice(0, 20) + "-" + (i + 2);
  }
  return base + "-" + randomToken(3).toLowerCase().slice(0, 5);
}
export function originOf(request, env) {
  const configured = String(env?.APP_URL || "").trim().replace(/\/$/, "");
  if (configured) return configured;
  return new URL(request.url).origin;
}
