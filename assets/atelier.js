(function(root){
  'use strict';
  var view='shelf',photoTarget=null,photoBusy=false,cardEntry=null,cardSequence=0,cardBlob=null,cardURL=null;
  var formats={square:{width:1080,height:1080,label:'Square'},story:{width:1080,height:1920,label:'Story'},compact:{width:1200,height:800,label:'Tasting card'}};
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function validPhoto(s){return typeof s==='string'&&/^data:image\/(?:jpeg|png|webp|gif);base64,[A-Za-z0-9+/]+=*$/.test(s);}
  function firstPhoto(c){return (c.photos||[]).find(validPhoto)||null;}
  function ageDays(date,now){if(!/^\d{4}-\d{2}-\d{2}$/.test(date||''))return null;var parts=date.split('-').map(Number),start=new Date(parts[0],parts[1]-1,parts[2]),today=now||new Date();if(start.getFullYear()!==parts[0]||start.getMonth()!==parts[1]-1||start.getDate()!==parts[2])return null;return Math.max(0,Math.round((Date.UTC(today.getFullYear(),today.getMonth(),today.getDate())-Date.UTC(parts[0],parts[1]-1,parts[2]))/86400000));}
  function model(entry,options){
    options=options||{};var format=formats[options.format]?options.format:'square',photo=(entry.photos||[])[Number(options.photoIndex)||0];
    return {format:format,width:formats[format].width,height:formats[format].height,name:String(entry.name||'A moment worth keeping'),brand:String(entry.brand||''),date:options.includeDate===false?'':String(entry.date||''),location:options.includeLocation?String(entry.location||''):'',notes:options.includeNotes?String(entry.notes||''):'',rating:Number.isInteger(entry.rating)&&entry.rating>=1&&entry.rating<=5?entry.rating:0,pairing:entry.drink?[entry.drink.type,entry.drink.name].filter(Boolean).join(' · '):'',photo:validPhoto(photo)?photo:null};
  }
  function filename(m){var name=m.name.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60)||'tasting';return 'Torcida-'+name+'-'+m.format+'.png';}
  function wrap(ctx,text,maxWidth,maxLines){
    var words=String(text||'').replace(/\s+/g,' ').trim().split(' '),lines=[],line='';
    words.forEach(function(word){if(!word)return;var parts=[];while(ctx.measureText(word).width>maxWidth&&word.length>1){var k=1;while(k<word.length&&ctx.measureText(word.slice(0,k+1)).width<=maxWidth)k++;parts.push(word.slice(0,k));word=word.slice(k);}parts.push(word);parts.forEach(function(part){var next=line?line+' '+part:part;if(line&&ctx.measureText(next).width>maxWidth){lines.push(line);line=part;}else line=next;});});if(line)lines.push(line);
    if(lines.length>maxLines){lines=lines.slice(0,maxLines);var last=lines.length-1;while(lines[last]&&ctx.measureText(lines[last]+'…').width>maxWidth)lines[last]=lines[last].slice(0,-1);lines[last]+='…';}return lines;
  }
  function button(action,id,label,classes){return '<button type="button" class="'+(classes||'btn btn-sm btn-ghost')+'" data-atelier-action="'+action+'" data-cigar-id="'+esc(id)+'">'+label+'</button>';}
  function cardMarkup(c){
    var photo=firstPhoto(c),days=ageDays(c.purchaseDate),quantity=root.TorcidaReliability.stock(c.qty),illustration='';
    if(!photo)illustration=root.TorcidaGuide.cigarSVG({name:c.name||'Cigar',length:6,ring:50,tip:'round',wrap:'#7b4a26'}).replace('<svg ','<svg aria-hidden="true" ');
    return '<article class="cigar-card collection-cigar"><button type="button" class="collection-photo '+(photo?'has-photo':'is-illustration')+'" data-atelier-action="detail" data-cigar-id="'+esc(c.id)+'" aria-label="View '+esc(c.name)+'">'+(photo?'<img src="'+photo+'" alt="'+esc(c.name)+'" loading="lazy" decoding="async">':illustration+'<span class="collection-photo-caption">Add your cigar or box photo</span>')+'<span class="collection-stock">'+quantity+' in stock</span></button><div class="collection-copy"><div class="collection-brand">'+esc(c.brand||'Your collection')+'</div><h3 class="collection-name">'+esc(c.name)+'</h3><div class="collection-meta">'+[c.size,c.strength].filter(Boolean).map(esc).join(' · ')+'</div><div class="collection-aging">'+(days===null?'Purchase date not recorded':days+' days in your humidor')+'</div><div class="collection-actions">'+button('detail',c.id,'View cigar')+button('photo',c.id,photo?'Change photo':'Add photo')+button('log',c.id,'Log a Smoke','btn btn-sm btn-primary')+'</div><div class="collection-stock-actions"><span>Quantity</span>'+button('minus',c.id,'−','qty-btn')+'<span aria-label="'+quantity+' cigars">'+quantity+'</span>'+button('plus',c.id,'+','qty-btn')+button('edit',c.id,'Edit')+'</div></div></article>';
  }
  function setView(next){view=next==='list'?'list':'shelf';try{localStorage.setItem('tc_humidor_view',view);}catch(e){}root.renderHumidor();}
  function applyView(el,items){el.classList.toggle('humidor-shelf',view==='shelf'&&items.length>0);el.classList.toggle('humidor-photo-list',view==='list');['shelf','list'].forEach(function(v){var b=document.getElementById('humidor-view-'+v);if(b)b.setAttribute('aria-pressed',String(view===v));});}
  function find(id,hid){var h=hid?root.humidors.find(function(x){return String(x.id)===String(hid);}):root.getActiveHumidor();return h?{humidor:h,cigar:h.cigars.find(function(c){return String(c.id)===String(id);})}:null;}
  function detail(id){
    var item=find(id);if(!item||!item.cigar)return;var c=item.cigar,photo=firstPhoto(c),content=document.getElementById('cigar-detail-content'),days=ageDays(c.purchaseDate);
    var history=root.smoked.filter(function(s){return s.sourceCigarId?String(s.sourceCigarId)===String(c.id):s.name===c.name&&(s.brand||'')===(c.brand||'');}).slice().reverse();
    document.getElementById('cigar-detail-title').textContent=c.name;
    content.innerHTML='<div class="detail-photo">'+(photo?'<img src="'+photo+'" alt="'+esc(c.name)+'">':root.TorcidaGuide.cigarSVG({name:c.name,length:6,ring:50,tip:'round',wrap:'#7b4a26'}))+'</div><p class="collection-brand">'+esc(c.brand||'Your collection')+'</p><dl class="cigar-detail-facts">'+[['Size',c.size],['Wrapper',c.wrapper],['Strength',c.strength],['Stock',root.TorcidaReliability.stock(c.qty)],['Purchased',c.purchaseDate],['Time in humidor',days===null?'Unknown':days+' days']].map(function(f){return '<div><dt>'+esc(f[0])+'</dt><dd>'+esc(f[1]==null||f[1]===''?'Not recorded':f[1])+'</dd></div>';}).join('')+'</dl>'+(c.notes?'<p class="detail-note">'+esc(c.notes)+'</p>':'')+'<div class="collection-actions">'+button('photo',c.id,photo?'Replace photo':'Add photo')+button('edit',c.id,'Edit cigar')+button('pair',c.id,'Explore pairings')+button('log',c.id,'Log a Smoke','btn btn-primary')+'</div><h3>Your journal</h3><p class="privacy-note">Includes older entries with the same cigar name and brand.</p>'+(history.length?history.slice(0,5).map(function(s){return '<div class="detail-journal"><strong>'+esc(s.date||'Date not recorded')+'</strong><span>'+(s.rating?s.rating+'/5':'Not rated')+'</span><p>'+esc(s.notes||'No tasting notes recorded.')+'</p></div>';}).join(''):'<p>No journal entries for this cigar yet.</p>');
    root.openModal('modal-cigar-detail');
  }
  function choosePhoto(id){if(photoBusy){root.showToast('Your cigar photo is still being saved.');return;}var item=find(id);if(!item||!item.cigar)return;photoTarget={id:item.cigar.id,hid:item.humidor.id};document.getElementById('humidor-photo-input').click();}
  async function savePhoto(input){
    var file=input.files&&input.files[0],target=photoTarget;input.value='';if(!file||!target||photoBusy)return;
    photoBusy=true;document.getElementById('humidor-photo-status').textContent='Preparing your cigar photo…';
    try{if(root.pendingCollection||root.collectionSaving)throw Error('Finish saving or recover pending changes before adding a photo.');var photo=await root.TorcidaMobile.preparePhoto(file,{maxDimension:1200,maxBytes:300000}),item=find(target.id,target.hid);if(!item||!item.cigar)throw Error('This cigar is no longer in your humidor.');item.cigar.photos=[photo.dataURL];await root.save();root.renderHumidor();if(document.getElementById('modal-cigar-detail').classList.contains('show')&&root.getActiveHumidor().id===target.hid)detail(target.id);root.showToast('Cigar photo saved on this device.');}
    catch(e){root.renderHumidor();root.showToast(e.message||'This photo could not be saved.');}
    finally{photoBusy=false;document.getElementById('humidor-photo-status').textContent='';}
  }
  function perform(action,id){
    var item=find(id);if(!item||!item.cigar)return;var c=item.cigar;
    if(action==='detail')return detail(c.id);if(action==='photo')return choosePhoto(c.id);
    if(action==='minus'||action==='plus')return root.changeQty(c.id,action==='minus'?-1:1).catch(function(e){root.showToast(e.message);});
    root.closeModal('modal-cigar-detail');
    if(action==='edit')root.openEditHumidor(c.id);else if(action==='log')root.logSmokeFromHumidor(c.id);else if(action==='pair'){document.getElementById('cigar-search').value=[c.brand,c.name].filter(Boolean).join(' ');root.showPage('scanner',null);root.searchCigar();}
  }
  function options(){return {format:document.getElementById('card-format').value,photoIndex:document.getElementById('card-photo').value,includeDate:document.getElementById('card-date').checked,includeNotes:document.getElementById('card-notes').checked,includeLocation:document.getElementById('card-location').checked};}
  function openCard(id){
    var entry=root.smoked.find(function(s){return String(s.id)===String(id);});if(!entry)return;cardEntry=entry;
    document.getElementById('modal-share')._entry=entry;document.getElementById('card-format').value='square';document.getElementById('card-notes').checked=false;document.getElementById('card-location').checked=false;document.getElementById('card-date').checked=true;
    var photos=document.getElementById('card-photo');photos.textContent='';(entry.photos||[]).forEach(function(p,i){if(validPhoto(p)){var option=document.createElement('option');option.value=i;option.textContent='Photo '+(i+1);photos.appendChild(option);}});if(!photos.options.length){var option=document.createElement('option');option.value='0';option.textContent='Torcida illustration';photos.appendChild(option);}photos.disabled=photos.options.length<2;
    root.openModal('modal-share');renderCard();
  }
  function loadImage(src){return new Promise(function(resolve,reject){var img=new Image();img.onload=function(){resolve(img);};img.onerror=function(){reject(Error('The selected photo could not be loaded. Choose another photo.'));};img.src=src;});}
  function textBlock(ctx,text,x,y,width,size,lineHeight,maxLines,color,font){ctx.font=(font||'')+size+'px Georgia,serif';ctx.fillStyle=color;var lines=wrap(ctx,text,width,maxLines);lines.forEach(function(line,i){ctx.fillText(line,x,y+i*lineHeight);});return y+lines.length*lineHeight;}
  function drawPlaceholder(ctx,x,y,w,h){
    var bg=ctx.createLinearGradient(x,y,x,y+h);bg.addColorStop(0,'#483323');bg.addColorStop(1,'#241b14');ctx.fillStyle=bg;ctx.fillRect(x,y,w,h);
    var cx=x+w*.13,cy=y+h*.48,len=w*.74,r=Math.min(h*.11,w*.055),body=ctx.createLinearGradient(cx,cy-r,cx,cy+r);body.addColorStop(0,'#5b331c');body.addColorStop(.45,'#b07946');body.addColorStop(1,'#5b331c');ctx.fillStyle=body;ctx.beginPath();ctx.roundRect(cx,cy-r,len,r*2,r);ctx.fill();ctx.fillStyle='#d8b873';ctx.fillRect(cx+len*.26,cy-r,len*.21,r*2);ctx.fillStyle='#4b3120';ctx.font='bold '+Math.max(13,r*.5)+'px Georgia';ctx.textAlign='center';ctx.fillText('Torcida',cx+len*.365,cy+r*.17);ctx.fillStyle='#e0c79d';ctx.font=Math.max(12,h*.045)+'px sans-serif';ctx.fillText('THE ART OF THE CIGAR',x+w/2,y+h*.78);ctx.textAlign='left';
  }
  function drawCard(canvas,m,image){
    canvas.width=m.width;canvas.height=m.height;var ctx=canvas.getContext('2d'),W=m.width,H=m.height,p=64,compact=m.format==='compact',story=m.format==='story';
    var bg=ctx.createLinearGradient(0,0,W,H);bg.addColorStop(0,'#fff9ed');bg.addColorStop(1,'#e8dac1');ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);ctx.strokeStyle='#b59256';ctx.lineWidth=2;ctx.strokeRect(24,24,W-48,H-48);
    ctx.fillStyle='#624628';ctx.font='600 22px Arial,sans-serif';ctx.fillText('TORCIDA  /  TASTING JOURNAL',p,79);
    var photoX=p,photoY=110,photoW=compact?430:W-p*2,photoH=compact?H-220:story?850:355;
    if(image){var scale=Math.max(photoW/image.naturalWidth,photoH/image.naturalHeight),sw=photoW/scale,sh=photoH/scale;ctx.drawImage(image,(image.naturalWidth-sw)/2,(image.naturalHeight-sh)/2,sw,sh,photoX,photoY,photoW,photoH);}else drawPlaceholder(ctx,photoX,photoY,photoW,photoH);
    var tx=compact?550:p,tw=compact?W-tx-p:W-p*2,y=compact?145:photoY+photoH+54;
    ctx.font='600 18px Arial,sans-serif';ctx.fillStyle='#82643e';ctx.fillText(m.brand.toUpperCase().slice(0,55),tx,y);y+=46;
    y=textBlock(ctx,m.name,tx,y,tw,compact?45:52,compact?52:60,2,'#39291e','bold ')+8;
    if(m.rating){ctx.font='28px Arial,sans-serif';ctx.fillStyle='#8c672d';ctx.fillText('★'.repeat(m.rating)+'☆'.repeat(5-m.rating)+'   '+m.rating+'/5',tx,y);y+=48;}
    ctx.font='18px Arial,sans-serif';ctx.fillStyle='#6b5742';var details=[m.date,m.location].filter(Boolean).join(' · ');if(details){wrap(ctx,details,tw,2).forEach(function(line){ctx.fillText(line,tx,y);y+=26;});y+=12;}
    if(m.pairing){ctx.fillStyle='#86663c';ctx.font='bold 16px Arial,sans-serif';ctx.fillText('THE PAIRING',tx,y);y+=29;y=textBlock(ctx,m.pairing,tx,y,tw,compact?24:26,32,2,'#4f3927')+20;}
    if(m.notes){ctx.fillStyle='#86663c';ctx.font='bold 16px Arial,sans-serif';ctx.fillText('TASTING NOTES',tx,y);y+=30;var maxLines=Math.max(1,Math.floor((H-128-y)/33));y=textBlock(ctx,m.notes,tx,y,tw,compact?23:25,33,Math.min(maxLines,story?13:5),'#5e4b38');}
    ctx.strokeStyle='#c4aa7d';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(p,H-91);ctx.lineTo(W-p,H-91);ctx.stroke();ctx.fillStyle='#755638';ctx.font='italic 28px Georgia,serif';ctx.fillText('Torcida',p,H-47);ctx.font='14px Arial,sans-serif';ctx.textAlign='right';ctx.fillText('A MOMENT WORTH KEEPING',W-p,H-49);ctx.textAlign='left';return canvas;
  }
  async function renderCard(){
    if(!cardEntry)return;var seq=++cardSequence,m=model(cardEntry,options());cardBlob=null;document.getElementById('card-status').textContent='Preparing your tasting card…';setExportEnabled(false);
    try{var img=m.photo?await loadImage(m.photo):null;if(seq!==cardSequence)return;var canvas=drawCard(document.createElement('canvas'),m,img),blob=await new Promise(function(resolve){canvas.toBlob(resolve,'image/png');});if(!blob)throw Error('Your browser could not create this image.');if(seq!==cardSequence)return;
      if(cardURL)URL.revokeObjectURL(cardURL);cardURL=URL.createObjectURL(blob);cardBlob=blob;
      var preview=document.getElementById('tasting-card-preview');preview.src=cardURL;preview.alt=[m.name,m.brand,m.rating?m.rating+' out of 5':'',m.date,m.location,m.pairing,m.notes].filter(Boolean).join('. ');preview.hidden=false;
      var link=document.getElementById('card-download-link');link.href=cardURL;link.download=filename(m);document.getElementById('card-status').textContent=m.width+' × '+m.height+' PNG. Preview matches your download.';document.getElementById('card-truncation').textContent='Long text is shortened to fit the selected format. Story has the most room.';setExportEnabled(true);
    }catch(e){if(seq===cardSequence){document.getElementById('tasting-card-preview').hidden=true;document.getElementById('card-status').textContent=e.message||'The card could not be prepared.';}}
  }
  function setExportEnabled(enabled){document.getElementById('card-share-button').disabled=!enabled;var link=document.getElementById('card-download-link');link.setAttribute('aria-disabled',String(!enabled));link.tabIndex=enabled?0:-1;link.style.pointerEvents=enabled?'auto':'none';if(!enabled)link.removeAttribute('href');}
  function shareCard(){
    if(!cardBlob||!cardEntry)return;var m=model(cardEntry,options()),file=new File([cardBlob],filename(m),{type:'image/png'});
    if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){navigator.share({files:[file],title:'Torcida tasting card'}).catch(function(e){if(e.name!=='AbortError')root.showToast('Sharing was unavailable. Use Download PNG to save the card.');});}
    else document.getElementById('card-download-link').click();
  }
  function closeCard(){cardSequence++;cardBlob=null;if(cardURL){URL.revokeObjectURL(cardURL);cardURL=null;}root.closeModal('modal-share');}
  function savedSmoke(id){var el=document.getElementById('saved-smoke-moment');if(!el)return;el.hidden=false;document.getElementById('saved-smoke-card-button').onclick=function(){openCard(id);};}
  function initialize(){
    try{view=localStorage.getItem('tc_humidor_view')==='list'?'list':'shelf';}catch(e){}
    document.addEventListener('click',function(e){var b=e.target.closest('[data-atelier-action]');if(b)perform(b.dataset.atelierAction,b.dataset.cigarId);});
    document.getElementById('humidor-photo-input').addEventListener('change',function(){savePhoto(this);});
    ['card-format','card-photo','card-date','card-notes','card-location'].forEach(function(id){document.getElementById(id).addEventListener('change',renderCard);});
    root.renderHumidor();
  }
  var api={formats:formats,model:model,filename:filename,wrap:wrap,ageDays:ageDays,firstPhoto:firstPhoto,cardMarkup:cardMarkup,applyView:applyView,setView:setView,detail:detail,choosePhoto:choosePhoto,savePhoto:savePhoto,openCard:openCard,renderCard:renderCard,drawCard:drawCard,shareCard:shareCard,closeCard:closeCard,savedSmoke:savedSmoke,initialize:initialize};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.TorcidaAtelier=api;
})(typeof window!=='undefined'?window:globalThis);
