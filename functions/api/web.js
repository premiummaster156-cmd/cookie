async function fetchPage(url, maxChars = 18000) {
  const target = String(url || "").trim();
  if (!/^https?:\/\//i.test(target)) return {ok:false,error:"Only public http(s) URLs are supported."};
  try {
    const r = await fetch(target, {
      method:"GET",
      redirect:"follow",
      headers:{Accept:"text/html,application/xhtml+xml,text/plain,application/xml;q=0.9,*/*;q=0.8","User-Agent":"CookieAI/1.0 (+https://cookie.pages.dev)"}
    });
    const raw = await r.text();
    if (!r.ok) return {ok:false,status:r.status,error:"HTTP "+r.status+" while fetching "+target,finalUrl:r.url || target};
    const content = String(raw || "")
      .replace(/<script[\s\S]*?<\/script>/gi," ")
      .replace(/<style[\s\S]*?<\/style>/gi," ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi," ")
      .replace(/<svg[\s\S]*?<\/svg>/gi," ")
      .replace(/<[^>]+>/g," ")
      .replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/&lt;/gi,"<").replace(/&gt;/gi,">")
      .replace(/\s+/g," ").trim().slice(0,maxChars);
    const links=[]; const re=/<a\b[^>]*href=["\']([^"\']+)["\']/gi; let m;
    while ((m=re.exec(raw)) && links.length<80) { try { const u=new URL(m[1],r.url||target); if (u.protocol==="http:"||u.protocol==="https:") links.push(u.href); } catch {} }
    return {ok:true,url:r.url||target,title:(raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||"").replace(/\s+/g," ").trim().slice(0,300),content,links:[...new Set(links)].slice(0,60)};
  } catch(error) { return {ok:false,error:String(error?.message||"Web fetch failed")}; }
}

function domainOf(value) {
  const m=String(value||"").match(/(?:https?:\/\/)?(?:www\.)?([a-z0-9-]+(?:\.[a-z0-9-]+)+)(?:[\/?#][^\s]*)?/i);
  return m?.[1]?.toLowerCase()||"";
}

export async function executeWebTool(name,args,apiKey="") {
  const a=args&&typeof args==="object"?args:{};
  const key=String(apiKey||"").trim();

  // Prefer Ollama's hosted web tools when Cookie is running on Ollama Cloud.
  if (key) {
    const endpoint=name==="web_search"
      ? "https://ollama.com/api/web_search"
      : "https://ollama.com/api/web_fetch";
    const payload=name==="web_search"
      ? {query:String(a.query||"").slice(0,500),max_results:Math.min(8,Math.max(1,Number(a.max_results)||5))}
      : {url:String(a.url||"").slice(0,2000)};
    try {
      const r=await fetch(endpoint,{
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":"Bearer "+key},
        body:JSON.stringify(payload)
      });
      const raw=await r.text();
      let data=null; try { data=raw?JSON.parse(raw):null; } catch {}
      if (r.ok) {
        if(name==="web_search") {
          const results=Array.isArray(data?.results)?data.results.slice(0,8).map(x=>({
            title:String(x?.title||"").slice(0,300),
            url:String(x?.url||""),
            content:String(x?.content||"").slice(0,7000)
          })).filter(x=>x.url):[];
          if(results.length) return {ok:true,results};
        } else {
          const content=String(data?.content||"").slice(0,18000);
          if(content) return {ok:true,title:String(data?.title||""),content,links:Array.isArray(data?.links)?data.links.slice(0,60):[]};
        }
      }
    } catch {}
  }

  // Always retain a public direct-fetch fallback.
  if(name==="web_search") return {ok:false,error:"Ollama web search returned no usable results."};
  return fetchPage(String(a.url||""),18000);
}

export async function researchWeb(query, apiKey = "") {
  const domain=domainOf(query);
  if (!domain) return executeWebTool("web_search",{query},apiKey);
  const base="https://"+domain;
  const pages=[]; const seen=new Set();
  for (const url of [base+"/",base+"/sitemap.xml",base+"/robots.txt"]) {
    const p=await fetchPage(url,url.endsWith(".xml")||url.endsWith(".txt")?30000:18000);
    if (p.ok) pages.push(p);
  }
  const discovered=[];
  for (const p of pages) {
    discovered.push(...(p.links||[]));
    discovered.push(...(String(p.content||"").match(/https?:\/\/[^\s<>"\']+/gi)||[]));
  }
  for (const url of discovered) {
    try {
      const u=new URL(url);
      if (u.hostname!==domain||seen.has(u.href)) continue;
      if (/\.(png|jpe?g|gif|webp|svg|ico|css|js|woff2?|ttf|map|zip|pdf)$/i.test(u.pathname)) continue;
      seen.add(u.href);
      if (pages.length>=10) break;
      const p=await fetchPage(u.href,12000);
      if (p.ok) pages.push(p);
    } catch {}
  }
  return pages.length ? {ok:true,pages:pages.slice(0,10)} : {ok:false,error:"No readable public pages were found for "+domain};
}