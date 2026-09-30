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


const FILE_LIMITS = { maxFiles: 30, maxFileChars: 500000, maxPathChars: 240 };

const agentTools = [
  { type:"function", function:{ name:"file_create", description:"Create a downloadable file for the user. Use this whenever the user asks for code, a document, configuration, or any file they can download.", parameters:{type:"object",required:["path","content"],properties:{path:{type:"string"},content:{type:"string"}}} } },
  { type:"function", function:{ name:"file_read", description:"Read a file you created earlier in this same response before revising it.", parameters:{type:"object",required:["path"],properties:{path:{type:"string"}}} } },
  { type:"function", function:{ name:"file_update", description:"Update a file you created earlier in this same response.", parameters:{type:"object",required:["path","content"],properties:{path:{type:"string"},content:{type:"string"}}} } },
  { type:"function", function:{ name:"file_delete", description:"Delete a generated file from this response when the user asks you to remove it.", parameters:{type:"object",required:["path"],properties:{path:{type:"string"}}} } }
];

function normalizeFiles(input) {
  if (!Array.isArray(input)) return [];
  return input.filter(f => f && typeof f.path === "string" && typeof f.content === "string")
    .slice(0, FILE_LIMITS.maxFiles)
    .map(f => ({path:f.path.replace(/^\/+/, "").slice(0, FILE_LIMITS.maxPathChars), content:f.content.slice(0, FILE_LIMITS.maxFileChars), kind:"file"}))
    .filter(f => f.path && !f.path.includes(".."));
}

function executeFileTool(files, name, args) {
  const a = args && typeof args === "object" ? args : {};
  const path = String(a.path || "").replace(/^\/+/, "");
  if (name === "file_create" || name === "file_update") {
    if (!path || path.includes("..")) return {files, result:JSON.stringify({ok:false,error:"Invalid file path."})};
    if (path.length > FILE_LIMITS.maxPathChars) return {files,result:JSON.stringify({ok:false,error:"File path is too long."})};
    const content = String(a.content ?? "");
    if (content.length > FILE_LIMITS.maxFileChars) return {files,result:JSON.stringify({ok:false,error:"File is too large."})};
    const i = files.findIndex(f => f.path === path);
    if (name === "file_create" && i >= 0) return {files,result:JSON.stringify({ok:false,error:"A generated file with that path already exists. Use file_update to replace it."})};
    if (name === "file_update" && i < 0) return {files,result:JSON.stringify({ok:false,error:"File not found in this response. Use file_create first."})};
    if (i >= 0) files[i] = {path,content,kind:"file"}; else {
      if (files.length >= FILE_LIMITS.maxFiles) return {files,result:JSON.stringify({ok:false,error:"Generated file limit reached."})};
      files.push({path,content,kind:"file"});
    }
    return {files,result:JSON.stringify({ok:true,action:i>=0?"updated":"created",path,size:content.length})};
  }
  if (name === "file_read") {
    const file = files.find(f => f.path === path);
    return file ? {files,result:JSON.stringify({ok:true,path,content:file.content})} : {files,result:JSON.stringify({ok:false,error:"Generated file not found: "+path})};
  }
  if (name === "file_delete") {
    const i = files.findIndex(f => f.path === path);
    if (i < 0) return {files,result:JSON.stringify({ok:false,error:"Generated file not found: "+path})};
    files.splice(i,1);
    return {files,result:JSON.stringify({ok:true,action:"deleted",path})};
  }
  return {files,result:JSON.stringify({ok:false,error:"Unknown file tool: "+name})};
}
const profiles = {
  standard: {
    name: "CPT-1",
    model: "gemma4:cloud",
    temperature: 0.55,
    instructions: "Be clear, practical, natural, concise when the task is simple, and detailed when the task needs it."
  },
  max: {
    name: "CPT-2 MAX",
    model: "gemma4:cloud",
    temperature: 0.68,
    instructions: "Handle difficult reasoning, coding, code review, architecture, debugging, creative work, planning, analysis, and multi-step engineering tasks with extra care. For code, inspect dependencies and edge cases, preserve conventions, and prefer complete production-quality solutions."
  },
  ultra: {
    name: "CPT-3 ULTRA",
    model: "gemma4:cloud",
    temperature: 0.62,
    instructions: "Operate as Cookie's highest-capability multimodal coding and agentic profile. Analyze difficult engineering problems, large codebases, screenshots and visual interfaces carefully. Review code for correctness, security, maintainability, edge cases, and integration issues. Produce polished production-quality solutions and verify assumptions before committing to an answer."
  }
};

