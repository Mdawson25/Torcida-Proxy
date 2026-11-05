const fs=require('node:fs');
const fields=['APP_ORIGIN','SUPABASE_URL','SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY','REVENUECAT_SECRET_KEY','REVENUECAT_WEBHOOK_AUTH','REVENUECAT_APPLE_PUBLIC_KEY','REVENUECAT_GOOGLE_PUBLIC_KEY','SUPPORT_EMAIL','TORCIDA_ADMIN_IDS'];
const missing=fields.filter(k=>!process.env[k]);
const signoff=JSON.parse(fs.readFileSync('docs/release-signoff.json','utf8'));
const pending=Object.keys(signoff).filter(k=>signoff[k]!==true);
if(process.env.ALLOW_SANDBOX_BILLING==='true')pending.push('disable sandbox billing for production');
if(missing.length||pending.length){console.error('Release blocked. Missing configuration names: '+missing.join(', '));console.error('Pending evidence: '+pending.join(', '));process.exitCode=1;}else console.log('Recorded release gates complete. Store review is still required.');
