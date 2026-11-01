import {cp,mkdir,rm} from 'node:fs/promises';
await rm('dist',{recursive:true,force:true});await mkdir('dist');
for(const path of ['index.html','assets','manifest.webmanifest','sw.js','privacy.html','support.html'])await cp(path,`dist/${path}`,{recursive:true});
console.log('Built web assets in dist/');
