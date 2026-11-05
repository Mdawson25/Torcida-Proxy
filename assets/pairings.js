(function(root){
 'use strict';
 function label(item){return [item.brand,item.name].filter(Boolean).join(' ').trim();}
 function available(item,drink){var qty=drink?item.bottles:item.qty;return !!item.name&&(qty===undefined||Number(qty)>0);}
 function inventory(data,type){var drink=type==='drink';var rows=drink?(data.myBar||[]):(data.humidors||[]).flatMap(function(h){return h.cigars||[];});return rows.filter(function(x){return available(x,drink);});}
 function compact(item){return {name:String(item.name||'').slice(0,180),brand:String(item.brand||'').slice(0,100),notes:[item.tasting_notes,item.notes,item.strength,item.type,Array.isArray(item.flavor_tags)?item.flavor_tags.join(', '):''].filter(Boolean).join('; ').slice(0,300)};}
 var api={label:label,inventory:inventory,compact:compact};
 if(typeof module!=='undefined'&&module.exports){module.exports=api;return;}
 var el=function(id){return document.getElementById(id);};
 function snapshot(){return collectionSnapshot();}
 function refresh(){if(!collectionLoaded)return;var list=el('pairing-owned-items');list.replaceChildren();inventory(snapshot(),el('pairing-type').value).forEach(function(item){var option=document.createElement('option');option.value=label(item);list.appendChild(option);});}
 function journal(source,match,type){
  if(el('s-name').value.trim()&&!confirm('Replace the current journal draft with this pairing?'))return;
  var cigar=type==='cigar'?source:match,drink=type==='cigar'?match:source;
  showPage('smoked',document.querySelector('.nav-tab[data-page="smoked"]'));
  el('smoked-form').classList.add('show');el('s-name').value=cigar.name;el('s-brand').value=cigar.brand||'';el('s-drink-name').value=label(drink);el('s-notes').value='Pairing suggestion: '+match.why;
  // Suggestions are drafts, never a claim that an item was owned or consumed.
  journalSource=null;pendingPhotos=[];newRatingVal=0;pairingRatingVal=0;attrRatings={draw:0,burn:0,flavor:0,construction:0};document.querySelectorAll('#smoked-form .star').forEach(function(star){star.classList.remove('lit');});el('s-drink-type').value='Other';el('s-name').focus();showToast('Pairing copied to a journal draft. Review before saving.');
 }
 async function search(){
  var button=el('pairing-submit'),status=el('pairing-status'),results=el('pairing-results');if(button.disabled)return;
  button.disabled=true;results.replaceChildren();status.textContent='Finding pairings…';
  try{
   if(!collectionLoaded)throw new Error('Your collection is still opening. Try again shortly.');
   var type=el('pairing-type').value,mode=el('pairing-mode').value,name=el('pairing-item').value.trim();if(!name)throw new Error('Enter a cigar or drink name.');
   var data=snapshot(),saved=inventory(data,type).find(function(x){return label(x).toLowerCase()===name.toLowerCase();});
   var source=saved?compact(saved):{name:name,brand:'',notes:''};if(el('pairing-notes').value.trim())source.notes=el('pairing-notes').value.trim();
   var candidates=inventory(data,type==='cigar'?'drink':'cigar').slice(0,80).map(compact);
   if(mode==='owned'&&!candidates.length)throw new Error('Add an in-stock '+(type==='cigar'?'drink to My Bar':'cigar to your Humidor')+' first, or choose new suggestions.');
   while(JSON.stringify({type:type,mode:mode,item:source,inventory:candidates}).length>19000)candidates.pop();
   var response=await fetchWithTimeout(torcidaApiUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operation:'pairings',messages:[{role:'user',content:JSON.stringify({type:type,mode:mode,item:source,inventory:candidates})}]})});
   var value=await readAIResponse(response,'pairings'),shown=0;
   ['owned','discover'].forEach(function(scope){
    var matches=value.matches.filter(function(x){return x.scope===scope;});if(!matches.length)return;
    var heading=document.createElement('h3');heading.textContent=scope==='owned'?'From your collection':'New suggestions';results.appendChild(heading);
    matches.forEach(function(match){
     if(scope==='owned'){
      var original=candidates[match.index];if(!original)return;
      if(!inventory(snapshot(),type==='cigar'?'drink':'cigar').some(function(x){return label(x)===label(original);}))return;
      match.name=original.name;match.brand=original.brand;
     }
     var card=document.createElement('article');card.className='notes-block';var title=document.createElement('h4');title.textContent=label(match);var reason=document.createElement('p');reason.textContent=match.why;var badge=document.createElement('p');badge.textContent=scope==='owned'?'In your collection':'Not verified in your collection. Confirm the product details.';
     var draft=document.createElement('button');draft.className='btn btn-ghost';draft.textContent='Use in journal draft';draft.onclick=function(){journal(source,match,type);};card.append(title,badge,reason,draft);results.appendChild(card);shown++;
    });
   });
   status.textContent=shown?'Pairing suggestions ready. Confirm item details and adjust to your taste.':'No matching suggestions returned. Add flavor notes or try another item.';
  }catch(e){status.textContent=e.message;}finally{button.disabled=false;}
 }
 api.refresh=refresh;api.search=search;root.TorcidaPairings=api;
})(typeof window!=='undefined'?window:globalThis);
