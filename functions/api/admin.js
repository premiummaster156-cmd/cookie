import { dbAvailable, getSessionUser, normalizeEmail, randomToken } from "./auth/_auth.js";
import { json, readJson } from "./_lib.js";

const OWNER_EMAIL = "cookie.ai.noreply@gmail.com";
const ROLES = new Set(["user","vip","staff","admin","owner"]);
const PLANS = new Set(["free","pro","max"]);

function roleOf(user){
  const email = normalizeEmail(user?.email);
  if(email === OWNER_EMAIL) return "owner";
  return String(user?.role || "user").toLowerCase();
}
function canManage(user){ return ["owner","admin","staff"].includes(roleOf(user)); }
function canChangeRoles(user){ return ["owner","admin"].includes(roleOf(user)); }
function now(){ return Math.floor(Date.now()/1000); }
function cleanEmail(v){ return normalizeEmail(v).slice(0,240); }
function clampInt(v,min,max,fallback){
  const n=Number(v);
  if(!Number.isFinite(n)) return fallback;
  return Math.max(min,Math.min(max,Math.trunc(n)));
}
async function currentLimits(env){
  const defaults={chat_limit_free:10,chat_limit_pro:30,chat_limit_max:60,image_limit_free:3,image_limit_pro:20,image_limit_max:50};
  try{
    const r=await env.DB.prepare("SELECT key,value FROM codebase_settings WHERE key LIKE 'ai_%'").all();
    for(const row of (r.results||[])){
      const key=String(row.key||"").replace(/^ai_/,"");
      if(Object.prototype.hasOwnProperty.call(defaults,key)) defaults[key]=clampInt(row.value,1,10000,defaults[key]);
    }
  }catch{}
  return defaults;
}
async function requireAdmin(request,env){
  if(!dbAvailable(env)) return {error:json({error:"Cookie database is not connected."},503)};
  const user=await getSessionUser(request,env);
  if(!user) return {error:json({error:"Sign in required."},401)};
  if(!canManage(user)) return {error:json({error:"Staff access required.",code:"ADMIN_FORBIDDEN"},403)};
  return {user,role:roleOf(user)};
}

export async function onRequestGet({request,env}){
  const ctx=await requireAdmin(request,env);
  if(ctx.error)return ctx.error;
  try{
    const [total,plans,roles,recent,usage,limits]=await Promise.all([
      env.DB.prepare("SELECT COUNT(*) AS count FROM users").first(),
      env.DB.prepare("SELECT plan,COUNT(*) AS count FROM users GROUP BY plan ORDER BY plan").all(),
      env.DB.prepare("SELECT role,COUNT(*) AS count FROM users GROUP BY role ORDER BY role").all(),
      env.DB.prepare("SELECT id,email,name,username,plan,plan_expires_at,role,credits_remaining,created_at,updated_at FROM users ORDER BY created_at DESC LIMIT 200").all(),
      env.DB.prepare("SELECT kind,COUNT(*) AS count FROM usage_events WHERE created_at>? GROUP BY kind ORDER BY count DESC LIMIT 20").bind(now()-86400).all(),
      currentLimits(env)
    ]);
    return json({
      ok:true,actorRole:ctx.role,
      stats:{
        users:Number(total?.count||0),
        plans:(plans?.results||[]).map(x=>({plan:x.plan,count:Number(x.count||0)})),
        roles:(roles?.results||[]).map(x=>({role:x.role||"user",count:Number(x.count||0)})),
        usage24h:(usage?.results||[]).map(x=>({kind:x.kind,count:Number(x.count||0)}))
      },
      users:(recent?.results||[]).map(x=>({
        id:x.id,email:x.email||"",name:x.name||"",username:x.username||"",
        plan:x.plan||"free",planExpiresAt:Number(x.plan_expires_at||0),
        role:x.role||"user",credits:Number(x.credits_remaining||0),
        createdAt:Number(x.created_at||0),updatedAt:Number(x.updated_at||0)
      })),
      limits
    });
  }catch(error){
    console.error("[Cookie admin GET]",error);
    return json({error:"Admin data could not be loaded."},500);
  }
}