export async function onRequestPost({ request, env }) {
  try {
    const apiKey = String(env.OLLAMA_API_KEY || "").trim();
    let model = "gemma4:cloud";
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
    model = profile.model;
    const attachments = Array.isArray(body?.attachments) ? body.attachments.slice(0,10) : [];
    let generatedFiles = [];
    const fileAttachments = attachments.filter(a => a && a.kind === "file" && typeof a.data === "string");
    const imageAttachments = attachments.filter(a => a && a.kind === "image" && typeof a.data === "string");


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
      "Cookie is currently running in a free public preview/demo. Do not claim to be Google, Gemini, OpenAI, GPT, Kimi, GLM, or any other provider/model. If asked which model is running, say: Cookie Preview Demo is currently using its free preview model backend; model names in the UI are Cookie profiles, not claims about the underlying provider.",
      "During the preview, all Cookie model profiles are free to use. Do not tell users to buy credits or upgrade to access a Cookie profile.",
      "You have temporary file-generation tools. When the user asks you to build code, documents, configurations, or other files, create the actual files with file_create. You can use nested paths such as src/commands/ping.js; folders are implicit in file paths and are never uploaded by users. Use file_read/file_update to refine files during the same response. At the end, the created files are returned directly in the chat for one-tap download. Never claim a file was created or changed unless the file tool succeeded.",
      "You are Cookie AI, the AI assistant built into the Cookie website. Your identity is Cookie AI, not the website's hosting provider and not the underlying model provider. If a user asks who you are, identify yourself as Cookie AI and explain that you run inside the Cookie website.",
      "COOKIE PRODUCT KNOWLEDGE: The current Cookie website has a chat composer, a mobile/desktop sidebar, recent chats, Settings, Help, model profiles (CPT-1, CPT-2 MAX, CPT-3 ULTRA), conversation search, image/file attachments, downloadable generated files, and assistant-message actions.",
      "COOKIE PRODUCT KNOWLEDGE: The + attachment picker supports Camera, Photos, and Files. Camera/Photos are for images; Files are for non-image files. Users can attach at most 10 images/files per message. Folder uploads are not supported.",
      "COOKIE PRODUCT KNOWLEDGE: Cookie can analyze user-provided images/files, answer questions, explain concepts, write and rewrite content, translate, plan, reason, help with programming, debug and review code, and create downloadable files when the user asks for an artifact.",
      "COOKIE PRODUCT KNOWLEDGE: Generated files are temporary response artifacts. Cookie can use its internal file_create, file_read, file_update, and file_delete capabilities during the current response to build and refine downloadable files. These capabilities are internal and are not presented as a user-facing Tools menu.",
      "COOKIE PRODUCT KNOWLEDGE: The old Workspace/Project Files system has been removed from the website. Do not tell users that Cookie has a persistent workspace, project file browser, folder uploader, or persistent project filesystem.",
      "COOKIE PRODUCT KNOWLEDGE: The website no longer exposes a Tools button/menu in the composer. Do not instruct users to click a Tools button. When a task requires one of Cookie's internal capabilities, use it directly rather than asking the user to activate a tool.",
      "COOKIE PRODUCT KNOWLEDGE: Assistant message actions currently include Copy and a More menu with Share, Pin/Unpin, Uploaded files, Find in chat, Archive, and Delete. Some actions are session/local UI actions rather than permanent cloud features; do not imply persistence unless the system actually provides it.",
      "COOKIE PRODUCT BEHAVIOR: When the user asks for a downloadable artifact, create it directly and return it in the chat. When the user uploads files/images, use the provided content as context and be explicit if the content could not be read. When discussing Cookie's capabilities, describe only capabilities actually available in this website.",
      "COOKIE PRODUCT BEHAVIOR: Do not invent Cookie features, buttons, pages, integrations, subscriptions, workspaces, browsing abilities, external actions, or persistent storage. If a capability is not in the current product knowledge or available internal tools, say so instead of pretending it exists.",
      "COOKIE PRODUCT BEHAVIOR: You do not need to expose internal tool names or implementation details to ordinary users. Use internal file capabilities when appropriate and describe the user-facing result instead.",
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

    const readableFiles = fileAttachments.map(a => {
      const match = a.data.match(/^data:[^;]+;base64,(.+)$/);
      if (!match) return {name:a.name,content:"[Binary attachment]"};
      try {
        const text = atob(match[1]);
        const decoded = decodeURIComponent(Array.from(text).map(ch => "%" + ch.charCodeAt(0).toString(16).padStart(2,"0")).join(""));
        return {name:a.name,content:decoded.slice(0,50000)};
      } catch { return {name:a.name,content:"[Binary or non-text attachment]"}; }
    });
    const attachmentContext = readableFiles.length
      ? "\n\nUSER ATTACHED FILES:\n" + readableFiles.map(f => "\n--- " + f.name + " ---\n" + f.content).join("\n")
      : "";
    const apiMessages = [{ role: "system", content: system }, ...messages];
    if (attachmentContext) {
      const lastUser = apiMessages.at(-1);
      if (lastUser?.role === "user") lastUser.content += attachmentContext;
    }
    if (imageData.length) {
      const last = apiMessages.at(-1);
      if (last?.role === "user") last.images = imageData;
    }

    const agentMessages = apiMessages.slice();
    let finalMessage = "";
    let lastData = null;

    for (let turn = 0; turn < 10; turn++) {
      const upstream = await fetch(ollamaUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + apiKey },
        body: JSON.stringify({
          model,
          stream: false,
          messages: agentMessages,
          tools: agentTools,
          options: { temperature: Math.min(1, profile.temperature * 0.65 + creativity * 0.35) }
        })
      });

      const responseText = await upstream.text();
      let data = null;
      try { data = responseText ? JSON.parse(responseText) : null; } catch {}
      lastData = data;

      if (!upstream.ok) {
        const upstreamMessage = typeof data?.error === "string" ? data.error :
          responseText?.trim() ? responseText.trim().slice(0,500) : "No error details were returned by Ollama Cloud.";
        console.error("[Cookie Ollama]", upstream.status, upstreamMessage);
        return json({error:"Ollama Cloud error ("+upstream.status+"): "+upstreamMessage},502);
      }

      const assistantMessage = data?.message;
      if (!assistantMessage || typeof assistantMessage !== "object") return json({error:"Cookie received an invalid model response."},502);
      agentMessages.push(assistantMessage);

      const toolCalls = Array.isArray(assistantMessage.tool_calls) ? assistantMessage.tool_calls : [];
      if (!toolCalls.length) {
        finalMessage = typeof assistantMessage.content === "string" ? assistantMessage.content : "";
        break;
      }

      for (const call of toolCalls.slice(0,8)) {
        const name=call?.function?.name;
        let args=call?.function?.arguments;
        if(typeof args==="string"){try{args=JSON.parse(args)}catch{args={}}}
        const executed=executeFileTool(generatedFiles,name,args);
        generatedFiles=executed.files;
        agentMessages.push({role:"tool",tool_name:name,content:executed.result});
      }
    }

    if(!finalMessage && lastData?.message?.content) finalMessage=lastData.message.content;
    if(!finalMessage) finalMessage="I finished the file-generation operation.";

    return json({
      message: limitResponse(String(finalMessage).trim()),
      model: profile.name,
      demo: true,
      demoNotice: "Cookie is currently in free preview. All model profiles are free during the demo.",
      generatedFiles: generatedFiles.map(f=>({name:f.path.split("/").pop()||f.path,path:f.path,content:f.content,kind:f.kind||"file"}))
    });
  } catch (error) {
    console.error("[Cookie chat]", error);
    return json({ error: "Cookie could not answer right now. Check the Pages Function logs." }, 502);
  }
}
