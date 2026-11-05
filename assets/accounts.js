/* Account sessions stay in HttpOnly cookies. Device stores are separated by owner. */
var TorcidaAccount=(function(){
 var user=null,owner=null,verified=false,config=false,syncTimer=null,syncing=false,dirty=false,conflict=null,applying=false,queued=false,importing=false,uploaded=new Set();
 function status(text){var el=document.getElementById('account-status');if(el)el.textContent=text;}
 async function api(path,body){var options={credentials:'same-origin',headers:{'Content-Type':'application/json'}};if(owner&&(path!=='account'||body))options.headers['X-Torcida-Owner']=owner;if(body){options.method='POST';options.body=JSON.stringify(body);}var res=await fetch('/api/'+path,options),data=await res.json();if(!res.ok){var e=new Error(data.error?.message||'Please retry.');e.code=data.error?.code;throw e;}return data;}
 function cachedOwner(){try{var v=localStorage.getItem('tc_owner');return /^[a-f0-9-]{36}$/.test(v||'')?v:null;}catch{return null;}}
 function draw(){
  document.getElementById('account-auth').hidden=!!user;
  document.getElementById('account-tools').hidden=!user;
  document.getElementById('account-name').textContent=user?user.email+' • '+user.plan.name:'Device collection';
  document.getElementById('account-plan').textContent=user?'AI: '+(user.plan.aiUnlimited?'Unlimited lookups':user.plan.ai+' requests per '+user.plan.aiPeriod)+'. Extra AI lookups remaining: '+(user.bonusAI||0)+'. Photo storage: '+Math.round(user.plan.photoBytes/1048576)+' MB.':'';
  document.getElementById('account-conflict').hidden=!conflict;
 }
 async function boot(){
  owner=cachedOwner();
  try{
   var fragment=new URLSearchParams(location.hash.slice(1));
   if(fragment.get('access_token')){
    var recovery=fragment.get('type')==='recovery';
    history.replaceState(null,'',recovery?'#about':'#scanner');
    await api('account',{action:'recovery-session',access_token:fragment.get('access_token'),refresh_token:fragment.get('refresh_token')});owner=null;
    if(recovery)sessionStorage.setItem('tc_password_reset','1');
   }
   var result=await api('account');config=result.configured;user=result.user;owner=user?.id||null;verified=!!user;
   if(user&&user.premiumUntil&&!user.suspended){try{user=(await api('subscription',{})).user;}catch(e){/* Existing records remain available when billing verification is offline. */}}
   if(owner)localStorage.setItem('tc_owner',owner);else localStorage.removeItem('tc_owner');
   status(config?(user?(user.suspended?'Account suspended. You can export device data or delete your account.':'Signed in. Opening your device copy.'):'Use a free account to sync. Manual logging also works on this device.'):'Accounts are being connected. Manual logging and backups remain available.');
  }catch(e){status('Offline or account service unavailable. Opening the last device copy. Sign-in is required before cloud changes.');}
  draw();
  if(user&&sessionStorage.getItem('tc_password_reset')==='1'){
   status('Enter a new password below, then click Change password to finish resetting it.');
   setTimeout(function(){var input=document.getElementById('account-new-password');if(input){input.scrollIntoView({block:'center'});input.focus();}},0);
  }
  return owner;
 }
 async function auth(action){
  var button=document.getElementById('account-submit');button.disabled=true;
  try{
   if(pendingCollection||collectionSaving)throw new Error('Finish Storage recovery before switching accounts.');
   var result=await api('account',{action:action,email:document.getElementById('account-email').value.trim(),password:document.getElementById('account-password').value,adult:document.getElementById('account-adult').checked});
   document.getElementById('account-password').value='';status(result.message);
   if(action==='login'){sessionStorage.removeItem('tc_ai_consent');location.replace(location.pathname+location.search+'#scanner');location.reload();}
  }catch(e){status(e.message);}finally{button.disabled=false;}
 }
 async function encode(data){
  var out=structuredClone(data),known=new Map();
  async function walk(v){if(!v||typeof v!=='object')return;for(var k of Object.keys(v)){if(k==='photos'&&Array.isArray(v[k])){var refs=[];for(var p of v[k]){if(!known.has(p)){var hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(p)))).map(x=>x.toString(16).padStart(2,'0')).join('');var ref='tc-photo:'+hash;if(!uploaded.has(ref)){ref=(await api('collection',{action:'photo',data:p})).ref;uploaded.add(ref);}known.set(p,ref);}refs.push(known.get(p));}v[k]=refs;}else await walk(v[k]);}}
  await walk(out);return out;
 }
 async function decode(data){
  var out=structuredClone(data),known=new Map();
  async function walk(v){if(!v||typeof v!=='object')return;for(var k of Object.keys(v)){if(k==='photos'&&Array.isArray(v[k])){var photos=[];for(var p of v[k]){if(!/^tc-photo:[a-f0-9]{64}$/.test(p))throw new Error('Cloud photo reference is invalid.');if(!known.has(p))known.set(p,(await api('collection',{action:'read-photo',hash:p.slice(9)})).data);uploaded.add(p);photos.push(known.get(p));}v[k]=photos;}else await walk(v[k]);}}
  await walk(out);return TorcidaData.validateCollection(out);
 }
 async function localReplace(data){
  if(collectionSaving||pendingCollection)throw new Error('Finish saving before accepting cloud changes.');
  applying=true;try{applyCollection(data);await persistCollection();renderAll();}finally{applying=false;}
 }
 function empty(){return {version:1,humidors:[],activeHumidorId:null,humidor:[],wishlist:[],smoked:[],myBar:[],ashPersonalBest:null};}
 async function sync(){
  if(!owner||!verified||syncing||conflict||!collectionLoaded||pendingCollection||navigator.onLine===false)return;
  if(cachedOwner()!==owner){status('Account changed in another tab. Reload to continue.');return;}
  if(collectionSaving){changed();return;}
  syncing=true;dirty=false;status('Syncing your collection…');
  try{
   var localText=JSON.stringify(collectionSnapshot()),local=await encode(JSON.parse(localText));
   var checkpoint=await collectionStore.readSync(),remote=(await api('collection')).record;
   var merged;
   try{merged=remote?(checkpoint?.base?TorcidaSync.merge(checkpoint.base,local,remote.data):TorcidaSync.same(local,empty())?remote.data:!local.humidors.some(h=>h.cigars.length)&&!local.smoked.length&&!local.myBar.length&&!local.wishlist.length&&!(local.tastings&&local.tastings.length)?remote.data:TorcidaSync.merge(empty(),local,remote.data)):local;}
   catch(e){conflict={remote:remote,local:local};draw();throw e;}
   // If the user edited while photos uploaded, restart rather than replacing newer device data.
   if(localText!==JSON.stringify(collectionSnapshot())){dirty=true;queued=true;return;}
   var record=remote&&TorcidaSync.same(merged,remote.data)?remote:(await api('collection',{action:'save',revision:remote?.revision??null,data:merged,migrate:checkpoint?.migrationPending===true})).record;
   var hydrated=await decode(record.data);
   if(localText!==JSON.stringify(collectionSnapshot())){dirty=true;queued=true;return;}
   await localReplace(hydrated);await collectionStore.saveSync({base:record.data,revision:record.revision});
   status('Cloud sync complete at '+new Date().toLocaleTimeString()+'.');
  }catch(e){dirty=true;status(e.message+' Device changes are retained.');if(e.code==='REVISION_CONFLICT')queued=true;}
  finally{syncing=false;if(queued){queued=false;changed();}}
 }
 function changed(){if(applying)return;dirty=true;clearTimeout(syncTimer);if(syncing)queued=true;else syncTimer=setTimeout(sync,1500);}
 async function resolveConflict(choice){
  if(!conflict||syncing||collectionSaving||pendingCollection)return;
  // Explicit resolution always creates a downloadable backup of both versions first.
  var current=JSON.stringify(collectionSnapshot());
  var selected=conflict;downloadJSON({app:'Torcida sync recovery',local:collectionSnapshot(),cloud:await decode(selected.remote.data)},'Torcida-sync-recovery.json');
  if(!confirm('Keep the '+choice+' collection? Both versions are in the recovery download.'))return;
  try{
   if(current!==JSON.stringify(collectionSnapshot()))throw new Error('Your device collection changed. Review again.');
   if(choice==='cloud'){await localReplace(await decode(selected.remote.data));await collectionStore.saveSync({base:selected.remote.data,revision:selected.remote.revision});}
   else {var record=(await api('collection',{action:'save',revision:selected.remote.revision,data:await encode(collectionSnapshot())})).record;await collectionStore.saveSync({base:record.data,revision:record.revision});}
   conflict=null;draw();status('Conflict resolved.');
  }catch(e){status(e.message);}
 }
 async function importDevice(){
  try{
   if(!verified)throw new Error('Sign in to import.');
   var guest=await CollectionStore.open(window),record=await guest.read();if(guest.close)guest.close();
   if(!record)throw new Error('No guest collection was found on this device.');
   var data=TorcidaData.validateCollection(record.data);
   if(!confirm('Import '+collectionSummary(data)+' into this account? Matching records will be skipped. The guest copy stays on this device.'))return;
   var result=TorcidaPortability.importCollection(collectionSnapshot(),data),checkpoint=await collectionStore.readSync();await collectionStore.saveSync({...checkpoint,migrationPending:true});importing=true;try{await localReplace(result);}finally{importing=false;}changed();status('Device collection imported. Syncing next.');
  }catch(e){status(e.message);}
 }
 async function logout(){
  try{
   if(pendingCollection||collectionSaving||syncing)throw new Error('Finish saving or syncing before signing out.');
   if(dirty){exportCollection(false);if(!confirm('Some changes may not be synced. Keep the downloaded backup before signing out. Continue?'))return;}
   await api('account',{action:'logout'});localStorage.removeItem('tc_owner');sessionStorage.removeItem('tc_ai_consent');location.reload();
  }catch(e){status(e.message);}
 }
 async function password(){try{status((await api('account',{action:'password',password:document.getElementById('account-new-password').value})).message);document.getElementById('account-new-password').value='';sessionStorage.removeItem('tc_password_reset');}catch(e){status(e.message);}}
 async function remove(){try{
  if(syncing||collectionSaving||pendingCollection)throw new Error('Finish saving before deleting your account.');
  var password=prompt('Enter your password to delete this account. Store billing continues until cancelled through Apple or Google.');if(!password)return;
  if(prompt('This permanently deletes the cloud collection and photos. Type DELETE to continue.')!=='DELETE')return;
  var result=await api('account',{action:'delete',password:password,confirmation:'DELETE'});
  // The account-specific cache is removed after the server confirms deletion.
  if(collectionStore.close)collectionStore.close();indexedDB.deleteDatabase('torcida-collection-v2-'+owner);localStorage.removeItem('tc_collection_'+owner);localStorage.removeItem('tc_collection_'+owner+'_sync');Object.keys(localStorage).filter(k=>k.startsWith('tc_private_'+owner+'_')).forEach(k=>localStorage.removeItem(k));localStorage.removeItem('tc_owner');alert(result.message);location.reload();
 }catch(e){status(e.message);}}
 async function report(){try{var reason=prompt('Describe the problem with this AI result. The result and your description will be sent to Torcida support.');if(!reason)return;await api('feedback',{reason:reason,result:JSON.stringify(currentResult||{})});status('AI result reported.');showToast('Report sent.');}catch(e){showToast(e.message);}}
 async function promo(){
  var button=document.getElementById('promo-submit');button.disabled=true;
  try{if(!verified)throw new Error('Sign in or create an account first, then redeem your code here.');
   var result=await api('promo',{code:document.getElementById('account-promo').value});user=result.user;draw();document.getElementById('account-promo').value='';status(result.message);
  }catch(e){status(e.message);}finally{button.disabled=false;}
 }
 async function premium(){try{if(!user)throw new Error('Sign in first.');if(!window.TorcidaNative)throw new Error('Subscriptions will be available in the iOS and Android apps after store setup.');await TorcidaNative.purchase(user.id);await refreshPlan();}catch(e){status(e.message);}}
 async function refreshPlan(){var result=await api('subscription',{});user=result.user;draw();return user;}
 async function restore(){try{if(!user||!window.TorcidaNative)throw new Error('Sign in through the store app to restore purchases.');await TorcidaNative.restore(user.id);await refreshPlan();status('Store purchases checked.');}catch(e){status(e.message);}}
 async function beforeAI(){
  if(!verified)throw new Error('Sign in with a verified email to use AI identification. Manual entry is available.');
  if(sessionStorage.getItem('tc_ai_consent')!=='yes'){
   if(!confirm('AI lookup sends your selected photo, item names, or flavor notes through Torcida to Anthropic. Do not include personal information. Provider retention depends on its service configuration. Allow this transfer for this session?'))throw new Error('AI transfer cancelled. You can enter the record manually.');
   sessionStorage.setItem('tc_ai_consent','yes');
  }
 }
 function validateGrowth(data,previous){if(importing)return;var limits=user?.plan||{cigars:25,humidors:1},count=x=>x.humidor.length+x.humidors.reduce((n,h)=>n+h.cigars.length,0);if(previous&&(count(data)>limits.cigars&&count(data)>count(previous)||data.humidors.length>limits.humidors&&data.humidors.length>previous.humidors.length))throw new Error('Your plan limit is reached. Existing records, editing and exports remain available.');}
 function refreshWhenVisible(){if(document.visibilityState!=='hidden')sync();}
 window.addEventListener('focus',refreshWhenVisible);
 document.addEventListener('visibilitychange',refreshWhenVisible);
 setInterval(refreshWhenVisible,30000);
 window.addEventListener('online',sync);window.addEventListener('storage',function(e){if(e.key==='tc_owner'&&cachedOwner()!==owner){verified=false;status('Account changed in another tab. Reload before continuing.');}});
 return {boot:boot,scope:function(){return owner;},api:api,auth:auth,sync:sync,changed:changed,importDevice:importDevice,resolveConflict:resolveConflict,logout:logout,password:password,remove:remove,report:report,promo:promo,premium:premium,restore:restore,beforeAI:beforeAI,validateGrowth:validateGrowth,status:status,refreshPlan:refreshPlan,revokeAI:function(){sessionStorage.removeItem('tc_ai_consent');status('AI transfer permission revoked. Manual entry remains available.');}};
})();
