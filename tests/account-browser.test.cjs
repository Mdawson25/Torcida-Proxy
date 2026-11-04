const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync('assets/accounts.js','utf8');
function browser(){
 const events={},timers=[],requests=[],nodes=new Map();
 const node=id=>{if(!nodes.has(id))nodes.set(id,{value:id==='account-email'?'a@example.test':'long password',checked:true,hidden:false,textContent:''});return nodes.get(id);};
 const values=new Map([['tc_owner','11111111-1111-1111-1111-111111111111']]);
 const c={console,Set,Map,Date,JSON,URLSearchParams,structuredClone,document:{getElementById:node,visibilityState:'visible',addEventListener:(n,f)=>events[n]=f},navigator:{onLine:true},localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)},sessionStorage:{getItem:()=>null,removeItem(){},setItem(){}},location:{pathname:'/',search:'',hash:'#about',replace:v=>c.destination=v,reload:()=>c.reloaded=true},history:{replaceState(){}},pendingCollection:null,collectionSaving:0,collectionLoaded:true,setTimeout:f=>{c.pending=f;return 1;},clearTimeout(){},setInterval:(f,ms)=>timers.push({f,ms}),fetch:async(url)=>{requests.push(url);return {ok:true,json:async()=>url==='/api/account'?{configured:true,user:{id:values.get('tc_owner'),email:'a@example.test',plan:{name:'free',ai:5,photoBytes:100,aiPeriod:'introductory total'}}}:{record:null}};},collectionSnapshot:()=>({humidors:[],smoked:[],myBar:[],wishlist:[]}),collectionStore:{readSync:async()=>null}};
 c.window=c;c.addEventListener=(n,f)=>events[n]=f;vm.createContext(c);vm.runInContext(source,c);return {c,events,timers,requests};
}
test('successful sign-in navigates to Find rather than retaining About',async()=>{const {c}=browser();await c.TorcidaAccount.auth('login');assert.equal(c.destination,'/#scanner');assert.equal(c.reloaded,true);});
test('automatic refresh checks visible signed-in apps and skips hidden or offline apps',async()=>{const {c,events,timers,requests}=browser();await c.TorcidaAccount.boot();assert.equal(timers[0].ms,30000);const count=()=>requests.filter(x=>x==='/api/collection').length;
 c.document.visibilityState='hidden';timers[0].f();assert.equal(count(),0);
 c.document.visibilityState='visible';c.navigator.onLine=false;events.focus();assert.equal(count(),0);
 c.navigator.onLine=true;events.visibilitychange();await new Promise(setImmediate);assert.equal(count(),2);
});
