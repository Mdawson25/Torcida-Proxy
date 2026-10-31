/* Offline shell only. Collection backups, API calls and access tokens are never cached. */
const CACHE='torcida-shell-atelier-v5';
const SHELL=['/','/assets/atelier.js','/assets/atelier.css','/assets/reliability.js','/assets/workflows.js','/assets/spirit-categories.jpg','/assets/data.js','/assets/collection.js','/assets/storage.js','/assets/ai-client.js','/assets/design.css','/assets/mobile.js','/assets/guide.js','/manifest.webmanifest','/assets/icon.svg','/assets/icon-192.png','/assets/icon-512.png','/assets/apple-touch-icon.png','/assets/icon-maskable.png'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('torcida-shell-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(url.origin!==self.location.origin)return;
  if(url.pathname.startsWith('/api/')){
    event.respondWith(fetch(request).catch(()=>new Response(JSON.stringify({error:{code:'OFFLINE',message:'You are offline. Your saved collection is still available; AI lookup needs an internet connection.'}}),{status:503,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}})));return;
  }
  // Never store share-link query strings or other authenticated transient URLs.
  if(url.search)return;
  if(request.mode==='navigate'){
    if(!['/','/index.html'].includes(url.pathname)){event.respondWith(fetch(request));return;}
    event.respondWith(fetch(request).then(response=>{
      if(response.ok&&!response.redirected){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put('/',copy)));}
      return response;
    }).catch(()=>caches.match('/')));return;
  }
  if(request.method==='GET'&&SHELL.includes(url.pathname))event.respondWith(fetch(request).then(response=>{if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(request,copy)));}return response;}).catch(()=>caches.match(request)));
});


