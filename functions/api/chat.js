import { executeWebTool, researchWeb } from "./web.js";
import { getSessionUser, randomToken } from "./auth/_auth.js";
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

const fileTools = [
  { type:"function", function:{ name:"file_create", description:"Create a downloadable file for the user. Use this whenever the user asks for code, a document, configuration, or any file they can download.", parameters:{type:"object",required:["path","content"],properties:{path:{type:"string"},content:{type:"string"}}} } },
  { type:"function", function:{ name:"file_read", description:"Read a file you created earlier in this same response before revising it.", parameters:{type:"object",required:["path"],properties:{path:{type:"string"}}} } },
  { type:"function", function:{ name:"file_update", description:"Update a file you created earlier in this same response.", parameters:{type:"object",required:["path","content"],properties:{path:{type:"string"},content:{type:"string"}}} } },
  { type:"function", function:{ name:"file_delete", description:"Delete a generated file from this response when the user asks you to remove it.", parameters:{type:"object",required:["path"],properties:{path:{type:"string"}}} } }
];

const webTools = [
  { type:"function", function:{ name:"web_search", description:"Search the live web for current information. Use for recent facts, news, products, documentation, comparisons, or whenever the user explicitly asks you to research/search the web.", parameters:{type:"object",required:["query"],properties:{query:{type:"string",description:"The search query."},max_results:{type:"integer",minimum:1,maximum:8,description:"Number of search results to return."}}} } },
  { type:"function", function:{ name:"web_fetch", description:"Fetch and read a specific public webpage when a URL is provided or when a search result needs deeper inspection.", parameters:{type:"object",required:["url"],properties:{url:{type:"string",description:"The public webpage URL to fetch."}}} } }
];

const agentTools = [...fileTools];

const memoryTools = [
  { type:"function", function:{ name:"memory_search", description:"Search the user's long-term Cookie memory for relevant saved preferences, facts, or instructions.", parameters:{type:"object",properties:{query:{type:"string",description:"What to look for in memory."}}} } },
  { type:"function", function:{ name:"memory_save", description:"Save a durable user preference or fact that will be useful across future Cookie conversations. Only save information that is clearly useful and appropriate to remember.", parameters:{type:"object",required:["key","value"],properties:{key:{type:"string"},value:{type:"string"}}} } },
  { type:"function", function:{ name:"memory_delete", description:"Delete a previously saved long-term memory by key.", parameters:{type:"object",required:["key"],properties:{key:{type:"string"}}} } }
];

async function executeMemoryTool(env, userId, name, args) {
  const a=args && typeof args==="object" ? args : {};
  if (!env?.DB || !userId) return {ok:false,error:"Long-term memory is unavailable."};

  if(name==="memory_search"){
    const q=String(a.query||"").trim().slice(0,160);
    if(!q) {
      const rows=await env.DB.prepare("SELECT id,key,value,updated_at FROM memories WHERE user_id=? ORDER BY updated_at DESC LIMIT 20").bind(userId).all();
      return {ok:true,memories:rows.results||[]};
    }
    const pattern="%"+q.replace(/[%_]/g, m=>"\"+m)+"%";
    const rows=await env.DB.prepare(
      "SELECT id,key,value,updated_at FROM memories WHERE user_id=? AND (key LIKE ? ESCAPE '\\' OR value LIKE ? ESCAPE '\\') ORDER BY updated_at DESC LIMIT 20"
    ).bind(userId,pattern,pattern).all();
    return {ok:true,memories:rows.results||[]};
  }

  if(name==="memory_save"){
    const key=String(a.key||"").trim().slice(0,120);
    const value=String(a.value||"").trim().slice(0,4000);
    if(!key||!value) return {ok:false,error:"Both memory key and value are required."};
    const now=Math.floor(Date.now()/1000);
    await env.DB.prepare(
      "INSERT INTO memories (id,user_id,key,value,created_at,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(user_id,key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at"
    ).bind(randomToken(16),userId,key,value,now,now).run();
    return {ok:true,key,value};
  }

  if(name==="memory_delete"){
    const key=String(a.key||"").trim().slice(0,120);
    if(!key) return {ok:false,error:"A memory key is required."};
    await env.DB.prepare("DELETE FROM memories WHERE user_id=? AND key=?").bind(userId,key).run();
    return {ok:true,key};
  }

  return {ok:false,error:"Unknown memory tool."};
}

async function loadMemories(env,userId) {
  if(!env?.DB || !userId) return [];
  try {
    const rows=await env.DB.prepare("SELECT key,value FROM memories WHERE user_id=? ORDER BY updated_at DESC LIMIT 100").bind(userId).all();
    return rows.results||[];
  } catch {
    return [];
  }
}

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
    model: "gpt-oss:20b-cloud",
    temperature: 0.55,
    instructions: "Be clear, practical, natural, concise when the task is simple, and detailed when the task needs it.",
    thinking: false
  },
  max: {
    name: "CPT-2 MAX",
    model: "qwen3-coder:480b-cloud",
    temperature: 0.7,
    instructions: "Handle difficult reasoning, coding, code review, architecture, debugging, creative work, planning, analysis, and multi-step engineering tasks with extra care. For code, inspect dependencies and edge cases, preserve conventions, and prefer complete production-quality solutions.",
    thinking: true
  },
  ultra: {
    name: "CPT-3 ULTRA",
    model: "deepseek-v4-pro:cloud",
    temperature: 0.68,
    instructions: "Operate as Cookie's highest-capability multimodal coding and agentic profile. Analyze difficult engineering problems, large codebases, screenshots and visual interfaces carefully. Review code for correctness, security, maintainability, edge cases, and integration issues. Produce polished production-quality solutions and verify assumptions before committing to an answer.",
    thinking: true
  }
};

