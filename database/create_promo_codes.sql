-- Run once after 003_promo_codes.sql. Copy the two codes from the Results tab.
-- Each code expires in 90 days, allows 100 accounts, and can be used once per account.
with generated as materialized (
 select 'TORCIDA-'||upper(replace(gen_random_uuid()::text,'-','')) as code,'premium'::text as kind,30 as amount
 union all
 select 'TORCIDA-'||upper(replace(gen_random_uuid()::text,'-','')),'lookups',10
), saved as (
 insert into public.promo_codes(code_hash,kind,amount,expires_at,max_redemptions)
 select encode(sha256(convert_to(code,'UTF8')),'hex'),kind,amount,now()+interval '90 days',100 from generated
 returning code_hash
)
select g.kind,g.amount,g.code from generated g join saved s on s.code_hash=encode(sha256(convert_to(g.code,'UTF8')),'hex');
