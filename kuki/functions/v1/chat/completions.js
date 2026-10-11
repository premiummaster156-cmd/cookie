const MAX_BODY_BYTES = 64 * 1024;
const MAX_MESSAGES = 20;
const MAX_MESSAGE_CHARS = 12_000;
const MAX_UPSTREAMS = 4;
const MAX_ATTEMPTS = 2;
const MAX_OUTPUT_TOKENS = 256;
const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

class EdgeError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function jsonResponse(status, value, origin = null, extraHeaders = {}) {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    ...extraHeaders,
  });
  if (origin) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
  }
  return new Response(JSON.stringify(value), { status, headers });
}

function allowedOrigins(env) {
  const raw = typeof env.ALLOWED_ORIGINS === "string" ? env.ALLOWED_ORIGINS : "";
  return raw.split(",").map((item) => item.trim()).filter(Boolean);
}

export function isAllowedOrigin(origin, requestOrigin, env = {}) {
  if (!origin) return false;
  return origin === requestOrigin || allowedOrigins(env).includes(origin);
}

export function parseUpstreams(raw) {
  if (typeof raw !== "string" || !raw.trim()) {
    throw new EdgeError(503, "upstream_not_configured", "Kuki's model server is not configured.");
  }

  const values = raw.split(",").map((item) => item.trim()).filter(Boolean);
  if (!values.length || values.length > MAX_UPSTREAMS) {
    throw new EdgeError(503, "upstream_configuration_invalid", "Kuki's model-server configuration is invalid.");
  }

  const origins = [];
  for (const value of values) {
    let parsed;
    try {
      parsed = new URL(value);
    } catch {
      throw new EdgeError(503, "upstream_configuration_invalid", "Kuki's model-server configuration is invalid.");
    }
    if (
      parsed.protocol !== "https:" ||
      parsed.username ||
      parsed.password ||
      parsed.pathname !== "/" ||
      parsed.search ||
      parsed.hash
    ) {
      throw new EdgeError(503, "upstream_configuration_invalid", "Model-server entries must be HTTPS origins without paths or credentials.");
    }
    if (!origins.includes(parsed.origin)) origins.push(parsed.origin);
  }

  if (!origins.length) {
    throw new EdgeError(503, "upstream_not_configured", "Kuki's model server is not configured.");
  }
  return origins;
}

function boundedNumber(value, fallback, low, high, name) {
  if (value === undefined) return fallback;
  if (typeof value !== "number" || !Number.isFinite(value) || value < low || value > high) {
    throw new EdgeError(400, "invalid_request", name + " is outside the allowed range.");
  }
  return value;
}

function boundedInteger(value, fallback, low, high, name) {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || value < low || value > high) {
    throw new EdgeError(400, "invalid_request", name + " is outside the allowed range.");
  }
  return value;
}

export function validateChatPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new EdgeError(400, "invalid_request", "Request body must be a JSON object.");
  }
  if (!Array.isArray(payload.messages) || payload.messages.length === 0) {
    throw new EdgeError(400, "invalid_request", "messages must be a non-empty array.");
  }
  if (payload.messages.length > MAX_MESSAGES) {
    throw new EdgeError(413, "too_many_messages", "Please shorten this conversation and try again.");
  }

  let expectedRole = "user";
  let totalChars = 0;
  const messages = [];
  for (const item of payload.messages) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new EdgeError(400, "invalid_request", "Each message must be an object.");
    }
    if (item.role !== expectedRole) {
      throw new EdgeError(400, "invalid_turn_order", "Only alternating user and assistant chat turns are accepted.");
    }
    if (typeof item.content !== "string" || !item.content.trim()) {
      throw new EdgeError(400, "invalid_request", "Message content must be non-empty text.");
    }
    if (item.content.length > MAX_MESSAGE_CHARS) {
      throw new EdgeError(413, "message_too_large", "Each message is limited to 12,000 characters.");
    }
    totalChars += item.content.length;
    if (totalChars > 32_000) {
      throw new EdgeError(413, "conversation_too_large", "Please shorten this conversation and try again.");
    }
    messages.push({ role: item.role, content: item.content.trim() });
    expectedRole = expectedRole === "user" ? "assistant" : "user";
  }
  if (messages[messages.length - 1].role !== "user") {
    throw new EdgeError(400, "invalid_turn_order", "The last message must be from the user.");
  }

  const requestedTokens = boundedInteger(payload.max_tokens, 128, 1, 4096, "max_tokens");
  return {
    messages,
    max_tokens: Math.min(requestedTokens, MAX_OUTPUT_TOKENS),
    temperature: boundedNumber(payload.temperature, 0.7, 0.01, 2.0, "temperature"),
    top_p: boundedNumber(payload.top_p, 0.95, 0.01, 1.0, "top_p"),
    top_k: boundedInteger(payload.top_k, 40, 1, 262, "top_k"),
  };
}

