import { createSession, cookie, dbAvailable, normalizeEmail, originOf, randomToken, uniqueUsername, withCookies } from "../_auth.js";

async function exchange(provider, code, redirectUri, env) {
  const params = new URLSearchParams({ code, redirect_uri: redirectUri });
  let tokenUrl = "";
  if (provider === "google") {
    tokenUrl = "https://oauth2.googleapis.com/token";
    params.set("client_id", String(env.GOOGLE_CLIENT_ID || ""));
    params.set("client_secret", String(env.GOOGLE_CLIENT_SECRET || ""));
    params.set("grant_type", "authorization_code");
  } else if (provider === "github") {
    tokenUrl = "https://github.com/login/oauth/access_token";
    params.set("client_id", String(env.GITHUB_CLIENT_ID || ""));
    params.set("client_secret", String(env.GITHUB_CLIENT_SECRET || ""));
  } else {
    tokenUrl = "https://discord.com/api/oauth2/token";
    params.set("client_id", String(env.DISCORD_CLIENT_ID || ""));
    params.set("client_secret", String(env.DISCORD_CLIENT_SECRET || ""));
    params.set("grant_type", "authorization_code");
  }
  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: params
  });
  const raw = await response.text();
  let data = {};
  try {
    data = raw ? JSON.parse(raw) : Object.fromEntries(new URLSearchParams(raw));
  } catch {}
  if (!response.ok || !data.access_token) throw new Error(data.error_description || data.error || "OAuth token exchange failed");
  return String(data.access_token);
}

async function providerProfile(provider, accessToken) {
  const headers = {
    Authorization: "Bearer " + accessToken,
    Accept: "application/json",
    "User-Agent": "CookieAI"
  };
  if (provider === "google") {
    const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers });
    if (!response.ok) throw new Error("Google profile request failed");
    const user = await response.json();
    return {
      id: String(user.sub),
      email: normalizeEmail(user.email),
      emailVerified: Boolean(user.email_verified),
      name: String(user.name || user.given_name || "Cookie user"),
      avatarUrl: String(user.picture || ""),
      username: ""
    };
  }

  if (provider === "github") {
    const [profileResponse, emailResponse] = await Promise.all([
      fetch("https://api.github.com/user", { headers }),
      fetch("https://api.github.com/user/emails", { headers })
    ]);
    if (!profileResponse.ok) throw new Error("GitHub profile request failed");
    const user = await profileResponse.json();
    const emails = emailResponse.ok ? await emailResponse.json() : [];
    const primary = Array.isArray(emails)
      ? emails.find(item => item?.primary && item?.verified) || emails.find(item => item?.verified) || null
      : null;
    return {
      id: String(user.id),
      email: normalizeEmail(primary?.email || user.email || ""),
      emailVerified: Boolean(primary?.verified),
      name: String(user.name || user.login || "Cookie user"),
      avatarUrl: String(user.avatar_url || ""),
      username: String(user.login || "")
    };
  }

  const response = await fetch("https://discord.com/api/v10/users/@me", { headers });
  if (!response.ok) throw new Error("Discord profile request failed");
  const user = await response.json();
  return {
    id: String(user.id),
    email: normalizeEmail(user.email || ""),
    emailVerified: Boolean(user.verified),
    name: String(user.global_name || user.username || "Cookie user"),
    avatarUrl: user.avatar
      ? "https://cdn.discordapp.com/avatars/" + user.id + "/" + user.avatar + ".png?size=128"
      : "",
    username: String(user.username || "")
  };
}

