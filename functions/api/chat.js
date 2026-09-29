import { json, readJson } from "./_lib.js";

const SUPABASE_URL = "https://imnsdbqricehgncpobda.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_0mQKl_lds4N017Zhcn8JfQ_PwmTCvRi";

async function getSupabaseUser(request) {
  const authorization = request.headers.get("Authorization") || "";
  if (!/^Bearer\\s+\\S+$/i.test(authorization)) return null;
  const response = await fetch(SUPABASE_URL + "/auth/v1/user", {
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: authorization
    }
  });
  if (!response.ok) return null;
  return await response.json().catch(() => null);
}

async function getPlan(userId, accessToken) {
  const response = await fetch(SUPABASE_URL + "/rest/v1/profiles?id=eq." + encodeURIComponent(userId) + "&select=plan&limit=1", {
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: "Bearer " + accessToken
    }
  });
  if (!response.ok) return "free";
  const rows = await response.json().catch(() => []);
  return rows?.[0]?.plan || "free";
}

const profiles = {
  standard: {
    name: "CPT-1",
    required: "free",
    temperature: 0.45,
    instructions: "You are CPT-1, Cookie's free everyday model. Be clear, practical, natural, and useful."
  },
  max: {
    name: "CPT-2 MAX",
    required: "plus",
    temperature: 0.75,
    instructions: "You are CPT-2 MAX, Cookie's advanced Plus model. Handle creative work, deep analysis, difficult writing, planning, brainstorming, and complex tasks."
  },
  ultra: {
    name: "CPT-3 ULTRA",
    required: "pro",
    temperature: 0.9,
    instructions: "You are CPT-3 ULTRA, Cookie's strongest model. Give sophisticated reasoning, advanced writing, complex analysis, research-style thinking, and multi-step assistance."
  }
};
const rank = { free: 0, plus: 1, pro: 2 };

export async function onRequestPost({ request, env }) {
  try {
    const authorization = request.headers.get("Authorization") || "";
    const user = await getSupabaseUser(request);
    if (!user) return json({ error: "Please sign in to use Cookie." }, 401);
    const accessToken = authorization.replace(/^Bearer\\s+/i, "");
    const userPlan = await getPlan(user.id, accessToken);

    if (!env.OLLAMA_API_KEY) {
      return json({ error: "Cookie AI is not configured yet. Add OLLAMA_API_KEY in Pages secrets." }, 503);
    }

    const body = await readJson(request);
    const preferences = body?.preferences || {};
    const mode = ["standard","max","ultra"].includes(preferences.responseMode) ? preferences.responseMode : "standard";
    const profile = profiles[mode];
    const plan = userPlan || "free";

    if ((rank[plan] || 0) < (rank[profile.required] || 0)) {
      return json({ error: profile.name + " requires the " + profile.required.toUpperCase() + " plan." }, 403);
    }

    const messages = Array.isArray(body?.messages)
      ? body.messages.filter(m => m && ["user","assistant"].includes(m.role) && typeof m.content === "string")
          .slice(-24).map(m => ({ role: m.role, content: m.content.slice(0, 12000) }))
      : [];

    if (!messages.length || messages.at(-1).role !== "user") {
      return json({ error: "A user message is required." }, 400);
    }

    const language = ["auto","english","uzbek","russian"].includes(preferences.language) ? preferences.language : "auto";
    const length = ["auto","short","detailed"].includes(preferences.answerLength) ? preferences.answerLength : "auto";
    const creativity = Math.min(1, Math.max(0, Number(preferences.creativity) || 0.7));

    const system = [
      "You are Cookie, a helpful general-purpose AI assistant.",
      "Cookie was created and built by Brian. If asked who made Cookie, say Brian.",
      "Never reveal, guess, infer, or volunteer Brian's private/legal/real name unless a trusted server setting explicitly allows it.",
      "Match the user's language and be natural.",
      "Do not claim Cookie is autonomous or made itself.",
      language === "english" ? "Prefer English." : "",
      language === "uzbek" ? "Prefer Uzbek." : "",
      language === "russian" ? "Prefer Russian." : "",
      length === "short" ? "Keep answers concise." : "",
      length === "detailed" ? "Give detailed, structured answers." : "",
      profile.instructions
    ].filter(Boolean).join(" ");

    const upstream = await fetch(env.OLLAMA_URL || "https://ollama.com/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + env.OLLAMA_API_KEY },
      body: JSON.stringify({
        model: env.OLLAMA_MODEL || "gpt-oss:120b-cloud",
        stream: false,
        messages: [{ role: "system", content: system }, ...messages],
        options: { temperature: Math.min(1, profile.temperature * 0.65 + creativity * 0.35) }
      })
    });

    const data = await upstream.json().catch(() => null);
    if (!upstream.ok) return json({ error: data?.error || "Ollama Cloud returned an error." }, upstream.status >= 500 ? 502 : upstream.status);

    const message = data?.message?.content;
    if (typeof message !== "string" || !message.trim()) return json({ error: "Cookie received an empty response." }, 502);

    return json({ message: message.trim(), model: profile.name });
  } catch (error) {
    console.error("[Cookie chat]", error);
    return json({ error: "Cookie could not answer right now. Check the Pages Function logs." }, 502);
  }
}
