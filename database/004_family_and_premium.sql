-- Run after 003_promo_codes.sql. Existing AI usage and subscriptions are preserved.
begin;
alter table public.profiles add column if not exists friends_family boolean not null default false;
create or replace function public.has_premium(p profiles) returns boolean
language sql stable set search_path=public as $$
 select p.friends_family or coalesce(p.complimentary_until>now(),false) or
 (coalesce(p.premium_until>now(),false) and coalesce(p.billing_checked_at>now()-interval '1 hour',false));
$$;
create or replace function public.consume_ai(p_user uuid) returns integer
language plpgsql security definer set search_path=public as $$
declare p profiles; period_name text; cap int; used_now int;
begin
 select * into strict p from profiles where id=p_user for update;
 if p.suspended then raise exception 'SUSPENDED'; end if;
 if p.friends_family then return 0; end if;
 if has_premium(p) then period_name:=to_char(now() at time zone 'UTC','YYYY-MM');cap:=50; else period_name:='intro';cap:=5; end if;
 insert into ai_usage(user_id,period,used) values(p_user,period_name,0) on conflict do nothing;
 select used into used_now from ai_usage where user_id=p_user and period=period_name;
 if used_now>=cap then
  if p.bonus_ai>0 then update profiles set bonus_ai=bonus_ai-1 where id=p_user; return used_now; end if;
  raise exception 'AI_LIMIT';
 end if;
 update ai_usage set used=used+1 where user_id=p_user and period=period_name returning used into used_now;
 return used_now;
end $$;
create or replace function public.admin_account_action(p_actor uuid,p_target uuid,p_action text,p_until timestamptz,p_reason text) returns void
language plpgsql security definer set search_path=public as $$
begin
 perform 1 from profiles where id=p_target for update;
 if p_action='grant-family' then update profiles set friends_family=true where id=p_target;
 elsif p_action='revoke-family' then update profiles set friends_family=false where id=p_target;
 elsif p_action='suspend' then update profiles set suspended=true where id=p_target;
 elsif p_action='restore' then update profiles set suspended=false where id=p_target;
 elsif p_action='grant' then update profiles set complimentary_until=p_until where id=p_target;
 elsif p_action='revoke-grant' then update profiles set complimentary_until=null where id=p_target;
 else raise exception 'INVALID_ACTION'; end if;
 insert into admin_audit(actor,target,action,reason) values(p_actor,p_target,p_action,p_reason);
end $$;
revoke all on function public.has_premium(profiles),public.consume_ai(uuid),public.admin_account_action(uuid,uuid,text,timestamptz,text) from public,anon,authenticated;
grant execute on function public.has_premium(profiles),public.consume_ai(uuid),public.admin_account_action(uuid,uuid,text,timestamptz,text) to service_role;
commit;
