import { json } from "../_lib.js";
import { dbAvailable, getSessionUser } from "./_auth.js";

export async function onRequestGet({ request, env }) {
  if (!dbAvailable(env)) return json({ authenticated:false, configured:false, error:"Cookie auth database is not connected." }, 503);
  const user=await getSessionUser(request,env);
  return json({ authenticated:Boolean(user), configured:true, user:user||null });
}
