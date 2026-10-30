const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Data = require('../assets/data.js');
const Store = require('../assets/storage.js');
const empty = () => ({version:1,humidors:[{id:'h1',name:'My Humidor',type:'Desktop',humidity:68,temp:68,cigars:[]}],activeHumidorId:'h1',humidor:[],wishlist:[],smoked:[],myBar:[],ashPersonalBest:null});
function storageContext(initial = {}) {
  const values=new Map(Object.entries(initial)), nodes=new Map();let blocked=false,reloaded=false,downloads=[];
  const context={console,JSON,Date,Set,TorcidaData:Data,humidors:[],activeHumidorId:null,humidor:[],wishlist:[],smoked:[],myBar:[],ashPersonalBest:null,
    localStorage:{getItem:k=>values.get(k)??null,setItem:(k,v)=>{if(blocked)throw new Error('QuotaExceededError');values.set(k,String(v));},removeItem:k=>values.delete(k)},
    document:{getElementById:id=>{if(!nodes.has(id))nodes.set(id,{hidden:true,textContent:''});return nodes.get(id);},body:{appendChild(){}},createElement:()=>({click(){},remove(){}})},
    window:{addEventListener(){},location:{reload(){reloaded=true;}}},setTimeout(){},Blob,URL:{createObjectURL(){return 'blob:test';},revokeObjectURL(){}},renderAll(){},showToast(){},openModal(){},closeModal(){}
  };
  context.CollectionStore={...Store,open:()=>Store.open({localStorage:context.localStorage})};
  vm.createContext(context);vm.runInContext(fs.readFileSync(require.resolve('../assets/collection.js'),'utf8'),context);
  const nativeDownload=context.downloadJSON;
  context.downloadJSON=(data,name)=>downloads.push({data,name});
  return {c:context,values,nodes,nativeDownload,block(v){blocked=v;},get reloaded(){return reloaded;},downloads};
}
test('backup round trip preserves photos, collections, freeform wishlist prices and ash record',async()=>{
 const d=empty();d.humidors[0].cigars.push({id:1,name:'Padron',qty:2,price:18});d.wishlist.push({id:2,name:'Rum',price:'$35 to $50'});d.smoked.push({id:3,name:'Padron',rating:5,photos:['data:image/jpeg;base64,YQ==']});d.myBar.push({id:'bar_1',name:'Rum'});d.ashPersonalBest={length:'2 inches',verdict:'Good'};
 assert.deepEqual(Data.validateCollection(JSON.parse(JSON.stringify(d))),d);
 const t=storageContext({tc_collection_v1:JSON.stringify(d)});await t.c.initializeCollection();t.c.exportCollection(false);assert.deepEqual(JSON.parse(JSON.stringify(t.downloads[0].data.collection)),d);
});
test('legacy migration loads all arrays before writing, including old single humidor',async()=>{
 const t=storageContext({tc_humidor:JSON.stringify([{id:1,name:'Old cigar',qty:3}]),tc_wishlist:JSON.stringify([{id:2,name:'Wish'}]),tc_smoked:JSON.stringify([{id:3,name:'Journal'}]),tc_bar:JSON.stringify([{id:'bar_1',name:'Rum'}])});
 await t.c.initializeCollection();const saved=JSON.parse(t.values.get('tc_collection_v1'));assert.equal(saved.humidors[0].cigars[0].name,'Old cigar');assert.equal(saved.wishlist.length,1);assert.equal(saved.smoked.length,1);assert.equal(saved.myBar.length,1);assert.ok(t.values.has('tc_humidor'));
});
test('multi-humidor migration keeps active humidor and ash record',async()=>{
 const d=empty();d.humidors.push({id:'h2',name:'Travel',cigars:[{id:4,name:'Travel cigar'}]});
 const t=storageContext({tc_humidors:JSON.stringify(d.humidors),tc_active_humidor:'h2',tc_ashbest:JSON.stringify({length:'1 inch'})});await t.c.initializeCollection();assert.equal(t.c.activeHumidorId,'h2');assert.equal(t.c.ashPersonalBest.length,'1 inch');
});
test('quota failure rolls back all arrays, retains pending snapshot and retries atomically',async()=>{
 const d=empty(),raw=JSON.stringify(d),t=storageContext({tc_collection_v1:raw});await t.c.initializeCollection();
 t.c.smoked.push({id:1,name:'Unsaved journal',rating:4});t.c.humidors[0].cigars.push({id:2,name:'Unsaved cigar'});t.block(true);
 await assert.rejects(t.c.persistCollection(),/not saved/);assert.equal(t.values.get('tc_collection_v1'),raw);assert.equal(t.c.smoked.length,0);assert.equal(t.c.humidors[0].cigars.length,0);assert.equal(JSON.parse(t.c.pendingCollection).smoked.length,1);assert.equal(t.nodes.get('collection-alert').hidden,false);
 const pending=t.c.pendingCollection;t.c.wishlist.push({id:3,name:'Second change'});await assert.rejects(t.c.persistCollection(),/recovery/i);assert.equal(t.c.pendingCollection,pending);
 t.block(false);await t.c.retryCollectionSave();assert.equal(JSON.parse(t.values.get('tc_collection_v1')).smoked.length,1);assert.equal(t.c.pendingCollection,null);assert.equal(t.reloaded,false);
});
test('corrupt legacy data is preserved and writes are blocked',async()=>{
 const t=storageContext({tc_smoked:'{broken'});await t.c.initializeCollection();assert.equal(t.c.collectionReadBlocked,true);assert.equal(t.values.get('tc_smoked'),'{broken');assert.equal(t.values.has('tc_collection_v1'),false);await assert.rejects(t.c.persistCollection());
});
test('another tab cannot silently overwrite newer saved data',async()=>{
 const t=storageContext({tc_collection_v1:JSON.stringify(empty())});await t.c.initializeCollection();const newer=empty();newer.wishlist.push({id:1,name:'Other tab'});const raw=JSON.stringify(newer);t.values.set('tc_collection_v1',raw);t.c.smoked.push({id:2,name:'This tab'});await assert.rejects(t.c.persistCollection());assert.equal(t.values.get('tc_collection_v1'),raw);
});
test('restore previews, requires confirmation, and downloads current data before replacing',async()=>{
 const t=storageContext({tc_collection_v1:JSON.stringify(empty())});await t.c.initializeCollection();const replacement=empty();replacement.myBar.push({id:'bar_5',name:'Restored rum'});
 const input={files:[{size:1000,text:async()=>JSON.stringify({app:'Torcida',backupVersion:1,collection:replacement})}],value:'file'};await t.c.previewCollectionRestore(input);assert.equal(t.c.myBar.length,0);assert.match(t.nodes.get('restore-summary').textContent,/1 spirits/);await t.c.confirmCollectionRestore();assert.equal(t.downloads.length,1);assert.equal(t.downloads[0].data.collection.myBar.length,0);assert.equal(JSON.parse(t.values.get('tc_collection_v1')).myBar[0].name,'Restored rum');
});
test('invalid restore and failed restore leave saved data unchanged',async()=>{
 const raw=JSON.stringify(empty()),t=storageContext({tc_collection_v1:raw});await t.c.initializeCollection();await t.c.previewCollectionRestore({files:[{size:5,text:async()=>'{}'}],value:'file'});assert.equal(t.c.restoreCandidate,null);assert.equal(t.values.get('tc_collection_v1'),raw);
 t.c.restoreCandidate=empty();t.c.restoreCandidate.wishlist.push({id:1,name:'New'});t.block(true);await t.c.confirmCollectionRestore();assert.equal(t.values.get('tc_collection_v1'),raw);assert.equal(t.c.wishlist.length,0);
});
test('invalid backup schemas, executable photos, markup and dangerous keys are rejected',async()=>{
 for(const mutate of [d=>d.version=2,d=>d.smoked={},d=>d.humidors[0].cigars={},d=>d.smoked.push({id:1,name:'bad',rating:9}),d=>d.smoked.push({id:1,name:'bad',photos:['javascript:alert(1)']}),d=>d.wishlist.push({id:'1);alert(1)',name:'bad'}),d=>d.wishlist.push({id:1,name:'<img src=x onerror=alert(1)>'})]){const d=empty();mutate(d);assert.throws(()=>Data.validateCollection(d));}
 const d=JSON.parse(JSON.stringify(empty()).replace('"version":1','"version":1,"__proto__":{}'));assert.throws(()=>Data.validateCollection(d));
});
test('all AI schemas normalize types and reject missing required data',async()=>{
 assert.deepEqual(Data.normalizeAI({type:'cigar',name:'Padron',brand:1964,flavor_tags:'cedar, coffee'},'identify').flavor_tags,['cedar','coffee']);
 assert.equal(Data.normalizeAI({type:'spirit',name:'Rum',proof:80,tasting_notes:['oak','vanilla']},'identify').tasting_notes,'oak, vanilla');
 assert.deepEqual(Data.normalizeAI({name:'Padron',flavor_tags:{bad:true}},'selector').flavor_tags,[]);
 assert.equal(Data.normalizeAI({cigar_name:'Padron'},'pairing').cigar_name,'Padron');
 assert.equal(Data.normalizeAI({cocktail_name:'Old Fashioned'},'recipes').cocktail_name,'Old Fashioned');
 assert.equal(Data.normalizeAI({cigars:[{name:'Padron',brand:{bad:true}}]},'quiz').cigars[0].brand,'');
 assert.equal(Data.normalizeAI({estimated_length:'2 inches',quality_verdict:'Good'},'ash').quality_verdict,'Good');
 assert.equal(Data.normalizeAI({cigar_name:'Padron'},'occasion').cigar_name,'Padron');
 assert.equal(Data.normalizeAI([{name:'Padron',tasting_notes:['oak']}],'alternatives')[0].tasting_notes,'oak');
 for(const kind of ['identify','selector','pairing','recipes','quiz','ash','occasion','alternatives'])assert.throws(()=>Data.normalizeAI({},kind));
 assert.throws(()=>Data.normalizeAI({name:'<script>alert(1)</script>'},'selector'));
});
test('JSON extraction handles fenced or prefaced JSON but rejects truncated data',async()=>{
 assert.deepEqual(Data.parseAI('```json\n{"name":"Cigar"}\n```'),{name:'Cigar'});assert.deepEqual(Data.parseAI('Here it is: [{"name":"Cigar"}]'),[{name:'Cigar'}]);assert.throws(()=>Data.parseAI('{"name":'));assert.throws(()=>Data.parseAI('no result'));
});
test('every browser AI request uses the shared validated response reader and an operation',async()=>{
 const s=fs.readFileSync(require.resolve('../index.html'),'utf8');assert.equal((s.match(/await readAIResponse\(/g)||[]).length,9);assert.equal((s.match(/operation:'/g)||[]).length,9);assert.ok(!s.includes('data.content.map'));
 for(const m of s.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
});
test('AI bar-match claims require an owned bottle with stock remaining',async()=>{
 const html=fs.readFileSync(require.resolve('../index.html'),'utf8');const start=html.indexOf('function showBarMatchBanner(');const end=html.indexOf('function renderFlavorTags(',start);
 const nodes={'bar-match-banner':{style:{}},'bar-match-name':{},'bar-match-why':{}};const ctx={document:{getElementById:id=>nodes[id]},myBar:[]};vm.createContext(ctx);vm.runInContext(html.slice(start,end),ctx);
 ctx.showBarMatchBanner('Death & Co','AI claim');assert.equal(nodes['bar-match-banner'].style.display,'none');
 ctx.myBar=[{name:'Reserve',brand:'Example',bottles:1}];ctx.showBarMatchBanner('Example Reserve','Match');assert.equal(nodes['bar-match-banner'].style.display,'block');
 ctx.myBar[0].bottles=0;ctx.showBarMatchBanner('Example Reserve','Match');assert.equal(nodes['bar-match-banner'].style.display,'none');
});

function expandedDriver(){
 let record=null,archive=null,count=0,release=null;
 const driver={mode:'indexeddb',fail:false,pause:false,read:async()=>record,archive:async()=>archive,
  write:async(data,expected,raw)=>{
   if(driver.pause){driver.pause=false;await new Promise(resolve=>{release=resolve;});}
   if(driver.fail){const e=new Error('Quota exceeded');e.name='QuotaExceededError';throw e;}
   if((record?record.revision:null)!==expected)throw new Error('Changed in another tab');
   if(raw)archive={values:JSON.parse(JSON.stringify(raw))};record={revision:'idb-'+(++count),data:JSON.parse(JSON.stringify(data))};return record;
  },release(){release();},get waiting(){return !!release;}
 };return driver;
}
test('full localStorage migrates to expanded storage without deleting unarchived data',async()=>{
 const d=empty();d.smoked.push({id:1,name:'Old photo entry',photos:['data:image/jpeg;base64,YQ==']});
 const raw=JSON.stringify(d),t=storageContext({tc_collection_v1:raw,tc_smoked:JSON.stringify(d.smoked),unrelated:'keep',tc_timer_start:'123'}),driver=expandedDriver();
 t.block(true);t.c.CollectionStore.open=async()=>driver;await t.c.initializeCollection();
 assert.deepEqual((await driver.read()).data,d);assert.equal((await driver.archive()).values.tc_collection_v1,raw);assert.equal(t.c.pendingCollection,null);assert.equal(t.values.has('tc_collection_v1'),false);assert.equal(t.values.has('tc_smoked'),false);assert.equal(t.values.get('unrelated'),'keep');assert.equal(t.values.get('tc_timer_start'),'123');assert.equal(t.nodes.get('collection-alert').hidden,true);
});
test('failed expanded-storage migration leaves every original key intact',async()=>{
 const d=empty(),raw=JSON.stringify(d),t=storageContext({tc_collection_v1:raw}),driver=expandedDriver();driver.fail=true;t.c.CollectionStore.open=async()=>driver;await t.c.initializeCollection();assert.equal(t.values.get('tc_collection_v1'),raw);assert.equal(await driver.read(),null);assert.equal(await driver.archive(),null);assert.ok(t.c.pendingCollection);t.c.dismissCollectionNotice();assert.equal(t.nodes.get('collection-alert').hidden,true);assert.ok(t.c.pendingCollection);
});
test('rapid asynchronous saves serialize and preserve both edits',async()=>{
 const t=storageContext(),driver=expandedDriver();t.c.CollectionStore.open=async()=>driver;await t.c.initializeCollection();
 t.c.wishlist.push({id:1,name:'First'});const first=t.c.persistCollection();t.c.wishlist.push({id:2,name:'Second'});const second=t.c.persistCollection();await Promise.all([first,second]);assert.equal((await driver.read()).data.wishlist.length,2);assert.equal(t.c.wishlist.length,2);
});
test('a queued save failure retains the newest pending snapshot and can be dismissed',async()=>{
 const t=storageContext(),driver=expandedDriver();t.c.CollectionStore.open=async()=>driver;await t.c.initializeCollection();driver.fail=true;
 t.c.wishlist.push({id:1,name:'First'});const first=t.c.persistCollection();t.c.wishlist.push({id:2,name:'Second'});const second=t.c.persistCollection();await Promise.allSettled([first,second]);assert.equal(JSON.parse(t.c.pendingCollection).wishlist.length,2);assert.equal(t.c.wishlist.length,0);t.c.dismissCollectionNotice();assert.equal(t.nodes.get('collection-alert').hidden,true);driver.fail=false;await t.c.retryCollectionSave();assert.equal((await driver.read()).data.wishlist.length,2);assert.equal(t.c.pendingCollection,null);
});
test('journal fields and success messages wait for durable completion',async()=>{
 const t=storageContext(),driver=expandedDriver();t.c.CollectionStore.open=async()=>driver;await t.c.initializeCollection();
 const html=fs.readFileSync(require.resolve('../index.html'),'utf8'),a=html.indexOf('async function logSmoke(){'),b=html.indexOf('\nasync function removeSmoked',a);assert.ok(a>0&&b>a);
 t.c.save=()=>t.c.persistCollection();t.c.TorcidaMobile={photoBusy:()=>false};t.c.newRatingVal=4;t.c.pendingPhotos=[];t.c.pairingRatingVal=0;t.c.attrRatings={draw:0,burn:0,flavor:0,construction:0};let success=false;t.c.showToast=()=>success=true;t.c.toggleAddForm=()=>{};t.c.renderSmoked=()=>{};t.c.document.querySelectorAll=()=>[];
 t.nodes.set('s-name',{value:'Draft cigar'});for(const id of ['s-brand','s-date','s-location','s-notes','s-drink-type','s-drink-name','s-photo-input'])t.nodes.set(id,{value:''});t.nodes.set('s-photo-preview',{innerHTML:''});
 vm.runInContext(html.slice(a,b),t.c);driver.pause=true;const saving=t.c.logSmoke();await new Promise(resolve=>setImmediate(resolve));assert.equal(t.nodes.get('s-name').value,'Draft cigar');assert.equal(success,false);driver.release();await saving;assert.equal(t.nodes.get('s-name').value,'');assert.equal(success,true);
});
test('downloads leave a real save link available for mobile browsers',()=>{
 const t=storageContext();t.nodes.set('backup-download-link',{click(){}});t.nativeDownload({safe:true},'Torcida-backup.json');assert.equal(t.nodes.get('backup-download-link').href,'blob:test');assert.equal(t.nodes.get('backup-download-link').download,'Torcida-backup.json');
});
