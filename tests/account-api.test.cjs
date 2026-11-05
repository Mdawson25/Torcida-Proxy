const test=require('node:test'),assert=require('node:assert/strict');
const cloud=require('../lib/cloud'),account=require('../api/account'),collection=require('../api/collection'),admin=require('../api/admin'),subscription=require('../api/subscription'),webhook=require('../api/billing-webhook');
const A='11111111-1111-1111-1111-111111111111',B='22222222-2222-2222-2222-222222222222';
const initialEnv={...process.env},originalFetch=global.fetch;let calls=[];
function result(data,status=200){return {ok:status>=200&&status<300,status,json:async()=>data};}
function req(body,extra={}){return {method:body?'POST':'GET',headers:{origin:'https://torcida-proxy.vercel.app','content-type':'application/json',cookie:'tc_access=token','x-torcida-owner':A},body,...extra};}
function res(){return {statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.statusCode=n;return this;},json(v){this.body=v;return this;}};}
function baseline(url,options){
 calls.push({url,options});if(url.endsWith('/auth/v1/user'))return result({id:A,email:'a@example.test',email_confirmed_at:'2026-01-01'});
 if(url.includes('/profiles?'))return result([{id:A,email:'a@example.test',suspended:false}]);
 if(url.includes('/auth/v1/token?'))return result({access_token:'secret-access',refresh_token:'secret-refresh',expires_in:3600,user:{id:A,email:'a@example.test',email_confirmed_at:'2026-01-01'}});
 if(url.includes('/collections?'))return result([]);return result(null);
}
test.beforeEach(()=>{calls=[];process.env.SUPABASE_URL='https://supabase.test';process.env.SUPABASE_ANON_KEY='public';process.env.SUPABASE_SERVICE_ROLE_KEY='server-secret';delete process.env.REVENUECAT_SECRET_KEY;delete process.env.TORCIDA_ADMIN_IDS;global.fetch=async(url,options)=>baseline(url,options);});
test.after(()=>{global.fetch=originalFetch;for(const k of Object.keys(process.env))if(!(k in initialEnv))delete process.env[k];Object.assign(process.env,initialEnv);});
test('login emits secure HttpOnly cookies without returning credentials',async()=>{const r=res();await account(req({action:'login',email:'a@example.test',password:'a strong password'}),r);assert.equal(r.statusCode,200);assert.ok(r.headers['Set-Cookie'].every(x=>x.includes('HttpOnly; Secure; SameSite=Lax')));assert.ok(!JSON.stringify(r.body).includes('secret-access'));});
test('cross-site and originless account mutations are rejected before the provider',async()=>{for(const origin of ['https://bad.test',undefined]){const r=res();await account(req({action:'login',email:'a@example.test',password:'a strong password'},{headers:{origin,'content-type':'application/json'}}),r);assert.equal(r.statusCode,403);}assert.equal(calls.length,0);});
test('unverified users and stale-account tabs cannot reach cloud data',async()=>{const r=res();await collection(req(null,{headers:{origin:'https://torcida-proxy.vercel.app',cookie:'tc_access=token','x-torcida-owner':B}}),r);assert.equal(r.statusCode,409);assert.equal(calls.length,1);global.fetch=async()=>result({id:A,email:'a@example.test'});const unverified=res();await collection(req(),unverified);assert.equal(unverified.statusCode,401);});
test('cloud requests cannot select another owner from query or body',async()=>{const r=res();await collection(req(null,{query:{userId:B}}),r);assert.equal(r.statusCode,200);const query=calls.find(x=>x.url.includes('/collections?')).url;assert.ok(query.includes(A));assert.ok(!query.includes(B));});
test('missing cloud configuration never returns a fake signed-in user',async()=>{delete process.env.SUPABASE_URL;const r=res();await account(req(),r);assert.deepEqual(r.body,{configured:false,user:null});const v=res();await collection(req(),v);assert.equal(v.statusCode,503);});
test('admin allowlist alone is insufficient without a verified second factor',async()=>{process.env.TORCIDA_ADMIN_IDS=A;const r=res();await admin(req(),r);assert.equal(r.statusCode,403);assert.equal(r.body.error.code,'ADMIN_MFA');});
test('verified administrator mutations record actor identity rather than client actor',async()=>{process.env.TORCIDA_ADMIN_IDS=A;const token='e30.'+Buffer.from(JSON.stringify({aal:'aal2'})).toString('base64url')+'.sig';const r=res();await admin(req({action:'suspend',userId:B,actor:B,reason:'Support investigation'},{headers:{origin:'https://torcida-proxy.vercel.app','content-type':'application/json',cookie:'tc_access='+token,'x-torcida-owner':A}}),r);assert.equal(r.statusCode,200);const body=JSON.parse(calls.find(x=>x.url.includes('admin_account_action')).options.body);assert.equal(body.p_actor,A);assert.equal(body.p_target,B);});
test('webhooks reject invalid credentials and do not trust client Premium flags',async()=>{process.env.REVENUECAT_WEBHOOK_AUTH='private-hook';const r=res();await webhook(req({event:{id:'event',app_user_id:A,premium:true}},{headers:{authorization:'wrong'}}),r);assert.equal(r.statusCode,401);assert.equal(calls.length,0);});
test('subscription reconciliation uses server data and excludes sandbox from production',async()=>{process.env.REVENUECAT_SECRET_KEY='private-billing';delete process.env.ALLOW_SANDBOX_BILLING;global.fetch=async(url,options)=>{if(url.startsWith('https://api.revenuecat.com')){assert.equal(options.headers.Authorization,'Bearer private-billing');return result({subscriber:{entitlements:{premium:{expires_date:'2099-01-01',product_identifier:'premium_annual'}},subscriptions:{premium_annual:{is_sandbox:true,store:'app_store'}}}});}return baseline(url,options);};await subscription.reconcile(A);const patch=calls.find(x=>x.options.method==='PATCH');assert.equal(JSON.parse(patch.options.body).premium_until,null);});
test('processor deletion failure leaves the account intact and reports a retry',async()=>{process.env.REVENUECAT_SECRET_KEY='private-billing';global.fetch=async(url,options)=>url.startsWith('https://api.revenuecat.com')?result({},503):baseline(url,options);const r=res();await account(req({action:'delete',password:'a strong password',confirmation:'DELETE'}),r);assert.equal(r.statusCode,503);assert.ok(!calls.some(x=>x.url.includes('/admin/users/')));});
test('expired access tokens refresh through a secure cookie and reverify the user',async()=>{let requests=0;global.fetch=async(url,options)=>{if(url.endsWith('/auth/v1/user')&&++requests===1)return result({},401);return baseline(url,options);};const r=res();await account(req(null,{headers:{cookie:'tc_access=expired; tc_refresh=refresh'}}),r);assert.equal(r.statusCode,200);assert.ok(r.headers['Set-Cookie']);assert.equal(requests,1);assert.ok(calls.some(x=>x.url.includes('refresh_token')));});

