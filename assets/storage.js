(function(root){
  'use strict';
  var LEGACY=['tc_collection_v1','tc_humidors','tc_active_humidor','tc_humidor','tc_wishlist','tc_smoked','tc_bar','tc_ashbest'];
  function conflict(){var e=new Error('Your collection changed in another tab. Download unsaved changes, then reload.');e.name='CollectionConflictError';return e;}
  function localAdapter(storage){return {mode:'local',
    read:async function(){var raw=storage.getItem('tc_collection_v1');return raw===null?null:{revision:raw,data:JSON.parse(raw)};},
    archive:async function(){return null;},
    write:async function(data,expected){var current=storage.getItem('tc_collection_v1');if(current!==expected)throw conflict();var text=JSON.stringify(data);storage.setItem('tc_collection_v1',text);if(storage.getItem('tc_collection_v1')!==text)throw new Error('The save could not be verified.');return {revision:text,data:data};}
  };}
  function indexedAdapter(db){
    function read(key){return new Promise(function(resolve,reject){var tx=db.transaction('state','readonly'),request=tx.objectStore('state').get(key);request.onsuccess=function(){resolve(request.result||null);};request.onerror=function(){reject(request.error||new Error('Saved data could not be read.'));};});}
    return {mode:'indexeddb',read:function(){return read('current');},archive:function(){return read('legacyArchive');},
      write:function(data,expected,archive){return new Promise(function(resolve,reject){
        var tx;try{tx=db.transaction('state','readwrite',{durability:'strict'});}catch(e){tx=db.transaction('state','readwrite');}
        var store=tx.objectStore('state'),failure=null,record={revision:Date.now()+'-'+Math.random().toString(36).slice(2),data:data,savedAt:new Date().toISOString()};
        var request=store.get('current');
        request.onsuccess=function(){
          if((request.result?request.result.revision:null)!==expected){failure=conflict();tx.abort();return;}
          // The archive and new collection commit in the same transaction.
          if(archive)store.put({values:archive,createdAt:new Date().toISOString()},'legacyArchive');
          store.put(record,'current');
        };
        tx.oncomplete=function(){resolve(record);};
        tx.onabort=function(){reject(failure||tx.error||new Error('The collection was not saved.'));};
        tx.onerror=function(){failure=failure||tx.error;};
      });},close:function(){db.close();}
    };
  }
  function openDatabase(environment){return new Promise(function(resolve,reject){
    var request=environment.indexedDB.open('torcida-collection-v2',1),settled=false;
    var timeout=setTimeout(function(){settled=true;reject(new Error('Expanded storage did not open in time.'));},5000);
    request.onupgradeneeded=function(){if(!request.result.objectStoreNames.contains('state'))request.result.createObjectStore('state');};
    request.onsuccess=function(){clearTimeout(timeout);if(settled){request.result.close();return;}settled=true;var db=request.result;db.onversionchange=function(){db.close();};resolve(indexedAdapter(db));};
    request.onerror=request.onblocked=function(){clearTimeout(timeout);if(!settled){settled=true;reject(request.error||new Error('Expanded storage is unavailable.'));}};
  });}
  async function open(environment){
    environment=environment||root;
    if(environment.indexedDB){try{return await openDatabase(environment);}catch(e){}}
    return localAdapter(environment.localStorage);
  }
  function readLegacy(storage){var values={};LEGACY.forEach(function(key){values[key]=storage.getItem(key);});return values;}
  function removeArchivedCopies(storage,values){
    // Only remove exact copies after an IndexedDB transaction archived them.
    // Timer settings and unrelated browser data are never touched.
    LEGACY.forEach(function(key){try{if(values[key]!==null&&storage.getItem(key)===values[key])storage.removeItem(key);}catch(e){}});
  }
  var api={open:open,readLegacy:readLegacy,removeArchivedCopies:removeArchivedCopies,legacyKeys:LEGACY};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.CollectionStore=api;
})(typeof window!=='undefined'?window:globalThis);
