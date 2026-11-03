const {build}=require('esbuild');const fs=require('node:fs');
async function main(){
 const origin=new URL(process.env.MOBILE_API_ORIGIN||'https://torcida-proxy.vercel.app');
 if(origin.protocol!=='https:'||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash)throw new Error('MOBILE_API_ORIGIN must be an HTTPS origin.');
 await build({entryPoints:['mobile/src/native.js'],bundle:true,format:'iife',outfile:'assets/native.js',minify:true,target:'es2020',define:{__TORCIDA_API_ORIGIN__:JSON.stringify(origin.origin)}});
 fs.mkdirSync('mobile/www',{recursive:true});
 for(const name of ['index.html','privacy.html','terms.html','support.html','delete-account.html','admin.html'])fs.copyFileSync(name,'mobile/www/'+name);
 fs.cpSync('assets','mobile/www/assets',{recursive:true});
}
main().catch(e=>{console.error(e.message);process.exit(1);});
