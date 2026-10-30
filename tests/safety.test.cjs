const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Data = require('../assets/data.js');
const empty = () => ({version:1,humidors:[{id:'h1',name:'My Humidor',type:'Desktop',humidity:68,temp:68,cigars:[]}],activeHumidorId:'h1',humidor:[],wishlist:[],smoked:[],myBar:[],ashPersonalBest:null});
function storageContext(initial = {}) {
  const values=new Map(Object.entries(initial)), nodes=new Map();let blocked=false,reloaded=false,downloads=[];
  const context={console,JSON,Date,Set,TorcidaData:Data,humidors:[],activeHumidorId:null,humidor:[],wishlist:[],smoked:[],myBar:[],ashPersonalBest:null,
    localStorage:{getItem:k=>values.get(k)??null,setItem:(k,v)=>{if(blocked)throw new Error('QuotaExceededError');values.set(k,String(v));}},
    document:{getElementById:id=>{if(!nodes.has(id))nodes.set(id,{hidden:true,textContent:''});return nodes.get(id);},body:{appendChild(){}},createElement:()=>({click(){},remove(){}})},
    window:{addEventListener(){},location:{reload(){reloaded=true;}}},setTimeout(){},Blob,URL:{createObjectURL(){return 'blob:test';},revokeObjectURL(){}},renderAll(){},showToast(){},openModal(){},closeModal(){}
  };
  vm.createContext(context);vm.runInContext(fs.readFileSync(require.resolve('../assets/collection.js'),'utf8'),context);
  context.downloadJSON=(data,name)=>downloads.push({data,name});
  return {c:context,values,nodes,block(v){blocked=v;},get reloaded(){return reloaded;},downloads};
}
test('backup round trip preserves photos, collections, freeform wishlist prices and ash record',()=>{
 const d=empty();d.humidors[0].cigars.push({id:1,name:'Padron',qty:2,price:18});d.wishlist.push({id:2,name:'Rum',price:'$35 to $50'});d.smoked.push({id:3,name:'Padron',rating:5,photos:['data:image/jpeg;base64,YQ==']});d.myBar.push({id:'bar_1',name:'Rum'});d.ashPersonalBest={length:'2 inches',verdict:'Good'};
 assert.deepEqual(Data.validateCollection(JSON.parse(JSON.stringify(d))),d);
 const t=storageContext({tc_collection_v1:JSON.stringify(d)});t.c.initializeCollection();t.c.exportCollection(false);assert.deepEqual(JSON.parse(JSON.stringify(t.downloads[0].data.collection)),d);
});
test('legacy migration loads all arrays before writing, including old single humidor',()=>{
 const t=storageContext({tc_humidor:JSON.stringify([{id:1,name:'Old cigar',qty:3}]),tc_wishlist:JSON.stringify([{id:2,name:'Wish'}]),tc_smoked:JSON.stringify([{id:3,name:'Journal'}]),tc_bar:JSON.stringify([{id:'bar_1',name:'Rum'}])});
 t.c.initializeCollection();const saved=JSON.parse(t.values.get('tc_collection_v1'));assert.equal(saved.humidors[0].cigars[0].name,'Old cigar');assert.equal(saved.wishlist.length,1);assert.equal(saved.smoked.length,1);assert.equal(saved.myBar.length,1);assert.ok(t.values.has('tc_humidor'));
});
test('multi-humidor migration keeps active humidor and ash record',()=>{
 const d=empty();d.humidors.push({id:'h2',name:'Travel',cigars:[{id:4,name:'Travel cigar'}]});
 const t=storageContext({tc_humidors:JSON.stringify(d.humidors),tc_active_humidor:'h2',tc_ashbest:JSON.stringify({length:'1 inch'})});t.c.initializeCollection();assert.equal(t.c.activeHumidorId,'h2');assert.equal(t.c.ashPersonalBest.length,'1 inch');
});
test('quota failure rolls back all arrays, retains pending snapshot and retries atomically',()=>{
 const d=empty(),raw=JSON.stringify(d),t=storageContext({tc_collection_v1:raw});t.c.initializeCollection();
 t.c.smoked.push({id:1,name:'Unsaved journal',rating:4});t.c.humidors[0].cigars.push({id:2,name:'Unsaved cigar'});t.block(true);
 assert.throws(()=>t.c.persistCollection(),/not saved/);assert.equal(t.values.get('tc_collection_v1'),raw);assert.equal(t.c.smoked.length,0);assert.equal(t.c.humidors[0].cigars.length,0);assert.equal(JSON.parse(t.c.pendingCollection).smoked.length,1);assert.equal(t.nodes.get('collection-alert').hidden,false);
 const pending=t.c.pendingCollection;t.c.wishlist.push({id:3,name:'Second change'});assert.throws(()=>t.c.persistCollection(),/Recover/);assert.equal(t.c.pendingCollection,pending);
 t.block(false);t.c.retryCollectionSave();assert.equal(JSON.parse(t.values.get('tc_collection_v1')).smoked.length,1);assert.equal(t.c.pendingCollection,null);assert.equal(t.reloaded,true);
});
test('corrupt legacy data is preserved and writes are blocked',()=>{
 const t=storageContext({tc_smoked:'{broken'});t.c.initializeCollection();assert.equal(t.c.collectionReadBlocked,true);assert.equal(t.values.get('tc_smoked'),'{broken');assert.equal(t.values.has('tc_collection_v1'),false);assert.throws(()=>t.c.persistCollection());
});
test('another tab cannot silently overwrite newer saved data',()=>{
 const t=storageContext({tc_collection_v1:JSON.stringify(empty())});t.c.initializeCollection();const newer=empty();newer.wishlist.push({id:1,name:'Other tab'});const raw=JSON.stringify(newer);t.values.set('tc_collection_v1',raw);t.c.smoked.push({id:2,name:'This tab'});assert.throws(()=>t.c.persistCollection());assert.equal(t.values.get('tc_collection_v1'),raw);
});
test('restore previews, requires confirmation, and downloads current data before replacing',async()=>{
 const t=storageContext({tc_collection_v1:JSON.stringify(empty())});t.c.initializeCollection();const replacement=empty();replacement.myBar.push({id:'bar_5',name:'Restored rum'});
 const input={files:[{size:1000,text:async()=>JSON.stringify({app:'Torcida',backupVersion:1,collection:replacement})}],value:'file'};await t.c.previewCollectionRestore(input);assert.equal(t.c.myBar.length,0);assert.match(t.nodes.get('restore-summary').textContent,/1 spirits/);t.c.confirmCollectionRestore();assert.equal(t.downloads.length,1);assert.equal(t.downloads[0].data.collection.myBar.length,0);assert.equal(JSON.parse(t.values.get('tc_collection_v1')).myBar[0].name,'Restored rum');
});
test('invalid restore and failed restore leave saved data unchanged',async()=>{
 const raw=JSON.stringify(empty()),t=storageContext({tc_collection_v1:raw});t.c.initializeCollection();await t.c.previewCollectionRestore({files:[{size:5,text:async()=>'{}'}],value:'file'});assert.equal(t.c.restoreCandidate,null);assert.equal(t.values.get('tc_collection_v1'),raw);
 t.c.restoreCandidate=empty();t.c.restoreCandidate.wishlist.push({id:1,name:'New'});t.block(true);t.c.confirmCollectionRestore();assert.equal(t.values.get('tc_collection_v1'),raw);assert.equal(t.c.wishlist.length,0);
});
test('invalid backup schemas, executable photos, markup and dangerous keys are rejected',()=>{
 for(const mutate of [d=>d.version=2,d=>d.smoked={},d=>d.humidors[0].cigars={},d=>d.smoked.push({id:1,name:'bad',rating:9}),d=>d.smoked.push({id:1,name:'bad',photos:['javascript:alert(1)']}),d=>d.wishlist.push({id:'1);alert(1)',name:'bad'}),d=>d.wishlist.push({id:1,name:'<img src=x onerror=alert(1)>'})]){const d=empty();mutate(d);assert.throws(()=>Data.validateCollection(d));}
 const d=JSON.parse(JSON.stringify(empty()).replace('"version":1','"version":1,"__proto__":{}'));assert.throws(()=>Data.validateCollection(d));
});
test('all AI schemas normalize types and reject missing required data',()=>{
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
test('JSON extraction handles fenced or prefaced JSON but rejects truncated data',()=>{
 assert.deepEqual(Data.parseAI('```json\n{"name":"Cigar"}\n```'),{name:'Cigar'});assert.deepEqual(Data.parseAI('Here it is: [{"name":"Cigar"}]'),[{name:'Cigar'}]);assert.throws(()=>Data.parseAI('{"name":'));assert.throws(()=>Data.parseAI('no result'));
});
test('every browser AI request uses the shared validated response reader and an operation',()=>{
 const s=fs.readFileSync(require.resolve('../index.html'),'utf8');assert.equal((s.match(/await readAIResponse\(/g)||[]).length,9);assert.equal((s.match(/operation:'/g)||[]).length,9);assert.ok(!s.includes('data.content.map'));
 for(const m of s.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
});
test('AI bar-match claims require an owned bottle with stock remaining',()=>{
 const html=fs.readFileSync(require.resolve('../index.html'),'utf8');const start=html.indexOf('function showBarMatchBanner(');const end=html.indexOf('function renderFlavorTags(',start);
 const nodes={'bar-match-banner':{style:{}},'bar-match-name':{},'bar-match-why':{}};const ctx={document:{getElementById:id=>nodes[id]},myBar:[]};vm.createContext(ctx);vm.runInContext(html.slice(start,end),ctx);
 ctx.showBarMatchBanner('Death & Co','AI claim');assert.equal(nodes['bar-match-banner'].style.display,'none');
 ctx.myBar=[{name:'Reserve',brand:'Example',bottles:1}];ctx.showBarMatchBanner('Example Reserve','Match');assert.equal(nodes['bar-match-banner'].style.display,'block');
 ctx.myBar[0].bottles=0;ctx.showBarMatchBanner('Example Reserve','Match');assert.equal(nodes['bar-match-banner'].style.display,'none');
});
