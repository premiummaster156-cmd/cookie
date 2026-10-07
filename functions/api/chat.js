import { executeWebTool } from "./web.js";
import { dbAvailable, getSessionUser, randomToken } from "./auth/_auth.js";
import { json, readJson } from "./_lib.js";


function missionMarker(text) {
  const raw=String(text||"");
  const match=raw.match(/<!--COOKIE_MISSION_PLAN:(\[[\s\S]*?\])-->/i);
  if(!match)return {clean:raw,plan:[]};
  let plan=[];
  try {
    const parsed=JSON.parse(match[1]);
    if(Array.isArray(parsed)) plan=parsed.map(x=>String(x||"").trim()).filter(Boolean).slice(0,10);
  } catch {}
  return {clean:raw.replace(match[0],"").trim(),plan};
}

async function createMissionRecord(env,user,goal,chatId) {
  if(!env?.DB||!user?.id)return "";
  const id=randomToken(16), t=nowSeconds();
  try {
    await env.DB.prepare(
      "INSERT INTO missions (id,user_id,chat_id,goal,status,plan_json,verification_json,result_summary,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)"
    ).bind(id,user.id,String(chatId||""),String(goal||"").slice(0,12000),"running","[]","{}","",t,t).run();
    return id;
  } catch(error) {
    console.error("[Cookie mission create]",error);
    return "";
  }
}

async function updateMissionRecord(env,missionId,patch={}) {
  if(!env?.DB||!missionId)return;
  const sets=[],values=[];
  if(patch.status){sets.push("status=?");values.push(String(patch.status).slice(0,40));}
  if(patch.plan){sets.push("plan_json=?");values.push(JSON.stringify(Array.isArray(patch.plan)?patch.plan:[]).slice(0,12000));}
  if(patch.verification){sets.push("verification_json=?");values.push(JSON.stringify(patch.verification||{}).slice(0,12000));}
  if(patch.result){sets.push("result_summary=?");values.push(String(patch.result||"").slice(0,12000));}
  if(patch.completedAt){sets.push("completed_at=?");values.push(Number(patch.completedAt));}
  if(!sets.length)return;
  sets.push("updated_at=?");values.push(nowSeconds());values.push(missionId);
  try { await env.DB.prepare("UPDATE missions SET "+sets.join(",")+" WHERE id=?").bind(...values).run(); }
  catch(error){ console.error("[Cookie mission update]",error); }
}

function appendMissionInstruction(systemParts) {
  systemParts.push(
    "MISSION MODE: You are operating as Cookie's task-completion agent. Do not treat the request as a one-shot chat answer when it requires multiple steps. First understand the goal and constraints, then make a concise plan, execute the work with available tools, inspect the intermediate results, and perform a verification pass before finalizing. Keep working until the goal is actually complete or a real blocker prevents completion. Never claim a step is complete unless the relevant tool/result supports it.",
    "MISSION MODE PLAN MARKER: On your first model turn, include a machine-readable HTML comment exactly in the form <!--COOKIE_MISSION_PLAN:[\"step 1\",\"step 2\"]--> before any user-facing text. Keep it to the actual steps you intend to execute. Cookie removes this marker from the user-facing answer and stores the plan in the mission record.",
    "MISSION MODE VERIFICATION: Before the final answer, check your output against the original goal, constraints, and tool results. Fix discovered issues before finishing. Do not expose private reasoning; summarize completed work, verification, and any remaining blocker in the final answer."
  );
}

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
const MISSION_MAX_TURNS = 16;
const MISSION_MAX_TOOL_CALLS = 8;


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

const GPT_PROFILES = {
  "study-coach": {
    name:"Study Coach",
    description:"Step-by-step learning and practice.",
    requiredPlan:0,
    system:"You are Study Coach inside Cookie AI. Teach clearly and patiently, adapt explanations to the user's level, use examples, and prefer active learning. Ask focused follow-up questions only when necessary. Do not invent citations or facts."
  },
  "code-expert": {
    name:"Code Expert",
    description:"Senior programming, debugging, and architecture.",
    requiredPlan:1,
    system:"You are Code Expert inside Cookie AI. Act as a senior software engineer. Diagnose bugs systematically, respect the user's existing stack and conventions, produce complete production-quality code when requested, consider security and edge cases, and explain important implementation decisions briefly."
  },
  "writing-partner": {
    name:"Writing Partner",
    description:"Drafting, editing, rewriting, and polishing.",
    requiredPlan:0,
    system:"You are Writing Partner inside Cookie AI. Help users draft, rewrite, edit, summarize, and polish writing. Preserve intent and voice unless asked to change them. Prefer natural human language over generic AI phrasing. Match the requested tone and audience."
  },
  "research-analyst": {
    name:"Research Analyst",
    description:"Evidence-led research and decision support.",
    requiredPlan:1,
    system:"You are Research Analyst inside Cookie AI. Approach research questions carefully, distinguish evidence from inference, compare competing explanations, surface uncertainty, and structure findings for decision-making. When live sources are supplied, ground claims in those sources and never pretend you browsed when you did not."
  },
  "data-analyst": {
    name:"Data Analyst",
    description:"Tables, CSVs, trends, metrics, and anomalies.",
    requiredPlan:1,
    system:"You are Data Analyst inside Cookie AI. Analyze attached or provided data rigorously. State assumptions, check data quality, calculate useful statistics when possible, identify trends and anomalies, and communicate results clearly. Never fabricate measurements that were not available."
  },
  "creative-studio": {
    name:"Creative Studio",
    description:"Original creative concepts and execution-ready directions.",
    requiredPlan:2,
    system:"You are Creative Studio inside Cookie AI. Develop original, high-quality creative concepts. Explore multiple directions, refine the strongest one, and keep the output practical enough to execute. Match the requested brand voice and constraints."
  }
};

const TOOL_REQUIREMENTS = {
  "calculator":0,
  "file-analysis":0,
  "data-analysis":1,
  "url-fetch":1,
  "code-analysis":1,
  "deep-research":2
};

function planRank(plan) {
  const p=String(plan||"free").toLowerCase();
  return p==="max" ? 2 : (p==="pro"||p==="plus") ? 1 : 0;
}
function modelRequiredRank(mode){
  return mode==="ultra"?2:mode==="max"?1:0;
}
function isPrivilegedUser(user){
  const email=String(user?.email||"").trim().toLowerCase();
  const role=String(user?.role||"user").toLowerCase();
  return email==="cookie.ai.noreply@gmail.com"||["owner","admin","staff"].includes(role);
}

