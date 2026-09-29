import { json, readJson } from "./_lib.js";

const profiles = {
  standard: {
    name: "CPT-1",
    temperature: 0.55,
    instructions: "Be clear, practical, natural, concise when the task is simple, and detailed when the task needs it."
  },
  max: {
    name: "CPT-2 MAX",
    temperature: 0.72,
    instructions: "Handle difficult reasoning, creative work, writing, planning, coding, analysis, and multi-step tasks with extra care."
  },
  ultra: {
    name: "CPT-3 ULTRA",
    temperature: 0.82,
    instructions: "Give high-quality sophisticated assistance. Break complex work into useful steps, check assumptions, and produce polished results."
  }
};

export async function onRequestPost({ request, env }) {
  try {
    const apiKey = String(env.OLLAMA_API_KEY || "").trim();
    const model = String(env.OLLAMA_MODEL || "gpt-oss:120b-cloud").trim();
    const ollamaUrl = String(env.OLLAMA_URL || "https://ollama.com/api/chat").trim();

    if (!apiKey) {
      return json({ error: "Cookie AI is not configured yet. Add OLLAMA_API_KEY in Pages secrets." }, 503);
    }

    const body = await readJson(request);
    const preferences = body?.preferences || {};
    const mode = ["standard", "max", "ultra"].includes(preferences.responseMode)
      ? preferences.responseMode
      : "standard";
    const profile = profiles[mode];

    const messages = Array.isArray(body?.messages)
      ? body.messages
          .filter(m => m && ["user", "assistant"].includes(m.role) && typeof m.content === "string")
          .slice(-32)
          .map(m => ({ role: m.role, content: m.content.slice(0, 16000) }))
      : [];

    if (!messages.length || messages.at(-1).role !== "user") {
      return json({ error: "A user message is required." }, 400);
    }

    const language = ["auto", "english", "uzbek", "russian"].includes(preferences.language)
      ? preferences.language
      : "auto";
    const length = ["auto", "short", "detailed"].includes(preferences.answerLength)
      ? preferences.answerLength
      : "auto";
    const creativity = Math.min(1, Math.max(0, Number(preferences.creativity) || 0.7));

    const system = [
      "You are Cookie, a polished general-purpose AI assistant.",
      "Be genuinely useful rather than overly enthusiastic or repetitive.",
      "Follow the user's instructions precisely and preserve important constraints.",
      "Use the conversation context. If the user asks to revise, continue, shorten, expand, translate, or change something, operate on the relevant previous content instead of starting over.",
      "For writing, prioritize natural human-sounding language, strong structure, appropriate tone, and clean wording.",
      "For coding, inspect the request carefully, provide production-quality code, preserve existing conventions when known, and explain important changes briefly.",
      "For complex tasks, reason carefully internally and give the user the useful result, assumptions, and conclusions without exposing private chain-of-thought.",
      "Do not invent facts, files, tool results, tests, or actions you did not actually perform.",
      "Use Markdown when it improves readability. Avoid unnecessary headings, filler, and repeated conclusions.",
      profile.instructions,
      language === "english" ? "Prefer English unless the user clearly requests another language." : "",
      language === "uzbek" ? "Prefer Uzbek unless the user clearly requests another language." : "",
      language === "russian" ? "Prefer Russian unless the user clearly requests another language." : "",
      length === "short" ? "Keep the response concise." : "",
      length === "detailed" ? "Give a thorough, well-structured response." : ""
    ].filter(Boolean).join("\n");

    const upstream = await fetch(ollamaUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + apiKey
      },
      body: JSON.stringify({
        model,
        stream: false,
        messages: [{ role: "system", content: system }, ...messages],
        options: {
          temperature: Math.min(1, profile.temperature * 0.65 + creativity * 0.35)
        }
      })
    });

    const responseText = await upstream.text();
    let data = null;
    try { data = responseText ? JSON.parse(responseText) : null; } catch {}
    if (!upstream.ok) {
      const upstreamMessage = typeof data?.error === "string"
        ? data.error
        : responseText?.trim()
          ? responseText.trim().slice(0, 500)
          : "No error details were returned by Ollama Cloud.";
      console.error("[Cookie Ollama]", upstream.status, upstreamMessage);
      return json(
        { error: "Ollama Cloud error (" + upstream.status + "): " + upstreamMessage },
        502
      );
    }

    const message = data?.message?.content;
    if (typeof message !== "string" || !message.trim()) {
      return json({ error: "Cookie received an empty response." }, 502);
    }

    return json({ message: message.trim(), model: profile.name });
  } catch (error) {
    console.error("[Cookie chat]", error);
    return json({ error: "Cookie could not answer right now. Check the Pages Function logs." }, 502);
  }
}
