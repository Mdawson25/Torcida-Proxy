import {cp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {build} from 'esbuild';
await rm('native-dist',{recursive:true,force:true});await mkdir('native-dist');
for(const path of ['assets','manifest.webmanifest','privacy.html','support.html'])await cp(path,`native-dist/${path}`,{recursive:true});
let html=await readFile('index.html','utf8');
// This is the same feature set for every iOS beta user, including reviewers.
html=html.replace(/<!-- LONG ASH CHALLENGE -->[\s\S]*?<\/details>/,'');
html=html.replace(/@import url\('https:\/\/fonts.googleapis.com[^\n]+\n/,'');
html=html.replace('<head>','<head>\n<script src="/assets/native.js"></script>');
html=html.replace('Add Torcida to your home screen','Using the iPhone beta').replace(/<p>On iPhone or iPad,[\s\S]*?<\/p>/,'<p>The app interface is bundled on this device. AI features need internet access. Safari collections transfer by backup and restore.</p>');
await writeFile('native-dist/index.html',html);
await build({entryPoints:['native/bridge.js'],bundle:true,format:'iife',target:'safari15',outfile:'native-dist/assets/native.js',minify:true,legalComments:'eof'});
console.log('Bundled iOS assets. No remote app URL, external fonts or Long Ash Challenge UI.');
