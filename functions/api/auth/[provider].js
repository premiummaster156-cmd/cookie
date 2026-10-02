import { cookie, dbAvailable, originOf, randomToken } from "./_auth.js";

const configs = {
  google: () => ({
    clientId: String(globalThis.__env?.GOOGLE_CLIENT_ID || "").trim(),
    authorize: "https://accounts.google.com/o/oauth2/v2/auth",
    scope: "openid profile email"
  }),
  github: () => ({
    clientId: String(globalThis.__env?.GITHUB_CLIENT_ID || "").trim(),
    authorize: "https://github.com/login/oauth/authorize",
    scope: "read:user user:email"
  }),
  discord: () => ({
    clientId: String(globalThis.__env?.DISCORD_CLIENT_ID || "").trim(),
    authorize: "https://discord.com/oauth2/authorize",
    scope: "identify email"
  })
};

export async function onRequestGet({ request, env, params }) {
  if (!dbAvailable(env)) return new Response("Cookie auth database is not connected.", {status:503});
  const provider = String(params?.provider || "").toLowerCase();
  if (!["google","github","discord"].includes(provider)) return new Response("Not found", {status:404});
  const clientId = String(env?.[provider==="google"?"GOOGLE_CLIENT_ID":provider==="github"?"GITHUB_CLIENT_ID":"DISCORD_CLIENT_ID"] || "").trim();
  if (!clientId) {
    const target = new URL("/", originOf(request, env));
    target.searchParams.set("auth_error", provider + "_not_configured");
    return Response.redirect(target.toString(), 302);
  }
  const state = randomToken(24);
  const redirectUri = originOf(request, env) + "/api/auth/callback/" + provider;
  let url;
  if (provider==="google") {
    url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id",clientId);
    url.searchParams.set("redirect_uri",redirectUri);
    url.searchParams.set("response_type","code");
    url.searchParams.set("scope","openid profile email");
    url.searchParams.set("access_type","online");
    url.searchParams.set("prompt","select_account");
  } else if (provider==="github") {
    url = new URL("https://github.com/login/oauth/authorize");
    url.searchParams.set("client_id",clientId);
    url.searchParams.set("redirect_uri",redirectUri);
    url.searchParams.set("scope","read:user user:email");
    url.searchParams.set("state",state);
  } else {
    url = new URL("https://discord.com/oauth2/authorize");
    url.searchParams.set("client_id",clientId);
    url.searchParams.set("redirect_uri",redirectUri);
    url.searchParams.set("response_type","code");
    url.searchParams.set("scope","identify email");
    url.searchParams.set("state",state);
  }
  if(provider==="google") url.searchParams.set("state",state);
  return new Response(null,{status:302,headers:{
    Location:url.toString(),
    "Set-Cookie":cookie("__Host-cookie_oauth_"+provider,state,{maxAge:600,sameSite:"Lax"})
  }});
}
