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

export async function executeWebTool(name,args) {
  const a=args&&typeof args==="object"?args:{};
  if (name==="web_search") return {ok:false,error:"Search-engine API is not configured. Use a specific URL or domain; Cookie can crawl public pages directly."};
  return fetchPage(String(a.url||""),18000);
}

export async function researchWeb(query) {
  const domain=domainOf(query);
  if (!domain) return executeWebTool("web_search",{query});
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