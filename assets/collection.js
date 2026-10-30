var collectionKey='tc_collection_v1';
var lastSavedCollection=null, pendingCollection=null, collectionReadBlocked=false, collectionLoaded=false;
function collectionSnapshot(){
  return {version:1,humidors:humidors,activeHumidorId:activeHumidorId,humidor:humidor,wishlist:wishlist,smoked:smoked,myBar:myBar,ashPersonalBest:ashPersonalBest||null};
}
function applyCollection(data){
  humidors=data.humidors;activeHumidorId=data.activeHumidorId;humidor=data.humidor;wishlist=data.wishlist;smoked=data.smoked;myBar=data.myBar;ashPersonalBest=data.ashPersonalBest;
}
function collectionNotice(message){
  var box=document.getElementById('collection-alert');
  document.getElementById('collection-alert-text').textContent=message;box.hidden=false;
  document.getElementById('retry-collection').hidden=!pendingCollection;
}
function collectionSummary(data){
  return data.humidors.length+' humidors, '+data.humidors.reduce(function(n,h){return n+h.cigars.length;},0)+' cigar entries, '+data.myBar.length+' spirits, '+data.wishlist.length+' wish list entries, '+data.smoked.length+' journal entries';
}
function initializeCollection(){
  var raw;
  try{
    raw=localStorage.getItem(collectionKey);
    if(raw!==null){var data=TorcidaData.validateCollection(JSON.parse(raw));applyCollection(data);lastSavedCollection=raw;}
    else{
      function legacy(key,fallback){var v=localStorage.getItem(key);return v===null?fallback:JSON.parse(v);}
      var data={version:1,humidors:legacy('tc_humidors',[]),activeHumidorId:localStorage.getItem('tc_active_humidor'),humidor:legacy('tc_humidor',[]),wishlist:legacy('tc_wishlist',[]),smoked:legacy('tc_smoked',[]),myBar:legacy('tc_bar',[]),ashPersonalBest:legacy('tc_ashbest',null)};
      TorcidaData.validateCollection(data);applyCollection(data);
      if(!humidors.length){humidors=[{id:'humi_default',name:'My Humidor',type:'Desktop',humidity:68,temp:68,cigars:humidor.slice()}];humidor=[];}
      if(!humidors.some(function(h){return h.id===activeHumidorId;}))activeHumidorId=humidors[0].id;
      // Retain every legacy key. No migration writes can erase existing data.
      try{persistCollection();}catch(e){}
    }
    collectionLoaded=true;
    if(humidors.length&&!humidors.some(function(h){return h.id===activeHumidorId;}))activeHumidorId=humidors[0].id;
    document.getElementById('backup-status').textContent='Stored on this device. Download a backup before switching devices.';
  }catch(e){
    collectionReadBlocked=true;collectionLoaded=true;
    collectionNotice('Your saved collection could not be read. Existing storage is untouched. Download recovery data before restoring a backup.');
  }
}
function persistCollection(){
  var candidate=JSON.stringify(collectionSnapshot());
  if(pendingCollection&&candidate!==pendingCollection){
    if(lastSavedCollection)applyCollection(JSON.parse(lastSavedCollection));
    collectionNotice('Recover the unsaved changes first using Retry save or Download unsaved backup. Your original unsaved entry is still available.');
    throw new Error('Recover your unsaved changes before making another change.');
  }
  try{
    if(collectionReadBlocked)throw new Error('Existing saved data needs recovery before changes can be saved.');
    var current=localStorage.getItem(collectionKey);
    if(current!==lastSavedCollection)throw new Error('Your collection changed in another tab. Download unsaved changes, then reload before continuing.');
    TorcidaData.validateCollection(JSON.parse(candidate));
    localStorage.setItem(collectionKey,candidate);
    if(localStorage.getItem(collectionKey)!==candidate)throw new Error('The save could not be verified.');
    lastSavedCollection=candidate;pendingCollection=null;
    document.getElementById('collection-alert').hidden=true;
    document.getElementById('backup-status').textContent='Saved on this device at '+new Date().toLocaleTimeString()+'.';
    return true;
  }catch(error){
    pendingCollection=candidate;
    if(lastSavedCollection)applyCollection(JSON.parse(lastSavedCollection));
    collectionNotice('Changes were not saved. Your previous saved collection is unchanged. Your new entry is available in the unsaved backup. Free space and retry, or download it before leaving. '+error.message);
    throw new Error('Collection was not saved. Use the recovery controls at the top of the page.');
  }
}
function retryCollectionSave(){
  if(!pendingCollection)return;
  var pending=pendingCollection;applyCollection(TorcidaData.validateCollection(JSON.parse(pending)));
  try{persistCollection();window.location.reload();}catch(e){}
}
function downloadJSON(data,name){
  var url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
  var link=document.createElement('a');link.href=url;link.download=name;document.body.appendChild(link);link.click();link.remove();setTimeout(function(){URL.revokeObjectURL(url);},1000);
}
function exportCollection(unsaved){
  var data=unsaved&&pendingCollection?JSON.parse(pendingCollection):collectionSnapshot();
  downloadJSON({app:'Torcida',backupVersion:1,exportedAt:new Date().toISOString(),collection:data},'Torcida-'+(unsaved?'unsaved-':'backup-')+new Date().toISOString().replace(/[:.]/g,'-')+'.json');
}
function exportRecoveryData(){
  var values={};
  try{[collectionKey,'tc_humidors','tc_active_humidor','tc_humidor','tc_wishlist','tc_smoked','tc_bar','tc_ashbest'].forEach(function(k){values[k]=localStorage.getItem(k);});downloadJSON({app:'Torcida recovery',storage:values},'Torcida-recovery.json');}catch(e){collectionNotice('Recovery data could not be read. Browser storage may be disabled.');}
}
var restoreCandidate=null;
async function previewCollectionRestore(input){
  restoreCandidate=null;var file=input.files&&input.files[0];input.value='';if(!file)return;
  try{
    if(file.size>40*1024*1024)throw new Error('Choose a backup smaller than 40 MB.');
    var backup=JSON.parse(await file.text());
    if(backup.app!=='Torcida'||backup.backupVersion!==1)throw new Error('Choose a Torcida backup file.');
    restoreCandidate=TorcidaData.validateCollection(backup.collection);
    document.getElementById('restore-summary').textContent='This replaces the collection on this device with '+collectionSummary(restoreCandidate)+'. A backup of your current saved collection will download first. Keep both files.';
    openModal('modal-restore');
  }catch(e){restoreCandidate=null;showToast('Restore stopped: '+e.message);}
}
function confirmCollectionRestore(){
  if(!restoreCandidate)return;
  if(pendingCollection){showToast('Save or download your unsaved changes before restoring.');return;}
  var previous=JSON.stringify(collectionSnapshot()),wasBlocked=collectionReadBlocked;
  try{
    if(wasBlocked)exportRecoveryData();else exportCollection(false);
    // An explicit restore may replace unreadable storage, after a recovery download.
    lastSavedCollection=localStorage.getItem(collectionKey);collectionReadBlocked=false;
    applyCollection(restoreCandidate);persistCollection();restoreCandidate=null;closeModal('modal-restore');renderAll();showToast('Backup restored and saved on this device.');
  }catch(e){applyCollection(JSON.parse(previous));collectionReadBlocked=wasBlocked;collectionNotice('Restore was not completed. The selected backup file remains available. '+e.message);}
}
window.addEventListener('beforeunload',function(e){if(pendingCollection){e.preventDefault();e.returnValue='';}});
window.addEventListener('storage',function(e){if(e.key===collectionKey&&e.newValue!==lastSavedCollection)collectionNotice('Your collection changed in another tab. Download any unsaved changes, then reload this page.');});
