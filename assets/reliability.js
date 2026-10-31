(function(root){
  'use strict';
  function stock(value,fallback){if(value===undefined||value===null||value==='')return fallback===undefined?1:fallback;var n=Number(value);return Number.isInteger(n)&&n>=0?n:0;}
  var lastId=0;
  function nextId(){lastId=Math.max(Date.now(),lastId+1);return lastId;}
  function tasteProfile(entries){
    var rated=entries.filter(function(s){return s.rating>=1&&s.rating<=5;}),counts={},flavors={},strengths={};
    var words=['cedar','leather','chocolate','coffee','pepper','cream','vanilla','earth','spice','nuts','fruit','floral','honey','caramel','toast'];
    rated.forEach(function(s){var notes=(s.notes||'').toLowerCase();words.forEach(function(w){if(notes.includes(w)){flavors[w]=(flavors[w]||0)+1;}});if(s.strength)strengths[s.strength]=(strengths[s.strength]||0)+1;});
    return {ratedCount:rated.length,flavors:Object.keys(flavors).sort(function(a,b){return flavors[b]-flavors[a]||a.localeCompare(b);}).map(function(k){return {name:k,count:flavors[k]};}),strengths:Object.keys(strengths).sort().map(function(k){return {name:k,count:strengths[k]};}),top:rated.slice().sort(function(a,b){return b.rating-a.rating;}).slice(0,3)};
  }
  function ashInches(value,unit){
    if(typeof value==='string'&&unit===undefined){var m=value.trim().match(/^(\d+(?:\.\d+)?(?:\s+\d+\/\d+)?|\d+\/\d+)\s*(inches|inch|in|cm|mm)\s*$/i);if(!m)return null;value=m[1];unit=m[2];}
    if(typeof value==='string'&&value.includes('/')){var p=value.split(/\s+/),f=p.pop().split('/');value=(p.length?Number(p[0]):0)+Number(f[0])/Number(f[1]);}
    var n=Number(value),u=String(unit||'').toLowerCase();if(!Number.isFinite(n)||n<=0)return null;
    if(u==='cm')n/=2.54;else if(u==='mm')n/=25.4;else if(!['in','inch','inches'].includes(u))return null;
    return n<=12?n:null;
  }
  function escaped(value){return String(value||'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  var api={stock:stock,nextId:nextId,tasteProfile:tasteProfile,ashInches:ashInches,escaped:escaped};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.TorcidaReliability=api;
})(typeof window!=='undefined'?window:globalThis);
