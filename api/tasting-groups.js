const c=require('../lib/cloud');const {randomBytes,createHash}=require('node:crypto');
module.exports=async(req,res)=>{try{
 c.secure(req,res,['POST']);const id=await c.identity(req,res),b=req.body||{};
 const actions=['create','join','list','get','session','rate','reveal','rotate','leave','delete'];if(!actions.includes(b.action))throw c.problem(400,'GROUP_INPUT','Choose a group action.');
 const uuid=v=>{if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v||''))throw c.problem(400,'GROUP_INPUT','Choose a valid group or session.');return v;};
 const text=(v,max)=>{if(typeof v!=='string'||!v.trim()||v.length>max||/<\/?[a-z][^>]*>/i.test(v))throw c.problem(400,'GROUP_INPUT','Enter valid group details.');return v.trim();};
 let invite=null,data={};if(['create','rotate'].includes(b.action)){invite=randomBytes(24).toString('hex').toUpperCase();data.hash=createHash('sha256').update(invite).digest('hex');}
 if(['create','join'].includes(b.action))data.displayName=text(b.displayName,60);
 if(b.action==='create')data.name=text(b.name,100);
 if(b.action==='join'){const value=text(b.invite,100).toUpperCase();if(!/^[A-F0-9]{48}$/.test(value))throw c.problem(400,'GROUP_INPUT','Enter the full invite code.');data.hash=createHash('sha256').update(value).digest('hex');}
 if(b.action==='session'){data.title=text(b.title,100);data.lineup=text(b.lineup,2000);}
 if(b.action==='rate'){if(!Number.isInteger(b.rating)||b.rating<1||b.rating>5)throw c.problem(400,'GROUP_INPUT','Rate this session from 1 to 5.');data.rating=b.rating;data.notes=b.notes===''?'':text(b.notes,2000);}
 const groupId=['create','join','list'].includes(b.action)?null:uuid(b.groupId),sessionId=['rate','reveal'].includes(b.action)?uuid(b.sessionId):null;
 const result=await c.rpc('tasting_group_action',{p_user:id.user.id,p_action:b.action,p_group:groupId,p_session:sessionId,p_data:data});
 if(result?.error)throw c.problem(400,'GROUP_INPUT',result.error);
 return res.json({...result,...(invite?{invite}:{})});
}catch(e){c.error(res,e);}};