async function finishOAuth(env, provider, profile) {
  const now = Math.floor(Date.now() / 1000);
  const linked = await env.DB.prepare(
    "SELECT user_id FROM oauth_accounts WHERE provider=? AND provider_user_id=? LIMIT 1"
  ).bind(provider, profile.id).first();

  let user = linked
    ? await env.DB.prepare("SELECT * FROM users WHERE id=? LIMIT 1").bind(linked.user_id).first()
    : profile.email
      ? await env.DB.prepare("SELECT * FROM users WHERE email=? LIMIT 1").bind(profile.email).first()
      : null;

  if (!user) {
    const username = await uniqueUsername(env, profile.username || profile.name || profile.email || provider);
    const id = randomToken(18);
    await env.DB.prepare(
      "INSERT INTO users (id,email,email_verified,name,username,avatar_url,plan,credits_remaining,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)"
    ).bind(id, profile.email || null, profile.emailVerified ? 1 : 0, profile.name, username, profile.avatarUrl || "", "free", 100, now, now).run();
    user = await env.DB.prepare("SELECT * FROM users WHERE id=?").bind(id).first();
  } else {
    await env.DB.prepare(
      "UPDATE users SET name=CASE WHEN ?<>'' THEN ? ELSE name END,avatar_url=CASE WHEN ?<>'' THEN ? ELSE avatar_url END,email_verified=CASE WHEN email_verified=1 OR ?=1 THEN 1 ELSE 0 END,updated_at=? WHERE id=?"
    ).bind(
      profile.name || "", profile.name || "",
      profile.avatarUrl || "", profile.avatarUrl || "",
      profile.emailVerified ? 1 : 0,
      now, user.id
    ).run();
    user = await env.DB.prepare("SELECT * FROM users WHERE id=?").bind(user.id).first();
  }

  await env.DB.prepare(
    "INSERT INTO oauth_accounts (id,user_id,provider,provider_user_id,provider_email,created_at,updated_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(provider,provider_user_id) DO UPDATE SET user_id=excluded.user_id,provider_email=excluded.provider_email,updated_at=excluded.updated_at"
  ).bind(randomToken(16), user.id, provider, profile.id, profile.email || null, now, now).run();

  return user;
}

function readCookie(request, name) {
  const raw = request.headers.get("Cookie") || "";
  for (const part of raw.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return "";
}

function redirectHome(request, env, values = {}) {
  const target = new URL("/", originOf(request, env));
  for (const [key, value] of Object.entries(values)) target.searchParams.set(key, String(value));
  return target.toString();
}

export async function onRequestGet({ request, env, params }) {
  if (!dbAvailable(env)) return Response.redirect(redirectHome(request, env, { auth_error:"database_not_configured" }), 302);
  const provider = String(params?.provider || "").toLowerCase();
  if (!["google","github","discord"].includes(provider)) return new Response("Not found", {status:404});

  const url = new URL(request.url);
  const code = String(url.searchParams.get("code") || "");
  const state = String(url.searchParams.get("state") || "");
  const error = String(url.searchParams.get("error") || "");
  const stateCookieName = "__Host-cookie_oauth_" + provider;
  const expected = readCookie(request, stateCookieName);
  const cleared = cookie(stateCookieName, "", {maxAge:0, sameSite:"Lax"});

  if (error) {
    return withCookies(new Response(null, {status:302, headers:{Location:redirectHome(request, env, {auth_error:"oauth_denied"})}}), [cleared]);
  }
  if (!code || !state || !expected || state !== expected) {
    return withCookies(new Response(null, {status:302, headers:{Location:redirectHome(request, env, {auth_error:"oauth_state"})}}), [cleared]);
  }

  try {
    const redirectUri = originOf(request, env) + "/api/auth/callback/" + provider;
    const accessToken = await exchange(provider, code, redirectUri, env);
    const profile = await providerProfile(provider, accessToken);
    const user = await finishOAuth(env, provider, profile);
    const sessionCookie = await createSession(env, user.id, true);
    return withCookies(
      new Response(null, {status:302, headers:{Location:redirectHome(request, env, {auth:"success"})}}),
      [cleared, sessionCookie]
    );
  } catch (error) {
    console.error("[Cookie OAuth]", provider, error);
    return withCookies(
      new Response(null, {status:302, headers:{Location:redirectHome(request, env, {auth_error:"oauth_failed"})}}),
      [cleared]
    );
  }
}
