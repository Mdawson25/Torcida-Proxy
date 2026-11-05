(function(root){
 'use strict';
 function same(a,b){return JSON.stringify(a)===JSON.stringify(b);}
 function merge(base,local,remote,path){
  path=path||'collection';
  if(same(local,remote)||same(base,remote))return structuredClone(local);
  if(same(base,local))return structuredClone(remote);
  if(base===undefined&&path.endsWith('/tastings'))base=[];
  if(Array.isArray(local)&&Array.isArray(remote)&&Array.isArray(base)&&[...base,...local,...remote].every(x=>x&&typeof x==='object'&&'id'in x)){
   var b=new Map(base.map(x=>[String(x.id),x])),l=new Map(local.map(x=>[String(x.id),x])),r=new Map(remote.map(x=>[String(x.id),x]));
   var ids=new Set([...l.keys(),...r.keys(),...b.keys()]),out=[];
   ids.forEach(function(id){var v=merge(b.get(id),l.get(id),r.get(id),path+'/'+id);if(v!==undefined)out.push(v);});return out;
  }
  if(base&&local&&remote&&!Array.isArray(local)&&typeof local==='object'&&!Array.isArray(remote)&&typeof remote==='object'){
   var out={};new Set([...Object.keys(base),...Object.keys(local),...Object.keys(remote)]).forEach(function(k){var v=k==='activeHumidorId'?local[k]:merge(base[k],local[k],remote[k],path+'/'+k);if(v!==undefined)out[k]=v;});return out;
  }
  var e=new Error('Both devices changed '+path+'. Both copies are retained.');e.code='MERGE_CONFLICT';throw e;
 }
 var api={merge:merge,same:same};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.TorcidaSync=api;
})(typeof window!=='undefined'?window:globalThis);
