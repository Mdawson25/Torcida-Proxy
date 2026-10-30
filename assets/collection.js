var collectionKey='tc_collection_v1';
var lastSavedCollection=null,lastSavedRevision=null,pendingCollection=null,collectionReadBlocked=false,collectionLoaded=false;
var collectionStore=null,legacyArchive=null,collectionQueue=Promise.resolve(),collectionSaving=0,collectionEpoch=0,latestRequestedCollection=null;
function collectionSnapshot(){return {version:1,humidors:humidors,activeHumidorId:activeHumidorId,humidor:humidor,wishlist:wishlist,smoked:smoked,myBar:myBar,ashPersonalBest:ashPersonalBest||null};}
function applyCollection(data){humidors=data.humidors;activeHumidorId=data.activeHumidorId;humidor=data.humidor;wishlist=data.wishlist;smoked=data.smoked;myBar=data.myBar;ashPersonalBest=data.ashPersonalBest;}
function setCollectionStatus(message){var el=document.getElementById('backup-status');if(el)el.textContent=message;}
function collectionNotice(message){
  var box=document.getElementById('collection-alert');document.getElementById('collection-alert-text').textContent=message;box.hidden=false;
  var details=document.getElementById('collection-recovery-text');if(details)details.textContent=message;
  document.getElementById('retry-collection').hidden=!pendingCollection;
  setCollectionStatus(pendingCollection?'Unsaved changes are available in Storage recovery.':'Storage recovery options are available.');
}
function dismissCollectionNotice(){document.getElementById('collection-alert').hidden=true;}
function openCollectionRecovery(){document.getElementById('retry-collection').hidden=!pendingCollection;document.getElementById('download-unsaved-collection').hidden=!pendingCollection;if(!pendingCollection&&!collectionReadBlocked)document.getElementById('collection-recovery-text').textContent='Your collection is saved. No unsaved changes need recovery.';openModal('modal-storage-recovery');}
function collectionSummary(data){return data.humidors.length+' humidors, '+data.humidors.reduce(function(n,h){return n+h.cigars.length;},0)+' cigar entries, '+data.myBar.length+' spirits, '+data.wishlist.length+' wish list entries, '+data.smoked.length+' journal entries';}
function legacyData(values){
  function parse(key,fallback){return values[key]===null?fallback:JSON.parse(values[key]);}
  if(values[collectionKey]!==null)return TorcidaData.validateCollection(JSON.parse(values[collectionKey]));
  var data={version:1,humidors:parse('tc_humidors',[]),activeHumidorId:values.tc_active_humidor,humidor:parse('tc_humidor',[]),wishlist:parse('tc_wishlist',[]),smoked:parse('tc_smoked',[]),myBar:parse('tc_bar',[]),ashPersonalBest:parse('tc_ashbest',null)};
  TorcidaData.validateCollection(data);
  if(!data.humidors.length){data.humidors=[{id:'humi_default',name:'My Humidor',type:'Desktop',humidity:68,temp:68,cigars:data.humidor.slice()}];data.humidor=[];}
  if(!data.humidors.some(function(h){return h.id===data.activeHumidorId;}))data.activeHumidorId=data.humidors[0].id;
  return data;
}
async function initializeCollection(){
  try{
    // Put the notice in normal document flow instead of covering the screen.
    if(document.querySelector){var header=document.querySelector('.header'),box=document.getElementById('collection-alert');if(header&&box)header.after(box);}
    collectionStore=await CollectionStore.open();
    var record=await collectionStore.read();
    if(record){lastSavedRevision=record.revision;var data=TorcidaData.validateCollection(record.data);applyCollection(data);lastSavedCollection=JSON.stringify(data);if(collectionStore.mode==='indexeddb'){try{var archived=await collectionStore.archive();if(archived&&archived.values)CollectionStore.removeArchivedCopies(localStorage,archived.values);}catch(e){}}}
    else{
      var values=CollectionStore.readLegacy(localStorage),data=legacyData(values);applyCollection(data);
      // Legacy data itself is already a saved checkpoint, even if migration fails.
      lastSavedCollection=JSON.stringify(data);
      if(collectionStore.mode==='indexeddb')legacyArchive=values;
      try{await persistCollection();}catch(e){}
    }
    collectionLoaded=true;
    if(humidors.length&&!humidors.some(function(h){return h.id===activeHumidorId;}))activeHumidorId=humidors[0].id;
    if(!pendingCollection)setCollectionStatus('Saved on this device. Download a backup before switching devices.');
  }catch(e){collectionReadBlocked=true;collectionLoaded=true;collectionNotice('Saved data could not be read. It has not been changed. You can dismiss this notice or open Storage recovery.');}
}
function persistCollection(){
  var candidate=JSON.stringify(collectionSnapshot());
  if(pendingCollection&&candidate!==pendingCollection){
    if(lastSavedCollection)applyCollection(JSON.parse(lastSavedCollection));
    collectionNotice('Recover or download your unsaved changes before saving another change. You can dismiss this notice and continue browsing.');
    return Promise.reject(new Error('Use Storage recovery to save your pending changes.'));
  }
  var epoch=collectionEpoch;latestRequestedCollection=candidate;collectionSaving++;
  var operation=collectionQueue.then(async function(){
    if(epoch!==collectionEpoch)throw new Error('Unsaved changes are retained in Storage recovery.');
    try{
      if(collectionReadBlocked)throw new Error('Existing saved data needs recovery.');
      if(!collectionStore)throw new Error('Collection storage is still opening.');
      var data=TorcidaData.validateCollection(JSON.parse(candidate));
      var record=await collectionStore.write(data,lastSavedRevision,legacyArchive);
      lastSavedRevision=record.revision;lastSavedCollection=candidate;pendingCollection=null;
      if(collectionStore.mode==='indexeddb'&&legacyArchive){CollectionStore.removeArchivedCopies(localStorage,legacyArchive);legacyArchive=null;}
      document.getElementById('collection-alert').hidden=true;
      setCollectionStatus('Saved on this device at '+new Date().toLocaleTimeString()+'.');return true;
    }catch(error){
      collectionEpoch++;
      // Preserve the latest snapshot submitted before this failure, including rapid taps.
      pendingCollection=latestRequestedCollection||candidate;
      if(lastSavedCollection)applyCollection(JSON.parse(lastSavedCollection));
      var full=error.name==='QuotaExceededError'||/quota/i.test(error.message);
      collectionNotice(full?'Device storage is full. Your saved collection is safe, and pending changes are kept for recovery. You can dismiss this notice.':'Changes could not be saved. Your saved collection is safe. Open Storage recovery or dismiss this notice.');
      document.getElementById('collection-recovery-text').textContent=full?'Device storage is full. Retry after making room, or save an unsaved backup before leaving. No collection or photos have been deleted.':error.message;
      throw new Error('Collection was not saved. Open Storage recovery for your pending changes.');
    }
  });
  collectionQueue=operation.catch(function(){});
  return operation.finally(function(){collectionSaving--;});
}
async function retryCollectionSave(){
  if(!pendingCollection||collectionSaving)return;
  var button=document.getElementById('retry-collection');button.disabled=true;button.textContent='Saving…';
  try{
    if(collectionStore&&collectionStore.mode==='local'){
      var expanded=await CollectionStore.open();
      if(expanded.mode==='indexeddb'){
        var existing=await expanded.read();if(existing)throw new Error('A collection already exists in expanded storage. Download the pending backup, then reload.');
        collectionStore=expanded;lastSavedRevision=null;legacyArchive=CollectionStore.readLegacy(localStorage);
      }
    }
    applyCollection(TorcidaData.validateCollection(JSON.parse(pendingCollection)));await persistCollection();renderAll();closeModal('modal-storage-recovery');showToast('Your pending changes are saved.');
  }catch(e){document.getElementById('collection-recovery-text').textContent=e.message;}
  finally{button.disabled=false;button.textContent='Retry save';}
}
var backupObjectURL=null;
function downloadJSON(data,name){
  if(backupObjectURL)URL.revokeObjectURL(backupObjectURL);
  backupObjectURL=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
  var link=document.getElementById('backup-download-link');link.href=backupObjectURL;link.download=name;
  // A real link stays available for Safari if the automatic download is blocked.
  openModal('modal-backup-download');link.click();
}
function exportCollection(unsaved){var data=unsaved&&pendingCollection?JSON.parse(pendingCollection):collectionSnapshot();downloadJSON({app:'Torcida',backupVersion:1,exportedAt:new Date().toISOString(),collection:data},'Torcida-'+(unsaved?'unsaved-':'backup-')+new Date().toISOString().replace(/[:.]/g,'-')+'.json');}
async function exportRecoveryData(){
  try{
    var values=CollectionStore.readLegacy(localStorage),archived=collectionStore?await collectionStore.archive():null,record=collectionStore?await collectionStore.read():null;
    downloadJSON({app:'Torcida recovery',storage:values,archivedStorage:archived,current:record,pending:pendingCollection?JSON.parse(pendingCollection):null},'Torcida-recovery.json');
  }catch(e){collectionNotice('Recovery data could not be read. Your existing storage has not been changed.');throw e;}
}
var restoreCandidate=null;
async function previewCollectionRestore(input){
  restoreCandidate=null;var file=input.files&&input.files[0];input.value='';if(!file)return;
  try{
    if(file.size>40*1024*1024)throw new Error('Choose a backup smaller than 40 MB.');
    var backup=JSON.parse(await file.text());if(backup.app!=='Torcida'||backup.backupVersion!==1)throw new Error('Choose a Torcida backup file.');
    restoreCandidate=TorcidaData.validateCollection(backup.collection);
    document.getElementById('restore-summary').textContent='This replaces the collection on this device with '+collectionSummary(restoreCandidate)+'. A backup of your current saved collection will download first. Keep both files.';openModal('modal-restore');
  }catch(e){restoreCandidate=null;showToast('Restore stopped: '+e.message);}
}
async function confirmCollectionRestore(){
  if(!restoreCandidate||collectionSaving)return;
  if(pendingCollection){showToast('Save your pending changes in Storage recovery before restoring.');return;}
  var previous=JSON.stringify(collectionSnapshot()),wasBlocked=collectionReadBlocked;
  try{
    if(wasBlocked)await exportRecoveryData();else exportCollection(false);
    var existing=await collectionStore.read();lastSavedRevision=existing?existing.revision:null;collectionReadBlocked=false;
    applyCollection(restoreCandidate);await persistCollection();restoreCandidate=null;closeModal('modal-restore');renderAll();showToast('Backup restored and saved on this device.');
  }catch(e){applyCollection(JSON.parse(previous));collectionReadBlocked=wasBlocked;collectionNotice('Restore was not completed. The selected backup file is still available.');}
}
window.addEventListener('beforeunload',function(e){if(pendingCollection||collectionSaving){e.preventDefault();e.returnValue='';}});
window.addEventListener('storage',function(e){if(collectionStore&&collectionStore.mode==='local'&&e.key===collectionKey&&e.newValue!==lastSavedRevision)collectionNotice('Your collection changed in another tab. Download any pending changes, then reload.');});
