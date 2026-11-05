const c=require('../lib/cloud');
const {createHash}=require('node:crypto');
module.exports=async(req,res)=>{try{
 c.secure(req,res,['POST']);const id=await c.identity(req,res);
 const code=typeof req.body?.code==='string'?req.body.code.trim().toUpperCase():'';
 if(!/^[A-Z0-9-]{8,80}$/.test(code))throw c.problem(400,'PROMO','Enter a valid promo code.');
 const result=await c.rpc('redeem_promo',{p_user:id.user.id,p_hash:createHash('sha256').update(code).digest('hex')});
 if(!result?.ok)throw c.problem(400,'PROMO',result?.message||'This promo code could not be redeemed.');
 const profiles=await c.supa('/rest/v1/profiles?id=eq.'+encodeURIComponent(id.user.id)+'&select=*',{service:true});
 return res.json({message:result.message,user:c.safeProfile(profiles[0])});
}catch(e){c.error(res,e);}};