async function readLimitedBody(request) {
  const lengthHeader = request.headers.get("Content-Length");
  if (lengthHeader !== null) {
    const length = Number(lengthHeader);
    if (!Number.isSafeInteger(length) || length < 0) {
      throw new EdgeError(400, "invalid_content_length", "Invalid Content-Length header.");
    }
    if (length > MAX_BODY_BYTES) {
      throw new EdgeError(413, "request_too_large", "Chat requests are limited to 64 KB.");
    }
  }

  if (!request.body) throw new EdgeError(400, "empty_body", "Request body is empty.");
  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      total += part.value.byteLength;
      if (total > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new EdgeError(413, "request_too_large", "Chat requests are limited to 64 KB.");
      }
      chunks.push(part.value);
    }
  } finally {
    try { reader.releaseLock(); } catch { /* stream already closed */ }
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new EdgeError(400, "invalid_encoding", "Request body must be valid UTF-8.");
  }
}

export async function verifyTurnstile(token, secret, hostname, remoteIp = "") {
  if (typeof token !== "string" || !token || token.length > 2048) {
    return { ok: false, unavailable: false };
  }
  const form = new URLSearchParams({ secret, response: token });
  if (remoteIp) form.set("remoteip", remoteIp);

  let response;
  try {
    response = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    return { ok: false, unavailable: true };
  }

  if (!response.ok) return { ok: false, unavailable: true };
  let result;
  try { result = await response.json(); } catch { return { ok: false, unavailable: true }; }

  return {
    ok: result.success === true &&
      result.action === "cookie_chat" &&
      typeof result.hostname === "string" &&
      result.hostname.toLowerCase() === hostname.toLowerCase(),
    unavailable: false,
  };
}

function shuffledOrigins(origins) {
  if (origins.length < 2) return origins.slice();
  const copy = origins.slice();
  const start = Math.floor(Math.random() * copy.length);
  return copy.slice(start).concat(copy.slice(0, start));
}

