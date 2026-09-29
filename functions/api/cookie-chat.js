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


const WORKSPACE_LIMITS = { maxFiles: 120, maxFileChars: 500000, maxPathChars: 240 };

const agentTools = [
  { type:"function", function:{ name:"workspace_list", description:"List files in Cookie's project workspace.", parameters:{type:"object",properties:{}} } },
  { type:"function", function:{ name:"workspace_read", description:"Read one complete file from Cookie's project workspace.", parameters:{type:"object",required:["path"],properties:{path:{type:"string"}}} } },
  { type:"function", function:{ name:"workspace_write", description:"Create a new file or replace an existing file in Cookie's project workspace.", parameters:{type:"object",required:["path","content"],properties:{path:{type:"string"},content:{type:"string"}}} } },
  { type:"function", function:{ name:"workspace_delete", description:"Delete one file from Cookie's project workspace.", parameters:{type:"object",required:["path"],properties:{path:{type:"string"}}} } },
  { type:"function", function:{ name:"workspace_mkdir", description:"Create a folder in Cookie's project workspace. Folder entries are kept so empty folders can also be included in ZIP exports.", parameters:{type:"object",required:["path"],properties:{path:{type:"string"}}} } },
  { type:"function", function:{ name:"workspace_rename", description:"Rename a file inside Cookie's project workspace.", parameters:{type:"object",required:["from","to"],properties:{from:{type:"string"},to:{type:"string"}}} } }
];

function normalizeWorkspace(input) {
  if (!Array.isArray(input)) return [];
  return input.filter(f => f && typeof f.path === "string" && typeof f.content === "string")
    .slice(0, WORKSPACE_LIMITS.maxFiles)
    .map(f => ({path:f.path.replace(/^\/+/,"").slice(0,WORKSPACE_LIMITS.maxPathChars),content:f.content.slice(0,WORKSPACE_LIMITS.maxFileChars)}))
    .filter(f => f.path && !f.path.includes(".."));
}

function executeWorkspaceTool(workspace, name, args) {
  const a = args && typeof args === "object" ? args : {};
  if (name === "workspace_list") {
    return {workspace, result:JSON.stringify({ok:true,files:workspace.map(f=>({path:f.path,size:f.content.length,kind:f.kind||"file"}))})};
  }
  if (name === "workspace_read") {
    const path=String(a.path||"").replace(/^\/+/,"");
    const file=workspace.find(f=>f.path===path);
    return file ? {workspace,result:JSON.stringify({ok:true,path,content:file.content})} : {workspace,result:JSON.stringify({ok:false,error:"File not found: "+path})};
  }
  if (name === "workspace_write") {
    const path=String(a.path||"").replace(/^\/+/,"");
    const content=String(a.content ?? "");
    if (!path || path.includes("..")) return {workspace,result:JSON.stringify({ok:false,error:"Invalid workspace path."})};
    if (path.length>WORKSPACE_LIMITS.maxPathChars) return {workspace,result:JSON.stringify({ok:false,error:"Path is too long."})};
    if (content.length>WORKSPACE_LIMITS.maxFileChars) return {workspace,result:JSON.stringify({ok:false,error:"File is too large for the preview workspace."})};
    const i=workspace.findIndex(f=>f.path===path);
    const action=i>=0 ? "updated" : "created";
    if(i>=0 && workspace[i].kind === "folder") return {workspace,result:JSON.stringify({ok:false,error:"That path is a folder."})};
    if(i>=0) workspace[i]={path,content,kind:"file"}; else {
      if(workspace.length>=WORKSPACE_LIMITS.maxFiles) return {workspace,result:JSON.stringify({ok:false,error:"Workspace file limit reached."})};
      workspace.push({path,content});
    }
    return {workspace,result:JSON.stringify({ok:true,action,path,size:content.length})};
  }
  if (name === "workspace_mkdir") {
    const path=String(a.path||"").replace(/^\/+|\/+$/g,"");
    if(!path || path.includes("..")) return {workspace,result:JSON.stringify({ok:false,error:"Invalid folder path."})};
    const folderPath=path+"/";
    if(workspace.some(f=>f.path===folderPath || f.path.startsWith(folderPath))) return {workspace,result:JSON.stringify({ok:true,action:"exists",path:folderPath})};
    if(workspace.length>=WORKSPACE_LIMITS.maxFiles) return {workspace,result:JSON.stringify({ok:false,error:"Workspace entry limit reached."})};
    workspace.push({path:folderPath,content:"",kind:"folder"});
    return {workspace,result:JSON.stringify({ok:true,action:"created",path:folderPath,folder:true})};
  }
  if (name === "workspace_delete") {
    const path=String(a.path||"").replace(/^\/+/,"");
    const i=workspace.findIndex(f=>f.path===path);
    if(i<0) return {workspace,result:JSON.stringify({ok:false,error:"File not found: "+path})};
    workspace.splice(i,1);
    return {workspace,result:JSON.stringify({ok:true,action:"deleted",path})};
  }
  if (name === "workspace_rename") {
    const from=String(a.from||"").replace(/^\/+/,""), to=String(a.to||"").replace(/^\/+/,"");
    if(!from||!to||from.includes("..")||to.includes("..")) return {workspace,result:JSON.stringify({ok:false,error:"Invalid workspace path."})};
    const source=workspace.find(f=>f.path===from || f.path===from+"/");
    if(!source) return {workspace,result:JSON.stringify({ok:false,error:"File not found: "+from})};
    if(workspace.some(f=>f.path===to)) return {workspace,result:JSON.stringify({ok:false,error:"Destination already exists: "+to})};
    source.path=source.kind === "folder" ? to.replace(/\/+$/,"")+"/" : to;
    return {workspace,result:JSON.stringify({ok:true,action:"renamed",from,to})};
  }
  return {workspace,result:JSON.stringify({ok:false,error:"Unknown workspace tool: "+name})};
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
    const attachments = Array.isArray(body?.attachments) ? body.attachments : [];
    let workspace = normalizeWorkspace(body?.workspace);
    const workspaceActions = [];
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
      "You have real project workspace tools. When the user asks you to build a project, create the folders and files needed for the complete project, using workspace_mkdir and workspace_write. Use workspace_list/workspace_read before editing when useful. You can create nested paths such as src/commands/ping.js. When the project is complete, tell the user it is ready to download as a ZIP. Never claim a file or folder was changed unless the workspace tool succeeded.",
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
        const executed=executeWorkspaceTool(workspace,name,args);
        workspace=executed.workspace;
        workspaceActions.push({tool:name,path:args?.path||args?.to||args?.from||null,ok:!/"ok":false/.test(executed.result)});
        agentMessages.push({role:"tool",tool_name:name,content:executed.result});
      }
    }

    if(!finalMessage && lastData?.message?.content) finalMessage=lastData.message.content;
    if(!finalMessage) finalMessage="I finished the workspace operation.";

    return json({
      message: limitResponse(String(finalMessage).trim()),
      model: profile.name,
      demo: true,
      demoNotice: "Cookie is currently in free preview. All model profiles are free during the demo.",
      workspace,
      workspaceActions
    });
  } catch (error) {
    console.error("[Cookie chat]", error);
    return json({ error: "Cookie could not answer right now. Check the Pages Function logs." }, 502);
  }
}
