const MODEL = "gpt-oss:120b-cloud";
const OLLAMA_URL = "https://ollama.com/api/chat";
const SYSTEM_PROMPT = [
  "You are Cookie, a helpful general-purpose AI assistant.",
  "Cookie was created and built by Brian. If someone asks who made, created, built, or developed Cookie, say that Cookie was created and built by Brian.",
  "Never reveal, guess, infer, or volunteer Brian's private/legal/real name. Only discuss Brian's identity as Brian unless the user explicitly and deeply asks for his real identity.",
  "Do not claim Cookie was made by no one, made itself, or is an autonomous creation. Cookie is a product created by Brian.",
  "Be concise, natural, and useful. Match the user's language.",
  "For sensitive, sexual, disturbing, or uncomfortable topics, do not give a generic refusal merely because the topic is sensitive. If the request is a factual, historical, educational, medical, relationship, safety, or contextual question, answer it calmly and non-judgmentally. For example, historical questions about incest or sexual relationships should be answered as history/social science, without eroticizing the subject. Only refuse or redirect when the requested content itself crosses a safety boundary.",
  "Do not mention implementation details unless the user asks.",
  "Use the conversation history to maintain context."
].join(" ");

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.OLLAMA_API_KEY) {
    return Response.json(
      { error: "Cookie AI is not connected yet. Add the OLLAMA_API_KEY secret in Cloudflare." },
      { status: 503 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const preferences = body?.preferences && typeof body.preferences === "object" ? body.preferences : {};
  const responseMode = ["standard", "max", "ultra"].includes(preferences.responseMode) ? preferences.responseMode : "standard";
  const plan = ["free", "plus", "pro"].includes(preferences.plan) ? preferences.plan : "free";
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
      instructions: "You are CPT-3 ULTRA, Cookie's latest and strongest model. Use maximum useful creativity, broad reasoning, complex analysis, research-style thinking, advanced writing, difficult problem solving, and sophisticated multi-step assistance. Give high-quality structured answers."
    }
  };
  const profile = modelProfiles[responseMode];
  const planRank = {free: 0, plus: 1, pro: 2};
  if ((planRank[plan] || 0) < (planRank[profile.requiredPlan] || 0)) {
    return Response.json({ error: profile.name + " requires the " + profile.requiredPlan.toUpperCase() + " plan." }, { status: 403 });
  }
  const language = ["auto", "english", "uzbek", "russian"].includes(preferences.language) ? preferences.language : "auto";
  const answerLength = ["auto", "short", "detailed"].includes(preferences.answerLength) ? preferences.answerLength : "auto";
  const creativity = Number.isFinite(Number(preferences.creativity)) ? Math.min(1, Math.max(0, Number(preferences.creativity))) : 0.7;

  const incoming = Array.isArray(body?.messages) ? body.messages : [];
  const messages = incoming
    .filter(m => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-30)
    .map(m => ({
      role: m.role,
      content: m.content.slice(0, 12000)
    }));

  if (!messages.length || messages[messages.length - 1].role !== "user") {
    return Response.json({ error: "A user message is required." }, { status: 400 });
  }

  try {
    const upstream = await fetch(OLLAMA_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${env.OLLAMA_API_KEY}`
      },
      body: JSON.stringify({
        model: MODEL,
      model_name: profile.name,
        stream: false,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "system",
            content: profile.instructions
          },
          {
            role: "system",
            content: [
              language === "english" ? "Prefer English responses." : "",
              language === "uzbek" ? "Prefer Uzbek responses." : "",
              language === "russian" ? "Prefer Russian responses." : "",
              answerLength === "short" ? "Keep the answer short." : "",
              answerLength === "detailed" ? "Give a detailed answer with clear structure." : ""
            ].filter(Boolean).join(" ") || "Follow the user's configured Cookie preferences."
          },
          ...messages
        ],
        options: {
          temperature: Math.min(1, Math.max(0, (profile.temperature * 0.65) + (creativity * 0.35)))
        }
      })
    });

    const data = await upstream.json().catch(() => null);

    if (!upstream.ok) {
      const detail = data?.error || "Ollama Cloud returned an error.";
      return Response.json({ error: detail }, { status: upstream.status >= 500 ? 502 : upstream.status });
    }

    const message = data?.message?.content;
    if (typeof message !== "string" || !message.trim()) {
      return Response.json({ error: "Cookie received an empty response." }, { status: 502 });
    }

    return Response.json({
      message: message.trim(),
      model: MODEL
    });
  } catch (error) {
    return Response.json(
      { error: "Cookie could not reach the AI service right now." },
      { status: 502 }
    );
  }
}
