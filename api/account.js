const c=require('../lib/cloud');
module.exports=async(req,res)=>{try{
 c.secure(req,res);
 if(req.method==='GET'){
  if(!c.configured())return res.json({configured:false,user:null});
  if(!c.cookie(req,'tc_access')&&!c.cookie(req,'tc_refresh'))return res.json({configured:true,user:null});
  const id=await c.identity(req,res,{allowSuspended:true});return res.json({configured:true,user:c.safeProfile(id.profile)});
 }
 // secure() already checked this origin against the app and deployment allowlist.
 const returnOrigin=req.headers.origin||c.origin();
 const b=req.body||{},action=b.action;
 if(['signup','login','recover'].includes(action)){
  if(typeof b.email!=='string'||b.email.length>254||!/^\S+@\S+\.\S+$/.test(b.email))throw c.problem(400,'EMAIL','Enter a valid email address.');
  if(action!=='recover'&&(typeof b.password!=='string'||b.password.length<12||b.password.length>128))throw c.problem(400,'PASSWORD','Use a password between 12 and 128 characters.');
  if(action==='recover'){await c.supa('/auth/v1/recover?redirect_to='+encodeURIComponent(returnOrigin+'/'),{method:'POST',body:{email:b.email}});return res.json({message:'If this email has an account, a reset link will arrive shortly.'});}
  if(action==='signup'){
   if(b.adult!==true)throw c.problem(400,'AGE','Confirm that you are at least 21 years old.');
   await c.supa('/auth/v1/signup?redirect_to='+encodeURIComponent(returnOrigin),{method:'POST',body:{email:b.email,password:b.password,data:{adult_confirmed_at:new Date().toISOString()}}});
   return res.json({message:'Check your email to verify your account, then sign in.'});
  }
  const session=await c.supa('/auth/v1/token?grant_type=password',{method:'POST',body:{email:b.email,password:b.password}});
  if(!session.user?.email_confirmed_at)throw c.problem(401,'VERIFY','Verify your email before signing in.');
  await c.ensureProfile(session.user);c.sessionCookies(res,session);return res.json({message:'Signed in.'});
 }
 if(action==='recovery-session'){
  if(typeof b.access_token!=='string'||typeof b.refresh_token!=='string'||b.access_token.length>8192||b.refresh_token.length>1024)throw c.problem(400,'RESET','This reset link is invalid.');
  const user=await c.supa('/auth/v1/user',{token:b.access_token});if(!user.email_confirmed_at)throw c.problem(401,'VERIFY','Verify your email.');
  c.sessionCookies(res,b);return res.json({message:'Enter a new password.'});
 }
 const id=await c.identity(req,res,{allowSuspended:true});
 if(action==='logout'){await c.supa('/auth/v1/logout',{method:'POST',token:id.token,body:{}});c.sessionCookies(res,null);return res.json({ok:true});}
 if(action==='password'){
  if(typeof b.password!=='string'||b.password.length<12||b.password.length>128)throw c.problem(400,'PASSWORD','Use a password between 12 and 128 characters.');
  await c.supa('/auth/v1/user',{method:'PUT',token:id.token,body:{password:b.password,...(b.nonce?{nonce:b.nonce}:{})}});return res.json({message:'Password changed.'});
 }
 if(action==='delete'){
  if(b.confirmation!=='DELETE')throw c.problem(400,'CONFIRM','Type DELETE to confirm account deletion.');
  // Reauthenticate immediately before destructive account deletion.
  await c.supa('/auth/v1/token?grant_type=password',{method:'POST',body:{email:id.user.email,password:b.password}});
  // Delete the linked processor record first. Failure is retryable; never claim deletion succeeded.
  if(process.env.REVENUECAT_SECRET_KEY){const r=await fetch('https://api.revenuecat.com/v1/subscribers/'+encodeURIComponent(id.user.id),{method:'DELETE',headers:{Authorization:'Bearer '+process.env.REVENUECAT_SECRET_KEY},signal:AbortSignal.timeout(10000)});if(!r.ok&&r.status!==404)throw c.problem(503,'DELETE_PROCESSOR','The billing record could not be removed. Please retry.');}
  await c.supa('/auth/v1/admin/users/'+encodeURIComponent(id.user.id),{method:'DELETE',service:true,body:{should_soft_delete:false}});
  c.sessionCookies(res,null);return res.json({deleted:true,userId:id.user.id,message:'Your account and cloud collection were deleted. Store subscriptions must be cancelled through Apple or Google.'});
 }
 if(action==='mfa-enroll')return res.json(await c.supa('/auth/v1/factors',{method:'POST',token:id.token,body:{factor_type:'totp',friendly_name:'Torcida administrator'}}));
 if(action==='mfa-factors')return res.json({factors:(id.user.factors||[]).map(f=>({id:f.id,status:f.status,factor_type:f.factor_type}))});
 if(action==='mfa-verify'){
  if(!/^[a-zA-Z0-9-]{1,100}$/.test(b.factorId)||!/^\d{6}$/.test(b.code))throw c.problem(400,'MFA','Enter the authenticator code.');
  const path='/auth/v1/factors/'+b.factorId,challenge=await c.supa(path+'/challenge',{method:'POST',token:id.token,body:{}});
  const session=await c.supa(path+'/verify',{method:'POST',token:id.token,body:{challenge_id:challenge.id,code:b.code}});c.sessionCookies(res,session);return res.json({ok:true});
 }
 throw c.problem(400,'ACTION','Choose a supported account action.');
}catch(e){c.error(res,e);}};
