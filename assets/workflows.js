/* User workflows. Collection writes continue through the existing atomic store. */
var journalSource=null,sessionDraftInForm=false,sessionDraftToken=null;
function spiritThumbnail(type){
  var cells={'Bourbon':0,'Rye Whiskey':0,'Scotch':1,'Irish Whiskey':1,'Japanese Whisky':1,'Rum':2,'Cognac':3,'Armagnac':3,'Tequila':4,'Mezcal':4,'Gin':5,'Vodka':6,'Port':7,'Red Wine':7,'Other':2};
  var cell=cells[type]===undefined?2:cells[type],x=(cell%4)*100/3,y=cell<4?0:100;
  return '<span class="spirit-photo" role="img" aria-label="'+TorcidaReliability.escaped(type||'Spirit')+' illustrative category photo" style="background-position:'+x+'% '+y+'%"></span>';
}
function toggleSelector(){
  var el=document.getElementById('cigar-selector-wrap'),button=document.getElementById('help-choose-button');el.hidden=!el.hidden;button.setAttribute('aria-expanded',String(!el.hidden));
  if(!el.hidden){document.querySelector('#chips-strength button').focus({preventScroll:true});el.scrollIntoView({block:'start'});}
}
function updateNoteCount(){var count=document.querySelectorAll('#chips-notes .chosen').length;document.getElementById('selector-note-count').textContent=count+' of 5 selected';}
function clearJournalSource(){journalSource=null;document.getElementById('journal-stock-choice').hidden=true;}
function confirmReplaceJournalDraft(){
  if(TorcidaMobile.photoBusy()){showToast('Wait for the current photos to finish before replacing this draft.');return false;}
  var name=document.getElementById('s-name').value.trim(),notes=document.getElementById('s-notes').value.trim();
  if((name||notes)&&!confirm('Replace the current unsaved journal form? A completed timer draft, if any, remains available.'))return false;
  ['s-name','s-brand','s-notes','s-location','s-drink-name'].forEach(function(id){document.getElementById(id).value='';});
  document.getElementById('s-photo-preview').textContent='';pendingPhotos=[];newRatingVal=0;pairingRatingVal=0;attrRatings={draw:0,burn:0,flavor:0,construction:0};
  document.querySelectorAll('#smoked-form .star').forEach(function(el){el.classList.remove('lit');});
  document.getElementById('s-drink-type').value='';sessionDraftInForm=false;sessionDraftToken=null;return true;
}
function readSessionDraft(){try{return JSON.parse(localStorage.getItem('tc_session_draft_v1')||'null');}catch(e){return null;}}
function renderSessionDraft(){var el=document.getElementById('session-draft-banner');if(el)el.hidden=!readSessionDraft();}
function resumeSessionDraft(){
  var draft=readSessionDraft();if(!draft)return;if(!confirmReplaceJournalDraft())return;
  clearJournalSource();document.getElementById('s-name').value=draft.name;document.getElementById('s-date').value=draft.date;document.getElementById('s-notes').value='Smoke duration: '+draft.duration;
  sessionDraftInForm=true;sessionDraftToken=JSON.stringify(draft);showPage('smoked',null);document.getElementById('smoked-form').classList.add('show');document.getElementById('s-name').focus();
}
function completeSessionDraft(){
  if(sessionDraftInForm){try{if(localStorage.getItem('tc_session_draft_v1')===sessionDraftToken)localStorage.removeItem('tc_session_draft_v1');}catch(e){}sessionDraftInForm=false;sessionDraftToken=null;}
  renderSessionDraft();
}
function renderRemovalUndo(){
  var undo;try{undo=JSON.parse(localStorage.getItem('tc_removal_undo_v1')||'null');}catch(e){}
  var box=document.getElementById('removal-undo');if(!box)return;box.hidden=!undo;
  if(undo)document.getElementById('removal-undo-text').textContent='Removed '+undo.item.name+'.';
}
async function removeWithUndo(kind,id){
  if(!collectionLoaded||pendingCollection||collectionSaving){showToast('Finish saving or recover pending changes before removing an entry.');return;}
  var list=kind==='journal'?smoked:kind==='wishlist'?wishlist:myBar,index=list.findIndex(function(x){return x.id===id;});if(index<0)return;
  var undo={kind:kind,item:JSON.parse(JSON.stringify(list[index])),index:index};
  // Keep a recoverable copy before touching the live collection.
  try{localStorage.setItem('tc_removal_undo_v1',JSON.stringify(undo));}catch(e){showToast('A recoverable removal could not be prepared. Download a backup and free device space before removing this entry.');return;}
  if(kind==='journal')smoked=smoked.filter(function(x){return x.id!==id;});else if(kind==='wishlist')wishlist=wishlist.filter(function(x){return x.id!==id;});else myBar=myBar.filter(function(x){return x.id!==id;});
  try{await save();renderAll();renderRemovalUndo();showToast('Entry removed. Undo removal is available.');}catch(e){renderAll();renderRemovalUndo();throw e;}
}
async function undoLastRemoval(){
  if(pendingCollection||collectionSaving){showToast('Recover your pending changes before undoing a removal.');return;}
  var undo;try{undo=JSON.parse(localStorage.getItem('tc_removal_undo_v1')||'null');}catch(e){}if(!undo)return;
  var list=undo.kind==='journal'?smoked:undo.kind==='wishlist'?wishlist:myBar;
  if(!list.some(function(x){return x.id===undo.item.id;})){list.splice(Math.min(undo.index,list.length),0,undo.item);await save();}
  localStorage.removeItem('tc_removal_undo_v1');renderAll();renderRemovalUndo();showToast('Entry restored.');
}
function guardAction(name){
  var original=window[name];if(typeof original!=='function')return;
  var busy=false;window[name]=async function(){
    if(busy)return;busy=true;
    var buttons=Array.from(document.querySelectorAll('button[onclick]')).filter(function(b){return b.getAttribute('onclick').startsWith(name+'(');}),prior=buttons.map(function(b){return b.disabled;});
    buttons.forEach(function(b){b.disabled=true;b.setAttribute('aria-busy','true');});
    try{return await original.apply(this,arguments);}catch(e){showToast(e.message||'This change could not be completed. Your draft is still available.');}
    finally{busy=false;buttons.forEach(function(b,i){b.disabled=prior[i];b.removeAttribute('aria-busy');});}
  };
}
function initializeReliabilityUI(){
  renderSessionDraft();renderRemovalUndo();loadAshBest();
  var originalNote=toggleNoteChip;window.toggleNoteChip=function(el){originalNote(el);updateNoteCount();};updateNoteCount();
  window.removeSmoked=function(id){return removeWithUndo('journal',id);};window.removeWish=function(id){return removeWithUndo('wishlist',id);};window.removeFromBar=function(id){return removeWithUndo('bar',id);};
  window.deleteFromWishlist=async function(){var id=parseInt(document.getElementById('edit-w-id').value,10);await removeWithUndo('wishlist',id);if(!wishlist.some(function(x){return x.id===id;}))closeModal('modal-wishlist');};
  window.deleteFromSmoked=async function(){var id=parseInt(document.getElementById('edit-s-id').value,10);await removeWithUndo('journal',id);closeModal('modal-smoked');};
  ['logSmoke','addToHumidor','addToBarManually','addToBarFromResult','addToBarWishlist','addToWishlist','addToWishlistFromResult','addSelectorToWishlist','restockToWishlist','saveNewHumidor','saveEditHumidor','saveEditBar','saveEditSmoked','saveEditWishlist','confirmCollectionRestore','retryCollectionSave','removeSmoked','removeWish','removeFromBar','deleteFromSmoked','undoLastRemoval','findCigar','searchCigar','executeHumidorAction','moveWishSpiritToBar','deleteFromWishlist'].forEach(guardAction);
  // One central rating state keeps mouse, keyboard and assistive technology aligned.
  document.querySelectorAll('.rating-stars').forEach(function(group){var interactive=group.querySelector('[onclick]');group.setAttribute('role',interactive?'radiogroup':'img');group.setAttribute('aria-label',interactive?group.id.replace(/-/g,' ')+' rating':group.querySelectorAll('.lit').length+' of 5 stars');});
  function ratingState(){document.querySelectorAll('.rating-stars').forEach(function(group){var stars=Array.from(group.querySelectorAll('[onclick]')),value=stars.filter(function(s){return s.classList.contains('lit');}).length;stars.forEach(function(star,i){star.setAttribute('role','radio');star.setAttribute('aria-checked',String(i+1===value));star.setAttribute('aria-label',(i+1)+' of 5');star.tabIndex=value?i+1===value?0:-1:i===0?0:-1;});});}
  ratingState();document.addEventListener('click',function(e){if(e.target.closest('.rating-stars'))ratingState();});
  document.addEventListener('keydown',function(e){var star=e.target.closest('.rating-stars [role="radio"]');if(!star||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key))return;e.preventDefault();var stars=Array.from(star.parentElement.querySelectorAll('[onclick]')),i=stars.indexOf(star),next=e.key==='Home'?0:e.key==='End'?stars.length-1:(i+(['ArrowRight','ArrowDown'].includes(e.key)?1:stars.length-1))%stars.length;stars[next].click();stars[next].focus();ratingState();});
  new MutationObserver(ratingState).observe(document.getElementById('smoked-form'),{subtree:true,attributes:true,attributeFilter:['class']});
}