test('sign-in explains provider failures without setting cookies or exposing provider details',async()=>{
 const cases=[
  {code:'email_not_confirmed',status:400,expected:'VERIFY',http:401},
  {code:'invalid_credentials',status:400,expected:'INVALID_CREDENTIALS',http:401},
  {code:'PGRST202',status:404,expected:'CLOUD_SCHEMA',http:503,database:true},
  {code:'PGRST301',status:401,expected:'CLOUD_CREDENTIALS',http:503,database:true}
 ];
 for(const c of cases){
  global.fetch=async(url,options)=>!c.database||url.includes('/rest/')?result({code:c.code,message:'private provider detail'},c.status):baseline(url,options);
  const r=res();await account(req({action:'login',email:'a@example.test',password:'a strong password'}),r);
  assert.equal(r.statusCode,c.http);assert.equal(r.body.error.code,c.expected);
  assert.equal(r.headers['Set-Cookie'],undefined);assert.ok(!JSON.stringify(r.body).includes('private provider detail'));
 }
});

test('recovery returns to the trusted preview that requested it',async()=>{
 process.env.VERCEL_URL='preview.example.test';
 try{
  const r=res();await account(req({action:'recover',email:'a@example.test'},{headers:{origin:'https://preview.example.test','content-type':'application/json'}}),r);
  assert.equal(r.statusCode,200);
  const request=calls.find(x=>x.url.includes('/recover?'));
  assert.equal(new URL(request.url).searchParams.get('redirect_to'),'https://preview.example.test/');
 }finally{delete process.env.VERCEL_URL;}
});
test('promo endpoint hashes codes and derives ownership from the session',async()=>{
 const promo=require('../api/promo');let payload;
 global.fetch=async(url,options)=>{if(url.includes('/rpc/redeem_promo')){payload=JSON.parse(options.body);return result({ok:true,message:'10 extra AI lookups added.'});}return baseline(url,options);};
 const r=res();await promo(req({code:'  test-code-12345 ',userId:B}),r);assert.equal(r.statusCode,200);assert.equal(payload.p_user,A);assert.match(payload.p_hash,/^[a-f0-9]{64}$/);assert.ok(!JSON.stringify(payload).includes('TEST-CODE'));
});
