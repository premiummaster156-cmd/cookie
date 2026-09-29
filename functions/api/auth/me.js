export async function onRequestGet({request,env}){
  if(!env.DB)return Response.json({user:null});
  const cookie=request.headers.get("Cookie")||"",match=cookie.match(/(?:^|; )cookie_session=([^;]+)/);
  if(!match)return Response.json({user:null});
  const user=await env.DB.prepare("SELECT u.id,u.name,u.email,u.email_verified FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=?1 AND s.expires_at>datetime('now')").bind(match[1]).first();
  return Response.json({user:user||null});
}
