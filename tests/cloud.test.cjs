const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),{PGlite}=require('@electric-sql/pglite');
const Sync=require('../assets/sync'),Port=require('../assets/portability'),Cloud=require('../lib/cloud');
let db;const A='11111111-1111-1111-1111-111111111111',B='22222222-2222-2222-2222-222222222222';
function collection(cigars=[]){return {version:1,humidors:[{id:'home',name:'Home',cigars}],activeHumidorId:'home',humidor:[],wishlist:[],smoked:[],myBar:[],ashPersonalBest:null};}
test.before(async()=>{db=new PGlite();await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);`);await db.exec(fs.readFileSync('database/001_accounts.sql','utf8'));});
test.after(async()=>await db.close());
test.beforeEach(async()=>{await db.exec('truncate auth.users cascade');await db.query('insert into auth.users(id) values ($1),($2)',[A,B]);await db.query('select ensure_profile($1,$2)',[A,'a@example.test']);await db.query('select ensure_profile($1,$2)',[B,'b@example.test']);});
async function save(user,revision,data,migrate=false){return (await db.query('select save_collection($1,$2,$3,$4,$5,$6,$7) as record',[user,revision,data,Cloud.metrics(data).cigars,data.humidors.length,[],migrate])).rows[0].record;}
test('database migration enables RLS and rejects anonymous and authenticated access',async()=>{
 const r=await db.query("select relname,relrowsecurity from pg_class where relname in ('profiles','photos','collections','ai_usage','admin_audit','ai_reports')");assert.equal(r.rows.length,6);assert.ok(r.rows.every(x=>x.relrowsecurity));
 await db.exec('set role authenticated');try{await assert.rejects(db.query('select * from profiles'),/permission denied/);await assert.rejects(db.query('select ensure_profile($1,$2)',[A,'hacked']),/permission denied/);}finally{await db.exec('reset role');}
});
test('collection revisions reject a stale device and preserve the saved copy',async()=>{const initial=await save(A,null,collection());assert.equal(initial.revision,1);await save(A,1,collection([{id:1,name:'First'}]));await assert.rejects(save(A,1,collection([{id:2,name:'Stale'}])),/REVISION_CONFLICT/);const rows=await db.query('select revision,data from collections where user_id=$1',[A]);assert.equal(rows.rows[0].revision,2);assert.equal(rows.rows[0].data.humidors[0].cigars[0].name,'First');});
test('one migration preserves existing over-limit data while later free growth is blocked',async()=>{const entries=Array.from({length:26},(_,i)=>({id:i,name:'Cigar '+i}));await assert.rejects(save(A,null,collection(entries)),/PLAN_LIMIT/);await save(A,null,collection(entries),true);const updated=collection(entries);updated.humidors[0].cigars[0].notes='Edited after downgrade';await save(A,1,updated);await assert.rejects(save(A,2,collection([...entries,{id:99,name:'Extra'}]),true),/PLAN_LIMIT/);await save(A,2,collection(entries.slice(0,25)));});
test('profile upserts do not clear suspension or complimentary access',async()=>{await db.query("update profiles set suspended=true,complimentary_until=now()+interval '1 day' where id=$1",[A]);await db.query('select ensure_profile($1,$2)',[A,'new@example.test']);const p=(await db.query('select * from profiles where id=$1',[A])).rows[0];assert.equal(p.suspended,true);assert.ok(p.complimentary_until);await assert.rejects(save(A,null,collection()),/SUSPENDED/);});
test('AI intro quota is atomic and suspended users cannot consume it',async()=>{for(let i=1;i<=5;i++)assert.equal((await db.query('select consume_ai($1) as used',[A])).rows[0].used,i);await assert.rejects(db.query('select consume_ai($1)',[A]),/AI_LIMIT/);await db.query('update profiles set suspended=true where id=$1',[B]);await assert.rejects(db.query('select consume_ai($1)',[B]),/SUSPENDED/);});
test('expired or stale provider verification does not grant Premium',()=>{assert.equal(Cloud.isPremium({premium_until:'2099-01-01',billing_checked_at:'2000-01-01'}),false);assert.equal(Cloud.isPremium({premium_until:'2000-01-01',billing_checked_at:new Date().toISOString()}),false);assert.equal(Cloud.isPremium({complimentary_until:'2099-01-01'}),true);});
test('cloud photos deduplicate and cannot be linked from another account',async()=>{const photo='data:image/jpeg;base64,YQ==',hash=Cloud.photoHash(photo);await db.query('select put_photo($1,$2,$3)',[A,hash,photo]);await db.query('select put_photo($1,$2,$3)',[A,hash,photo]);assert.equal((await db.query('select count(*)::int n from photos')).rows[0].n,1);await assert.rejects(db.query('select save_collection($1,$2,$3,$4,$5,$6)',[B,null,collection(),0,1,[hash]]),/PHOTO_MISSING/);});
test('account deletion cascades collection, photo, usage, reports and audit',async()=>{await save(A,null,collection());await db.query('select consume_ai($1)',[A]);await db.query('select put_photo($1,$2,$3)',[A,'a'.repeat(64),'data:image/jpeg;base64,YQ==']);await db.query('select report_ai_result($1,$2,$3)',[A,'Incorrect result','result']);await db.query('select admin_account_action($1,$2,$3,$4,$5)',[B,A,'grant','2099-01-01','Support grant']);await db.query('delete from auth.users where id=$1',[A]);for(const table of ['collections','photos','ai_usage','ai_reports','admin_audit'])assert.equal((await db.query('select count(*)::int n from '+table)).rows[0].n,0);});
test('disjoint edits merge and simultaneous modifications stop for review',()=>{const base=collection([{id:1,name:'A',notes:'old'},{id:2,name:'B',qty:2}]),local=structuredClone(base),remote=structuredClone(base);local.humidors[0].cigars[0].notes='local';remote.humidors[0].cigars[1].qty=3;const merged=Sync.merge(base,local,remote);assert.equal(merged.humidors[0].cigars[0].notes,'local');assert.equal(merged.humidors[0].cigars[1].qty,3);remote.humidors[0].cigars[0].notes='remote';assert.throws(()=>Sync.merge(base,local,remote),e=>e.code==='MERGE_CONFLICT');});
test('delete versus edit conflicts, while independent deletions merge',()=>{const base=collection([{id:1,name:'A',notes:'old'},{id:2,name:'B'}]),local=structuredClone(base),remote=structuredClone(base);local.humidors[0].cigars.shift();remote.humidors[0].cigars[0].notes='changed';assert.throws(()=>Sync.merge(base,local,remote),/Both devices changed/);remote.humidors[0].cigars[0].notes='old';assert.equal(Sync.merge(base,local,remote).humidors[0].cigars.length,1);});
test('CSV handles commas, escaped quotes and multiline notes and blocks spreadsheet formulas',()=>{const rows=Port.parseCSV('name,brand,notes,qty\r\n"Cigar, A",Maker,"Line 1\nLine ""2""",2');const records=Port.records(rows,{name:0,brand:1,notes:2,qty:3});assert.equal(records[0].name,'Cigar, A');assert.equal(records[0].notes,'Line 1\nLine "2"');assert.equal(records[0].qty,2);const csv=Port.csv(collection([{id:1,name:'=HYPERLINK("bad")'}]));assert.ok(csv.includes("'=HYPERLINK"));assert.throws(()=>Port.parseCSV('a\n"unclosed'),/not closed/);assert.throws(()=>Port.records([['name','qty'],['A','no']],{name:0,qty:1}),/quantity/);});
test('repeated device imports skip exact records instead of duplicating them',()=>{const source=collection([{id:1,name:'A',qty:2}]);const once=Port.importCollection(collection(),source),twice=Port.importCollection(once,source);assert.equal(twice.humidors.length,1);assert.equal(twice.humidors[0].cigars.length,1);});

test('allowance upgrade preserves usage and permits only the two additional Free requests',async()=>{
 await db.query("insert into ai_usage(user_id,period,used) values ($1,'intro',3)",[A]);
 await db.exec(fs.readFileSync('database/002_free_ai_allowance.sql','utf8'));
 assert.equal((await db.query('select consume_ai($1) as used',[A])).rows[0].used,4);
 assert.equal((await db.query('select consume_ai($1) as used',[A])).rows[0].used,5);
 await assert.rejects(db.query('select consume_ai($1)',[A]),/AI_LIMIT/);
 assert.equal(Cloud.plan({}).ai,5);
 await db.exec('set role authenticated');try{await assert.rejects(db.query('select consume_ai($1)',[A]),/permission denied/);}finally{await db.exec('reset role');}
});
test('promo redemption grants once, preserves usage, enforces expiry and restricts access',async()=>{
 await db.exec(fs.readFileSync('database/003_promo_codes.sql','utf8'));
 const premium='b'.repeat(64),lookups='c'.repeat(64),expired='d'.repeat(64);
 for(const [hash,kind,amount,expiry] of [[premium,'premium',30,'2099-01-01'],[lookups,'lookups',10,'2099-01-01'],[expired,'lookups',10,'2000-01-01']])await db.query('insert into promo_codes(code_hash,kind,amount,expires_at,max_redemptions) values($1,$2,$3,$4,1)',[hash,kind,amount,expiry]);
 const redeem=async(user,hash)=>(await db.query('select redeem_promo($1,$2) as result',[user,hash])).rows[0].result;
 assert.equal((await redeem(A,premium)).ok,true);
 const p=(await db.query('select * from profiles where id=$1',[A])).rows[0];assert.ok(Cloud.isPremium(p));assert.ok(Date.parse(p.complimentary_until)>Date.now()+29*86400000);
 assert.equal((await redeem(A,premium)).ok,false);assert.equal((await redeem(B,premium)).ok,false);
 assert.equal((await redeem(B,expired)).ok,false);assert.equal((await redeem(B,lookups)).ok,true);
 await db.query("insert into ai_usage(user_id,period,used) values($1,'intro',5)",[B]);
 for(let i=0;i<10;i++)await db.query('select consume_ai($1)',[B]);
 await assert.rejects(db.query('select consume_ai($1)',[B]),/AI_LIMIT/);
 assert.equal((await db.query("select used from ai_usage where user_id=$1 and period='intro'",[B])).rows[0].used,5);
 await db.exec('set role authenticated');try{await assert.rejects(db.query('select redeem_promo($1,$2)',[A,premium]),/permission denied/);await assert.rejects(db.query('select * from promo_codes'),/permission denied/);}finally{await db.exec('reset role');}
});
test('owner code creation returns two private codes without saving their plaintext',async()=>{
 await db.exec(fs.readFileSync('database/003_promo_codes.sql','utf8'));
 const rows=(await db.query(fs.readFileSync('database/create_promo_codes.sql','utf8'))).rows;
 assert.equal(rows.length,2);assert.deepEqual(rows.map(x=>x.kind).sort(),['lookups','premium']);
 for(const r of rows){assert.match(r.code,/^TORCIDA-[A-F0-9]{32}$/);const hash=Cloud.photoHash(r.code);assert.equal((await db.query('select max_redemptions from promo_codes where code_hash=$1',[hash])).rows[0].max_redemptions,100);}
});
test('family access has unlimited AI, is revocable and respects suspension, Premium stops at 50',async()=>{
 await db.exec(fs.readFileSync('database/004_family_and_premium.sql','utf8'));
 await db.query("select admin_account_action($1,$2,'grant-family',null,'Family account')",[B,A]);
 let p=(await db.query('select * from profiles where id=$1',[A])).rows[0];assert.equal(Cloud.plan(p).aiUnlimited,true);assert.equal(Cloud.isPremium(p),true);
 for(let i=0;i<55;i++)await db.query('select consume_ai($1)',[A]);
 await db.query('update profiles set suspended=true where id=$1',[A]);await assert.rejects(db.query('select consume_ai($1)',[A]),/SUSPENDED/);
 await db.query('update profiles set suspended=false where id=$1',[A]);
 await db.query("select admin_account_action($1,$2,'revoke-family',null,'Remove family')",[B,A]);
 p=(await db.query('select * from profiles where id=$1',[A])).rows[0];assert.equal(Cloud.isPremium(p),false);
 await db.query("update profiles set complimentary_until=now()+interval '1 day' where id=$1",[B]);
 for(let i=0;i<50;i++)await db.query('select consume_ai($1)',[B]);await assert.rejects(db.query('select consume_ai($1)',[B]),/AI_LIMIT/);
 assert.equal(Cloud.plan({complimentary_until:'2099-01-01'}).ai,50);
});