function safeCalculate(expression) {
  const normalized=String(expression||"").replace(/,/g,"").replace(/\^/g,"**").trim().slice(0,300);
  if(!normalized) return {ok:false,error:"Enter an arithmetic expression."};
  if(!/^[0-9+*/%().\\s-]+$/.test(normalized)) return {ok:false,error:"Calculator only accepts arithmetic expressions."};
  try {
    const value=Function('"use strict";return ('+normalized+')')();
    if(typeof value!=="number" || !Number.isFinite(value)) return {ok:false,error:"The result is not a finite number."};
    return {ok:true,expression:normalized,result:value};
  } catch {
    return {ok:false,error:"Could not evaluate that expression."};
  }
}

function csvSummary(name,content) {
  const raw=String(content||"").replace(/\r/g,"").trim();
  if(!raw) return {name,rows:0,columns:0};
  const lines=raw.split("\n").filter(Boolean).slice(0,5001);
  const delimiter=(lines[0].split(";").length>lines[0].split(",").length) ? ";" : ",";
  const parse=(line)=>line.split(delimiter).map(x=>x.trim().replace(/^"(.*)"$/,"$1"));
  const headers=parse(lines[0]);
  const data=lines.slice(1).map(parse);
  const stats=[];
  for(let c=0;c<headers.length;c++){
    const nums=data.map(r=>Number(String(r[c]??"").replace(/,/g,"").trim())).filter(Number.isFinite);
    if(nums.length>=2){
      const sum=nums.reduce((a,b)=>a+b,0), mean=sum/nums.length;
      const variance=nums.reduce((a,b)=>a+(b-mean)**2,0)/nums.length;
      stats.push(headers[c]+": n="+nums.length+" mean="+Number(mean.toFixed(4))+" min="+Math.min(...nums)+" max="+Math.max(...nums)+" sd="+Number(Math.sqrt(variance).toFixed(4)));
    }
  }
  return {name,rows:data.length,columns:headers.length,headers:headers.slice(0,40),numericStats:stats.slice(0,40)};
}

const memoryTools = [
  { type:"function", function:{ name:"memory_search", description:"Search the user's long-term Cookie memory for relevant saved preferences, facts, or instructions.", parameters:{type:"object",properties:{query:{type:"string",description:"What to look for in memory."}}} } },
  { type:"function", function:{ name:"memory_save", description:"Save a durable user preference or fact that will be useful across future Cookie conversations. Only save information that is clearly useful and appropriate to remember.", parameters:{type:"object",required:["key","value"],properties:{key:{type:"string"},value:{type:"string"}}} } },
  { type:"function", function:{ name:"memory_delete", description:"Delete a previously saved long-term memory by key.", parameters:{type:"object",required:["key"],properties:{key:{type:"string"}}} } }
];

async function executeMemoryTool(env, userId, name, args) {
  const a=args && typeof args==="object" ? args : {};
  if (!env?.DB || !userId) return {ok:false,error:"Long-term memory is unavailable."};

  if (name === "memory_search") {
    const q=String(a.query||"").trim().slice(0,160);
    if (!q) {
      const rows=await env.DB.prepare(
        "SELECT id,key,value,updated_at FROM memories WHERE user_id=? ORDER BY updated_at DESC LIMIT 20"
      ).bind(userId).all();
      return {ok:true,memories:rows.results||[]};
    }
    const pattern="%" + q.replace(/[%_]/g, m => "\\" + m) + "%";
    const rows=await env.DB.prepare(
      "SELECT id,key,value,updated_at FROM memories WHERE user_id=? AND (key LIKE ? ESCAPE '\\' OR value LIKE ? ESCAPE '\\') ORDER BY updated_at DESC LIMIT 20"
    ).bind(userId,pattern,pattern).all();
    return {ok:true,memories:rows.results||[]};
  }

  if (name === "memory_save") {
    const key=String(a.key||"").trim().slice(0,120);
    const value=String(a.value||"").trim().slice(0,4000);
    if(!key||!value) return {ok:false,error:"Both memory key and value are required."};
    const now=Math.floor(Date.now()/1000);
    await env.DB.prepare(
      "INSERT INTO memories (id,user_id,key,value,created_at,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(user_id,key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at"
    ).bind(randomToken(16),userId,key,value,now,now).run();
    return {ok:true,key,value};
  }

  if (name === "memory_delete") {
    const key=String(a.key||"").trim().slice(0,120);
    if(!key) return {ok:false,error:"A memory key is required."};
    await env.DB.prepare("DELETE FROM memories WHERE user_id=? AND key=?").bind(userId,key).run();
    return {ok:true,key};
  }

  return {ok:false,error:"Unknown memory tool: "+name};
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

async function executeImageTool(env, args, generatedImages, userId="", plan="free") {
  const prompt = String(args?.prompt || "").trim().slice(0, 2048);
  if (env?.DB && userId) {
    const configured = await loadAiLimits(env);
    const key = plan==="max" ? "image_limit_max" : planRank(plan)>=1 ? "image_limit_pro" : "image_limit_free";
    const imageLimit = Number(configured[key]||3);
    try {
      const usage = await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM usage_events WHERE user_id=? AND kind='image_generation' AND created_at>?"
      ).bind(userId, nowSeconds() - 86400).first();
      if (Number(usage?.count || 0) >= imageLimit) {
        return {ok:false,error:"Daily image-generation limit reached ("+imageLimit+")."};
      }
    } catch {}
  }
  if (!prompt) return {ok:false,error:"An image prompt is required."};

  const model = "@cf/black-forest-labs/flux-2-klein-4b";
  const accountId = String(env?.CLOUDFLARE_ACCOUNT_ID || env?.CF_ACCOUNT_ID || "").trim();
  const token = String(env?.CLOUDFLARE_AI_API_TOKEN || env?.CLOUDFLARE_API_TOKEN || "").trim();

  try {
    let image = "";

    if (accountId && token) {
      const form = new FormData();
      form.append("prompt", prompt);
      form.append("width", "1024");
      form.append("height", "1024");

      const response = await fetch(
        "https://api.cloudflare.com/client/v4/accounts/" + encodeURIComponent(accountId) + "/ai/run/" + model,
        {
          method: "POST",
          headers: { Authorization: "Bearer " + token },
          body: form
        }
      );

      const raw = await response.text();
      let data = null;
      try { data = raw ? JSON.parse(raw) : null; } catch {}

      if (!response.ok) {
        const detail = String(data?.errors?.[0]?.message || data?.error || raw || "Workers AI request failed").slice(0, 500);
        throw new Error("Workers AI API (" + response.status + "): " + detail);
      }

      image = String(
        data?.result?.image ||
        data?.result?.output ||
        data?.result?.data?.image ||
        ""
      ).trim();
    } else if (env?.AI && typeof env.AI.run === "function") {
      const form = new FormData();
      form.append("prompt", prompt);
      form.append("width", "1024");
      form.append("height", "1024");
      const formResponse = new Response(form);
      const result = await env.AI.run(model, {
        multipart: {
          body: formResponse.body,
          contentType: formResponse.headers.get("content-type")
        }
      });
      image = String(result?.image || "").trim();
    } else {
      return {
        ok:false,
        error:"Workers AI image generation is not configured. Add CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_AI_API_TOKEN to Pages secrets."
      };
    }

    if (!image) return {ok:false,error:"Workers AI returned no image data."};

    const dataUrl = image.startsWith("data:image/")
      ? image
      : "data:image/png;base64," + image;

    generatedImages.push({
      dataUrl,
      prompt,
      model:"FLUX.2 [klein] 4B"
    });

    if (env?.DB && userId) {
      try {
        await env.DB.prepare("INSERT INTO usage_events (id,user_id,kind,model,units,created_at) VALUES (?,?,?,?,?,?)")
          .bind(randomToken(16),userId,"image_generation","FLUX.2 [klein] 4B",1,nowSeconds()).run();
      } catch {}
    }
    return {ok:true,prompt,model:"FLUX.2 [klein] 4B",index:generatedImages.length};
  } catch (error) {
    console.error("[Cookie image generation]", error);
    return {ok:false,error:String(error?.message || "Image generation failed.")};
  }
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
function inferModel({mode, text, attachments, gptProfile, requestedTool}) {
  const q = String(text || "").toLowerCase();
  const hasImages = Array.isArray(attachments) && attachments.some(a => a && a.kind === "image");
  const codeLike = /\b(code|coding|program|programming|debug|bug|stack trace|typescript|javascript|react|next\.js|python|java|swift|kotlin|rust|go|sql|api|sdk|git|github|css|html|regex|function|class|component|repository|repo|pull request|commit)\b/i.test(q);
  const researchLike = requestedTool === "deep-research" || /\b(research|sources?|cite|citation|latest|current|today|news|compare evidence|look up|investigate)\b/i.test(q);
  if (hasImages) return mode==="ultra" ? "kimi-k2.7-code:cloud" : "glm-5.3-flash:cloud";
  if (gptProfile?.id === "code-expert" || codeLike) return "kimi-k2.7-code:cloud";
  if (mode === "ultra") return "kimi-k3:cloud";
  if (mode === "max" || researchLike) return "deepseek-v4-pro:cloud";
  return "glm-5.3:cloud";
}

function modelContext(model) {
  if (/deepseek-v4|glm-5\.3|kimi-k3/i.test(model)) return 1048576;
  if (/kimi-k2\.7|kimi-k2\.6|qwen3\.8/i.test(model)) return 262144;
  if (/gpt-oss/i.test(model)) return 131072;
  return 131072;
}

function thinkingFor(mode, reasoning, model) {
  if (reasoning === "fast") return false;
  if (/deepseek-v4-pro/i.test(model) && (reasoning === "deep" || mode === "ultra")) return "max";
  if (/glm-5\.3/i.test(model)) return "max";
  if (/kimi-k3/i.test(model) && (reasoning === "deep" || mode === "ultra")) return "max";
  if (/kimi-k2\.7|kimi-k2\.6|gpt-oss/i.test(model)) return "high";
  return reasoning === "deep" || mode !== "standard";
}

function providerModelFallbacks(model) {
  const ordered = [
    "glm-5.3-flash:cloud",
    "glm-5.3:cloud",
    "deepseek-v4-pro:cloud",
    "kimi-k3:cloud",
    "kimi-k2.7-code:cloud",
    "minimax-m3:cloud",
    "gpt-oss:120b-cloud",
    "deepseek-v4-flash:cloud",
    "qwen3-coder:480b-cloud",
    "gemma4:cloud"
  ];
  const freeFallback = "gemma4:cloud";
  return [model, freeFallback, ...ordered.filter(x => x !== model && x !== freeFallback)];
}

function safeOllamaUrl(value) {
  const fallback = "https://ollama.com/api/chat";
  const raw = String(value || "").trim();
  if (!raw) return fallback;
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return fallback;
    if (!/(^|\.)ollama\.com$/i.test(u.hostname)) return fallback;
    return u.href;
  } catch {
    return fallback;
  }
}

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

