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
async function executeWebTool(name, args, apiKey) {
  const a = args && typeof args === "object" ? args : {};
  const endpoint = name === "web_search" ? "https://ollama.com/api/web_search" : "https://ollama.com/api/web_fetch";
  const payload = name === "web_search"
    ? { query:String(a.query || "").slice(0,500), max_results:Math.min(8,Math.max(1,Number(a.max_results)||5)) }
    : { url:String(a.url || "").slice(0,2000) };
  if (!payload.query && name === "web_search") return {ok:false,error:"A search query is required."};
  if (!payload.url && name === "web_fetch") return {ok:false,error:"A URL is required."};
  try {
    const r = await fetch(endpoint, {
      method:"POST",
      headers:{"Content-Type":"application/json","Authorization":"Bearer "+apiKey},
      body:JSON.stringify(payload)
    });
    const raw = await r.text();
    let data = null;
    try { data = raw ? JSON.parse(raw) : null; } catch {}
    if (!r.ok) return {ok:false,error:data?.error || raw?.slice(0,500) || ("Web API returned "+r.status)};
    if (name === "web_search") {
      const results = Array.isArray(data?.results) ? data.results.slice(0,8).map(x=>({
        title:String(x?.title||"").slice(0,300),
        url:String(x?.url||""),
        content:String(x?.content||"").slice(0,7000)
      })) : [];
      if (!results.length) {
        return {
          ok:false,
          error:"Ollama web search returned no results. The web-search service may be unavailable or the API quota may be exhausted."
        };
      }
      return {ok:true,results};
    }
    const content = String(data?.content || "").slice(0,16000);
    if (!content && name === "web_fetch") {
      return {ok:false,error:"The webpage fetch returned no readable page content."};
    }
    return {ok:true,title:String(data?.title||""),content,links:Array.isArray(data?.links)?data.links.slice(0,40):[]};
  } catch (error) {
    return {ok:false,error:String(error?.message||"Web request failed")};
  }
}

const profiles = {
  standard: {
    name: "CPT-1",
    model: "deepseek/deepseek-v4-flash-0731:free",
    temperature: 0.55,
    instructions: "Be clear, practical, natural, concise when the task is simple, and detailed when the task needs it.",
    thinking: false
  },
  max: {
    name: "CPT-2 MAX",
    model: "moonshotai/kimi-k2:free",
    temperature: 0.7,
    instructions: "Handle difficult reasoning, coding, code review, architecture, debugging, creative work, planning, analysis, and multi-step engineering tasks with extra care. For code, inspect dependencies and edge cases, preserve conventions, and prefer complete production-quality solutions.",
    thinking: true
  },
  ultra: {
    name: "CPT-3 ULTRA",
    model: "nvidia/nemotron-3-ultra-550b-a55b:free",
    temperature: 0.68,
    instructions: "Operate as Cookie's highest-capability multimodal coding and agentic profile. Analyze difficult engineering problems, large codebases, screenshots and visual interfaces carefully. Review code for correctness, security, maintainability, edge cases, and integration issues. Produce polished production-quality solutions and verify assumptions before committing to an answer.",
    thinking: true
  }
};

