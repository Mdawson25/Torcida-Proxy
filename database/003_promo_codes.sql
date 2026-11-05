-- Run after 001_accounts.sql and 002_free_ai_allowance.sql. Preserves existing usage.
begin;
alter table public.profiles add column if not exists bonus_ai integer not null default 0 check (bonus_ai>=0);
alter table public.profiles add column if not exists promo_attempt_at timestamptz;
alter table public.profiles add column if not exists promo_attempts integer not null default 0;
create table if not exists public.promo_codes (
 code_hash text primary key check(code_hash ~ '^[a-f0-9]{64}$'),
 kind text not null check(kind in ('premium','lookups')),
 amount integer not null check((kind='premium' and amount=30) or (kind='lookups' and amount=10)),
 expires_at timestamptz not null, max_redemptions integer not null check(max_redemptions>0),
 redeemed integer not null default 0, active boolean not null default true
);
create table if not exists public.promo_redemptions (
 user_id uuid references public.profiles(id) on delete cascade,
 code_hash text references public.promo_codes(code_hash), created_at timestamptz not null default now(),
 primary key(user_id,code_hash)
);
alter table public.promo_codes enable row level security;
alter table public.promo_redemptions enable row level security;
revoke all on public.promo_codes,public.promo_redemptions from public,anon,authenticated;
grant select,insert,update,delete on public.promo_codes,public.promo_redemptions to service_role;
create or replace function public.redeem_promo(p_user uuid,p_hash text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare p profiles; promo promo_codes;
begin
 select * into strict p from profiles where id=p_user for update;
 if p.suspended then raise exception 'SUSPENDED'; end if;
 if p.promo_attempt_at is null or p.promo_attempt_at<now()-interval '1 minute' then
  update profiles set promo_attempt_at=now(),promo_attempts=1 where id=p_user;
 elsif p.promo_attempts>=5 then return jsonb_build_object('ok',false,'message','Too many promo attempts. Wait one minute.');
 else update profiles set promo_attempts=promo_attempts+1 where id=p_user; end if;
 select * into promo from promo_codes where code_hash=p_hash for update;
 if not found or not promo.active or promo.expires_at<=now() or promo.redeemed>=promo.max_redemptions then
  return jsonb_build_object('ok',false,'message','This promo code is invalid, expired, or fully redeemed.');
 end if;
 if exists(select 1 from promo_redemptions where user_id=p_user and code_hash=p_hash) then
  return jsonb_build_object('ok',false,'message','You have already used this promo code.');
 end if;
 insert into promo_redemptions(user_id,code_hash) values(p_user,p_hash);
 update promo_codes set redeemed=redeemed+1 where code_hash=p_hash;
 if promo.kind='premium' then
  update profiles set complimentary_until=greatest(coalesce(complimentary_until,now()),now())+interval '30 days' where id=p_user;
 else update profiles set bonus_ai=bonus_ai+10 where id=p_user; end if;
 return jsonb_build_object('ok',true,'message',case when promo.kind='premium' then '30 days of complimentary Premium added. This does not change store billing.' else '10 extra AI lookups added. They do not expire.' end);
end $$;
create or replace function public.consume_ai(p_user uuid) returns integer
language plpgsql security definer set search_path=public as $$
declare p profiles; period_name text; cap int; used_now int;
begin
 select * into strict p from profiles where id=p_user for update;
 if p.suspended then raise exception 'SUSPENDED'; end if;
 if has_premium(p) then period_name:=to_char(now() at time zone 'UTC','YYYY-MM');cap:=30; else period_name:='intro';cap:=5; end if;
 insert into ai_usage(user_id,period,used) values(p_user,period_name,0) on conflict do nothing;
 select used into used_now from ai_usage where user_id=p_user and period=period_name;
 if used_now>=cap then
  if p.bonus_ai>0 then update profiles set bonus_ai=bonus_ai-1 where id=p_user; return used_now; end if;
  raise exception 'AI_LIMIT';
 end if;
 update ai_usage set used=used+1 where user_id=p_user and period=period_name returning used into used_now;
 return used_now;
end $$;
revoke all on function public.redeem_promo(uuid,text),public.consume_ai(uuid) from public,anon,authenticated;
grant execute on function public.redeem_promo(uuid,text),public.consume_ai(uuid) to service_role;
commit;
