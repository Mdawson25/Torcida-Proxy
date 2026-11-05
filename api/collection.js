const c=require('../lib/cloud');
module.exports=async(req,res)=>{try{
 c.secure(req,res);const id=await c.identity(req,res);
 if(req.headers['x-torcida-owner']!==id.user.id)throw c.problem(409,'ACCOUNT_CHANGED','Reload your account before syncing.');
 if(req.method==='GET'){
  const rows=await c.supa('/rest/v1/collections?user_id=eq.'+id.user.id+'&select=revision,data',{service:true});return res.json({record:rows?.[0]||null,plan:c.plan(id.profile)});
 }
 const b=req.body||{};
 if(b.action==='photo'){
  const data=b.data;if(typeof data!=='string'||data.length>1100000||!/^data:image\/(jpeg|png|webp|gif);base64,[a-zA-Z0-9+/]+=*$/.test(data))throw c.problem(400,'PHOTO','Use a prepared photo smaller than 800 KB.');
  const hash=c.photoHash(data);await c.rpc('put_photo',{p_user:id.user.id,p_hash:hash,p_data:data});return res.json({ref:'tc-photo:'+hash});
 }
 if(b.action==='read-photo'){
  if(!/^[a-f0-9]{64}$/.test(b.hash||''))throw c.problem(400,'PHOTO','Invalid photo.');
  const rows=await c.supa('/rest/v1/photos?user_id=eq.'+id.user.id+'&hash=eq.'+b.hash+'&select=data',{service:true});if(!rows?.[0])throw c.problem(404,'PHOTO','This cloud photo is missing.');return res.json(rows[0]);
 }
 if(b.action!=='save'||Buffer.byteLength(JSON.stringify(b))>3000000)throw c.problem(400,'COLLECTION','Use a smaller collection request.');
 try{c.validateSnapshot(b.data);}catch{throw c.problem(400,'COLLECTION','The collection is invalid. Your cloud copy has not changed.');}
 // Cloud photo references only. Reject inline photos and require every reference to belong to the authenticated owner.
 const refs=[];function walk(v){if(!v||typeof v!=='object')return;for(const k of Object.keys(v)){if(k==='photos'){for(const p of v[k]){if(!/^tc-photo:[a-f0-9]{64}$/.test(p))throw c.problem(400,'PHOTO','Upload photos before saving.');refs.push(p.slice(9));}}else walk(v[k]);}}walk(b.data);
 const m=c.metrics(b.data);const record=await c.rpc('save_collection',{p_user:id.user.id,p_expected:b.revision??null,p_data:b.data,p_cigars:m.cigars,p_humidors:m.humidors,p_photos:[...new Set(refs)],p_migration:b.migrate===true});
 return res.json({record});
}catch(e){c.error(res,e);}};
