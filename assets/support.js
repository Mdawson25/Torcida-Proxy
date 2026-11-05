(async function(){
 var out=document.getElementById('support-contact');
 try{var result=await(await fetch('/api/support')).json();if(!result.email){out.textContent='Support contact is being configured. Public launch is not enabled yet.';return;}var a=document.createElement('a');a.href='mailto:'+result.email;a.textContent=result.email;out.textContent='Contact Torcida: ';out.appendChild(a);}catch{out.textContent='Support contact is unavailable. Please retry when connected.';}
})();
