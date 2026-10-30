const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{execFileSync}=require('node:child_process');
const Guide=require('../assets/guide.js'),Mobile=require('../assets/mobile.js');
const html=fs.readFileSync(require.resolve('../index.html'),'utf8');
test('cigar diagrams use one physical scale for length and ring gauge',()=>{
 const robusto=Guide.metrics(5,50),churchill=Guide.metrics(7,47);assert.equal(robusto.ratio,6.4);assert.equal(robusto.length/churchill.length,5/7);assert.equal(robusto.diameter/churchill.diameter,50/47);
});
test('diagrams have unique IDs, accessible descriptions and distinct shaped silhouettes',()=>{
 const shape={name:'Robusto',length:5,ring:50,wrap:'#7b4a1e',tip:'round'};const a=Guide.cigarSVG(shape),b=Guide.cigarSVG(shape);assert.notEqual(a.match(/id="([^"]+)"/)[1],b.match(/id="([^"]+)"/)[1]);assert.match(a,/role="img"/);assert.match(a,/Unlit cigar/);assert.match(a,/data-length="200"/);assert.match(a,/data-diameter="31.25"/);
 assert.notEqual(a,Guide.cigarSVG({...shape,tip:'torpedo'}));assert.notEqual(Guide.cutSVG('straight'),Guide.cutSVG('v'));assert.notEqual(Guide.cutSVG('v'),Guide.cutSVG('punch'));
});
test('local dates remain correct on either side of UTC midnight',()=>{
 const code="const m=require('./assets/mobile.js');console.log(m.localDate(new Date('2026-10-31T01:30:00Z')));";
 assert.equal(execFileSync(process.execPath,['-e',code],{cwd:require('path').join(__dirname,'..'),env:{...process.env,TZ:'America/New_York'}}).toString().trim(),'2026-10-30');
 assert.equal(execFileSync(process.execPath,['-e',code],{cwd:require('path').join(__dirname,'..'),env:{...process.env,TZ:'Asia/Tokyo'}}).toString().trim(),'2026-10-31');
 assert.ok(!html.includes("toISOString().split('T')[0]"));
});
test('five named destinations preserve existing index-based workflows and settings access',()=>{
 const buttons=[...html.matchAll(/class="nav-tab[^\"]*" data-page="([^\"]+)"/g)].map(m=>m[1]);assert.deepEqual(buttons,['scanner','cigar','bar','smoked','guide']);assert.match(html,/aria-label="Settings and About"/);assert.match(html,/popstate/);assert.match(html,/TorcidaGuide.initialize/);
});
test('mobile viewport enables zoom and safe areas, with native controls and focus support',()=>{
 assert.match(html,/width=device-width, initial-scale=1.0, viewport-fit=cover/);assert.ok(!html.includes('user-scalable=no'));assert.ok(!html.includes('<div class="pill'));assert.ok(!html.includes('<div class="sel-chip'));
 const css=fs.readFileSync(require.resolve('../assets/design.css'),'utf8');for(const feature of ['safe-area-inset-bottom','prefers-reduced-motion','focus-visible','--viewport-height','min-height:48px','white-space:normal'])assert.ok(css.includes(feature));
});
test('photo processing rejects invalid input and always releases decoded object URLs',async()=>{
 const source=fs.readFileSync(require.resolve('../assets/mobile.js'),'utf8');let revoked=false;
 const ctx={module:{exports:{}},Map,console,URL:{createObjectURL:()=> 'blob:test',revokeObjectURL:()=>{revoked=true;}},Image:class{set src(v){this.onerror();}},document:{}};vm.createContext(ctx);vm.runInContext(source,ctx);
 await assert.rejects(ctx.module.exports.preparePhoto({size:0,type:'image/png'}));await assert.rejects(ctx.module.exports.preparePhoto({size:30*1024*1024,type:'image/jpeg'}));await assert.rejects(ctx.module.exports.preparePhoto({size:200,type:'image/heic'}),/JPEG or PNG/);assert.equal(revoked,true);
});
test('PNG processing resizes, converts to JPEG and preserves a matching MIME declaration',async()=>{
 const source=fs.readFileSync(require.resolve('../assets/mobile.js'),'utf8');let canvas,revoked=false;
 const ctx={module:{exports:{}},Map,console,URL:{createObjectURL:()=> 'blob:test',revokeObjectURL:()=>{revoked=true;}},Image:class{constructor(){this.naturalWidth=3200;this.naturalHeight=2400;}set src(v){this.onload();}},FileReader:class{readAsDataURL(blob){this.result='data:image/jpeg;base64,YQ==';this.onload();}},document:{createElement:()=> canvas={getContext:()=>({fillRect(){},drawImage(){}}),toBlob(fn,type){assert.equal(type,'image/jpeg');fn({size:200000});}}}};vm.createContext(ctx);vm.runInContext(source,ctx);
 const photo=await ctx.module.exports.preparePhoto({size:1000000,type:'image/png'},{maxDimension:1200,maxBytes:450000});assert.equal(photo.width,1200);assert.equal(photo.height,900);assert.equal(photo.mediaType,'image/jpeg');assert.equal(photo.base64,'YQ==');assert.equal(revoked,true);
});
test('home-screen assets are complete and the offline shell never caches API requests',()=>{
 const manifest=JSON.parse(fs.readFileSync(require.resolve('../manifest.webmanifest'),'utf8'));assert.equal(manifest.display,'standalone');for(const icon of manifest.icons)assert.ok(fs.existsSync(require('path').join(__dirname,'..',icon.src)));
 const sw=fs.readFileSync(require.resolve('../sw.js'),'utf8');new vm.Script(sw);assert.match(sw,/url.pathname.startsWith\('\/api\/'\)/);assert.match(sw,/if\(url.search\)return/);assert.ok(!sw.includes('skipWaiting'));assert.match(sw,/if\(url.origin!==self.location.origin\)return/);
});
