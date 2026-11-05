-- Raise Free to five lifetime AI requests. Existing usage is preserved.
begin;
create or replace function public.consume_ai(p_user uuid) returns integer
language plpgsql security definer set search_path=public as $$
declare p profiles; period_name text; cap int; used_now int;
begin
 select * into strict p from profiles where id=p_user for update;
 if p.suspended then raise exception 'SUSPENDED'; end if;
 if has_premium(p) then period_name:=to_char(now() at time zone 'UTC','YYYY-MM');cap:=30; else period_name:='intro';cap:=5; end if;
 insert into ai_usage(user_id,period,used) values(p_user,period_name,0) on conflict do nothing;
 select used into used_now from ai_usage where user_id=p_user and period=period_name;
 if used_now>=cap then raise exception 'AI_LIMIT'; end if;
 update ai_usage set used=used+1 where user_id=p_user and period=period_name returning used into used_now;
 return used_now;
end $$;
revoke all on function public.consume_ai(uuid) from public,anon,authenticated;
grant execute on function public.consume_ai(uuid) to service_role;
commit;
