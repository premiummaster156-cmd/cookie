export async function onRequest(context) {
  const request = context.request;
  if (request.method !== "GET") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Allow": "GET" },
    });
  }

  const env = context.env || {};
  const ready = Boolean(
    typeof env.TURNSTILE_SITE_KEY === "string" && env.TURNSTILE_SITE_KEY.trim() &&
    typeof env.TURNSTILE_SECRET_KEY === "string" && env.TURNSTILE_SECRET_KEY.trim() &&
    typeof env.KUKI_UPSTREAM_TOKEN === "string" && env.KUKI_UPSTREAM_TOKEN.length >= 32 &&
    typeof env.KUKI_API_ORIGINS === "string" && env.KUKI_API_ORIGINS.trim()
  );

  return new Response(JSON.stringify({
    ready,
    turnstileSiteKey: typeof env.TURNSTILE_SITE_KEY === "string" ? env.TURNSTILE_SITE_KEY : "",
  }), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
