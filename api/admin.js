const c=require('../lib/cloud');
module.exports=async(req,res)=>{try{
 c.secure(req,res);const actor=await c.admin(req,res);
 if(req.method==='GET'){
  const account=String(req.query?.account||'');
  if(account){if(!/^[a-f0-9-]{36}$/.test(account))throw c.problem(400,'USER','Choose an account.');const [usage,reports,audit]=await Promise.all([
   c.supa('/rest/v1/ai_usage?user_id=eq.'+account+'&select=period,used',{service:true}),
   c.supa('/rest/v1/ai_reports?user_id=eq.'+account+'&select=id,reason,result,created_at&order=created_at.desc&limit=20',{service:true}),
   c.supa('/rest/v1/admin_audit?target=eq.'+account+'&select=actor,action,reason,created_at&order=created_at.desc&limit=20',{service:true})]);return res.json({usage,reports,audit});}
  const search=String(req.query?.email||'').trim();if(search&&!/^[a-zA-Z0-9@._+\-]{1,254}$/.test(search))throw c.problem(400,'SEARCH','Search by email.');
  const rows=await c.supa('/rest/v1/profiles?select=id,email,suspended,friends_family,premium_until,complimentary_until,purchase_source,billing_checked_at&limit=50&order=id'+(search?'&email=ilike.'+encodeURIComponent('*'+search+'*'):''),{service:true});return res.json({accounts:rows});
 }
 const b=req.body||{};if(!/^[a-f0-9-]{36}$/.test(b.userId||''))throw c.problem(400,'USER','Choose an account.');
 if(!['suspend','restore','grant','revoke-grant','grant-family','revoke-family'].includes(b.action))throw c.problem(400,'ACTION','Unsupported account action.');
 if(typeof b.reason!=='string'||b.reason.trim().length<5||b.reason.length>500)throw c.problem(400,'REASON','Record a support reason.');
 let until=null;if(b.action==='grant'){const days=Number(b.days);if(!Number.isInteger(days)||days<1||days>365)throw c.problem(400,'DAYS','Use 1 to 365 days.');until=new Date(Date.now()+days*86400000).toISOString();}
 await c.rpc('admin_account_action',{p_actor:actor.user.id,p_target:b.userId,p_action:b.action,p_until:until,p_reason:b.reason});return res.json({ok:true});
}catch(e){c.error(res,e);}};
