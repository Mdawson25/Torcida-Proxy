begin;
lock table public.promo_codes, public.promo_redemptions in share row exclusive mode;
do $$
declare
 offer record;
 old_code public.promo_codes%rowtype;
 new_hash text;
 matches integer;
begin
 for offer in select * from (values ('premium','TORCIDA30'),('lookups','EXTRA10AI')) as names(kind,code)
 loop
  new_hash := encode(sha256(convert_to(offer.code,'UTF8')),'hex');
  if exists(select 1 from public.promo_codes where code_hash=new_hash and kind=offer.kind) then
   continue;
  end if;
  select count(*) into matches from public.promo_codes where kind=offer.kind;
  if matches<>1 then
   raise exception 'Expected exactly one % code. No codes were changed. Contact support before retrying.',offer.kind;
  end if;
  select * into strict old_code from public.promo_codes where kind=offer.kind;
  insert into public.promo_codes(code_hash,kind,amount,expires_at,max_redemptions,redeemed,active)
  values(new_hash,old_code.kind,old_code.amount,old_code.expires_at,old_code.max_redemptions,old_code.redeemed,old_code.active);
  update public.promo_redemptions set code_hash=new_hash where code_hash=old_code.code_hash;
  delete from public.promo_codes where code_hash=old_code.code_hash;
 end loop;
end $$;
commit;