async function loadAiLimits(env) {
  const defaults={chat_limit_free:10,chat_limit_pro:30,chat_limit_max:60,image_limit_free:3,image_limit_pro:20,image_limit_max:50};
  try{
    const r=await env.DB.prepare("SELECT key,value FROM codebase_settings WHERE key LIKE 'ai_%'").all();
    for(const row of (r.results||[])){
      const key=String(row.key||"").replace(/^ai_/,"");
      if(Object.prototype.hasOwnProperty.call(defaults,key)){
        const v=Number(row.value);
        if(Number.isFinite(v)) defaults[key]=Math.max(1,Math.min(10000,Math.trunc(v)));
      }
    }
  }catch{}
  return defaults;
}
async function rateLimitChat(env, user, plan, limits) {
  const key=plan === "max" ? "chat_limit_max" : planRank(plan) >= 1 ? "chat_limit_pro" : "chat_limit_free";
  const limit=Number(limits?.[key]||10);
  const since = nowSeconds() - 60;
  const row = await env.DB.prepare(
    "SELECT COUNT(*) AS count FROM usage_events WHERE user_id=? AND kind='chat_request' AND created_at>?"
  ).bind(user.id, since).first();
  const count = Number(row?.count || 0);
  if (count >= limit) {
    const retry = 60;
    return json(
      {error:"Cookie is busy for this account. Please try again in a moment.",code:"RATE_LIMITED",limit,retryAfter:retry},
      429,
      {"Retry-After":String(retry)}
    );
  }
  await env.DB.prepare(
    "INSERT INTO usage_events (id,user_id,kind,model,units,created_at) VALUES (?,?,?,?,?,?)"
  ).bind(randomToken(16), user.id, "chat_request", plan, 1, nowSeconds()).run();
  return null;
}

