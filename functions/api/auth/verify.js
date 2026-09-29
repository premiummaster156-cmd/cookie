export async function onRequestGet({ request, env }) {
  const token = new URL(request.url).searchParams.get("token");
  if (!env.DB || !token) return new Response("Invalid verification link.", { status: 400 });
  const row = await env.DB.prepare("SELECT user_id FROM email_tokens WHERE token = ?1 AND type='verify' AND expires_at > datetime('now')").bind(token).first();
  if (!row) return new Response("This verification link is invalid or expired. You can request a new one from Cookie.", { status: 400 });
  await env.DB.prepare("UPDATE users SET email_verified=1 WHERE id=?1").bind(row.user_id).run();
  await env.DB.prepare("DELETE FROM email_tokens WHERE token=?1").bind(token).run();
  return Response.redirect(new URL("/auth.html?verified=1", request.url), 302);
}
