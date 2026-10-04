import { json } from "./_lib.js";

export function onRequestGet({ env }) {
  return json({
    ok: true,
    service: "cookie-pages-function",
    ollamaConfigured: Boolean(String(env?.OLLAMA_API_KEY || "").trim()),
    aiConfigured: Boolean(String(env?.OLLAMA_API_KEY || "").trim()),
    timestamp: new Date().toISOString()
  })
}