function appendWebSources(target, result) {
  const rows = Array.isArray(result?.pages)
    ? result.pages
    : Array.isArray(result?.results)
      ? result.results
      : result?.url
        ? [result]
        : [];
  for (const item of rows.slice(0, 12)) {
    const url = String(item?.url || "").trim();
    if (!/^https?:\/\//i.test(url)) continue;
    if (target.some(x => x.url === url)) continue;
    let domain = "";
    try { domain = new URL(url).hostname.replace(/^www\./i, ""); } catch {}
    target.push({
      title: String(item?.title || "Web source").replace(/\s+/g, " ").trim().slice(0, 180),
      url,
      domain,
      snippet: String(item?.content || "").replace(/\s+/g, " ").trim().slice(0, 260)
    });
  }
}

const profiles = {
  standard: {
    name: "CPT-1",
    model: "glm-5.3:cloud",
    temperature: 0.48,
    instructions: "Be fast, clear, practical, natural, and accurate. Spend reasoning effort where it materially improves the answer; do not over-explain simple tasks.",
    thinking: true
  },
  max: {
    name: "CPT-2 MAX",
    model: "deepseek-v4-pro:cloud",
    temperature: 0.56,
    instructions: "Handle difficult reasoning, coding, code review, architecture, debugging, planning, analysis, and multi-step engineering tasks with extra care. Prefer verification, explicit assumptions, robust edge-case handling, and complete production-quality solutions.",
    thinking: true
  },
  ultra: {
    name: "CPT-3 ULTRA",
    model: "kimi-k3:cloud",
    temperature: 0.58,
    instructions: "Operate as Cookie's highest-capability multimodal and agentic profile. Analyze difficult engineering problems, large codebases, screenshots and visual interfaces carefully. Use long-horizon planning, strong code/design judgment, tool use, and rigorous self-review. Produce polished production-quality solutions and verify assumptions before committing to an answer.",
    thinking: true
  }
};

export async function onRequestPost({ request, env }) {
  try {
    if (!dbAvailable(env)) return json({ error:"Cookie accounts are not configured yet. Add NEON_DATABASE_URL as an encrypted Pages secret." }, 503);
    const sessionUser = await getSessionUser(request, env);
    if (!sessionUser) return json({ error:"Please sign in to use Cookie AI." }, 401);

    const credits = Number(sessionUser.credits ?? 0);
    const plan = String(sessionUser.plan || "free");
    if (plan === "free" && credits <= 0) {
      return json({ error:"Your free Cookie credits are used up. Add a paid plan before continuing." }, 402);
    }
    const aiLimits = await loadAiLimits(env);
    const rateLimited = await rateLimitChat(env,sessionUser,plan,aiLimits);
    if (rateLimited) return rateLimited;

    // Cookie runs directly on Ollama Cloud. OpenRouter is intentionally not used.
    const provider = "ollama";
    const apiKey = String(env.OLLAMA_API_KEY || "").trim();
    let model = "gpt-oss:20b-cloud";
    const ollamaUrl = safeOllamaUrl(env.OLLAMA_URL);

    if (!apiKey) {
      return json({ error: "Cookie AI is not configured yet. Add OLLAMA_API_KEY in Pages secrets." }, 503);
    }

    const body = await readJson(request);
    const preferences = body?.preferences || {};
    const mode = ["standard", "max", "ultra"].includes(preferences.responseMode)
      ? preferences.responseMode
      : "standard";
    const profile = profiles[mode];
    if(!isPrivilegedUser(sessionUser) && modelRequiredRank(mode)>planRank(plan)){
      return json({error:(mode==="ultra"?"CPT-3 ULTRA requires a MAX plan.":"CPT-2 MAX requires a PRO or MAX plan."),code:"MODEL_PLAN_REQUIRED",requiredPlan:mode==="ultra"?"max":"pro"},402);
    }
    model = profile.model;
    const attachments = Array.isArray(body?.attachments) ? body.attachments.slice(0,10) : [];
    let generatedFiles = [];
    let generatedImages = [];
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
    const requestedEffort = ["light","standard","high","ultra"].includes(preferences.effort) ? preferences.effort : "standard";
    const effortReasoning = requestedEffort==="light" ? "fast" : requestedEffort==="high" || requestedEffort==="ultra" ? "deep" : "auto";
    const reasoning = ["auto","fast","deep"].includes(preferences.reasoning) && preferences.reasoning!=="auto" ? preferences.reasoning : effortReasoning;
    const customInstructions = typeof preferences.instructions === "string" ? preferences.instructions.slice(0,6000).trim() : "";
    const skillInstructions = {
      "deep-research":"Use a research-first workflow: identify key subquestions, compare evidence, distinguish facts from assumptions, and surface uncertainty. Prefer current sources when available.",
      "ship-code":"Act as a production engineer. Understand existing architecture before changing it, preserve compatibility, check security and edge cases, and finish with a concise validation summary.",
      "study-mode":"Teach actively from the learner's level, use examples, ask focused checks for understanding, and adapt the explanation instead of only giving the final answer.",
      "creative-director":"Think like a senior creative director. Generate distinct directions, evaluate them against the brief, and refine the strongest executable concept.",
      "data-investigator":"Analyze data rigorously. Check quality and assumptions, distinguish correlation from causation, identify anomalies, and never invent missing measurements."
    };
    const skillId = typeof body.skill === "string" && Object.prototype.hasOwnProperty.call(skillInstructions, body.skill) ? body.skill : "";
    const activeSkillInstruction = skillId ? skillInstructions[skillId] : "";
    const requestedWebQuery = String(messages.at(-1)?.content || "").trim();
    const researchRequested = /(research|sources?|cite|citation|latest|current|today|news|look up|investigate|verify)/i.test(requestedWebQuery);
    const useWebSearch = preferences.webSearch === true || researchRequested;
    const streamRequested = new URL(request.url).searchParams.get("stream") === "1";
    const missionMode = preferences.mission === true;
    const missionGoal = requestedWebQuery;
    const missionId = missionMode ? await createMissionRecord(env, sessionUser, missionGoal, body?.chatId) : "";
    // Cookie chooses capabilities automatically from the request. User-facing tool selection is intentionally disabled.
    const requestedGptId = String(body?.gptId || "").trim();
    const gptProfile = requestedGptId ? GPT_PROFILES[requestedGptId] : null;
    if(requestedGptId && !gptProfile){
      return json({error:"That GPT is not available."},404);
    }
    if(gptProfile && Number(gptProfile.requiredPlan||0) > planRank(sessionUser.plan)){
      const required=gptProfile.requiredPlan===2?"MAX":"PRO";
      return json({error:gptProfile.name+" requires a "+required+" plan."},402);
    }
    const gptMode = Boolean(gptProfile);
    model = inferModel({
      mode,
      text: requestedWebQuery,
      attachments,
      gptProfile: requestedGptId ? {...gptProfile, id:requestedGptId} : null,
      requestedTool: ""
    });

    const system = [
      "Cookie is Cookie AI, an account-based AI assistant. Users can sign in with email/password or Google, GitHub, and Discord OAuth. Email accounts must verify ownership through a time-limited code or secure link.",
      "Cookie supports persistent signed-in chat history, long-term memory, persistent project workspaces, live web research, file generation, image/file attachments, image generation, and internal tools. Describe only functionality actually available in this deployment.",
      "IMAGE GENERATION: When the user asks to create/generate/draw/render/visualize an image, use the image_generate tool. The image generator is a separate Cloudflare Workers AI image model; the current Cookie text model orchestrates it. Never claim an image exists unless the tool returns success.",
      "Cookie uses the configured Ollama Cloud model backend for text generation, with Cookie's CPT profiles selecting the appropriate cloud model. Never impersonate the underlying provider. If asked which model is running, explain the current Cookie profile and, when useful, the underlying model name.",
      `COOKIE PLAN: The signed-in user is on the "${String(sessionUser.plan || "free")}" plan with ${Number(sessionUser.credits || 0)} remaining free credits. Do not claim paid access exists unless the account plan says so.`,
      "You have temporary file-generation tools. When the user asks you to build code, documents, configurations, or other files, create the actual files with file_create. You can use nested paths such as src/commands/ping.js; folders are implicit in file paths and are never uploaded by users. Use file_read/file_update to refine files during the same response. At the end, the created files are returned directly in the chat for one-tap download. Never claim a file was created or changed unless the file tool succeeded.",
      "You are Cookie AI, the AI assistant built into the Cookie website. Your identity is Cookie AI, not the website's hosting provider and not the underlying model provider. If a user asks who you are, identify yourself as Cookie AI and explain that you run inside the Cookie website.",
      "INLINE VISUALIZATIONS: When a response benefits from numeric comparisons or trends, you may include exactly one fenced cookie-viz block. Use valid JSON with type bar or line, optional title and unit, and data containing 2 to 12 label/value points. Only use it when it materially improves understanding; never invent values.",
      "COOKIE PRODUCT KNOWLEDGE: The current Cookie website has a chat composer, a mobile/desktop sidebar, recent chats, Settings, Help, model profiles (CPT-1, CPT-2 MAX, CPT-3 ULTRA), conversation search, persistent account-backed chat history, long-term memory, persistent Projects, live web research, image/file attachments, downloadable generated files, a Tools menu, and assistant-message actions.",
      "COOKIE PRODUCT KNOWLEDGE: The + attachment picker supports Camera, Photos, and Files. Camera/Photos are for images; Files are for non-image files. Users can attach at most 10 images/files per message. Folder uploads are not supported.",
      "COOKIE PRODUCT KNOWLEDGE: Cookie can analyze user-provided images/files, answer questions, explain concepts, write and rewrite content, translate, plan, reason, help with programming, debug and review code, and create downloadable files.",
      "COOKIE PRODUCT KNOWLEDGE: Generated files are temporary response artifacts. Cookie can use its internal file_create, file_read, file_update, and file_delete capabilities during the current response to build and refine downloadable files. These capabilities are internal and are not presented as a user-facing Tools menu.",
      "COOKIE PRODUCT KNOWLEDGE: Cookie Projects are persistent account-backed workspaces. Users can create projects, keep project descriptions, and store text files under project paths. Do not claim that temporary generated response files automatically become project files.",
      "COOKIE PRODUCT KNOWLEDGE: Assistant message actions currently include Copy and a More menu with Share, Pin/Unpin, Uploaded files, Find in chat, Archive, and Delete. Some actions are session/local UI actions rather than permanent cloud features; do not imply persistence unless the system actually provides it.",
      "COOKIE PRODUCT BEHAVIOR: When the user asks for a downloadable artifact, create it directly and return it in the chat. When the user uploads files/images, use the provided content as context and be explicit if the content could not be read. When discussing Cookie's capabilities, describe only capabilities actually available in this website.",
      "COOKIE PRODUCT BEHAVIOR: Do not invent Cookie features or integrations. For capabilities that require configuration (OAuth, email, paid plans, image generation), state the relevant configuration requirement rather than pretending it is active. Do not refer to an unresolved prior image request when the current user message is a greeting or unrelated request; only discuss an image when the current turn actually includes image data or the conversation clearly requires it.",
      "COOKIE PRODUCT BEHAVIOR: You do not need to expose internal tool names or implementation details to ordinary users. Use internal file capabilities when appropriate and describe the user-facing result instead.",
      `USER PREFERENCES: Respond with the selected Cookie personality: ${personality}. Balanced = natural and adaptable; Friendly = warm and conversational; Professional = clear and formal; Concise = short and direct; Creative = imaginative and expressive; Teacher = step-by-step and educational.`,
      customInstructions ? `CUSTOM INSTRUCTIONS: ${customInstructions}` : "",
      useWebSearch ? "WEB RESEARCH: Live web search and page fetching are enabled for this message. Use them when the user asks for current information, research, sources, recent facts, or when browsing materially improves accuracy. When you use web research, cite useful sources inline as Markdown links using the returned URLs. Do not claim you browsed unless a web tool actually returned results." : "WEB RESEARCH: Live web research is disabled for this message. Do not claim to have searched the web.",
      memoryEnabled ? "LONG-TERM USER MEMORY: You have access to the user's persistent memory. Use it only when relevant. Do not expose the complete memory store. Save only stable preferences or helpful facts when the user clearly asks you to remember something or when a durable preference is obvious and appropriate." : "LONG-TERM USER MEMORY: Memory is disabled for this message.",
      persistentMemories.length ? "CURRENT SAVED MEMORY:\n" + persistentMemories.map(m => "- " + m.key + ": " + m.value).join("\n") : "",
      profileUsername ? `USER PROFILE: The user's Cookie username is "${profileUsername}". Use it naturally when useful; do not reveal private profile data unless relevant.` : "",
      profileEmail ? "USER PROFILE: An email address is saved for the Cookie account interface. Do not expose or repeat it unless the user explicitly asks." : "",
      "You are Cookie, a polished general-purpose AI assistant.",
      "Be genuinely useful rather than overly enthusiastic or repetitive.",
      "Follow the user's instructions precisely and preserve important constraints.",
      activeSkillInstruction ? `ACTIVE COOKIE SKILL (${skillId}): ${activeSkillInstruction}` : "",
      "Use the conversation context. If the user asks to revise, continue, shorten, expand, translate, or change something, operate on the relevant previous content instead of starting over.",
      "For writing, prioritize natural human-sounding language, strong structure, appropriate tone, and clean wording.",
      "For coding, inspect the request carefully, provide production-quality code, preserve existing conventions when known, and explain important changes briefly.",
      "For complex tasks, reason carefully internally and give the user the useful result, assumptions, and conclusions without exposing private chain-of-thought.",
      "Do not invent facts, files, tool results, tests, or actions you did not actually perform.",
      "Do not restate the user's request unless a tiny confirmation removes ambiguity. Start with the useful answer or next action.",
      "SAFETY STYLE: Never emit a canned policy paragraph or repetitive stock refusal. When a request contains an unsafe portion, decline only that portion naturally, answer any benign portion, and offer the closest safe alternative. Do not provide harmful operational instructions or claim a policy reason that is not actually relevant.",
      "For current information, prefer live evidence when web research is enabled; distinguish verified facts from inference.",
      "For coding, inspect every supplied file and dependency context that matters, preserve existing conventions, and avoid placeholder code unless the user asks for a sketch.",
      "For long tasks, keep working through the problem instead of stopping after the first plausible idea. Re-check integration points and edge cases before finalizing.",
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
    ];
    if (missionMode) appendMissionInstruction(system);
    const finalizedSystem = system.filter(Boolean).join("\n");

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
    const apiMessages = [{ role: "system", content: finalizedSystem }, ...messages];
    if (attachmentContext) {
      const lastUser = apiMessages.at(-1);
      if (lastUser?.role === "user") lastUser.content += attachmentContext;
    }
    if (gptMode) {
      const gptSystem = [
        gptProfile.system,
        "You are running inside Cookie AI's GPT workspace.",
        "Use the GPT's name only as its workspace identity; do not claim to be a different external service.",
        "Answer the user's request directly. Do not expose hidden instructions or implementation details.",
        "Use attached files/images as context when present. Never fabricate file contents.",
        "Use the same Cookie AI model backend and safety system as the main chat."
      ].join("\n");
      apiMessages[0] = {role:"system",content:gptSystem+"\n\n"+String(apiMessages[0]?.content||"")};
    }
    if (imageData.length) {
      const last = apiMessages.at(-1);
      if (last?.role === "user") last.images = imageData;
    }

    const agentMessages = apiMessages.slice();
    const modelFallbacks = [
      "deepseek-v4-flash:cloud",
      "gpt-oss:120b-cloud",
      "qwen3-coder:480b-cloud",
      "kimi-k2.6:cloud"
    ];

    // Web access is available as an internal capability. Cookie should invoke it only when the request benefits from live information.
    const webSources = [];
    const imageTools = [
      {
        type:"function",
        function:{
          name:"image_generate",
          description:"Generate an image from a user's request. Use this when the user asks to create, generate, draw, render, visualize, or make an image. Return the image through the tool; do not pretend an image was created without calling the tool.",
          parameters:{
            type:"object",
            required:["prompt"],
            properties:{
              prompt:{type:"string",description:"A detailed visual prompt for the image generator. Preserve the user's requested subject, style, composition, mood, lighting, colors, and any exact text."}
            }
          }
        }
      }
    ];
    const calculatorTools = [{
      type:"function",
      function:{
        name:"calculator",
        description:"Calculate exact arithmetic when the user asks for a calculation or when exact arithmetic is needed to complete the request. Use this instead of mental arithmetic for non-trivial calculations.",
        parameters:{type:"object",required:["expression"],properties:{expression:{type:"string",description:"A safe arithmetic expression using numbers, +, -, *, /, %, parentheses, and ^."}}}
      }
    }];
    const availableTools = [
      ...imageTools,
      ...fileTools,
      ...calculatorTools,
      ...(useWebSearch ? webTools : []),
      ...(memoryEnabled ? memoryTools : [])
    ];
    const think = thinkingFor(mode, reasoning, model);
    const numCtx = modelContext(model);
    let finalMessage = "";
    let lastData = null;

    // Token streaming path. The non-streaming path below remains available for
    // older clients and keeps the same tool loop/response contract.
    if (streamRequested) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          const push = payload => {
            try { controller.enqueue(encoder.encode("data: " + JSON.stringify(payload) + "\n\n")); } catch {}
          };
          const liveMessages = agentMessages.slice();
          const liveSources = webSources.slice();
          let liveFiles = [];
          let liveImages = [];
          let liveMessage = "";
          let usedModel = model;
          let completed = false;

          const statusForTool = name =>
            name === "calculator" ? "Calculating…" :
            name === "image_generate" ? "Creating image…" :
            name === "web_search" ? "Searching the web…" :
            name === "web_fetch" ? "Reading sources…" :
            name.startsWith("memory_") ? "Using memory…" :
            name.startsWith("file_") ? "Preparing files…" :
            "Working…";
          const toolLabel = (name,args) => {
            const a=args && typeof args==="object" ? args : {};
            if(name==="calculator") return "Calculating the result";
            if(name==="image_generate") return "Creating the image";
            if(name==="web_search") return "Searching for “"+String(a.query||"what you need").replace(/\s+/g," ").trim().slice(0,110)+"”";
            if(name==="web_fetch") { try { return "Reading "+new URL(String(a.url||"")).hostname.replace(/^www\./i,""); } catch { return "Reading the webpage"; } }
            if(name==="memory_search") return "Checking Cookie memory";
            if(name==="memory_save") return "Saving this to memory";
            if(name==="memory_delete") return "Updating Cookie memory";
            if(name==="file_create") return "Creating "+String(a.path||"the file").slice(0,120);
            if(name==="file_read") return "Opening "+String(a.path||"the file").slice(0,120);
            if(name==="file_update") return "Updating "+String(a.path||"the file").slice(0,120);
            if(name==="file_delete") return "Removing "+String(a.path||"the file").slice(0,120);
            return "Working on "+String(name||"the task").replace(/_/g," ").slice(0,120);
          };
          const toolDetail = (name,args,result) => {
            const a=args && typeof args==="object" ? args : {};
            if(name==="web_search") return String(a.query||"Searching live web").slice(0,180);
            if(name==="web_fetch") { try { return new URL(String(a.url||"")).hostname; } catch { return "Reading public webpage"; } }
            if(name==="calculator") return String(a.expression||"Calculating").slice(0,180);
            if(name==="image_generate") return String(a.prompt||"Generating requested image").slice(0,180);
            if(name.startsWith("file_")) return String(a.path||"Working with generated file").slice(0,180);
            if(name.startsWith("memory_")) return String(a.query||a.key||"Updating memory").slice(0,180);
            return "Completed tool operation";
          };

          try {
            let thinkingShown = false;

            for (let turn = 0; turn < (missionMode ? MISSION_MAX_TURNS : 12); turn++) {
              push({type:"status",status:missionMode ? (turn===0?"Planning mission…":"Executing mission…") : (turn===0?"Thinking…":"Continuing…")});
              if(missionMode && turn===0) push({type:"activity",id:"mission-start",stage:"mission",label:"Planning the mission",detail:"Turning the goal into executable steps",done:true});
              if(!thinkingShown){
                push({type:"activity",id:"thinking",stage:"thinking",label:"Thinking",detail:missionMode?"Working through the mission":"Reasoning about the request"});
                thinkingShown=true;
              }
              let upstream = null;
              let data = null;
              let assistantMessage = null;

              for (const candidate of providerModelFallbacks(model)) {
                try {
                  const requestBody = {
                    model: candidate,
                    stream: true,
                    messages: liveMessages,
                    tools: availableTools,
                    think: thinkingFor(mode,reasoning,candidate),
                    options: {
                      temperature: Math.min(1, profile.temperature * 0.68 + creativity * 0.32),
                      top_p: 0.95,
                      top_k: 64,
                      num_ctx: modelContext(candidate)
                    }
                  };
                  upstream = await fetch(ollamaUrl, {
                    method:"POST",
                    headers:{"Content-Type":"application/json","Authorization":"Bearer "+apiKey},
                    body:JSON.stringify(requestBody),
                    signal:request.signal
                  });

                  if (!upstream.ok) {
                    const raw = await upstream.text();
                    let errorData = null;
                    try { errorData = raw ? JSON.parse(raw) : null; } catch {}
                    console.error("[Cookie stream "+candidate+"]", upstream.status, errorData?.error || raw?.slice(0,300));
                    // Keep provider retries out of the user-facing activity stream; show one concise fallback step below if needed.
                    continue;
                  }

                  if (!upstream.body) throw new Error("Ollama returned no stream body.");
                  const reader = upstream.body.getReader();
                  const decoder = new TextDecoder();
                  let buffer = "";
                  const callMap = new Map();
                  const parts = [];
                  let role = "assistant";

                  const consumeLine = line => {
                    const trimmed = line.trim();
                    if (!trimmed) return;
                    let chunk = null;
                    try { chunk = JSON.parse(trimmed); } catch { return; }
                    const msg = chunk?.message;
                    if (!msg || typeof msg !== "object") return;
                    if (typeof msg.role === "string") role = msg.role;
                    if (typeof msg.content === "string" && msg.content) {
                      parts.push(msg.content);
                      // Keep the internal mission-plan marker out of the live UI. The first mission turn is buffered until completion.
                      if (!(missionMode && turn===0)) push({type:"delta",delta:msg.content});
                    }
                    if (Array.isArray(msg.tool_calls)) {
                      msg.tool_calls.forEach((call, index) => {
                        const key = String(call?.index ?? index);
                        const previous = callMap.get(key);
                        callMap.set(key, previous ? {...previous, ...call} : call);
                      });
                    }
                  };

                  while (true) {
                    const chunk = await reader.read();
                    if (chunk.done) break;
                    buffer += decoder.decode(chunk.value, {stream:true});
                    const lines = buffer.split("\n");
                    buffer = lines.pop() || "";
                    for (const line of lines) consumeLine(line);
                  }
                  buffer += decoder.decode();
                  if (buffer.trim()) consumeLine(buffer);

                  assistantMessage = {role, content:parts.join("")};
                  const toolCalls = Array.from(callMap.values()).filter(Boolean);
                  if (toolCalls.length) assistantMessage.tool_calls = toolCalls;
                  data = {message:assistantMessage};
                  usedModel = candidate;
                  break;
                } catch (streamError) {
                  console.error("[Cookie stream fetch]", streamError);
                }
              }

              if (!upstream?.ok || !assistantMessage) {
                if (env?.AI && typeof env.AI.run === "function") {
                  try {
                    push({type:"activity",id:"provider-fallback",stage:"provider",label:"Switching to Cookie fallback",detail:"Ollama Cloud was unavailable, so Cookie is switching providers",done:false});
                    const fallback = await env.AI.run("@cf/zai-org/glm-4.7-flash", {messages:liveMessages,stream:true});
                    const reader2 = fallback?.getReader?.();
                    if (reader2) {
                      const decoder2 = new TextDecoder();
                      let buf2 = "";
                      let combined = "";
                      while (true) {
                        const chunk = await reader2.read();
                        if (chunk.done) break;
                        buf2 += decoder2.decode(chunk.value,{stream:true});
                        const lines2 = buf2.split("\n");
                        buf2 = lines2.pop() || "";
                        for (const line2 of lines2) {
                          const t=line2.replace(/^data:\s*/,"").trim();
                          if(!t)continue;
                          try{
                            const part=JSON.parse(t);
                            const delta=String(part?.response||part?.result?.response||part?.message?.content||"");
                            if(delta){combined+=delta;push({type:"delta",delta});}
                          }catch{}
                        }
                      }
                      if(combined.trim()){
                        assistantMessage={role:"assistant",content:combined};
                        data={message:assistantMessage};
                        usedModel="@cf/zai-org/glm-4.7-flash";
                        upstream={ok:true,status:200};
                      }
                    }
                  }catch(fallbackError){console.error("[Cookie Workers AI fallback]",fallbackError);}
                }
              }
              if (!upstream?.ok || !assistantMessage) {
                throw new Error("AI provider unavailable. Ollama Cloud and the Cloudflare AI fallback both failed.");}

              liveMessages.push(assistantMessage);
              const toolCalls = Array.isArray(assistantMessage.tool_calls) ? assistantMessage.tool_calls : [];
              if (!toolCalls.length) {
                liveMessage = String(assistantMessage.content || "");
                completed = true;
                break;
              }

              for (const call of toolCalls.slice(0, MISSION_MAX_TOOL_CALLS)) {
                const name = call?.function?.name;
                let args = call?.function?.arguments;
                if (typeof args === "string") { try { args = JSON.parse(args); } catch { args = {}; } }
                if (!name) continue;
                const activityId="tool-"+turn+"-"+Math.random().toString(36).slice(2,8);
                const label=toolLabel(name,args);
                push({type:"status",status:statusForTool(name)});
                push({type:"activity",id:activityId,stage:name==="web_search"||name==="web_fetch"?"search":name==="image_generate"?"image":"tool",tool:name,label,detail:toolDetail(name,args),done:false});
                let executed;
                if (name === "calculator") {
                  const calc = safeCalculate(args?.expression);
                  executed = {files:liveFiles,result:JSON.stringify(calc)};
                } else if (name === "image_generate") {
                  executed = {files:liveFiles,result:JSON.stringify(await executeImageTool(env,args,liveImages,sessionUser.id,plan))};
                } else if (name === "web_search" || name === "web_fetch") {
                  const webResult = await executeWebTool(name,args,apiKey);
                  appendWebSources(liveSources, webResult);
                  executed = {files:liveFiles,result:JSON.stringify(webResult)};
                } else if (name === "memory_search" || name === "memory_save" || name === "memory_delete") {
                  executed = {files:liveFiles,result:JSON.stringify(await executeMemoryTool(env, sessionUser.id, name, args))};
                } else {
                  executed = executeFileTool(liveFiles,name,args);
                }
                liveFiles = executed.files;
                let domain="";
                let completedLabel=label;
                let completedDetail=toolDetail(name,args,executed.result);
                if(name==="web_search"){
                  try{
                    const parsed=JSON.parse(executed.result||"{}");
                    const rows=[...(Array.isArray(parsed.results)?parsed.results:[]),...(Array.isArray(parsed.pages)?parsed.pages:[])];
                    const urls=rows.map(x=>x?.url).filter(Boolean);
                    const domains=[...new Set(urls.map(u=>{try{return new URL(u).hostname.replace(/^www\\./i,"")}catch{return ""}}).filter(Boolean))].slice(0,6);
                    domain=domains.join(" · ");
                    completedLabel="Searched "+urls.length+" website"+(urls.length===1?"":"s");
                    completedDetail=String(args?.query||"Live web search").replace(/\\s+/g," ").trim().slice(0,180);
                  }catch{}
                } else if(name==="web_fetch"){
                  try {
                    const host=new URL(String(args?.url||"")).hostname.replace(/^www\\./i,"");
                    completedLabel="Read "+host;
                    completedDetail=String(args?.url||host).slice(0,180);
                  } catch {}
                } else if(name==="file_create") {
                  completedLabel="Created "+String(args?.path||"file").slice(0,120);
                } else if(name==="file_read") {
                  completedLabel="Opened "+String(args?.path||"file").slice(0,120);
                } else if(name==="file_update") {
                  completedLabel="Updated "+String(args?.path||"file").slice(0,120);
                } else if(name==="file_delete") {
                  completedLabel="Removed "+String(args?.path||"file").slice(0,120);
                } else if(name==="calculator") {
                  completedLabel="Calculated the result";
                } else if(name==="image_generate") {
                  completedLabel="Created the image";
                }
                push({
                  type:"activity",id:activityId,stage:name==="web_search"||name==="web_fetch"?"search":name==="image_generate"?"image":"tool",
                  tool:name,label:completedLabel,detail:completedDetail,domain,done:true,
                  meta:name.startsWith("file_")?String(args?.path||""):undefined
                });
                liveMessages.push({role:"tool",tool_name:name,content:executed.result});
              }
            }

            if (!completed) throw new Error("The AI agent did not finish within its tool-step budget.");
            push({type:"status",status:"Finishing…"});
            const missionParsed = missionMarker(liveMessage || "");
            const output = missionParsed.clean || "I couldn't produce a response. Please try again.";
            if (missionMode && missionId) await updateMissionRecord(env,missionId,{status:"completed",plan:missionParsed.plan,result:output,completedAt:nowSeconds()});

            if (plan === "free") {
              try {
                await env.DB.batch([
                  env.DB.prepare("UPDATE users SET credits_remaining=MAX(credits_remaining-1,0),updated_at=? WHERE id=?").bind(Math.floor(Date.now()/1000), sessionUser.id),
                  env.DB.prepare("INSERT INTO usage_events (id,user_id,kind,model,units,created_at) VALUES (?,?,?,?,?,?)").bind(randomToken(16),sessionUser.id,"chat",usedModel,1,Math.floor(Date.now()/1000))
                ]);
              } catch (creditError) {
                console.error("[Cookie stream credit accounting]", creditError);
              }
            }

            push({
              type:"done",
              message:limitResponse(output),
              model:profile.name,
              generatedFiles:liveFiles.map(f=>({name:f.path.split("/").pop()||f.path,path:f.path,content:f.content,kind:f.kind||"file"})),
              generatedImages:liveImages,
              sources:liveSources.slice(0,10),
              creditsRemaining:plan === "free" ? Math.max(0, credits - 1) : null
            });
            controller.close();
          } catch (error) {
            console.error("[Cookie stream]", error);
            push({type:"error",error:String(error?.message||"Cookie could not answer right now.")});
            controller.close();
          }
        }
      });
      return new Response(stream, {
        status:200,
        headers:{
          "Content-Type":"text/event-stream; charset=utf-8",
          "Cache-Control":"no-cache, no-transform",
          "Connection":"keep-alive",
          "X-Accel-Buffering":"no"
        }
      });
    }

    for (let turn = 0; turn < (missionMode ? MISSION_MAX_TURNS : 12); turn++) {
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
            think: thinkingFor(mode,reasoning,candidate),
            options: {
              temperature: Math.min(1, profile.temperature * 0.68 + creativity * 0.32),
              top_p:0.95,
              top_k:64,
              num_ctx:modelContext(candidate)
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
        if (env?.AI && typeof env.AI.run === "function") {
          try {
            const fallback=await env.AI.run("@cf/zai-org/glm-4.7-flash",{messages:agentMessages});
            const content=String(fallback?.response||fallback?.result?.response||fallback?.message?.content||"").trim();
            if(content){
              successfulModel="@cf/zai-org/glm-4.7-flash";
              data={message:{role:"assistant",content}};
              upstream={ok:true,status:200};
            }
          }catch(fallbackError){console.error("[Cookie Workers AI fallback]",fallbackError);}
        }
      }
      if (!upstream?.ok) {
        return json({error:"AI provider unavailable. Ollama Cloud and the Cloudflare AI fallback both failed."},502);
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
          const parsedMission = missionMarker(typeof assistantMessage.content === "string" ? assistantMessage.content : "");
        finalMessage = parsedMission.clean;
        if (missionMode && missionId) await updateMissionRecord(env,missionId,{status:"completed",plan:parsedMission.plan,result:finalMessage,completedAt:nowSeconds()});
        break;
      }

      for (const call of toolCalls.slice(0,8)) {
        const name=call?.function?.name;
        let args=call?.function?.arguments;
        if(typeof args==="string"){try{args=JSON.parse(args)}catch{args={}}}
        let executed;
        if(name === "image_generate") {
          executed = {files:generatedFiles,result:JSON.stringify(await executeImageTool(env,args,generatedImages,sessionUser.id,plan))};
        } else if(name === "web_search" || name === "web_fetch") {
          const webResult = await executeWebTool(name,args,apiKey);
          appendWebSources(webSources, webResult);
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

    if(!finalMessage && lastData?.message?.content) finalMessage=missionMarker(lastData.message.content).clean;
    if(!finalMessage) {
      if(missionMode && missionId) await updateMissionRecord(env,missionId,{status:"blocked",result:"Cookie could not complete the mission."});
      finalMessage = useWebSearch
      ? "I couldn't produce a web-researched answer. The search request did not return a usable response."
      : "I couldn't produce a response. Please try again.";
    }

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
      generatedFiles: generatedFiles.map(f=>({name:f.path.split("/").pop()||f.path,path:f.path,content:f.content,kind:f.kind||"file"})),
      generatedImages: generatedImages,
      sources: webSources.slice(0,10),
      creditsRemaining: plan === "free" ? Math.max(0, credits - 1) : null
    });
  } catch (error) {
    console.error("[Cookie chat]", error);
    return json({ error: "Cookie could not answer right now. Check the Pages Function logs." }, 502);
  }
}