export async function onRequestPost({ request, env }) {
  try {
    if (!env?.DB) return json({ error:"Cookie accounts are not configured yet. Bind the D1 database as DB in Cloudflare Pages." }, 503);
    const sessionUser = await getSessionUser(request, env);
    if (!sessionUser) return json({ error:"Please sign in to use Cookie AI." }, 401);

    const credits = Number(sessionUser.credits ?? 0);
    const plan = String(sessionUser.plan || "free");
    if (plan === "free" && credits <= 0) {
      return json({ error:"Your free Cookie credits are used up. Add a paid plan before continuing." }, 402);
    }

    // Cookie runs directly on Ollama Cloud. OpenRouter is intentionally not used.
    const provider = "ollama";
    const apiKey = String(env.OLLAMA_API_KEY || "").trim();
    let model = "gpt-oss:20b-cloud";
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

    const supportedLanguages = ["auto","en","uz","ru","tr","kk","ky","tg","ar","fa","hi","ur","zh","ja","ko","es","fr","de","it","pt","id"];
    const language = supportedLanguages.includes(preferences.language) ? preferences.language : "auto";
    const length = ["auto", "short", "detailed"].includes(preferences.answerLength)
      ? preferences.answerLength
      : "auto";
    const creativity = Math.min(1, Math.max(0, Number(preferences.creativity) || 0.7));
    const personalityNames = ["Balanced","Friendly","Professional","Concise","Creative","Teacher"];
    const personality = personalityNames.includes(preferences.personality) ? preferences.personality : "Balanced";
    const profileUsername = String(sessionUser.username || "").slice(0,80);
    const profileEmail = String(sessionUser.email || "").slice(0,160);
    const memoryEnabled = preferences.memory !== false;
    const persistentMemories = memoryEnabled ? await loadMemories(env, sessionUser.id) : [];
    const reasoning = ["auto","fast","deep"].includes(preferences.reasoning) ? preferences.reasoning : "auto";
    const customInstructions = typeof preferences.instructions === "string" ? preferences.instructions.slice(0,6000).trim() : "";
    const useWebSearch = preferences.webSearch === true;
    const requestedWebQuery = String(messages.at(-1)?.content || "").trim();

    const system = [
      "Cookie is Cookie AI, an account-based AI assistant. Users can sign in with email/password or Google, GitHub, and Discord OAuth. Email accounts must verify ownership through a time-limited code or secure link.",
      "Cookie supports persistent signed-in chat history, long-term memory, persistent project workspaces, live web research, file generation, image/file attachments, and internal tools. Describe only functionality actually available in this deployment.",
      "Cookie is currently running in a free public preview/demo. Do not claim to be Google, Gemini, OpenAI, GPT, Kimi, GLM, or any other provider/model. If asked which model is running, say: Cookie Preview Demo is currently using its free preview model backend; model names in the UI are Cookie profiles, not claims about the underlying provider.",
      "During the preview, all Cookie model profiles are free to use. Do not tell users to buy credits or upgrade to access a Cookie profile.",
      "You have temporary file-generation tools. When the user asks you to build code, documents, configurations, or other files, create the actual files with file_create. You can use nested paths such as src/commands/ping.js; folders are implicit in file paths and are never uploaded by users. Use file_read/file_update to refine files during the same response. At the end, the created files are returned directly in the chat for one-tap download. Never claim a file was created or changed unless the file tool succeeded.",
      "You are Cookie AI, the AI assistant built into the Cookie website. Your identity is Cookie AI, not the website's hosting provider and not the underlying model provider. If a user asks who you are, identify yourself as Cookie AI and explain that you run inside the Cookie website.",
      "COOKIE PRODUCT KNOWLEDGE: The current Cookie website has a chat composer, a mobile/desktop sidebar, recent chats, Settings, Help, model profiles (CPT-1, CPT-2 MAX, CPT-3 ULTRA), conversation search, persistent account-backed chat history, long-term memory, persistent Projects, live web research, image/file attachments, downloadable generated files, a Tools menu, and assistant-message actions.",
      "COOKIE PRODUCT KNOWLEDGE: The + attachment picker supports Camera, Photos, and Files. Camera/Photos are for images; Files are for non-image files. Users can attach at most 10 images/files per message. Folder uploads are not supported.",
      "COOKIE PRODUCT KNOWLEDGE: Cookie can analyze user-provided images/files, answer questions, explain concepts, write and rewrite content, translate, plan, reason, help with programming, debug and review code, and create downloadable files when the user asks for an artifact.",
      "COOKIE PRODUCT KNOWLEDGE: Generated files are temporary response artifacts. Cookie can use its internal file_create, file_read, file_update, and file_delete capabilities during the current response to build and refine downloadable files. These capabilities are internal and are not presented as a user-facing Tools menu.",
      "COOKIE PRODUCT KNOWLEDGE: Cookie Projects are persistent account-backed workspaces. Users can create projects, keep project descriptions, and store text files under project paths. Do not claim that temporary generated response files automatically become project files.",
      "COOKIE PRODUCT KNOWLEDGE: The website no longer exposes a Tools button/menu in the composer. Do not instruct users to click a Tools button. When a task requires one of Cookie's internal capabilities, use it directly rather than asking the user to activate a tool.",
      "COOKIE PRODUCT KNOWLEDGE: Assistant message actions currently include Copy and a More menu with Share, Pin/Unpin, Uploaded files, Find in chat, Archive, and Delete. Some actions are session/local UI actions rather than permanent cloud features; do not imply persistence unless the system actually provides it.",
      "COOKIE PRODUCT BEHAVIOR: When the user asks for a downloadable artifact, create it directly and return it in the chat. When the user uploads files/images, use the provided content as context and be explicit if the content could not be read. When discussing Cookie's capabilities, describe only capabilities actually available in this website.",
      "COOKIE PRODUCT BEHAVIOR: Do not invent Cookie features or integrations. For capabilities that require configuration (OAuth, email, paid plans, image generation), state the relevant configuration requirement rather than pretending it is active.",
      "COOKIE PRODUCT BEHAVIOR: You do not need to expose internal tool names or implementation details to ordinary users. Use internal file capabilities when appropriate and describe the user-facing result instead.",
      `USER PREFERENCES: Respond with the selected Cookie personality: ${personality}. Balanced = natural and adaptable; Friendly = warm and conversational; Professional = clear and formal; Concise = short and direct; Creative = imaginative and expressive; Teacher = step-by-step and educational.`,
      customInstructions ? `CUSTOM INSTRUCTIONS: ${customInstructions}` : "",
      useWebSearch ? "WEB RESEARCH: Live web search and page fetching are enabled for this message. Use them when the user asks for current information, research, sources, recent facts, or when browsing materially improves accuracy. When you use web research, cite useful sources inline as Markdown links using the returned URLs. Do not claim you browsed unless a web tool actually returned results." : "WEB RESEARCH: Live web research is disabled for this message. Do not claim to have searched the web.",
      memoryEnabled ? "LONG-TERM USER MEMORY: You have access to the user's persistent memory. Use it only when relevant. Do not expose the complete memory store. Save only stable preferences or helpful facts when the user clearly asks you to remember something or when a durable preference is obvious and appropriate." : "LONG-TERM USER MEMORY: Memory is disabled for this message.",
      persistentMemories.length ? "CURRENT SAVED MEMORY:\n" + persistentMemories.map(m => "- " + m.key + ": " + m.value).join("\n") : ""
      profileUsername ? `USER PROFILE: The user's Cookie username is "${profileUsername}". Use it naturally when useful; do not reveal private profile data unless relevant.` : "",
      profileEmail ? "USER PROFILE: An email address is saved for the Cookie account interface. Do not expose or repeat it unless the user explicitly asks." : "",
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
      language === "en" ? "Prefer English unless the user clearly requests another language." : "",
      language === "uz" ? "Prefer Uzbek unless the user clearly requests another language." : "",
      language === "ru" ? "Prefer Russian unless the user clearly requests another language." : "",
      language === "tr" ? "Prefer Turkish unless the user clearly requests another language." : "",
      language === "kk" ? "Prefer Kazakh unless the user clearly requests another language." : "",
      language === "ky" ? "Prefer Kyrgyz unless the user clearly requests another language." : "",
      language === "tg" ? "Prefer Tajik unless the user clearly requests another language." : "",
      language === "ar" ? "Prefer Arabic unless the user clearly requests another language." : "",
      language === "fa" ? "Prefer Persian unless the user clearly requests another language." : "",
      language === "hi" ? "Prefer Hindi unless the user clearly requests another language." : "",
      language === "ur" ? "Prefer Urdu unless the user clearly requests another language." : "",
      language === "zh" ? "Prefer Chinese unless the user clearly requests another language." : "",
      language === "ja" ? "Prefer Japanese unless the user clearly requests another language." : "",
      language === "ko" ? "Prefer Korean unless the user clearly requests another language." : "",
      language === "es" ? "Prefer Spanish unless the user clearly requests another language." : "",
      language === "fr" ? "Prefer French unless the user clearly requests another language." : "",
      language === "de" ? "Prefer German unless the user clearly requests another language." : "",
      language === "it" ? "Prefer Italian unless the user clearly requests another language." : "",
      language === "pt" ? "Prefer Portuguese unless the user clearly requests another language." : "",
      language === "id" ? "Prefer Indonesian unless the user clearly requests another language." : "",
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
    const modelFallbacks = [
      "deepseek-v4-pro:cloud",
      "qwen3-coder:480b-cloud",
      "minimax-m3:cloud",
      "gpt-oss:120b-cloud"
    ];

    // When web search is enabled, research public pages directly. This does not
    // depend on the Ollama API key, so OpenRouter deployments work correctly too.
    if (useWebSearch && requestedWebQuery) {
      const directWeb = await researchWeb(requestedWebQuery, apiKey);
      if (directWeb?.ok && (directWeb.content || directWeb.pages?.length || directWeb.results?.length)) {
        let webContext = "";
        if (Array.isArray(directWeb.pages)) {
          webContext = directWeb.pages.map((r, i) =>
            "[Source " + (i + 1) + "] " + (r.title || "Web page") + "\nURL: " + r.url + "\nContent: " + (r.content || "")
          ).join("\n\n");
        } else if (Array.isArray(directWeb.results)) {
          webContext = directWeb.results.map((r, i) =>
            "[Source " + (i + 1) + "] " + (r.title || "Web result") + "\nURL: " + r.url + "\nContent: " + (r.content || "")
          ).join("\n\n");
        }
        agentMessages.push({
          role:"system",
          content:"MANDATORY LIVE WEB RESEARCH RESULTS FOR THIS USER MESSAGE:\n"+webContext+"\n\nUse these actual live results to answer the user. Do not claim anything not supported by the supplied pages. When useful, include source URLs as Markdown links. Do not create files unless the user explicitly asks for a downloadable file or code artifact."
        });
      } else {
        agentMessages.push({
          role:"system",
          content:"LIVE WEB RESEARCH FAILED. Do not pretend that browsing succeeded. Tell the user live web access failed and include this diagnostic: "+String(directWeb?.error||"no usable public page response")
        });
      }
    }
    const availableTools = [
      ...fileTools,
      ...(useWebSearch ? webTools : []),
      ...(memoryEnabled ? memoryTools : [])
    ];
    const think = mode === "standard" || reasoning === "fast" ? false : true;
    let finalMessage = "";
    let lastData = null;

    for (let turn = 0; turn < 12; turn++) {
      let upstream = null;
      let responseText = "";
      let data = null;
      let successfulModel = model;

      for (const candidate of [model, ...modelFallbacks.filter(x => x !== model)]) {
        try {
          const requestBody = {
            model: candidate,
            stream: false,
            messages: agentMessages,
            tools: availableTools,
            think,
            options: {
              temperature: Math.min(1, profile.temperature * 0.65 + creativity * 0.35),
              top_p:0.95,
              top_k:64,
              num_ctx:64000
            }
          };

          upstream = await fetch(ollamaUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": "Bearer " + apiKey
            },
            body: JSON.stringify(requestBody)
          });
          responseText = await upstream.text();
          try { data = responseText ? JSON.parse(responseText) : null; } catch { data = null; }

          if (upstream.ok) {
            successfulModel = candidate;
            break;
          }

          console.error("[Cookie "+provider+" "+candidate+"]", upstream.status, data?.error || responseText?.slice(0,300));
        } catch (error) {
          console.error("[Cookie "+provider+" fetch]", error);
        }
      }

      if (!upstream?.ok) {
        return json({
          error: "Cookie could not reach Ollama Cloud. Check OLLAMA_API_KEY, Ollama Cloud availability, and the selected cloud model."
        }, 502);
      }

      model = successfulModel;
      lastData = data;

      const assistantMessage = data?.message;
      if (!assistantMessage || typeof assistantMessage !== "object") {
        return json({error:"Cookie received an invalid model response."},502);
      }
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
        let executed;
        if(name === "web_search" || name === "web_fetch") {
          const webResult = await executeWebTool(name,args,apiKey);
          executed = {files:generatedFiles,result:JSON.stringify(webResult)};
        } else if(name === "memory_search" || name === "memory_save" || name === "memory_delete") {
          executed = {files:generatedFiles,result:JSON.stringify(await executeMemoryTool(env, sessionUser.id, name, args))};
        } else {
          executed=executeFileTool(generatedFiles,name,args);
        }
        generatedFiles=executed.files;
        agentMessages.push({
          role:"tool",
          tool_name:name,
          content:executed.result
        });
      }
    }

    if(!finalMessage && lastData?.message?.content) finalMessage=lastData.message.content;
    if(!finalMessage) finalMessage = useWebSearch
      ? "I couldn't produce a web-researched answer. The search request did not return a usable response."
      : "I couldn't produce a response. Please try again.";

    if (plan === "free") {
      try {
        await env.DB.batch([
          env.DB.prepare("UPDATE users SET credits_remaining=MAX(credits_remaining-1,0),updated_at=? WHERE id=?").bind(Math.floor(Date.now()/1000), sessionUser.id),
          env.DB.prepare("INSERT INTO usage_events (id,user_id,kind,model,units,created_at) VALUES (?,?,?,?,?,?)").bind(randomToken(16),sessionUser.id,"chat",model,1,Math.floor(Date.now()/1000))
        ]);
      } catch (creditError) {
        console.error("[Cookie credit accounting]", creditError);
      }
    }

    return json({
      message: limitResponse(String(finalMessage).trim()),
      model: profile.name,
      demo: true,
      demoNotice: "Cookie is currently in free preview. All model profiles are free during the demo.",
      generatedFiles: generatedFiles.map(f=>({name:f.path.split("/").pop()||f.path,path:f.path,content:f.content,kind:f.kind||"file"})),
      creditsRemaining: plan === "free" ? Math.max(0, credits - 1) : null
    });
  } catch (error) {
    console.error("[Cookie chat]", error);
    return json({ error: "Cookie could not answer right now. Check the Pages Function logs." }, 502);
  }
}
