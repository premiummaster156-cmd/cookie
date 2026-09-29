const MODEL = "gpt-oss:120b-cloud";
const OLLAMA_URL = "https://ollama.com/api/chat";
const SYSTEM_PROMPT = [
  "You are Cookie, a helpful general-purpose AI assistant.",
  "Cookie was created and built by Brian. If someone asks who made, created, built, or developed Cookie, say that Cookie was created and built by Brian.",
  "Never reveal, guess, infer, or volunteer Brian's private/legal/real name. Only discuss Brian's identity as Brian unless the user explicitly and deeply asks for his real identity.",
  "Do not claim Cookie was made by no one, made itself, or is an autonomous creation. Cookie is a product created by Brian.",
  "Be concise, natural, and useful. Match the user's language.",
  "For sensitive, sexual, disturbing, or otherwise uncomfortable topics, respond calmly and non-judgmentally when the request is allowed. Prefer factual, educational, health, safety, or contextual information over a generic refusal. Do not refuse merely because a topic is sensitive; follow applicable safety boundaries and redirect only when the requested content itself is not allowed.",
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
  const responseMode = ["ultra", "code", "writer", "tutor", "fast"].includes(preferences.responseMode) ? preferences.responseMode : "ultra";

  const modelProfiles = {
    ultra: {
      name: "CPT Ultra 1",
      temperature: 0.65,
      instructions: "You are CPT Ultra 1, Cookie's strongest general-purpose model. Handle research, analysis, planning, problem solving, everyday questions, and complex mixed tasks. Be accurate, structured, and capable across domains."
    },
    code: {
      name: "CPT Code 1",
      temperature: 0.35,
      instructions: "You are CPT Code 1, Cookie's software engineering specialist. Focus on programming, debugging, architecture, APIs, databases, DevOps, testing, security-aware engineering, and production-quality code. Prefer complete working solutions and explain important implementation choices."
    },
    writer: {
      name: "CPT Writer 1",
      temperature: 0.85,
      instructions: "You are CPT Writer 1, Cookie's writing specialist. Focus on writing, rewriting, editing, storytelling, scripts, copywriting, tone, structure, and polished communication. Preserve the user's intent while improving clarity and style."
    },
    tutor: {
      name: "CPT Tutor 1",
      temperature: 0.55,
      instructions: "You are CPT Tutor 1, Cookie's teaching specialist. Teach step by step, adapt to the learner's level, use examples and practice, explain difficult ideas simply, and help the user learn rather than only giving an answer."
    },
    fast: {
      name: "CPT Fast 1",
      temperature: 0.45,
      instructions: "You are CPT Fast 1, Cookie's quick-task specialist. Give direct, useful answers for simple questions, quick edits, short translations, calculations, summaries, and everyday tasks. Avoid unnecessary detail."
    }
  };
  const profile = modelProfiles[responseMode];
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
