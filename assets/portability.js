(function(root){
 'use strict';
 function copy(v){return JSON.parse(JSON.stringify(v));}
 function signature(v){return [v.brand||'',v.name||'',v.line||'',v.size||'',v.purchaseDate||''].map(x=>x.trim().toLowerCase()).join('|');}
 function importCollection(target,source){
  var out=copy(target);
  function append(dst,src){src.forEach(function(item){if(dst.some(x=>JSON.stringify(x)===JSON.stringify(item)||signature(x)===signature(item)&&JSON.stringify({...x,id:null})===JSON.stringify({...item,id:null})))return;var next=copy(item);if(dst.some(x=>String(x.id)===String(next.id)))next.id=Date.now()+Math.floor(Math.random()*1000000);dst.push(next);});}
  source.humidors.forEach(function(h){var existing=out.humidors.find(x=>x.id===h.id&&x.name===h.name);if(existing)append(existing.cigars,h.cigars);else{var next=copy(h);if(out.humidors.some(x=>x.id===next.id))next.id='import_'+Date.now()+'_'+out.humidors.length;out.humidors.push(next);}});
  ['humidor','wishlist','smoked','myBar'].forEach(k=>append(out[k],source[k]));
  if(source.tastings&&source.tastings.length){out.tastings=out.tastings||[];source.tastings.forEach(function(item){if(out.tastings.some(function(x){return JSON.stringify({...x,id:null})===JSON.stringify({...item,id:null});}))return;var next=copy(item);if(out.tastings.some(function(x){return x.id===next.id;}))next.id='comparison_import_'+Date.now()+'_'+out.tastings.length;out.tastings.push(next);});}
  if(!out.activeHumidorId&&out.humidors.length)out.activeHumidorId=out.humidors[0].id;
  return out;
 }
 function parseCSV(text){
  if(typeof text!=='string'||text.length>2000000)throw new Error('Choose a CSV smaller than 2 MB.');
  var rows=[],row=[],field='',quoted=false;
  for(var i=0;i<text.length;i++){var ch=text[i];if(quoted){if(ch==='"'&&text[i+1]==='"'){field+='"';i++;}else if(ch==='"')quoted=false;else field+=ch;}
   else if(ch==='"'){if(field)throw new Error('Invalid CSV quotes.');quoted=true;}else if(ch===','){row.push(field);field='';}else if(ch==='\n'){row.push(field.replace(/\r$/,''));if(row.some(x=>x.trim()))rows.push(row);row=[];field='';}else field+=ch;
  }
  if(quoted)throw new Error('A CSV quote was not closed.');row.push(field.replace(/\r$/,''));if(row.some(x=>x.trim()))rows.push(row);
  if(rows.length<2||rows.length>5001)throw new Error('CSV needs a header and 1 to 5000 rows.');
  rows[0][0]=rows[0][0].replace(/^\uFEFF/,'');return rows;
 }
 var fields=['brand','name','line','size','wrapper','strength','qty','price','purchaseDate','notes'];
 function records(rows,mapping){return rows.slice(1).map(function(row,i){var out={id:Date.now()+i,qty:1,price:0};for(var key of fields){var index=mapping[key];if(index===undefined||index==='')continue;var value=String(row[Number(index)]||'').trim();if(key==='qty'){if(value&&!/^\d+$/.test(value))throw new Error('Invalid quantity on row '+(i+2));out.qty=value?Number(value):1;}else if(key==='price'){if(value&&!/^\d+(\.\d{1,2})?$/.test(value))throw new Error('Invalid price on row '+(i+2));out.price=Number(value||0);}else if(value)out[key]=value;}
   if(!out.name)throw new Error('Missing name on row '+(i+2));if(out.purchaseDate&&(!/^\d{4}-\d{2}-\d{2}$/.test(out.purchaseDate)||new Date(out.purchaseDate+'T00:00:00Z').toISOString().slice(0,10)!==out.purchaseDate))throw new Error('Use YYYY-MM-DD dates on row '+(i+2));return out;
 });}
 function cell(v){var text=String(v??'');if(/^[\s]*[=+@\-\t\r]/.test(text))text="'"+text;return '"'+text.replace(/"/g,'""')+'"';}
 function csv(data){var headers=['section','humidor',...fields,'date','rating','location'],rows=[headers];function add(section,humidor,list){list.forEach(v=>rows.push(headers.map(k=>k==='section'?section:k==='humidor'?humidor:v[k]??'')));}data.humidors.forEach(h=>add('inventory',h.name,h.cigars));add('inventory','Legacy',data.humidor);add('journal','',data.smoked);add('wishlist','',data.wishlist);add('bar','',data.myBar);return rows.map(r=>r.map(cell).join(',')).join('\r\n');}
 var api={parseCSV:parseCSV,records:records,csv:csv,fields:fields,signature:signature,importCollection:importCollection};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.TorcidaPortability=api;
})(typeof window!=='undefined'?window:globalThis);
