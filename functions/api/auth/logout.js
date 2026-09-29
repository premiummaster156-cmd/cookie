export async function onRequestPost({request,env}){
  const cookie=request.headers.get("Cookie")||"",match=cookie.match(/(?:^|; )cookie_session=([^;]+)/);
  if(env.DB&&match)await env.DB.prepare("DELETE FROM sessions WHERE token=?1").bind(match[1]).run();
  return Response.json({ok:true},{headers:{"Set-Cookie":"cookie_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0"}});
}
