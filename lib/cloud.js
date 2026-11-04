'use strict';
const {timingSafeEqual,createHash}=require('node:crypto');
const {validateCollection}=require('../assets/data.js');
function problem(status,code,message){return Object.assign(new Error(message),{status,code});}
function configured(){return !!(process.env.SUPABASE_URL&&process.env.SUPABASE_ANON_KEY&&process.env.SUPABASE_SERVICE_ROLE_KEY);}
function origin(){return process.env.APP_ORIGIN||'https://torcida-proxy.vercel.app';}
function secure(req,res,methods=['GET','POST']){
 res.setHeader('Cache-Control','no-store');res.setHeader('Vary','Origin');
 if(!methods.includes(req.method))throw problem(405,'METHOD','Method not allowed.');
 // Mutation requests require JSON and an exact trusted origin. Native builds use the same HTTPS origin.
 const allowed=new Set([origin()]);
 if(process.env.VERCEL_URL)allowed.add('https://'+process.env.VERCEL_URL);
 if(req.headers.origin&&!allowed.has(req.headers.origin))throw problem(403,'ORIGIN','Open Torcida from its app address.');
 if(req.method!=='GET'&&(!allowed.has(req.headers.origin)||!String(req.headers['content-type']||'').startsWith('application/json')))throw problem(403,'ORIGIN','Please reload Torcida and try again.');
}
async function supa(path,{method='GET',body,token,service=false}={}){
 if(!configured())throw problem(503,'SETUP_REQUIRED','Accounts and cloud sync are not connected yet. Your device collection is available.');
 const key=service?process.env.SUPABASE_SERVICE_ROLE_KEY:process.env.SUPABASE_ANON_KEY;
 const response=await fetch(process.env.SUPABASE_URL.replace(/\/$/,'')+path,{method,headers:{apikey:key,Authorization:'Bearer '+(token||key),'Content-Type':'application/json',Prefer:'return=representation'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(12000)});
 const data=await response.json().catch(()=>null);
 if(!response.ok){
  // Log only a fixed operation and a bounded provider code, never credentials or response bodies.
  const stage=path.startsWith('/rest/')?'database':'authentication';
  const providerCode=String(data?.error_code||data?.code||'unknown');
  console.error('Torcida account service',JSON.stringify({stage,status:response.status,code:/^[a-zA-Z0-9_]{1,64}$/.test(providerCode)?providerCode:'unknown'}));
  if(stage==='authentication'&&providerCode==='email_not_confirmed')throw problem(401,'VERIFY','Confirm your email using the link in your inbox, then return here and sign in.');
  if(stage==='authentication'&&providerCode==='invalid_credentials')throw problem(401,'INVALID_CREDENTIALS','The email or password is incorrect. Use the email you registered with, or reset your password.');
  if(['PGRST202','PGRST205','42P01','42883'].includes(providerCode))throw problem(503,'CLOUD_SCHEMA','The cloud database setup is incomplete. Run database/001_accounts.sql in the Supabase project connected to this preview.');
  if(service&&(response.status===401||response.status===403))throw problem(503,'CLOUD_CREDENTIALS','The cloud database connection was rejected. Check that the Supabase URL and service role key belong to the same project.');
  if(response.status===429)throw problem(429,'ACCOUNT_RATE_LIMIT','Too many account requests. Wait a few minutes, then try again.');
  if(data?.message==='REVISION_CONFLICT')throw problem(409,'REVISION_CONFLICT','The cloud collection changed. Review both versions before continuing.');
  if(data?.message==='PLAN_LIMIT')throw problem(403,'PLAN_LIMIT','This change exceeds your plan allowance. Existing records and exports remain available.');
  if(data?.message==='SUSPENDED')throw problem(403,'SUSPENDED','This account is suspended. Contact support.');
  if(data?.message==='AI_LIMIT')throw problem(429,'AI_LIMIT','Your AI allowance has been used. Manual entry remains available.');
  throw problem(response.status===401?401:502,'SERVICE_ERROR',response.status===401?'Please sign in again.':'The account service could not complete this request. Please try again.');
 }
 return data;
}
function cookie(req,name){const part=String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='));return part?decodeURIComponent(part.slice(name.length+1)):null;}
function sessionCookies(res,session){const options='; HttpOnly; Secure; SameSite=Lax; Path=/';res.setHeader('Set-Cookie',[
 'tc_access='+encodeURIComponent(session?.access_token||'')+options+'; Max-Age='+(session?Math.min(session.expires_in||3600,3600):0),
 'tc_refresh='+encodeURIComponent(session?.refresh_token||'')+options+'; Max-Age='+(session?2592000:0)
]);}
async function identity(req,res,{allowSuspended=false}={}){
 let token=cookie(req,'tc_access'),user=null;
 if(token)try{user=await supa('/auth/v1/user',{token});}catch(e){if(e.status!==401)throw e;}
 if(!user){const refresh=cookie(req,'tc_refresh');if(refresh){const session=await supa('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:refresh}});sessionCookies(res,session);token=session.access_token;user=session.user;}}
 if(!user?.id||!user.email_confirmed_at)throw problem(401,'SIGN_IN','Sign in with a verified email to continue.');
 if(req.headers['x-torcida-owner']&&req.headers['x-torcida-owner']!==user.id)throw problem(409,'ACCOUNT_CHANGED','The signed-in account changed in another tab. Reload before continuing.');
 await ensureProfile(user);
 const rows=await supa('/rest/v1/profiles?id=eq.'+encodeURIComponent(user.id)+'&select=*',{service:true});
 const profile=rows?.[0];if(!profile)throw problem(503,'PROFILE','Your account is still being prepared. Try again.');
 if(profile.suspended&&!allowSuspended)throw problem(403,'SUSPENDED','This account is suspended. Contact support.');
 return {user,profile,token};
}
// Profile creation must never overwrite suspension, grants, or provider access.
async function ensureProfile(user){return supa('/rest/v1/rpc/ensure_profile',{method:'POST',service:true,body:{p_id:user.id,p_email:user.email}});}
function isPremium(profile,now=Date.now()){
 return Date.parse(profile.complimentary_until||'')>now||Date.parse(profile.premium_until||'')>now&&Date.parse(profile.billing_checked_at||'')>now-3600000;
}
function plan(profile){const premium=isPremium(profile);return {name:premium?'premium':'free',cigars:premium?5000:25,humidors:premium?100:1,photoBytes:premium?100*1024*1024:10*1024*1024,ai:premium?30:5,aiPeriod:premium?'calendar month':'introductory total'};}
function safeProfile(profile){return {id:profile.id,email:profile.email,suspended:profile.suspended,plan:plan(profile),purchaseSource:profile.purchase_source||null,premiumUntil:profile.premium_until||null,complimentaryUntil:profile.complimentary_until||null};}
async function rpc(name,body){return supa('/rest/v1/rpc/'+name,{method:'POST',service:true,body});}
function photoHash(data){return createHash('sha256').update(data).digest('hex');}
function validateSnapshot(input){
 const data=JSON.parse(JSON.stringify(input));
 function walk(v){if(!v||typeof v!=='object')return;for(const k of Object.keys(v)){if(k==='photos'&&Array.isArray(v[k]))v[k]=v[k].map(p=>/^tc-photo:[a-f0-9]{64}$/.test(p)?'data:image/jpeg;base64,YQ==':p);else walk(v[k]);}}
 walk(data);validateCollection(data);return input;
}
function metrics(data){return {cigars:data.humidor.length+data.humidors.reduce((n,h)=>n+h.cigars.length,0),humidors:data.humidors.length};}
function error(res,e){return res.status(e.status||500).json({error:{code:e.code||'SERVER_ERROR',message:e.status?e.message:'The request could not be completed. Try again.'}});}
function equalSecret(a,b){if(!a||!b)return false;const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);}
async function admin(req,res){const id=await identity(req,res);const admins=String(process.env.TORCIDA_ADMIN_IDS||'').split(',');let claims={};try{claims=JSON.parse(Buffer.from(id.token.split('.')[1],'base64url'));}catch{}if(!admins.includes(id.user.id)||claims.aal!=='aal2')throw problem(403,'ADMIN_MFA','Administrator access requires an approved account and two-factor sign-in.');return id;}
module.exports={problem,configured,origin,secure,supa,cookie,sessionCookies,identity,ensureProfile,isPremium,plan,safeProfile,rpc,photoHash,validateSnapshot,metrics,error,equalSecret,admin};
