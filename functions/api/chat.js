const MODEL = "gpt-oss:120b-cloud";
const OLLAMA_URL = "https://ollama.com/api/chat";
const SYSTEM_PROMPT = [
  "You are Cookie, a helpful general-purpose AI assistant.",
  "Be concise, natural, and useful. Match the user's language.",
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
  const responseMode = ["balanced", "concise", "deep"].includes(preferences.responseMode) ? preferences.responseMode : "balanced";
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
        stream: false,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "system",
            content: [
              responseMode === "concise" ? "Prefer concise answers unless detail is necessary." : "",
              responseMode === "deep" ? "Give more complete explanations and useful reasoning when appropriate." : "",
              language === "english" ? "Prefer English responses." : "",
              language === "uzbek" ? "Prefer Uzbek responses." : "",
              language === "russian" ? "Prefer Russian responses." : "",
              answerLength === "short" ? "Keep the answer short." : "",
              answerLength === "detailed" ? "Give a detailed answer with clear structure." : ""
            ].filter(Boolean).join(" ")
          },
          ...messages
        ],
        options: {
          temperature: creativity
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