async function findUser(env,email){
  const e=cleanEmail(email);
  if(!e)return null;
  return env.DB.prepare("SELECT id,email,plan,plan_expires_at,role,credits_remaining FROM users WHERE lower(email)=? LIMIT 1").bind(e).first();
}
async function writeSetting(env,key,value){
  const t=now();
  await env.DB.prepare("INSERT INTO codebase_settings (key,value,updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at").bind(key,String(value),t).run();
}

export async function onRequestPost({request,env}){
  const ctx=await requireAdmin(request,env);
  if(ctx.error)return ctx.error;
  try{
    const body=await readJson(request);
    const action=String(body?.action||"").trim();

    if(action==="user"){
      const user=await findUser(env,body?.email);
      if(!user)return json({error:"User not found."},404);
      const nextPlan=PLANS.has(String(body?.plan||"").toLowerCase())?String(body.plan).toLowerCase():user.plan;
      const nextCredits=body?.credits===undefined?Number(user.credits_remaining||0):clampInt(body.credits,0,100000000,Number(user.credits_remaining||0));
      const requestedRole=String(body?.role||user.role||"user").toLowerCase();
      const nextRole=ROLES.has(requestedRole)?requestedRole:String(user.role||"user");
      if(String(user.email||"").toLowerCase()===OWNER_EMAIL&&nextRole!=="owner")return json({error:"The owner role is protected."},403);
      if(!canChangeRoles(ctx.user)&&nextRole!==String(user.role||"user"))return json({error:"Only owner/admin can change account roles."},403);
      if(ctx.role==="staff"&&["admin","owner"].includes(nextRole))return json({error:"Staff cannot promote accounts to admin or owner."},403);
      const expires=body?.planExpiresAt===undefined?Number(user.plan_expires_at||0):clampInt(body.planExpiresAt,0,4102444800,0);
      await env.DB.prepare("UPDATE users SET plan=?,plan_expires_at=?,role=?,credits_remaining=?,updated_at=? WHERE id=?").bind(nextPlan,expires,nextRole,nextCredits,now(),user.id).run();
      return json({ok:true});
    }

    if(action==="gift"){
      const user=await findUser(env,body?.email);
      if(!user)return json({error:"User not found."},404);
      const plan=PLANS.has(String(body?.plan||"").toLowerCase())?String(body.plan).toLowerCase():"free";
      const days=clampInt(body?.days,1,3650,30);
      const grantCredits=body?.credits===undefined?0:clampInt(body.credits,0,100000000,0);
      const expires=plan==="free"?0:now()+days*86400;
      await env.DB.prepare("UPDATE users SET plan=?,plan_expires_at=?,credits_remaining=credits_remaining+?,updated_at=? WHERE id=?").bind(plan,expires,grantCredits,now(),user.id).run();
      return json({ok:true,plan,days,credits:grantCredits});
    }

    if(action==="credit"){
      const delta=clampInt(body?.delta,-100000000,100000000,0);
      if(!delta)return json({error:"Credit change must be non-zero."},400);
      const user=await findUser(env,body?.email);
      if(!user)return json({error:"User not found."},404);
      await env.DB.prepare("UPDATE users SET credits_remaining=GREATEST(credits_remaining+?,0),updated_at=? WHERE id=?").bind(delta,now(),user.id).run();
      await env.DB.prepare("INSERT INTO usage_events (id,user_id,kind,model,units,created_at) VALUES (?,?,?,?,?,?)").bind(randomToken(16),user.id,"admin_credit",String(delta),delta,now()).run().catch(()=>{});
      return json({ok:true});
    }

    if(action==="limits"){
      if(!canChangeRoles(ctx.user))return json({error:"Only owner/admin can change AI limits."},403);
      const allowed=["chat_limit_free","chat_limit_pro","chat_limit_max","image_limit_free","image_limit_pro","image_limit_max"];
      for(const key of allowed){
        if(body?.limits&&body.limits[key]!==undefined)await writeSetting(env,"ai_"+key,clampInt(body.limits[key],1,10000,10));
      }
      return json({ok:true,limits:await currentLimits(env)});
    }

    return json({error:"Unknown admin action."},400);
  }catch(error){
    console.error("[Cookie admin POST]",error);
    return json({error:String(error?.message||"Admin action failed.").slice(0,300)},500);
  }
}
