import { json, readJson } from "./_lib.js";

function limitResponse(text) {
  const lines = String(text || "").replace(/\r/g, "").split("\n");
  const output = [];
  let inCode = false;
  let codeLines = 0;
  let normalLines = 0;

  for (const line of lines) {
    const fence = new RegExp("^\\s*" + "`" + "`" + "`");
    if (fence.test(line)) {
      if (inCode) {
        output.push(line);
        inCode = false;
        continue;
      }
      output.push(line);
      inCode = true;
      codeLines = 0;
      continue;
    }

    if (inCode) {
      if (codeLines >= 10000) continue;
      output.push(line);
      codeLines++;
    } else {
      if (normalLines >= 1000) continue;
      output.push(line);
      normalLines++;
    }
  }

  if (inCode) output.push("```");
  return output.join("\n");
}

const profiles = {
  standard: {
    name: "CPT-1",
    model: "__ENV_MODEL__",
    temperature: 0.55,
    instructions: "Be clear, practical, natural, concise when the task is simple, and detailed when the task needs it."
  },
  max: {
    name: "CPT-2 MAX",
    model: "kimi-k3:cloud",
    temperature: 0.68,
    instructions: "Handle difficult reasoning, coding, code review, architecture, debugging, creative work, planning, analysis, and multi-step engineering tasks with extra care. For code, inspect dependencies and edge cases, preserve conventions, and prefer complete production-quality solutions."
  },
  ultra: {
    name: "CPT-3 ULTRA",
    model: "glm-5.3-flash:cloud",
    temperature: 0.62,
    instructions: "Operate as Cookie's highest-capability multimodal coding and agentic profile. Analyze difficult engineering problems, large codebases, screenshots and visual interfaces carefully. Review code for correctness, security, maintainability, edge cases, and integration issues. Produce polished production-quality solutions and verify assumptions before committing to an answer."
  }
};

export async function onRequestPost({ request, env }) {
  try {
    const apiKey = String(env.OLLAMA_API_KEY || "").trim();
    let model = String(env.OLLAMA_MODEL || "gpt-oss:120b-cloud").trim();
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
    model = profile.model === "__ENV_MODEL__" ? model : profile.model;
    const attachments = Array.isArray(body?.attachments) ? body.attachments : [];
    const imageAttachments = attachments.filter(a => a && a.kind === "image" && typeof a.data === "string");
    if (imageAttachments.length && mode === "standard") model = "gemma4:cloud";

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
      "Response limits: keep ordinary non-code text to at most 1,000 lines. Code inside fenced code blocks may use up to 10,000 lines per code block when the task genuinely requires it. Prefer complete, useful code rather than shortening code unnecessarily. Do not split code into many tiny blocks just to bypass the limit.",
      profile.instructions,
      language === "english" ? "Prefer English unless the user clearly requests another language." : "",
      language === "uzbek" ? "Prefer Uzbek unless the user clearly requests another language." : "",
      language === "russian" ? "Prefer Russian unless the user clearly requests another language." : "",
      length === "short" ? "Keep the response concise." : "",
      length === "detailed" ? "Give a thorough, well-structured response." : ""
    ].filter(Boolean).join("\n");

    const imageData = imageAttachments.slice(0, 4).map(a => {
      const match = a.data.match(/^data:[^;]+;base64,(.+)$/);
      return match ? match[1] : a.data;
    });

    const apiMessages = [{ role: "system", content: system }, ...messages];
    if (imageData.length) {
      const last = apiMessages.at(-1);
      if (last?.role === "user") last.images = imageData;
    }

    const upstream = await fetch(ollamaUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + apiKey
      },
      body: JSON.stringify({
        model,
        stream: false,
        messages: apiMessages,
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

    return json({ message: limitResponse(message.trim()), model: profile.name });
  } catch (error) {
    console.error("[Cookie chat]", error);
    return json({ error: "Cookie could not answer right now. Check the Pages Function logs." }, 502);
  }
}
