(function(root){
  'use strict';
  var svgId=0;
  function escapeText(s){return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function metrics(length,ring){return {length:length*40,diameter:ring/64*40,ratio:length/(ring/64)};}
  function cigarSVG(shape,prefix){
    var m=metrics(shape.length,shape.ring),x=36,cy=43,len=m.length,r=m.diameter/2,tip=shape.tip;
    var gid='tc-wrap-'+(++svgId),bid='tc-band-'+svgId;
    var path;
    if(tip==='torpedo'||tip==='belicoso'){
      var taper=tip==='torpedo'?31:21;
      path='M '+x+' '+cy+' Q '+(x+taper*.5)+' '+(cy-r*.7)+' '+(x+taper)+' '+(cy-r)+' L '+(x+len)+' '+(cy-r)+' L '+(x+len)+' '+(cy+r)+' L '+(x+taper)+' '+(cy+r)+' Q '+(x+taper*.5)+' '+(cy+r*.7)+' '+x+' '+cy+' Z';
    }else if(tip==='figurado'){
      path='M '+x+' '+cy+' C '+(x+15)+' '+(cy-3)+' '+(x+20)+' '+(cy-r)+' '+(x+45)+' '+(cy-r)+' L '+(x+len-45)+' '+(cy-r)+' Q '+(x+len-12)+' '+(cy-r)+' '+(x+len)+' '+cy+' Q '+(x+len-12)+' '+(cy+r)+' '+(x+len-45)+' '+(cy+r)+' L '+(x+45)+' '+(cy+r)+' C '+(x+20)+' '+(cy+r)+' '+(x+15)+' '+(cy+3)+' '+x+' '+cy+' Z';
    }else{
      path='M '+(x+r)+' '+(cy-r)+' L '+(x+len)+' '+(cy-r)+' L '+(x+len)+' '+(cy+r)+' L '+(x+r)+' '+(cy+r)+' Q '+x+' '+(cy+r)+' '+x+' '+cy+' Q '+x+' '+(cy-r)+' '+(x+r)+' '+(cy-r)+' Z';
    }
    var clip='tc-clip-'+svgId,veins='';
    for(var i=0;i<Math.ceil(len/25);i++){var vx=x+16+i*25;veins+='<path d="M '+vx+' '+(cy-r-2)+' Q '+(vx+10)+' '+cy+' '+(vx+22)+' '+(cy+r+2)+'" fill="none" stroke="#382214" stroke-width=".65" opacity=".25"/>';}
    var bandX=x+len*.26,bandW=22;
    var caps=tip==='round'?'<path d="M '+(x+6)+' '+(cy-r*.75)+' Q '+(x+11)+' '+cy+' '+(x+6)+' '+(cy+r*.75)+'" fill="none" stroke="#301c10" stroke-width=".8" opacity=".45"/>':'';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 86" role="img" aria-label="'+escapeText((prefix||'')+shape.name+', '+shape.length+' inches long, '+shape.ring+' ring gauge. Unlit cigar, shown on a shared scale.')+'" data-length="'+len+'" data-diameter="'+m.diameter+'"><defs><linearGradient id="'+gid+'" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#4b2b18"/><stop offset=".22" stop-color="'+shape.wrap+'"/><stop offset=".4" stop-color="#a16b3f"/><stop offset=".7" stop-color="'+shape.wrap+'"/><stop offset="1" stop-color="#422717"/></linearGradient><linearGradient id="'+bid+'" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#9d7844"/><stop offset=".35" stop-color="#d7bb79"/><stop offset=".55" stop-color="#e0c990"/><stop offset="1" stop-color="#8a6436"/></linearGradient><clipPath id="'+clip+'"><path d="'+path+'"/></clipPath></defs><ellipse cx="'+(x+len/2)+'" cy="'+(cy+r+6)+'" rx="'+(len/2-3)+'" ry="3" fill="#20160f" opacity=".13"/><path d="'+path+'" fill="url(#'+gid+')" stroke="#4d301b" stroke-width=".8"/><g clip-path="url(#'+clip+')">'+veins+'<rect x="'+bandX+'" y="'+(cy-r-1)+'" width="'+bandW+'" height="'+(m.diameter+2)+'" fill="url(#'+bid+')"/><path d="M '+(bandX+3)+' '+(cy-r)+' V '+(cy+r)+' M '+(bandX+10)+' '+(cy-r)+' V '+(cy+r)+'" stroke="#5c4128" stroke-width=".6"/><text x="'+(bandX+11)+'" y="'+(cy+1.7)+'" text-anchor="middle" font-family="Georgia,serif" font-size="4.6" font-weight="bold" fill="#392719">Torcida</text>'+caps+'</g>'+(tip==='figurado'?'':'<ellipse cx="'+(x+len)+'" cy="'+cy+'" rx="2.1" ry="'+r+'" fill="#52311b"/><ellipse cx="'+(x+len+.2)+'" cy="'+cy+'" rx="1.1" ry="'+(r*.8)+'" fill="#a47a4d" opacity=".65"/>')+'</svg>';
  }
  function cutSVG(kind){
    var id='tc-cut-'+(++svgId),tool='',side='',cap='';
    var cigar='<path d="M133 106 V54 Q133 31 150 31 Q167 31 167 54 V106 Z" fill="url(#'+id+')" stroke="#62412a" stroke-width="1"/>';
    if(kind==='straight'){
      tool='<rect x="17" y="24" width="66" height="72" rx="14" fill="#66564b"/><circle cx="50" cy="62" r="18" fill="#eee3d0" stroke="#c5bdb2" stroke-width="3"/><path d="M27 37 L73 37 56 64 27 64Z" fill="#c5c6c1" stroke="#f5f2e9"/>';
      side=cigar+'<path d="M133 45 H167" stroke="#e8c379" stroke-width="2" stroke-dasharray="3 2"/><path d="M133 45 V36 Q133 17 150 17 Q167 17 167 36 V45Z" fill="#90623d" opacity=".3" transform="translate(0,-6)"/><path d="M122 45 H131 M169 45 H178" stroke="#6d4c29" stroke-width="1.5"/><path d="M136 59 Q150 52 164 59" fill="none" stroke="#493022" opacity=".5"/>';
      cap='<circle cx="250" cy="63" r="26" fill="#a57845" stroke="#5d3d24" stroke-width="3"/><path d="M233 52 Q245 41 259 52 T264 74 M236 75 Q244 59 255 68 T264 58 M242 44 Q235 60 243 82" stroke="#634023" stroke-width="2" fill="none"/><circle cx="250" cy="63" r="22" fill="none" stroke="#caa06a" opacity=".7"/>';
    }else if(kind==='v'){
      tool='<rect x="19" y="25" width="62" height="72" rx="15" fill="#66564b"/><circle cx="50" cy="63" r="17" fill="#eee3d0" stroke="#c5bdb2" stroke-width="3"/><path d="M32 34 H68 L50 61Z" fill="#c5c6c1" stroke="#f5f2e9"/>';
      side=cigar+'<path d="M138 39 L150 52 162 39" fill="#342116" stroke="#dab781" stroke-width="1.5"/><path d="M138 28 L150 40 162 28" fill="#90623d" opacity=".3"/><path d="M123 40 H133 M167 40 H177" stroke="#6d4c29" stroke-width="1.5" stroke-dasharray="3 2"/>';
      cap='<circle cx="250" cy="63" r="26" fill="#805232" stroke="#5d3d24" stroke-width="2"/><ellipse cx="250" cy="63" rx="8" ry="23" fill="#2c1d14"/><path d="M250 42 Q255 63 250 84" fill="none" stroke="#b58c59" stroke-width="1.5"/>';
    }else{
      tool='<path d="M36 29 Q50 22 64 29 V86 Q50 94 36 86Z" fill="#72665b" stroke="#534b43"/><ellipse cx="50" cy="29" rx="14" ry="5" fill="#b9b7ad"/><path d="M39 69 H61 V88 Q50 95 39 88Z" fill="#c5c6c1"/><ellipse cx="50" cy="88" rx="11" ry="4" fill="#28231f" stroke="#e1ded1" stroke-width="2"/>';
      side=cigar+'<ellipse cx="150" cy="36" rx="7" ry="4" fill="#2c1d14" stroke="#c9a36e"/><path d="M143 18 V27 M157 18 V27" stroke="#9b8b76" stroke-width="2"/><path d="M146 23 L150 28 154 23" fill="none" stroke="#6d4c29" stroke-width="1.2"/>';
      cap='<circle cx="250" cy="63" r="26" fill="#805232" stroke="#5d3d24" stroke-width="2"/><circle cx="250" cy="63" r="10" fill="#2c1d14" stroke="#c9a36e" stroke-width="2"/>';
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 122" role="img" aria-label="'+escapeText(kind==='straight'?'Straight cut: a double-blade cutter, a shallow cut above the cap shoulder, and the round exposed tobacco opening.':kind==='v'?'V-cut: a V-cutter, a shallow wedge in the cap, and the narrow slot viewed from above.':'Punch cut: a cylindrical punch, a small hole in the center of the cap, and the circular opening viewed from above.')+'"><defs><linearGradient id="'+id+'" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#54311e"/><stop offset=".45" stop-color="#9b6c40"/><stop offset="1" stop-color="#5d3921"/></linearGradient></defs><path d="M100 20 V108 M200 20 V108" stroke="#d9cbbb" stroke-width="1"/>'+tool+side+cap+'</svg>';
  }
  function initialize(shapesData){
    var shapes=shapesData.map(function(s){return {name:s.name,length:parseFloat(s.dim),ring:parseInt(s.dim.split('×')[1],10),wrap:s.wrapHex,tip:['Torpedo','Belicoso','Figurado'].includes(s.name)?s.tip:'round',desc:s.desc};});
    var grid=document.getElementById('shapes-grid');grid.textContent='';
    var panel=document.createElement('section');panel.className='guide-comparison';panel.id='guide-comparison';panel.setAttribute('aria-labelledby','compare-title');
    panel.innerHTML='<h3 id="compare-title">Find your proportions</h3><p>Compare two shapes at the same scale.</p><div class="compare-controls"><label>First cigar<select id="compare-first"></select></label><label>Second cigar<select id="compare-second"></select></label></div><div id="compare-drawings" aria-live="polite"></div><div class="compare-ruler" aria-label="Relative scale, zero to eight inches"><span>0</span><span>2</span><span>4</span><span>6</span><span>8 in</span></div><div class="compare-note">Ring gauge measures diameter in 64ths of an inch. Dimensions shown are representative, not universal standards.</div>';
    grid.before(panel);
    ['compare-first','compare-second'].forEach(function(id){var select=document.getElementById(id);shapes.forEach(function(s,i){var option=document.createElement('option');option.value=i;option.textContent=s.name;select.appendChild(option);});});
    document.getElementById('compare-first').value=1;document.getElementById('compare-second').value=2;
    function draw(){var a=shapes[Number(document.getElementById('compare-first').value)],b=shapes[Number(document.getElementById('compare-second').value)];document.getElementById('compare-drawings').innerHTML=[a,b].map(function(s){return '<div class="compare-line"><div class="compare-line-header"><span>'+escapeText(s.name)+'</span><span>'+s.length+' in · '+s.ring+' ring</span></div>'+cigarSVG(s)+'</div>';}).join('');}
    document.getElementById('compare-first').onchange=draw;document.getElementById('compare-second').onchange=draw;draw();
    shapes.forEach(function(s,i){var card=document.createElement('article');card.className='shape-card';card.innerHTML='<div class="shape-heading"><h3 class="shape-name">'+escapeText(s.name)+'</h3><span class="shape-dim">'+s.length+' in · '+s.ring+' ring</span></div><div class="shape-visual">'+cigarSVG(s)+'</div><p class="shape-desc">'+escapeText(s.desc)+'</p>';var button=document.createElement('button');button.className='shape-compare';button.type='button';button.textContent='Compare '+s.name;button.onclick=function(){document.getElementById('compare-first').value=i;draw();panel.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});document.getElementById('compare-second').focus({preventScroll:true});};card.appendChild(button);grid.appendChild(card);});
    var cuts=[{key:'straight',name:'Straight cut',badge:'Open draw',tool:'Double-blade cutter',desc:'A thin slice opens the full end of the cap. Start shallow, keeping the cap shoulder intact.',pro:'Versatile across many shapes and ring gauges.',con:'Cutting below the shoulder can loosen the wrapper.'},{key:'v',name:'V-cut',badge:'Wedge opening',tool:'V-cutter',desc:'A shaped blade removes a wedge while leaving most of the cap in place.',pro:'Creates a concentrated opening without removing the full cap.',con:'A shallow or poorly aligned wedge can restrict the draw.'},{key:'punch',name:'Punch cut',badge:'Small opening',tool:'Cigar punch',desc:'A circular blade removes a small disc from the center of a rounded cap.',pro:'Compact tool, with most of the cap left intact.',con:'Less suitable for pointed caps or a tight, narrow cigar.'}];
    document.getElementById('cuts-grid').innerHTML=cuts.map(function(c){return '<article class="cut-card"><div class="cut-heading"><h3 class="cut-name">'+c.name+'</h3><span class="cut-badge">'+c.badge+'</span></div><p class="cut-desc">'+c.desc+'</p><div class="cut-vis">'+cutSVG(c.key)+'<div class="cut-view-labels"><span>'+c.tool+'</span><span>Cut location</span><span>Opening at cap</span></div></div><p class="cut-pro">'+c.pro+'</p><p class="cut-con">'+c.con+'</p><p class="cut-note">Schematic close-ups. Blade position and opening size vary with the cigar and tool.</p></article>';}).join('');
  }
  function spiritSVG(type){
    var types={
      'Bourbon':['#b36a1d','#6a3212','BOURBON','square'],
      'Scotch':['#c89438','#63381a','SCOTCH','tall'],
      'Rye Whiskey':['#a96925','#39482d','RYE','square'],
      'Irish Whiskey':['#b98d38','#28563b','IRISH','tall'],
      'Japanese Whisky':['#b87825','#393330','WHISKY','round'],
      'Rum':['#9c511b','#593328','RUM','round'],
      'Cognac':['#ad5c21','#513023','COGNAC','decanter'],
      'Armagnac':['#9b561d','#613d2c','ARMAGNAC','decanter'],
      'Mezcal':['#e1dfb9','#586442','MEZCAL','square'],
      'Tequila':['#e7dcb0','#556b40','TEQUILA','square'],
      'Gin':['#bdcfc0','#355a48','GIN','round'],
      'Vodka':['#dae5e5','#42657a','VODKA','tall'],
      'Port':['#611f2c','#42202a','PORT','wine'],
      'Red Wine':['#651c30','#3a2530','RED WINE','wine'],
      'Other':['#cba567','#665547','SPIRIT','round']
    };
    var v=types[type]||types.Other,id='tc-spirit-'+(++svgId),shape=v[3];
    var d=shape==='square'?'M23 40 Q23 33 31 30 L31 16 H45 V30 Q53 33 53 40 V87 Q53 91 49 91 H27 Q23 91 23 87Z':shape==='decanter'?'M31 18 H45 V36 C45 43 61 46 61 65 C61 86 53 92 38 92 C23 92 15 86 15 65 C15 46 31 43 31 36Z':shape==='wine'?'M32 10 H44 V37 C44 46 52 45 52 57 V90 H24 V57 C24 45 32 46 32 37Z':shape==='tall'?'M32 12 H44 V35 Q51 42 51 48 V90 H25 V48 Q25 42 32 35Z':'M31 17 H45 V32 C45 39 57 39 57 53 V85 Q57 92 49 92 H27 Q19 92 19 85 V53 C19 39 31 39 31 32Z';
    var botanical=(type==='Tequila'||type==='Mezcal')?'<path d="M64 88 Q51 75 58 68 L65 82 66 65 69 82 75 71 Q78 81 68 90" fill="#657a48"/>':type==='Gin'?'<path d="M60 87 L69 66 M63 81 L59 73 M65 77 L73 73" stroke="#486347" fill="none"/><g fill="#36485c"><circle cx="63" cy="82" r="3"/><circle cx="68" cy="79" r="3"/><circle cx="69" cy="85" r="3"/></g>':'';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 104" width="64" height="84" role="img" aria-label="'+escapeText(type||'Spirit')+' category bottle"><defs><linearGradient id="'+id+'" x1="0" x2="1"><stop stop-color="#28322e"/><stop offset=".16" stop-color="'+v[0]+'"/><stop offset=".36" stop-color="#f5e5b5" stop-opacity=".8"/><stop offset=".52" stop-color="'+v[0]+'"/><stop offset=".83" stop-color="'+v[0]+'"/><stop offset="1" stop-color="#3b3025"/></linearGradient></defs><ellipse cx="39" cy="96" rx="25" ry="4" fill="#392619" opacity=".15"/><path d="'+d+'" fill="url(#'+id+')" stroke="#796f59" stroke-width=".7"/><path d="M29 46 V82" stroke="#fff" stroke-opacity=".48" stroke-width="2" stroke-linecap="round"/><rect x="30" y="'+(shape==='wine'?8:12)+'" width="16" height="10" rx="2" fill="'+v[1]+'"/><path d="M32 15 H44" stroke="#e9cf94" stroke-opacity=".6"/><rect x="25" y="54" width="26" height="24" rx="2" fill="#f4ead3" stroke="#c2a571" stroke-width=".6"/><text x="38" y="62" text-anchor="middle" font-size="3.6" font-family="Georgia,serif" fill="#715b3d">TORCIDA</text><path d="M29 65 H47" stroke="#b89a65" stroke-width=".5"/><text x="38" y="71" text-anchor="middle" font-size="4" font-family="Georgia,serif" font-weight="bold" fill="'+v[1]+'">'+v[2]+'</text><path d="M29 86 Q38 89 47 86" fill="none" stroke="#fff" stroke-opacity=".3"/>'+botanical+'</svg>';
  }

  var api={spiritSVG:spiritSVG,metrics:metrics,cigarSVG:cigarSVG,cutSVG:cutSVG,initialize:initialize};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.TorcidaGuide=api;
})(typeof window!=='undefined'?window:globalThis);
