import { dbAvailable, getSessionUser, randomToken } from "./auth/_auth.js";
import { json, readJson } from "./_lib.js";

const MAX_ITEMS = 120;
const MAX_TITLE = 180;
const MAX_CONTENT = 30000;
const MAX_URL = 4000;

async function auth(request, env) {
  if (!dbAvailable(env)) return { error: json({ error: "Cookie database is not connected." }, 503) };
  const user = await getSessionUser(request, env);
  return user ? { user } : { error: json({ error: "Authentication required." }, 401) };
}

function clean(v, max) {
  return String(v ?? "").trim().slice(0, max);
}

export async function onRequestGet({ request, env }) {
  const a = auth(request, env);
  const result = await a;
  if (result.error) return result.error;
  const rows = await env.DB.prepare(
    "SELECT id,kind,title,content,url,chat_id,created_at FROM saved_items WHERE user_id=? ORDER BY created_at DESC LIMIT ?"
  ).bind(result.user.id, MAX_ITEMS).all();
  return json({
    items: (rows.results || []).map(row => ({
      id: String(row.id),
      kind: String(row.kind || "message"),
      title: String(row.title || ""),
      content: String(row.content || ""),
      url: String(row.url || ""),
      chatId: row.chat_id ? String(row.chat_id) : "",
      createdAt: Number(row.created_at || 0)
    }))
  });
}

export async function onRequestPost({ request, env }) {
  const a = auth(request, env);
  const result = await a;
  if (result.error) return result.error;
  const body = await readJson(request);
  const kind = clean(body?.kind || "message", 30);
  const title = clean(body?.title || "Saved in Cookie", MAX_TITLE);
  const content = clean(body?.content || "", MAX_CONTENT);
  const url = clean(body?.url || "", MAX_URL);
  const chatId = clean(body?.chatId || "", 120);
  if (!content && !url) return json({ error: "Saved content is required." }, 400);

  const id = randomToken(18);
  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare(
    "INSERT INTO saved_items (id,user_id,kind,title,content,url,chat_id,created_at) VALUES (?,?,?,?,?,?,?,?)"
  ).bind(id, result.user.id, kind, title, content, url, chatId || null, now).run();

  return json({
    ok: true,
    item: { id, kind, title, content, url, chatId, createdAt: now }
  });
}

export async function onRequestDelete({ request, env }) {
  const a = auth(request, env);
  const result = await a;
  if (result.error) return result.error;
  const body = await readJson(request);
  const url = new URL(request.url);
  const id = clean(body?.id || url.searchParams.get("id") || "", 120);
  if (!id) return json({ error: "Saved item id is required." }, 400);
  await env.DB.prepare("DELETE FROM saved_items WHERE id=? AND user_id=?").bind(id, result.user.id).run();
  return json({ ok: true });
}
