const test=require('node:test');
const assert=require('node:assert/strict');
let api;
const valid=(extra={})=>({operation:'identify',max_tokens:999999,model:'untrusted-model',system:'Return JSON',messages:[{role:'user',content:'Padron 1964'}],...extra});
const originalEnv={...process.env};
function resetEnv(){for(const k of Object.keys(process.env))if(/^(AI_|UPSTASH_|KV_|TORCIDA_|ANTHROPIC_|VERCEL|NODE_ENV|CLAUDE_MODEL)/.test(k))delete process.env[k];}
function response(){return {headers:{},statusCode:200,body:null,setHeader(k,v){this.headers[k]=v;},status(n){this.statusCode=n;return this;},json(v){this.body=v;return this;},end(){return this;}};}
function request(body=valid(),extra={}){return {method:'POST',headers:{origin:'https://torcida-proxy.vercel.app'},socket:{remoteAddress:'127.0.0.1'},body,...extra};}
test.before(async()=>{api=await import('../api/chat.js');});
test.beforeEach(()=>resetEnv());
test.after(()=>{resetEnv();Object.assign(process.env,originalEnv);});
test('server fixes model, caps tokens, and strips client-controlled API features',()=>{
 const r=api.validateRequest(valid({tools:[{bad:true}],stream:true}));assert.equal(r.payload.model,'claude-sonnet-4-5');assert.equal(r.payload.max_tokens,1400);assert.equal(r.payload.tools,undefined);assert.equal(r.payload.stream,undefined);assert.ok(r.reserved>=1400);
});
test('unsupported operations, roles, oversized requests, malformed image and token limits reject',()=>{
 const cases=[valid({operation:'arbitrary'}),valid({operation:'toString'}),valid({messages:[{role:'system',content:'bad'}]}),valid({max_tokens:-1}),valid({messages:[{role:'user',content:'a'.repeat(21000)}]}),valid({messages:[{role:'user',content:[{type:'image',source:{type:'url',url:'https://example.com'}}]}]})];
 for(const body of cases)assert.throws(()=>api.validateRequest(body));
});
test('supported image requests are bounded and reservation includes image input',()=>{
 const r=api.validateRequest(valid({messages:[{role:'user',content:[{type:'image',source:{type:'base64',media_type:'image/jpeg',data:'YQ=='}},{type:'text',text:'Identify this cigar'}]}]}));assert.ok(r.reserved>8192);assert.equal(r.payload.messages[0].content[0].source.media_type,'image/jpeg');
});
test('shared minute limit blocks after configured count without contacting AI',async()=>{
 process.env.AI_REQUESTS_PER_MINUTE='2';const now=1900000000000;
 await api.reserveUsage('minute-test',100,undefined,now);await api.reserveUsage('minute-test',100,undefined,now);await assert.rejects(api.reserveUsage('minute-test',100,undefined,now),e=>e.status===429&&e.retry===60);
});
test('global daily budget applies across different IP addresses',async()=>{
 process.env.AI_DAILY_TOKEN_BUDGET='1000';const now=1910000000000;
 await api.reserveUsage('budget-a',700,undefined,now);await assert.rejects(api.reserveUsage('budget-b',400,undefined,now),e=>e.status===429&&e.code==='USAGE_LIMIT');
});
test('production fails closed without durable counters and on Redis failure',async()=>{
 process.env.VERCEL='1';await assert.rejects(api.reserveUsage('prod',100),e=>e.status===503&&e.code==='LIMIT_STORE_REQUIRED');
 process.env.UPSTASH_REDIS_REST_URL='https://example.test';process.env.UPSTASH_REDIS_REST_TOKEN='secret';await assert.rejects(api.reserveUsage('prod',100,async()=>{throw new Error('private connection error');}),e=>e.status===503&&!e.message.includes('private'));
});
test('Redis uses one atomic script, four bounded counters, expiry, and hashed IP',async()=>{
 process.env.UPSTASH_REDIS_REST_URL='https://example.test';process.env.UPSTASH_REDIS_REST_TOKEN='secret';let command;
 await api.reserveUsage('192.0.2.5',200,async(url,opts)=>{command=JSON.parse(opts.body);assert.equal(opts.headers.Authorization,'Bearer secret');return {ok:true,json:async()=>({result:0})};});
 assert.equal(command[0],'EVAL');assert.equal(command[2],'4');assert.ok(!JSON.stringify(command).includes('192.0.2.5'));assert.ok(command[1].includes("redis.call('EXPIRE'"));
 await assert.rejects(api.reserveUsage('redis-limit',100,async()=>({ok:true,json:async()=>({result:4})})),e=>e.status===429);
});
test('CORS, method and access code checks stop unauthorized requests',async()=>{
 let r=response();await api.default(request(valid(),{headers:{origin:'https://unapproved.example'}}),r);assert.equal(r.statusCode,403);assert.equal(r.headers['Access-Control-Allow-Origin'],undefined);
 r=response();await api.default(request(valid(),{method:'GET'}),r);assert.equal(r.statusCode,405);
 r=response();await api.default(request(undefined,{method:'OPTIONS'}),r);assert.equal(r.statusCode,204);
 process.env.TORCIDA_ACCESS_CODE='private-beta';r=response();await api.default(request(),r);assert.equal(r.statusCode,401);assert.equal(r.body.error.code,'ACCESS_CODE_REQUIRED');
});
test('proxy normalizes responses and hides upstream failures and secrets',async()=>{
 const saved=global.fetch;process.env.ANTHROPIC_KEY='test-key';
 try{
  global.fetch=async(url,opts)=>{assert.equal(JSON.parse(opts.body).max_tokens,1400);return {ok:true,json:async()=>({content:[{type:'text',text:JSON.stringify({type:'cigar',name:'Padron',brand:1964,flavor_tags:'cedar,coffee'})}],stop_reason:'end_turn'})};};
  let r=response();await api.default(request(),r);assert.equal(r.statusCode,200);const data=JSON.parse(r.body.content[0].text);assert.deepEqual(data.flavor_tags,['cedar','coffee']);assert.equal(data.brand,'1964');
  global.fetch=async()=>({ok:false,status:401,json:async()=>({error:{message:'test-key private details'}})});r=response();await api.default(request(),r);assert.equal(r.statusCode,502);assert.ok(!JSON.stringify(r.body).includes('test-key'));
 }finally{global.fetch=saved;}
});
test('truncated, malformed, and missing content results fail safely',async()=>{
 const saved=global.fetch;process.env.ANTHROPIC_KEY='test-key';
 try{for(const data of [{stop_reason:'max_tokens',content:[]},{content:'bad'},{content:[{type:'text',text:'{"name":'}]},{content:[{type:'text',text:'{"type":"cigar"}'}]}]){global.fetch=async()=>({ok:true,json:async()=>data});let r=response();await api.default(request(),r);assert.ok([422,502].includes(r.statusCode));assert.ok(r.body.error.message);}}finally{global.fetch=saved;}
});

test('Vercel Marketplace KV REST variables work without copying secrets',async()=>{
 process.env.VERCEL='1';process.env.KV_REST_API_URL='https://marketplace.example.test';process.env.KV_REST_API_TOKEN='marketplace-secret';
 await api.reserveUsage('marketplace',100,async(url,options)=>{assert.equal(url,'https://marketplace.example.test');assert.equal(options.headers.Authorization,'Bearer marketplace-secret');return {ok:true,json:async()=>({result:0})};});
});