function responseHeaders(origin) {
  const headers = new Headers({
    "Cache-Control": "no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  });
  if (origin) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
  }
  return headers;
}

async function handleChat(context) {
  const request = context.request;
  const env = context.env || {};
  const url = new URL(request.url);
  const origin = request.headers.get("Origin");

  if (!isAllowedOrigin(origin, url.origin, env)) {
    return jsonResponse(403, {
      error: { code: "origin_denied", message: "This origin is not allowed to use Cookie AI chat." },
    });
  }

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "600",
        "Cache-Control": "no-store",
        "Vary": "Origin",
      },
    });
  }
  if (request.method !== "POST") {
    return jsonResponse(405, {
      error: { code: "method_not_allowed", message: "Use POST for chat requests." },
    }, origin, { Allow: "POST, OPTIONS" });
  }

  if (
    typeof env.TURNSTILE_SITE_KEY !== "string" || !env.TURNSTILE_SITE_KEY.trim() ||
    typeof env.TURNSTILE_SECRET_KEY !== "string" || !env.TURNSTILE_SECRET_KEY.trim() ||
    typeof env.KUKI_UPSTREAM_TOKEN !== "string" || env.KUKI_UPSTREAM_TOKEN.length < 32
  ) {
    return jsonResponse(503, {
      error: { code: "security_not_configured", message: "Secure chat is temporarily locked until its verification and server credentials are configured." },
    }, origin);
  }

  let origins;
  try {
    origins = parseUpstreams(env.KUKI_API_ORIGINS);
  } catch (error) {
    if (error instanceof EdgeError) return jsonResponse(error.status, { error: { code: error.code, message: error.message } }, origin);
    return jsonResponse(503, { error: { code: "upstream_configuration_invalid", message: "Kuki's model-server configuration is invalid." } }, origin);
  }

  const contentType = request.headers.get("Content-Type") || "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return jsonResponse(415, { error: { code: "json_required", message: "Send chat requests as application/json." } }, origin);
  }

  let raw;
  try {
    raw = await readLimitedBody(request);
  } catch (error) {
    if (error instanceof EdgeError) return jsonResponse(error.status, { error: { code: error.code, message: error.message } }, origin);
    return jsonResponse(400, { error: { code: "invalid_request", message: "Unable to read the request body." } }, origin);
  }

  let parsed;
  try { parsed = JSON.parse(raw); } catch {
    return jsonResponse(400, { error: { code: "invalid_json", message: "Request body must be valid JSON." } }, origin);
  }
  const token = parsed && typeof parsed === "object" ? parsed.turnstile_token : null;

  let cleanPayload;
  try {
    cleanPayload = validateChatPayload(parsed);
  } catch (error) {
    if (error instanceof EdgeError) return jsonResponse(error.status, { error: { code: error.code, message: error.message } }, origin);
    return jsonResponse(400, { error: { code: "invalid_request", message: "The chat request is invalid." } }, origin);
  }

  const clientIp = request.headers.get("CF-Connecting-IP") || "";
  const verification = await verifyTurnstile(token, env.TURNSTILE_SECRET_KEY, url.hostname, clientIp);
  if (verification.unavailable) {
    return jsonResponse(503, {
      error: { code: "verification_unavailable", message: "Security verification is temporarily unavailable. Please try again shortly." },
    }, origin);
  }
  if (!verification.ok) {
    return jsonResponse(403, {
      error: { code: "verification_failed", message: "Complete the security check, then send your message again." },
    }, origin);
  }

  const orderedOrigins = shuffledOrigins(origins).slice(0, Math.min(MAX_ATTEMPTS, origins.length));
  let lastFailure = null;
  for (let index = 0; index < orderedOrigins.length; index += 1) {
    const upstreamUrl = orderedOrigins[index] + "/v1/chat/completions";
    let upstream;
    try {
      upstream = await fetch(upstreamUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Authorization": "Bearer " + env.KUKI_UPSTREAM_TOKEN,
        },
        body: JSON.stringify(cleanPayload),
        redirect: "manual",
        signal: AbortSignal.timeout(120_000),
      });
    } catch {
      lastFailure = "unreachable";
      continue;
    }

    if ([502, 503, 504].includes(upstream.status) && index + 1 < orderedOrigins.length) {
      try { await upstream.body?.cancel(); } catch { /* ignore cancellation failures */ }
      lastFailure = "unavailable";
      continue;
    }
    if (upstream.status === 401 || upstream.status === 403) {
      try { await upstream.body?.cancel(); } catch { /* ignore cancellation failures */ }
      return jsonResponse(503, {
        error: { code: "upstream_auth_misconfigured", message: "Kuki's model server rejected the private edge credential. Please contact the site administrator." },
      }, origin);
    }

    const headers = responseHeaders(origin);
    const contentTypeFromUpstream = upstream.headers.get("Content-Type");
    headers.set("Content-Type", contentTypeFromUpstream && contentTypeFromUpstream.toLowerCase().includes("json")
      ? contentTypeFromUpstream
      : "application/json; charset=utf-8");
    const retryAfter = upstream.headers.get("Retry-After");
    if (retryAfter) headers.set("Retry-After", retryAfter);
    return new Response(upstream.body, { status: upstream.status, headers });
  }

  return jsonResponse(503, {
    error: {
      code: "model_pool_unavailable",
      message: lastFailure === "unreachable"
        ? "Kuki's model servers could not be reached. Please try again shortly."
        : "Kuki's model servers are temporarily unavailable. Please try again shortly.",
    },
  }, origin);
}

export async function onRequest(context) {
  return handleChat(context);
}
