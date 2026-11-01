(function(root){
 'use strict';
 var key='tc_ai_permission_v1',pending=null;
 function allowed(){try{return root.localStorage.getItem(key)==='allowed';}catch(e){return false;}}
 function update(){var status=document.getElementById('ai-permission-status');if(status)status.textContent=allowed()?'AI sharing is enabled.':'AI sharing is off. Local collection and journal features still work.';}
 function revoke(){try{root.localStorage.removeItem(key);}catch(e){}update();}
 function authorizeAI(){
  if(allowed())return Promise.resolve();
  if(pending)return pending;
  pending=new Promise(function(resolve,reject){
   var modal=document.getElementById('modal-ai-permission');
   function finish(yes){
    document.removeEventListener('keydown',escape,true);root.closeModal('modal-ai-permission');pending=null;
    if(yes){try{root.localStorage.setItem(key,'allowed');}catch(e){}update();resolve();}else reject(Error('AI sharing was cancelled. Your local collection is still available.'));
   }
   function escape(e){if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();var doc=document.getElementById('modal-native-document');if(doc&&doc.classList&&doc.classList.contains('show')){root.closeModal(doc.id);return;}finish(false);}}
   document.getElementById('ai-permission-allow').onclick=function(){finish(true);};
   document.getElementById('ai-permission-decline').onclick=function(){finish(false);};
   document.addEventListener('keydown',escape,true);root.openModal(modal.id);
  });
  return pending;
 }
 root.TorcidaPrivacy={authorizeAI:authorizeAI,revoke:revoke,allowed:allowed};
 document.addEventListener('DOMContentLoaded',update);
})(typeof window!=='undefined'?window:globalThis);
