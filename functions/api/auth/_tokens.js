import { randomToken, sha256 } from "./_auth.js";

export function verificationCode() {
  const value = crypto.getRandomValues(new Uint32Array(1))[0] % 900000;
  return String(100000 + value);
}

export async function issueEmailToken(env, { userId, email, purpose }) {
  // Repair legacy email_tokens schemas before the verification flow touches them.
  const info = await env.DB.prepare("PRAGMA table_info(email_tokens)").all();
  const existing = new Set((info.results || []).map(column => String(column.name)));
  const missing = [
    ["user_id", "TEXT"],
    ["email", "TEXT NOT NULL DEFAULT ''"],
    ["purpose", "TEXT NOT NULL DEFAULT 'signup'"],
    ["code_hash", "TEXT"],
    ["token_hash", "TEXT"],
    ["attempts", "INTEGER NOT NULL DEFAULT 0"],
    ["expires_at", "INTEGER NOT NULL DEFAULT 0"],
    ["used_at", "INTEGER"],
    ["created_at", "INTEGER NOT NULL DEFAULT 0"]
  ];
  for (const [name, definition] of missing) {
    if (!existing.has(name)) {
      await env.DB.prepare("ALTER TABLE email_tokens ADD COLUMN " + name + " " + definition).run();
    }
  }

  const code = verificationCode();
  const token = randomToken(32);
  const now = Math.floor(Date.now() / 1000);
  const recent = await env.DB.prepare(
    "SELECT created_at FROM email_tokens WHERE email=? AND purpose=? AND created_at>? ORDER BY created_at DESC LIMIT 1"
  ).bind(email, purpose, now - 60).first();
  if (recent) {
    const wait = Math.max(1, 60 - (now - Number(recent.created_at)));
    return { ok: false, rateLimited: true, retryAfter: wait };
  }
  await env.DB.prepare("DELETE FROM email_tokens WHERE expires_at<? OR used_at IS NOT NULL").bind(now).run();
  await env.DB.prepare(
    "INSERT INTO email_tokens (id,user_id,email,purpose,code_hash,token_hash,attempts,expires_at,created_at) VALUES (?,?,?,?,?,?,?,?,?)"
  ).bind(
    randomToken(16),
    userId || null,
    email,
    purpose,
    await sha256(code),
    await sha256(token),
    0,
    now + 600,
    now
  ).run();
  return { ok: true, code, token };
}
