import { dbAvailable, getSessionUser, normalizeEmail, randomToken, passwordHash } from "./auth/_auth.js";
import { json, readJson } from "./_lib.js";
import { sendReleaseAnnouncementEmail } from "./auth/_email.js";

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
function canManageAccounts(user){ return ["owner","admin"].includes(roleOf(user)); }
function canModerateTarget(actor,target){
  const a=roleOf(actor),t=roleOf(target);
  if(String(target?.email||"").toLowerCase()===OWNER_EMAIL)return false;
  if(a==="staff")return t==="user"||t==="vip";
  if(a==="admin")return t!=="owner";
  return a==="owner";
}
function now(){ return Math.floor(Date.now()/1000); }
function cleanEmail(v){ return normalizeEmail(v).slice(0,240); }
function temporaryPassword(){
  const chars="ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes=new Uint8Array(16); crypto.getRandomValues(bytes);
  return Array.from(bytes,b=>chars[b%chars.length]).join("");
}
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
    const mode=new URL(request.url).searchParams.get("mode")||"";
    if(mode==="moderation"){
      const rows=await env.DB.prepare("SELECT id,email,name,username,role,COALESCE(account_status,'active') AS account_status,COALESCE(suspended_until,0) AS suspended_until,COALESCE(moderation_note,'') AS moderation_note,updated_at FROM users ORDER BY updated_at DESC LIMIT 300").all();
      return json({ok:true,actorRole:ctx.role,users:(rows?.results||[]).map(x=>({id:x.id,email:x.email||"",name:x.name||"",username:x.username||"",role:x.role||"user",status:String(x.account_status||"active"),suspendedUntil:Number(x.suspended_until||0),note:x.moderation_note||"",updatedAt:Number(x.updated_at||0)}))});
    }
    if(ctx.role==="staff")return json({ok:true,actorRole:"staff",users:[]});

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

    if(["user","gift","credit","limits"].includes(action)&&!canManageAccounts(ctx.user))return json({error:"Staff accounts can only perform moderation actions."},403);

    if(action==="announce_release"){
      if(ctx.role!=="owner")return json({error:"Only the Cookie owner can send a release announcement."},403);
      const releaseId=String(body?.releaseId||"").trim().slice(0,160);
      const title=String(body?.title||"New updates are live in Cookie").trim().slice(0,160);
      const intro=String(body?.intro||"Cookie just got a major update. New features and improvements are now live.").trim().slice(0,600);
      const features=Array.isArray(body?.features)?body.features.map(x=>String(x||"").trim()).filter(Boolean).slice(0,8):[];
      const ctaLabel=String(body?.ctaLabel||"Try Cookie").trim().slice(0,60);
      const ctaUrl=String(body?.ctaUrl||"").trim().slice(0,500);
      if(!releaseId)return json({error:"releaseId is required."},400);
      const markerKey="release_email_sent:"+releaseId;
      const previous=await env.DB.prepare("SELECT value,updated_at FROM codebase_settings WHERE key=? LIMIT 1").bind(markerKey).first();
      if(previous)return json({error:"This release announcement has already been sent.",releaseId,sentAt:Number(previous.updated_at||0)*1000},409);
      const rows=await env.DB.prepare("SELECT DISTINCT lower(trim(email)) AS email FROM users WHERE email IS NOT NULL AND trim(email)<>''").all();
      const recipients=(rows?.results||[]).map(row=>String(row.email||"").trim().toLowerCase()).filter(email=>/^\\S+@\\S+\\.\\S+$/.test(email));
      if(!recipients.length)return json({error:"No registered email addresses are available."},404);
      const result=await sendReleaseAnnouncementEmail(request,env,{recipients,title,intro,features,ctaLabel,ctaUrl});
      await env.DB.prepare("INSERT INTO codebase_settings (key,value,updated_at) VALUES (?,?,?)").bind(markerKey,String(result.sent),now()).run();
      return json({ok:true,releaseId,recipients:recipients.length,sent:result.sent,batches:result.batches});
    }


    if(["warn","suspend","ban","unsuspend","unban"].includes(action)){
      if(!["owner","admin","staff"].includes(ctx.role))return json({error:"Moderation permission required."},403);
      const target=await findUser(env,body?.email);
      if(!target)return json({error:"User not found."},404);
      if(!canModerateTarget(ctx.user,target))return json({error:"You cannot moderate this account."},403);
      const reason=String(body?.reason||"").trim().slice(0,500);
      if(!reason&&["warn","suspend","ban"].includes(action))return json({error:"A moderation reason is required."},400);
      const t=now();
      let status=String(target.account_status||"active");
      let until=Number(target.suspended_until||0);
      if(action==="warn"){
        await env.DB.prepare("UPDATE users SET moderation_note=?,updated_at=? WHERE id=?").bind(reason,t,target.id).run();
      }else if(action==="suspend"){
        const days=clampInt(body?.days,1,365,1);
        status="suspended";until=t+days*86400;
        await env.DB.prepare("UPDATE users SET account_status='suspended',suspended_until=?,moderation_note=?,updated_at=? WHERE id=?").bind(until,reason,t,target.id).run();
        await env.DB.prepare("DELETE FROM sessions WHERE user_id=?").bind(target.id).run().catch(()=>{});
      }else if(action==="ban"){
        status="banned";until=0;
        await env.DB.prepare("UPDATE users SET account_status='banned',suspended_until=0,moderation_note=?,updated_at=? WHERE id=?").bind(reason,t,target.id).run();
        await env.DB.prepare("DELETE FROM sessions WHERE user_id=?").bind(target.id).run().catch(()=>{});
      }else{
        status="active";until=0;
        await env.DB.prepare("UPDATE users SET account_status='active',suspended_until=0,moderation_note=?,updated_at=? WHERE id=?").bind(reason,t,target.id).run();
      }
      await env.DB.prepare("INSERT INTO moderation_events (id,target_user_id,actor_user_id,action,reason,duration_seconds,created_at) VALUES (?,?,?,?,?,?,?)")
        .bind(randomToken(16),target.id,ctx.user.id,action,reason,action==="suspend"?Math.max(0,until-t):0,t).run();
      return json({ok:true,status,until});
    }

    if(action==="reset_password"){
      if(!canManageAccounts(ctx.user))return json({error:"Only owner/admin can reset account passwords."},403);
      const target=await findUser(env,body?.email);
      if(!target)return json({error:"User not found."},404);
      if(String(target.email||"").toLowerCase()===OWNER_EMAIL && ctx.role!=="owner")return json({error:"Only the owner can reset the owner account password."},403);
      const password=temporaryPassword();
      const hashed=await passwordHash(password);
      await env.DB.prepare("UPDATE users SET password_hash=?,password_salt=?,login_failures=0,locked_until=0,updated_at=? WHERE id=?")
        .bind(hashed.hash,hashed.salt,now(),target.id).run();
      await env.DB.prepare("DELETE FROM sessions WHERE user_id=?").bind(target.id).run().catch(()=>{});
      return json({ok:true,temporaryPassword:password});
    }

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
