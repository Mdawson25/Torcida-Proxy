/* Run with PLAYWRIGHT_MODULE and CHROMIUM_HELPER pointing to installed local tools. */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
async function main(){
 const helper=(await import(process.env.CHROMIUM_HELPER)).default;
 const {chromium}=require(process.env.PLAYWRIGHT_MODULE);const root=process.cwd();
 const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');res.status=n=>{res.statusCode=n;return res};res.json=v=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(v));};
  try{if(url.pathname.startsWith('/api/')){let chunks=[];for await(const c of req)chunks.push(c);req.body=chunks.length?JSON.parse(Buffer.concat(chunks)):undefined;req.query=Object.fromEntries(url.searchParams);await require(path.join(root,url.pathname+'.js'))(req,res);return;}
   let f=path.join(root,url.pathname==='/'?'index.html':url.pathname);const ext=path.extname(f);res.setHeader('Content-Type',ext==='.js'?'text/javascript':ext==='.css'?'text/css':ext==='.html'?'text/html':'application/octet-stream');res.end(fs.readFileSync(f));
  }catch(e){res.statusCode=500;res.end(e.message);}
 });await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port;process.env.APP_ORIGIN=url;
 const browser=await chromium.launch({executablePath:await helper.executablePath(),args:['--no-sandbox','--disable-gpu','--disable-software-rasterizer','--no-zygote'],headless:true});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);await page.waitForFunction(()=>window.collectionLoaded===true);await page.waitForTimeout(400);
  assert.deepEqual(errors,[]);assert.equal(await page.locator('#account-name').textContent(),'Device collection');
  await page.evaluate(()=>showPage('cigar',null));await page.evaluate(()=>document.getElementById('humidor-form').classList.add('show'));
  await page.locator('#h-name').fill('Manual browser cigar');await page.locator('#h-brand').fill('Test brand');await page.evaluate(()=>addToHumidor());
  assert.equal(await page.evaluate(()=>getActiveHumidor().cigars[0].name),'Manual browser cigar');
  await page.reload();await page.waitForFunction(()=>window.collectionLoaded===true);assert.equal(await page.evaluate(()=>getActiveHumidor().cigars[0].name),'Manual browser cigar');
  await page.evaluate(()=>showPage('about',null));assert.equal(await page.locator('#account-auth').isVisible(),true);
  await page.screenshot({path:'/tmp/torcida-account-settings.png',fullPage:true});
  for(const width of [320,390,768]){await page.setViewportSize({width,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'overflow at '+width);}
  await page.evaluate(()=>showPage('guide',null));assert.equal(await page.locator('.ash-feature').count(),0);assert.equal(await page.locator('#guide-card-quizpill').count(),0);
  await page.goto(url+'/delete-account.html');await page.locator('#delete-email').fill('a@example.test');assert.ok(await page.locator('#deletion-form').isVisible());
  assert.deepEqual(errors,[]);
  // Simulate an account service and cloud record in a fresh browser. Exercise actual IDB namespaces and photo-independent sync.
  const accountContext=context,signed=await accountContext.newPage();const A='11111111-1111-1111-1111-111111111111';let remote=null;
  await signed.route('**/api/account',route=>route.fulfill({json:{configured:true,user:{id:A,email:'a@example.test',plan:{name:'free',cigars:25,humidors:1,photoBytes:10485760,ai:3,aiPeriod:'introductory total'}}}}));
  await signed.route('**/api/collection',async route=>{const r=route.request();if(r.method()==='GET')return route.fulfill({json:{record:remote}});const b=r.postDataJSON();if(b.action==='save'){assert.equal(r.headers()['x-torcida-owner'],A);remote={revision:(remote?.revision||0)+1,data:b.data};return route.fulfill({json:{record:remote}});}return route.fulfill({status:400,json:{error:{message:'Unexpected request'}}});});
  signed.on('pageerror',e=>errors.push(e.message));await signed.goto(url);await signed.waitForFunction(()=>window.collectionLoaded===true);await signed.evaluate(()=>TorcidaAccount.sync());
  assert.equal(await signed.evaluate(()=>getActiveHumidor().cigars.length),0,'guest records cannot auto-attach to another owner');
  await signed.evaluate(async()=>{getActiveHumidor().cigars.push({id:200,name:'Synced browser cigar'});await persistCollection();});await signed.evaluate(()=>TorcidaAccount.sync());await signed.waitForFunction(()=>document.getElementById('account-status').textContent.includes('Cloud sync complete'));
  assert.equal(remote.data.humidors[0].cigars[0].name,'Synced browser cigar');
  await signed.reload();await signed.waitForFunction(()=>window.collectionLoaded===true);assert.equal(await signed.evaluate(()=>getActiveHumidor().cigars[0].name),'Synced browser cigar');assert.deepEqual(errors,[]);
  const B='22222222-2222-2222-2222-222222222222';await signed.unroute('**/api/account');await signed.route('**/api/account',route=>{assert.equal(route.request().headers()['x-torcida-owner'],undefined,'account discovery must not be pinned to the previous owner');return route.fulfill({json:{configured:true,user:{id:B,email:'b@example.test',plan:{name:'free',cigars:25,humidors:1,photoBytes:10485760,ai:3,aiPeriod:'introductory total'}}}});});
  await signed.unroute('**/api/collection');await signed.route('**/api/collection',route=>route.fulfill({json:{record:null}}));await signed.reload();await signed.waitForFunction(()=>window.collectionLoaded===true);assert.equal(await signed.evaluate(()=>TorcidaAccount.scope()),B);assert.equal(await signed.evaluate(()=>getActiveHumidor().cigars.length),0,'signing in to B must not display A records');
  console.log('Browser checks passed: guest save/reload, signed-in sync, account isolation, 320/390/768 widths, deletion form, removed challenge.');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
