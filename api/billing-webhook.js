const c=require('../lib/cloud');const {reconcile}=require('./subscription');
module.exports=async(req,res)=>{try{
 res.setHeader('Cache-Control','no-store');if(req.method!=='POST')throw c.problem(405,'METHOD','Use POST.');
 if(!c.equalSecret(req.headers.authorization,process.env.REVENUECAT_WEBHOOK_AUTH))throw c.problem(401,'WEBHOOK','Unauthorized webhook.');
 const e=req.body?.event;if(!e||typeof e.id!=='string'||e.id.length>200)throw c.problem(400,'EVENT','Invalid event.');
 const ids=[e.app_user_id,e.original_app_user_id,...(e.transferred_from||[]),...(e.transferred_to||[])].filter(v=>typeof v==='string'&&/^[a-f0-9-]{36}$/.test(v));
 // Re-read current entitlements, so retries and out-of-order events cannot restore expired access.
 for(const userId of new Set(ids))await reconcile(userId);
 return res.json({ok:true});
}catch(e){c.error(res,e);}};
