import { json } from "../_lib.js";
import { revokeSession, withCookies } from "./_auth.js";

export async function onRequestPost({ request, env }) {
  const response = json({ ok: true });
  const cleared = withCookies(response, [await revokeSession(request, env)]);
  const headers = new Headers(cleared.headers);
  headers.set("Clear-Site-Data", "\"cache\"");
  return new Response(cleared.body, { status: cleared.status, headers });
}
