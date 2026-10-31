(function(root){
 'use strict';
 var key='tc_appearance',preference='system',media=root.matchMedia?root.matchMedia('(prefers-color-scheme: dark)'):null;
 function normalize(value){return ['light','dark','system'].includes(value)?value:'system';}
 function resolve(value,isDark){return normalize(value)==='system'?(isDark?'dark':'light'):normalize(value);}
 function apply(){var previous=document.documentElement.dataset.theme,dark=resolve(preference,media&&media.matches)==='dark';document.documentElement.dataset.theme=dark?'dark':'light';var meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.content=dark?'#191613':'#38251a';document.querySelectorAll('input[name="tc-appearance"]').forEach(function(input){input.checked=input.value===preference;});var status=document.getElementById('appearance-status');if(status)status.textContent=(dark?'After Hours':'Light')+' is active'+(preference==='system'?' · following your device.':'.');if(previous!==document.documentElement.dataset.theme)root.dispatchEvent(new Event('torcida:themechange'));}
 function choose(value){preference=normalize(value);try{root.localStorage.setItem(key,preference);}catch(e){}apply();}
 if(typeof module!=='undefined'&&module.exports){module.exports={normalize:normalize,resolve:resolve};return;}
 try{preference=normalize(root.localStorage.getItem(key));}catch(e){}
 apply();
 if(media){if(media.addEventListener)media.addEventListener('change',apply);else if(media.addListener)media.addListener(apply);}
 root.addEventListener('storage',function(e){if(e.key===key||e.key===null){preference=normalize(e.newValue);apply();}});
 document.addEventListener('DOMContentLoaded',function(){apply();document.querySelectorAll('input[name="tc-appearance"]').forEach(function(input){input.addEventListener('change',function(){if(this.checked)choose(this.value);});});});
})(typeof window!=='undefined'?window:globalThis);
