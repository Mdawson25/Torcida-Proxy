const c=require('../lib/cloud');
async function reconcile(userId){
 if(!process.env.REVENUECAT_SECRET_KEY)throw c.problem(503,'BILLING_SETUP','Store subscriptions are not connected yet.');
 const r=await fetch('https://api.revenuecat.com/v1/subscribers/'+encodeURIComponent(userId),{headers:{Authorization:'Bearer '+process.env.REVENUECAT_SECRET_KEY},signal:AbortSignal.timeout(10000)});
 if(!r.ok)throw c.problem(503,'BILLING','Subscription verification is temporarily unavailable.');
 const data=await r.json(),e=data.subscriber?.entitlements?.premium;
 // Sandbox transactions must never grant production access unless explicitly running a test deployment.
 const tx=data.subscriber?.subscriptions?.[e?.product_identifier];
 const sandboxAllowed=process.env.ALLOW_SANDBOX_BILLING==='true'&&process.env.VERCEL_ENV!=='production';
 const valid=e&&e.expires_date&&tx&&['app_store','play_store'].includes(tx.store)&&(tx.is_sandbox===false||tx.is_sandbox===true&&sandboxAllowed);
 await c.supa('/rest/v1/profiles?id=eq.'+userId,{method:'PATCH',service:true,body:{premium_until:valid?e.expires_date:null,purchase_source:valid?(tx?.store||'store'):null,billing_checked_at:new Date().toISOString()}});
}
module.exports=async(req,res)=>{try{c.secure(req,res);const id=await c.identity(req,res);if(req.method==='POST')await reconcile(id.user.id);const profiles=await c.supa('/rest/v1/profiles?id=eq.'+id.user.id+'&select=*',{service:true});return res.json({user:c.safeProfile(profiles[0]),keys:{ios:process.env.REVENUECAT_APPLE_PUBLIC_KEY||null,android:process.env.REVENUECAT_GOOGLE_PUBLIC_KEY||null}});}catch(e){c.error(res,e);}};
module.exports.reconcile=reconcile;
