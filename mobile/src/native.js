import {Capacitor,CapacitorHttp} from '@capacitor/core';
import {Camera,CameraResultType,CameraSource} from '@capacitor/camera';
import {Share} from '@capacitor/share';
import {Purchases} from '@revenuecat/purchases-capacitor';
import {Filesystem,Directory} from '@capacitor/filesystem';
import {Browser} from '@capacitor/browser';
const native=Capacitor.isNativePlatform();
const apiOrigin=__TORCIDA_API_ORIGIN__;
if(native){
 const browserFetch=window.fetch.bind(window);
 // Only Torcida API calls use the native HTTP transport and its private cookie jar.
 // Local collection assets remain bundled and load without a network connection.
 window.fetch=async function(input,options={}){
  const raw=typeof input==='string'?input:input.url;
  if(!raw.startsWith('/api/'))return browserFetch(input,options);
  const response=await CapacitorHttp.request({url:apiOrigin+raw,method:options.method||'GET',headers:{...options.headers,Origin:apiOrigin},data:options.body?JSON.parse(options.body):undefined,responseType:'json',connectTimeout:15000,readTimeout:18000});
  return new Response(JSON.stringify(response.data),{status:response.status,headers:response.headers});
 };
}
let configuredFor=null;
async function configure(id){
 if(!Capacitor.isNativePlatform())throw new Error('Use the iOS or Android app for store purchases.');
 if(configuredFor===id)return;
 const info=await window.TorcidaAccount.api('subscription');
 const apiKey=info.keys[Capacitor.getPlatform()];if(!apiKey)throw new Error('Store billing is still being connected.');
 if(configuredFor||(await Purchases.isConfigured()).isConfigured)await Purchases.logIn({appUserID:id});else await Purchases.configure({apiKey,appUserID:id});
 configuredFor=id;
}
async function purchase(id){
 await configure(id);
 const current=await window.TorcidaAccount.refreshPlan();if(current.plan.name==='premium')throw new Error('Premium is already active. Manage your current subscription through its original store.');
 const offerings=await Purchases.getOfferings(),packages=offerings.current?.availablePackages||[];
 if(!packages.length)throw new Error('No store plans are available yet.');
 const selected=await new Promise(resolve=>{
  const dialog=document.createElement('dialog');dialog.setAttribute('aria-label','Premium subscription plans');
  const title=document.createElement('h2');title.textContent='Torcida Premium';dialog.appendChild(title);
  const details=document.createElement('p');details.textContent='Premium includes up to 5,000 records, 100 humidors, 100 MB of photos and 50 monthly AI requests. Subscriptions renew automatically until cancelled through your store. Your store shows the final price and renewal terms before purchase.';dialog.appendChild(details);
  for(const pack of packages){const button=document.createElement('button');button.className='btn';button.textContent=pack.product.title+' • '+pack.product.priceString+' • '+(pack.packageType==='ANNUAL'?'yearly':pack.packageType==='MONTHLY'?'monthly':pack.packageType);button.onclick=()=>{dialog.close();dialog.remove();resolve(pack);};dialog.appendChild(button);}
  const legal=document.createElement('p');for(const [label,path] of [['Privacy','/privacy.html'],['Terms','/terms.html']]){const a=document.createElement('a');a.textContent=label+' ';a.href=path;legal.appendChild(a);}dialog.appendChild(legal);
  const cancel=document.createElement('button');cancel.className='btn';cancel.textContent='Cancel';cancel.onclick=()=>{dialog.close();dialog.remove();resolve(null);};dialog.appendChild(cancel);dialog.addEventListener('cancel',()=>{dialog.remove();resolve(null);},{once:true});document.body.appendChild(dialog);dialog.showModal();
 });
 if(selected)await Purchases.purchasePackage({aPackage:selected});
}
async function capture(){
 const photo=await Camera.getPhoto({resultType:CameraResultType.DataUrl,source:CameraSource.Prompt,quality:80,width:1200,correctOrientation:true,saveToGallery:false});
 const blob=await (await fetch(photo.dataUrl)).blob();const prepared=await window.TorcidaMobile.preparePhoto(blob,{maxDimension:1200,maxBytes:450000});
 await window.identifyCigarFromImage(prepared.base64);
}
async function shareBlob(blob,name,title='Torcida export'){
 const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=reject;reader.readAsDataURL(blob);});
 const safe=String(name).replace(/[^a-zA-Z0-9._-]/g,'-').slice(0,100);
 const file=await Filesystem.writeFile({directory:Directory.Cache,path:'torcida-share/'+Date.now()+'-'+safe,data,recursive:true});
 await Share.share({title,files:[file.uri]});
}
window.TorcidaNative={isNative:native,purchase,restore:async id=>{await configure(id);await Purchases.restorePurchases();},capture,shareBlob,share:options=>Share.share(options)};
if(native){
 const button=document.createElement('button');button.className='btn btn-full';button.textContent='Take or choose a photo';button.onclick=()=>capture().catch(e=>window.showToast(e.message||'Photo cancelled.'));
 document.getElementById('page-scanner')?.prepend(button);
 document.addEventListener('click',async event=>{
  const a=event.target.closest('a');if(!a)return;const href=a.getAttribute('href')||'';
  if(href.startsWith('blob:')&&a.download){event.preventDefault();event.stopImmediatePropagation();try{await shareBlob(await(await fetch(href)).blob(),a.download);}catch(e){window.showToast(e.message||'Sharing cancelled.');}}
  else if(/^https:\/\//.test(href)){event.preventDefault();await Browser.open({url:href}).catch(()=>window.showToast('Link could not be opened.'));}
 },true);
 // Temporary files are separate from collection storage and can be safely expired.
 Filesystem.readdir({directory:Directory.Cache,path:'torcida-share'}).then(async({files})=>{for(const file of files){const stamp=Number(file.name.split('-')[0]);if(stamp&&Date.now()-stamp>86400000)await Filesystem.deleteFile({directory:Directory.Cache,path:'torcida-share/'+file.name});}}).catch(()=>{});
}
