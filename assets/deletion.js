document.getElementById('deletion-form').addEventListener('submit',async function(event){
 event.preventDefault();var button=document.getElementById('delete-submit'),status=document.getElementById('delete-status');button.disabled=true;
 async function post(body){var r=await fetch('/api/account',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify(body)}),v=await r.json();if(!r.ok)throw new Error(v.error?.message||'Please retry.');return v;}
 try{var email=document.getElementById('delete-email').value.trim(),password=document.getElementById('delete-password').value;
  if(document.getElementById('delete-confirm').value!=='DELETE')throw new Error('Type DELETE to confirm.');
  if(!confirm('Permanently delete this account, its cloud collection and photos? Cancel any store subscription separately.'))return;
  await post({action:'login',email,password});var deleted=await post({action:'delete',password,confirmation:'DELETE'});
  var owner=deleted.userId;if(/^[a-f0-9-]{36}$/.test(owner||'')){indexedDB.deleteDatabase('torcida-collection-v2-'+owner);localStorage.removeItem('tc_collection_'+owner);localStorage.removeItem('tc_collection_'+owner+'_sync');Object.keys(localStorage).filter(k=>k.startsWith('tc_private_'+owner+'_')).forEach(k=>localStorage.removeItem(k));if(localStorage.getItem('tc_owner')===owner)localStorage.removeItem('tc_owner');}document.getElementById('deletion-form').reset();status.textContent='Account and cloud data deleted. Store subscriptions must be cancelled through Apple or Google. Backups you downloaded and copies on other devices are not remotely erased.';
 }catch(e){status.textContent=e.message;}finally{button.disabled=false;}
});
