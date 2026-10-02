import { json } from "../_lib.js";
import { revokeSession, withCookies } from "./_auth.js";

export async function onRequestPost({ request, env }) {
  const response=json({ok:true});
  return withCookies(response,[await revokeSession(request,env),"Clear-Site-Data: \"cache\""]);
}
