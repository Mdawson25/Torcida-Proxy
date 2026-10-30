(function(root){
  'use strict';
  var jobs=0,modalStack=[],openers=new Map(),toastTimer;
  var paths={
    find:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/>',
    humidor:'<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M3 11h18M9 7V4h6v3m-5 9h4"/>',
    bar:'<path d="M9 3h6m-5 0v5l-4 5v7a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-7l-4-5V3M7 14h10m-7 3h4"/>',
    journal:'<rect x="5" y="3" width="15" height="18" rx="2"/><path d="M8 3v18M3 7h4m-4 5h4m-4 5h4m5-10h5m-5 5h5m-5 5h3"/>',
    guide:'<path d="M12 5c-3-2-7-2-10-1v15c3-1 7-1 10 1 3-2 7-2 10-1V4c-3-1-7-1-10 1Zm0 0v15"/>',
    settings:'<path d="m9 3-1 3-3 1 1 3-2 2 2 2-1 3 3 1 1 3h6l1-3 3-1-1-3 2-2-2-2 1-3-3-1-1-3Z"/><circle cx="12" cy="12" r="3"/>',
    camera:'<path d="M8 6 9.5 3h5L16 6h4a1 1 0 0 1 1 1v13H3V7a1 1 0 0 1 1-1Z"/><circle cx="12" cy="12.5" r="4"/>',
    gallery:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 5-5 4 4 4-6 5 7"/>',
    star:'<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/>',
    edit:'<path d="m14 4 6 6M4 20l4-1L21 6l-4-4L4 15Z"/>',
    trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
    share:'<path d="M12 16V3m-4 4 4-4 4 4M5 12v9h14v-9"/>',
    target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    leaf:'<path d="M20 3c-9-1-16 3-16 9a7 7 0 0 0 7 7c6 0 9-7 9-16ZM3 21 16 8"/>',
    cup:'<path d="M5 3h14v4c0 6-14 6-14 0ZM5 5H2v2a5 5 0 0 0 5 5m12-7h3v2a5 5 0 0 1-5 5m-5 0v7m-5 2h10"/>'
  };
  function icon(name){return '<svg class="tc-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'+(paths[name]||paths.star)+'</svg>';}
  function localDate(date){var d=date||new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
  async function preparePhoto(file,options){
    options=options||{};var max=options.maxDimension||1600,maxBytes=options.maxBytes||1700000;
    if(!file||file.size===0)throw new Error('Choose a photo with image content.');
    if(file.size>25*1024*1024)throw new Error('Choose a photo smaller than 25 MB.');
    if(file.type&&!file.type.startsWith('image/'))throw new Error('Choose an image file.');
    var url=URL.createObjectURL(file);
    try{
      var image=new Image();image.decoding='async';
      await new Promise(function(resolve,reject){image.onload=resolve;image.onerror=function(){reject(new Error('This photo format cannot be opened here. Export it as JPEG or PNG, then try again.'));};image.src=url;});
      if(!image.naturalWidth||!image.naturalHeight)throw new Error('This image could not be read.');
      var scale=Math.min(1,max/image.naturalWidth,max/image.naturalHeight),canvas=document.createElement('canvas');
      canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
      var context=canvas.getContext('2d');if(!context)throw new Error('Your browser could not prepare this photo.');
      context.fillStyle='#ffffff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);
      var blob;
      for(var quality of [.84,.72,.6,.48]){
        blob=await new Promise(function(resolve){canvas.toBlob(resolve,'image/jpeg',quality);});
        if(blob&&blob.size<=maxBytes)break;
      }
      if(!blob||blob.size>maxBytes)throw new Error('This photo is still too large. Crop it or choose a smaller photo.');
      var dataURL=await new Promise(function(resolve,reject){var reader=new FileReader();reader.onload=function(){resolve(reader.result);};reader.onerror=function(){reject(new Error('The prepared photo could not be read.'));};reader.readAsDataURL(blob);});
      return {dataURL:dataURL,base64:dataURL.split(',')[1],mediaType:'image/jpeg',width:canvas.width,height:canvas.height,bytes:blob.size};
    }finally{URL.revokeObjectURL(url);}
  }
  function setPhotoJobs(delta){jobs=Math.max(0,jobs+delta);var el=document.getElementById('photo-upload-status');if(el)el.textContent=jobs?'Preparing photos. Please wait before saving.':'';document.querySelectorAll('[onclick="logSmoke()"]').forEach(function(b){b.disabled=jobs>0;});}
  function photoBusy(){return jobs>0;}
  async function copyShareText(text){
    try{if(!navigator.clipboard)throw new Error('Clipboard unavailable');await navigator.clipboard.writeText(text);showMessage('Journal text copied. Paste it into your message.');}
    catch(e){
      var modal=document.getElementById('modal-copy');
      if(!modal){modal=document.createElement('div');modal.id='modal-copy';modal.className='modal-overlay';modal.innerHTML='<div class="modal-box"><h2 class="modal-title">Copy your journal entry</h2><p>Select the text below, then copy it into your message.</p><textarea id="copy-share-text" class="form-input" readonly aria-label="Journal text to copy" rows="8" style="width:100%;margin:16px 0"></textarea><button class="btn" id="select-share-text">Select text</button><button class="btn btn-ghost" id="close-share-copy">Close</button></div>';document.body.appendChild(modal);document.getElementById('select-share-text').onclick=function(){var field=document.getElementById('copy-share-text');field.focus();field.select();field.setSelectionRange(0,field.value.length);};document.getElementById('close-share-copy').onclick=function(){root.closeModal('modal-copy');};}
      document.getElementById('copy-share-text').value=text;root.openModal('modal-copy');
    }
  }
  function showMessage(message){var t=document.getElementById('toast');clearTimeout(toastTimer);t.textContent=message;t.classList.add('show');toastTimer=setTimeout(function(){t.classList.remove('show');},7000);}
  function modalOpen(id){
    var el=document.getElementById(id);if(!el)return;openers.set(id,document.activeElement);modalStack=modalStack.filter(function(x){return x!==id;});modalStack.push(id);
    el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');
    var heading=el.querySelector('.modal-title,h2,h3');if(heading){if(!heading.id)heading.id=id+'-title';el.setAttribute('aria-labelledby',heading.id);}else el.setAttribute('aria-label',id.replace(/^modal-/,'').replace(/-/g,' '));
    var target=el.querySelector('input:not([type="hidden"]),select,textarea,button,[tabindex="0"]')||el.querySelector('.modal-box');
    if(target){if(target.classList.contains('modal-box'))target.tabIndex=-1;requestAnimationFrame(function(){target.focus({preventScroll:true});});}
  }
  function modalClose(id){
    modalStack=modalStack.filter(function(x){return x!==id;});
    if(modalStack.length){document.body.style.overflow='hidden';return;}
    var opener=openers.get(id);if(opener&&opener.isConnected)opener.focus({preventScroll:true});openers.delete(id);
  }
  function decorate(rootNode){
    var glyphs=[['📷','camera'],['🖼️','gallery'],['🖼','gallery'],['✨','star'],['✏️','edit'],['🗑','trash'],['💬','share'],['🎯','target'],['🥃','bar'],['🍹','bar'],['📦','humidor'],['💨','journal'],['🏆','cup'],['🍶','bar'],['📖','guide']];
    rootNode.querySelectorAll('button').forEach(function(button){
      if(button.querySelector('svg'))return;
      var text=button.textContent.trim();var match=glyphs.find(function(g){return text.startsWith(g[0]);});
      if(match){button.textContent=text.slice(match[0].length).trim();button.insertAdjacentHTML('afterbegin',icon(match[1]));}
    });
    rootNode.querySelectorAll('[onclick]:not(button):not(input):not(a):not(select):not(.modal-overlay)').forEach(function(el){
      if(!el.hasAttribute('role'))el.setAttribute('role','button');if(!el.hasAttribute('tabindex'))el.tabIndex=0;
      if(!el.dataset.keyEnabled){el.dataset.keyEnabled='true';el.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();el.click();}});}
      var action=el.getAttribute('onclick')||'',rating=action.match(/set(?:Attr|Pairing|Edit)?Rating\([^)]*?(\d)\)/);
      if(rating)el.setAttribute('aria-label',((action.match(/'(\w+)'/)||[])[1]||'Rating')+' '+rating[1]+' of 5');
    });
    rootNode.querySelectorAll('.pill,.sel-chip,.note-chip,.occ-chip,.quiz-opt,.filter-pill').forEach(function(el){el.setAttribute('aria-pressed',String(el.classList.contains('active')||el.classList.contains('chosen')||el.classList.contains('selected')));});
    rootNode.querySelectorAll('.empty-icon').forEach(function(el){var text=el.textContent.trim();var match=glyphs.find(function(g){return text===g[0];});if(match)el.innerHTML=icon(match[1]);});
  }
  function initialize(){
    document.querySelectorAll('.nav-tab').forEach(function(button){var name=button.dataset.icon;button.querySelector('.nav-icon').innerHTML=icon(name);});
    document.querySelector('.header-settings').innerHTML=icon('settings');
    var hero=document.querySelector('.scanner-box>div:first-child');if(hero){hero.innerHTML=icon('camera');hero.classList.add('scanner-hero-icon');}
    document.querySelectorAll('.form-group').forEach(function(group){var label=group.querySelector('label'),field=group.querySelector('input,select,textarea');if(label&&field&&field.id)label.htmlFor=field.id;});
    document.querySelectorAll('input[type="number"]').forEach(function(input){input.inputMode=input.step&&input.step!=='1'?'decimal':'numeric';});
    document.querySelectorAll('input[id$="search"],#cigar-search').forEach(function(input){input.enterKeyHint='search';});
    document.querySelectorAll('.modal-overlay').forEach(function(el){el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');});
    decorate(document);
    var scheduled=false;new MutationObserver(function(){if(scheduled)return;scheduled=true;requestAnimationFrame(function(){scheduled=false;decorate(document);});}).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
    document.addEventListener('keydown',function(e){
      if(e.key!=='Tab'||!modalStack.length)return;
      var modal=document.getElementById(modalStack[modalStack.length-1]);if(!modal||!modal.classList.contains('show'))return;
      var elements=Array.from(modal.querySelectorAll('button,input:not([type="hidden"]),select,textarea,a[href],[tabindex="0"]')).filter(function(el){return !el.disabled&&el.getClientRects().length;});
      if(!elements.length){e.preventDefault();return;}
      var first=elements[0],last=elements[elements.length-1];
      if(e.shiftKey&&(document.activeElement===first||!modal.contains(document.activeElement))){e.preventDefault();last.focus();}
      else if(!e.shiftKey&&(document.activeElement===last||!modal.contains(document.activeElement))){e.preventDefault();first.focus();}
    });
    function viewport(){
      var vv=window.visualViewport,h=vv?vv.height:window.innerHeight,offset=vv?vv.offsetTop:0;
      document.documentElement.style.setProperty('--viewport-height',h+'px');document.documentElement.style.setProperty('--viewport-top',offset+'px');
      var keyboard=vv&&vv.scale<1.1&&window.innerHeight-h>150&&/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
      document.body.classList.toggle('keyboard-open',!!keyboard);document.documentElement.style.setProperty('--keyboard-offset',keyboard?Math.max(0,window.innerHeight-h-offset)+'px':'0px');
    }
    viewport();window.addEventListener('resize',viewport);if(window.visualViewport){visualViewport.addEventListener('resize',viewport);visualViewport.addEventListener('scroll',viewport);}
    document.addEventListener('focusin',viewport);document.addEventListener('focusout',function(){setTimeout(viewport,100);});
    document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible'&&typeof refreshTimerUI==='function'){refreshTimerUI();if(timerIsRunning()){startTimerTick();scheduleCheckin();}}});
    if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(function(){});
  }
  var api={icon:icon,localDate:localDate,preparePhoto:preparePhoto,setPhotoJobs:setPhotoJobs,photoBusy:photoBusy,copyShareText:copyShareText,showMessage:showMessage,modalOpen:modalOpen,modalClose:modalClose,initialize:initialize};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.TorcidaMobile=api;
})(typeof window!=='undefined'?window:globalThis);
