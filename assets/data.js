(function(root){
  'use strict';
  var KEYS=['humidors','humidor','wishlist','smoked','myBar'];
  function object(v){return v!==null&&typeof v==='object'&&!Array.isArray(v);}
  function validateCollection(data){
    if(!object(data)||data.version!==1)throw new Error('This backup version is not supported.');
    KEYS.forEach(function(k){if(!Array.isArray(data[k])||data[k].length>20000)throw new Error('Invalid collection: '+k);});
    function records(list,freePrice){list.forEach(function(v){
      if(!object(v)||!(typeof v.id==='number'&&Number.isSafeInteger(v.id)||typeof v.id==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(v.id))||typeof v.name!=='string')throw new Error('A collection entry is invalid.');
      ['name','brand','size','wrapper','strength','notes','date','location','reason','itemType','spiritType','type','age','proof','purchaseDate'].forEach(function(k){if(v[k]!==undefined&&v[k]!==null&&typeof v[k]!=='string')throw new Error('Invalid text field: '+k);});
      ['qty','bottles','lowstock','rating'].forEach(function(k){if(v[k]!==undefined&&(!Number.isInteger(v[k])||v[k]<0||v[k]>(k==='rating'?5:1000000)))throw new Error('Invalid count or rating.');});
      if(!freePrice&&v.price!==undefined&&v.price!==''&&(!['number','string'].includes(typeof v.price)||!Number.isFinite(Number(v.price))||Number(v.price)<0))throw new Error('Invalid price.');
      if(v.ratings!==undefined){if(!object(v.ratings))throw new Error('Invalid ratings.');Object.keys(v.ratings).forEach(function(k){if(!Number.isInteger(v.ratings[k])||v.ratings[k]<0||v.ratings[k]>5)throw new Error('Invalid rating.');});}
      if(v.drink!==undefined&&(!object(v.drink)||typeof v.drink.name!=='string'||typeof v.drink.type!=='string'||!Number.isInteger(v.drink.rating)||v.drink.rating<0||v.drink.rating>5))throw new Error('Invalid drink entry.');
      if(v.photos!==undefined&&(!Array.isArray(v.photos)||v.photos.length>100||v.photos.some(function(p){return typeof p!=='string'||!/^data:image\/(?:jpeg|png|webp|gif);base64,[a-zA-Z0-9+/]+=*$/.test(p);})))throw new Error('Invalid saved photo.');
    });}
    records(data.humidors);records(data.humidor);records(data.wishlist,true);records(data.smoked);records(data.myBar);
    var ids=new Set();
    data.humidors.forEach(function(h){if(ids.has(h.id)||!Array.isArray(h.cigars))throw new Error('Invalid humidor.');ids.add(h.id);records(h.cigars);});
    if(data.activeHumidorId!==null&&typeof data.activeHumidorId!=='string')throw new Error('Invalid active humidor.');
    if(data.ashPersonalBest!==null&&!object(data.ashPersonalBest))throw new Error('Invalid ash record.');
    // Reject dangerous keys and non-JSON values at every depth, including nested notes/photos.
    function walk(v,depth){
      if(depth>12)throw new Error('Backup is too deeply nested.');
      if(typeof v==='number'&&!Number.isFinite(v))throw new Error('Invalid number.');
      if(typeof v==='string'&&/<\/?[a-z][^>]*>/i.test(v))throw new Error('Backup text must not contain HTML markup.');
      if(v===null||typeof v!=='object')return;
      Object.keys(v).forEach(function(k){if(['__proto__','constructor','prototype'].includes(k))throw new Error('Invalid backup key.');walk(v[k],depth+1);});
    }
    walk(data,0);return data;
  }
  function list(value){
    if(typeof value==='string'){
      var text=value.trim();try{var p=JSON.parse(text);if(Array.isArray(p))value=p;}catch(e){}
      if(typeof value==='string')value=text.split(/[,;|\n]+/);
    }
    return Array.isArray(value)?value.filter(function(v){return typeof v==='string'&&v.trim();}).map(function(v){return v.trim().slice(0,100);}).slice(0,12):[];
  }
  function parseAI(text){
    if(typeof text!=='string'||!text.trim())throw new Error('No result returned. Please try again.');
    text=text.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
    try{return JSON.parse(text);}catch(e){}
    var start=text.search(/[\[{]/);if(start<0)throw new Error('The result was incomplete. Please try again.');
    var end=text.lastIndexOf(text[start]==='['?']':'}');
    try{return JSON.parse(text.slice(start,end+1));}catch(e){throw new Error('The result was incomplete. Please try again.');}
  }
  var fields={
    identify:['name','brand','size','wrapper','strength','rating','tasting_notes','pairing','about','spirit_type','age','proof','cigar_pairing_name','cigar_pairing_brand','cigar_pairing_why'],
    selector:['name','brand','vitola','strength','why'],
    pairing:['cigar_name','cigar_brand','why'],
    recipes:['drink_name','drink_desc','drink_recipe','drink_recipe_search','drink_zero_proof','cocktail_name','cocktail_desc','cocktail_recipe','cocktail_recipe_search','zero_proof_recipe','bar_match','bar_match_why'],
    quiz:['recommended_strength','profile_description'],
    ash:['estimated_length','construction_analysis','why_contests_exist','quality_verdict'],
    occasion:['cigar_name','cigar_brand','cigar_size','cigar_strength','cigar_why','drink_name','drink_why','occasion_note'],
    alternatives:['name','brand','type','strength','wrapper','why_similar','price_range','tasting_notes']
  };
  function normalizeAI(value,kind){
    if(!fields[kind])throw new Error('Unknown result type.');
    function row(v,keys){
      if(!object(v))throw new Error('The result has an unexpected format. Please try again.');
      var out={};keys.forEach(function(k){var x=v[k];out[k]=(typeof x==='string'?x:typeof x==='number'&&Number.isFinite(x)?String(x):Array.isArray(x)?x.filter(function(s){return typeof s==='string';}).join(', '):'').slice(0,12000);if(/<\/?[a-z][^>]*>/i.test(out[k]))throw new Error('The result contained unexpected markup. Please try again.');});return out;
    }
    if(kind==='alternatives'){
      if(!Array.isArray(value)||!value.length||value.length>8)throw new Error('No alternatives returned. Please try again.');
      return value.map(function(v){var r=row(v,fields.alternatives);if(!r.name.trim())throw new Error('An alternative is missing its name.');return r;});
    }
    var r=row(value,fields[kind]);
    if(kind==='identify'){
      if(!r.name.trim()||!['cigar','spirit'].includes(value.type))throw new Error('Could not identify this item. Try a more specific name or photo.');
      r.type=value.type;r.flavor_tags=list(value.flavor_tags);
    }
    if(kind==='selector'){if(!r.name.trim())throw new Error('No cigar recommendation returned.');r.flavor_tags=list(value.flavor_tags);}
    if((kind==='pairing'||kind==='occasion')&&!r.cigar_name.trim())throw new Error('No cigar recommendation returned.');
    if(kind==='ash'&&(!r.estimated_length||!r.quality_verdict))throw new Error('The photo analysis was incomplete. Please try again.');
    if(kind==='recipes'&&!r.drink_name&&!r.cocktail_name)throw new Error('No pairing recipe returned. Please try again.');
    if(kind==='quiz'){
      if(!Array.isArray(value.cigars)||!value.cigars.length||value.cigars.length>5)throw new Error('The quiz result was incomplete. Please try again.');
      r.cigars=value.cigars.map(function(v){var c=row(v,['name','brand','why']);if(!c.name)throw new Error('A quiz recommendation was incomplete.');return c;});
    }
    return r;
  }
  var api={validateCollection:validateCollection,normalizeAI:normalizeAI,parseAI:parseAI,list:list};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.TorcidaData=api;
})(typeof window!=='undefined'?window:globalThis);
