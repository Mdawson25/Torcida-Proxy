const fs=require('node:fs');
fs.rmSync('public',{recursive:true,force:true});fs.mkdirSync('public');
for(const name of ['index.html','sw.js','manifest.webmanifest','privacy.html','terms.html','support.html','delete-account.html','admin.html'])fs.copyFileSync(name,'public/'+name);
fs.cpSync('assets','public/assets',{recursive:true});
