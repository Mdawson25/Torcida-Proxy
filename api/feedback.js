const c=require('../lib/cloud');
module.exports=async(req,res)=>{try{
 c.secure(req,res,['POST']);const id=await c.identity(req,res),b=req.body||{};
 if(typeof b.reason!=='string'||b.reason.trim().length<5||b.reason.length>2000||typeof b.result!=='string'||b.result.length>15000)throw c.problem(400,'REPORT','Describe the problem in 5 to 2000 characters.');
 await c.rpc('report_ai_result',{p_user:id.user.id,p_reason:b.reason,p_result:b.result});return res.json({ok:true});
}catch(e){c.error(res,e);}};