export async function onRequestPost({ request, env }) {
  try {
    const openRouterKey = String(env.OPENROUTER_API_KEY || "").trim();
    const ollamaKey = String(env.OLLAMA_API_KEY || "").trim();
    const provider = openRouterKey ? "openrouter" : "ollama";
    const apiKey = openRouterKey || ollamaKey;
    let model = "deepseek/deepseek-v4-flash-0731:free";
    const ollamaUrl = String(env.OLLAMA_URL || "https://ollama.com/api/chat").trim();
    const openRouterUrl = String(env.OPENROUTER_URL || "https://openrouter.ai/api/v1/chat/completions").trim();

    if (!apiKey) {
      return json({ error: "Cookie AI is not configured yet. Add OPENROUTER_API_KEY in Pages secrets." }, 503);
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
    const profileUsername = typeof preferences.profile?.username === "string" ? preferences.profile.username.slice(0,80) : "";
    const profileEmail = typeof preferences.profile?.email === "string" ? preferences.profile.email.slice(0,160) : "";
    const reasoning = ["auto","fast","deep"].includes(preferences.reasoning) ? preferences.reasoning : "auto";
    const customInstructions = typeof preferences.instructions === "string" ? preferences.instructions.slice(0,6000).trim() : "";
    const useWebSearch = preferences.webSearch === true;
    const requestedWebQuery = String(messages.at(-1)?.content || "").trim();

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
      `USER PREFERENCES: Respond with the selected Cookie personality: ${personality}. Balanced = natural and adaptable; Friendly = warm and conversational; Professional = clear and formal; Concise = short and direct; Creative = imaginative and expressive; Teacher = step-by-step and educational.`,
      customInstructions ? `CUSTOM INSTRUCTIONS: ${customInstructions}` : "",
      useWebSearch ? "WEB RESEARCH: Live web search and page fetching are enabled for this message. Use them when the user asks for current information, research, sources, recent facts, or when browsing materially improves accuracy. When you use web research, cite useful sources inline as Markdown links using the returned URLs. Do not claim you browsed unless a web tool actually returned results." : "WEB RESEARCH: Live web research is disabled for this message. Do not claim to have searched the web.",
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
    const modelFallbacks = provider === "openrouter"
      ? [
          "nvidia/nemotron-3-ultra-550b-a55b:free",
          "deepseek/deepseek-v4-flash-0731:free",
          "moonshotai/kimi-k2:free"
        ]
      : [model];

    // When web search is enabled, perform real server-side research before asking
    // the model to answer. For a domain/site name, fetch the actual site first.
    if (useWebSearch && requestedWebQuery) {
      const domainMatch = requestedWebQuery.match(/(?:https?:\/\/)?(?:www\.)?([a-z0-9-]+(?:\.[a-z0-9-]+)+)(?:[\/?#][^\s]*)?/i);
      let directWeb = null;

      if (domainMatch) {
        directWeb = await executeWebTool("web_fetch", {
          url: "https://" + domainMatch[1]
        }, apiKey);
      }

      // Normal research questions use the real Ollama web-search API.
      // If a direct page fetch failed, search is also attempted as a fallback.
      if (domainMatch || !directWeb?.ok) {
        directWeb = await executeWebTool("web_search", {
          query: domainMatch ? "site:" + domainMatch[1] : requestedWebQuery.slice(0, 500),
          max_results: 8
        }, apiKey);
      }

      if (directWeb?.ok && (directWeb.content || (Array.isArray(directWeb.results) && directWeb.results.length))) {
        let webContext = "";
        if (Array.isArray(directWeb.results)) {
          webContext = directWeb.results.map((r, i) =>
            `[Source ${i + 1}] ${r.title}\nURL: ${r.url}\nContent: ${r.content}`
          ).join("\n\n");
        } else {
          webContext =
            `[Fetched page] ${directWeb.title || "Web page"}\n` +
            `URL: ${domainMatch ? "https://" + domainMatch[1] : requestedWebQuery}\n` +
            `Content: ${directWeb.content || ""}\n` +
            (directWeb.links?.length ? `Links: ${directWeb.links.join(", ")}` : "");
        }

        agentMessages.push({
          role: "system",
          content:
            "MANDATORY LIVE WEB RESEARCH RESULTS FOR THIS USER MESSAGE:\n" +
            webContext +
            "\n\nUse these actual live results to answer the user. " +
            "Do not say you cannot browse. Do not claim anything not supported by the supplied page/search results. " +
            "When useful, include the source URL as a Markdown link. " +
            "Do not create files unless the user explicitly asks for a downloadable file or code artifact."
        });
      } else {
        agentMessages.push({
          role: "system",
          content:
            "LIVE WEB RESEARCH FAILED. The server attempted a real web request but received no usable result. " +
            "Do not pretend that browsing succeeded. Tell the user live web access failed and include this diagnostic: " +
            String(directWeb?.error || "no usable response from the web provider")
        });
      }
    }

    const availableTools = useWebSearch ? [...fileTools, ...webTools] : fileTools;
    const think = reasoning === "deep" ? (mode === "ultra" ? "high" : true) : reasoning === "fast" ? false : (mode === "ultra" ? "high" : mode === "max" ? "medium" : false);
    let finalMessage = "";
    let lastData = null;

    for (let turn = 0; turn < 12; turn++) {
      let upstream = null;
      let responseText = "";
      let data = null;
      let successfulModel = model;

      for (const candidate of [model, ...modelFallbacks.filter(x => x !== model)]) {
        try {
          const requestBody = provider === "openrouter"
            ? {
                model: candidate,
                messages: agentMessages,
                tools: availableTools,
                temperature: Math.min(1, profile.temperature * 0.65 + creativity * 0.35),
                top_p: 0.95,
                max_tokens: 65536
              }
            : {
                model: candidate,
                stream: false,
                messages: agentMessages,
                tools: availableTools,
                think,
                truncate: true,
                shift: true,
                options: { temperature: Math.min(1, profile.temperature * 0.65 + creativity * 0.35), top_p:0.95, top_k:64, num_ctx:32000 }
              };

          upstream = await fetch(provider === "openrouter" ? openRouterUrl : ollamaUrl, {
            method: "POST",
            headers: provider === "openrouter"
              ? {
                  "Content-Type": "application/json",
                  "Authorization": "Bearer " + apiKey,
                  "HTTP-Referer": "https://cookie.pages.dev",
                  "X-Title": "Cookie AI"
                }
              : { "Content-Type": "application/json", "Authorization": "Bearer " + apiKey },
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
          error: provider === "openrouter"
            ? "Cookie could not reach any configured free AI model. Check OPENROUTER_API_KEY or OpenRouter availability."
            : "Cookie could not reach Ollama Cloud. Check the OLLAMA_API_KEY and Ollama service connection."
        }, 502);
      }

      model = successfulModel;
      lastData = data;

      const assistantMessage = provider === "openrouter"
        ? data?.choices?.[0]?.message
        : data?.message;
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
        } else {
          executed=executeFileTool(generatedFiles,name,args);
        }
        generatedFiles=executed.files;
        agentMessages.push({role:"tool",tool_name:name,content:executed.result});
      }
    }

    if(!finalMessage && lastData?.message?.content) finalMessage=lastData.message.content;
    if(!finalMessage) finalMessage = useWebSearch
      ? "I couldn't produce a web-researched answer. The search request did not return a usable response."
      : "I couldn't produce a response. Please try again.";

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
