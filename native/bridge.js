import {Capacitor} from '@capacitor/core';
import {Camera} from '@capacitor/camera';
import {Filesystem,Directory} from '@capacitor/filesystem';
import {Share} from '@capacitor/share';
import {Browser} from '@capacitor/browser';
const isNative=Capacitor.isNativePlatform();
let sharing=false;
async function blobBase64(blob){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(Error('The file could not be prepared.'));reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.readAsDataURL(blob);});}
async function shareBlob(blob,name,title='Torcida file'){
 if(sharing)throw Error('Finish the current share before creating another.');
 sharing=true;
 try{
  const safe=String(name).replace(/[^a-zA-Z0-9._-]/g,'-').slice(0,100);
  const path='torcida-share/'+Date.now()+'-'+safe;
  const file=await Filesystem.writeFile({directory:Directory.Cache,path,data:await blobBase64(blob),recursive:true});
  await Share.share({title,files:[file.uri],dialogTitle:'Save or share with Files'});
  return true;
 }finally{sharing=false;}
}
async function openDocument(path){
 const response=await fetch(path);if(!response.ok)throw Error('This document could not be opened.');
 const text=await response.text();
 const page=new DOMParser().parseFromString(path.endsWith('.txt')?'<pre></pre>':text,'text/html');
 if(path.endsWith('.txt')){page.querySelector('pre').textContent=text;page.querySelector('pre').style.cssText='white-space:pre-wrap;overflow-wrap:anywhere;font:13px/1.6 monospace';}
 const home=page.querySelector('a[href="/"]');if(home)home.remove();
 let modal=document.getElementById('modal-native-document');
 if(!modal){modal=document.createElement('div');modal.id='modal-native-document';modal.className='modal-overlay';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-label','Torcida document');modal.innerHTML='<div class="modal-box"><button type="button" class="btn btn-ghost" aria-label="Close document">Close document</button><div class="native-document-content"></div></div>';modal.querySelector('button').onclick=()=>window.closeModal(modal.id);document.body.appendChild(modal);}
 const content=modal.querySelector('.native-document-content');content.replaceChildren(...Array.from(page.body.childNodes).map(node=>document.importNode(node,true)));
 if(!modal.classList.contains('show'))window.openModal(modal.id);
}
async function capture(source){
 try{
  const options={quality:85,targetWidth:1200,targetHeight:1200,correctOrientation:true,saveToGallery:false};
  const photo=source==='camera'?await Camera.takePhoto(options):(await Camera.chooseFromGallery({...options,allowMultipleSelection:false})).results[0];
  if(!photo||!photo.webPath)throw Error('No photo was returned.');
  const blob=await(await fetch(photo.webPath)).blob();
  await window.handleScan({files:[new File([blob],'cigar-scan.jpg',{type:blob.type||'image/jpeg'})],value:''});
 }catch(e){if(!/cancel/i.test(e.message||''))window.showToast(e.message||'Camera unavailable. Try selecting a photo.');}
}
window.TorcidaNative={isNative,apiUrl:'https://torcida-proxy.vercel.app/api/chat',shareBlob,capture};
if(isNative){
 document.addEventListener('DOMContentLoaded',()=>{
  document.querySelectorAll('button[onclick]').forEach(button=>{
   const action=button.getAttribute('onclick')||'';
   if(action.includes("'cam-input-camera'")){button.removeAttribute('onclick');button.onclick=()=>capture('camera');}
   if(action.includes("'cam-input-gallery'")){button.removeAttribute('onclick');button.onclick=()=>capture('photos');}
  });
  // File links are handed to the OS share sheet instead of a blob-only WebView download.
  document.addEventListener('click',async event=>{
   const link=event.target.closest('a');if(!link)return;
   const href=link.getAttribute('href')||'';
   if(['/privacy.html','/support.html','/assets/third-party-notices.txt'].includes(href)){event.preventDefault();event.stopImmediatePropagation();try{await openDocument(href);}catch(e){window.showToast(e.message);}return;}
   if(href.startsWith('blob:')&&link.download){
    event.preventDefault();event.stopImmediatePropagation();
    try{await shareBlob(await(await fetch(href)).blob(),link.download,'Torcida export');}catch(e){window.showToast(e.message||'The file could not be shared.');}
   }else if(/^https:\/\//.test(href)){
    event.preventDefault();try{await Browser.open({url:href});}catch(e){window.showToast('This link could not be opened.');}
   }
  },true);
  // Best-effort clean-up of temporary export copies older than one day, never collection files.
  Filesystem.readdir({directory:Directory.Cache,path:'torcida-share'}).then(async({files})=>{
   for(const file of files){const stamp=Number(file.name.split('-')[0]);if(stamp&&Date.now()-stamp>86400000)await Filesystem.deleteFile({directory:Directory.Cache,path:'torcida-share/'+file.name});}
  }).catch(()=>{});
 });
}
