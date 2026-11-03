-- Run once in the Supabase SQL editor. No data is publicly readable or writable.
create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 email text not null, suspended boolean not null default false, migration_done boolean not null default false,
 premium_until timestamptz, complimentary_until timestamptz,
 purchase_source text, billing_checked_at timestamptz
);
create table if not exists public.collections (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 revision bigint not null default 1, data jsonb not null,
 cigar_count integer not null, humidor_count integer not null,
 updated_at timestamptz not null default now()
);
create table if not exists public.photos (
 user_id uuid references public.profiles(id) on delete cascade,
 hash text not null check(hash ~ '^[a-f0-9]{64}$'), data text not null check(octet_length(data)<=1100000),
 created_at timestamptz not null default now(), primary key(user_id,hash)
);
create table if not exists public.ai_usage (
 user_id uuid references public.profiles(id) on delete cascade,
 period text not null, used integer not null default 0, primary key(user_id,period)
);
create table if not exists public.ai_reports (
 id bigint generated always as identity primary key,
 user_id uuid references public.profiles(id) on delete cascade,
 reason text not null, result text not null, created_at timestamptz not null default now()
);
create table if not exists public.admin_audit (
 id bigint generated always as identity primary key,
 actor uuid references public.profiles(id) on delete cascade,
 target uuid references public.profiles(id) on delete cascade,
 action text not null, reason text not null, created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
alter table public.collections enable row level security;
alter table public.photos enable row level security;
alter table public.ai_usage enable row level security;
alter table public.ai_reports enable row level security;
alter table public.admin_audit enable row level security;
revoke all on public.profiles,public.collections,public.photos,public.ai_usage,public.ai_reports,public.admin_audit from anon,authenticated;
grant all on public.profiles,public.collections,public.photos,public.ai_usage,public.ai_reports,public.admin_audit to service_role;
grant usage,select on all sequences in schema public to service_role;

create or replace function public.ensure_profile(p_id uuid,p_email text) returns void
language sql security definer set search_path=public as $$
 insert into profiles(id,email) values(p_id,p_email) on conflict(id) do update set email=excluded.email;
$$;
create or replace function public.has_premium(p profiles) returns boolean
language sql stable set search_path=public as $$
 select coalesce(p.complimentary_until>now(),false) or
 (coalesce(p.premium_until>now(),false) and coalesce(p.billing_checked_at>now()-interval '1 hour',false));
$$;
create or replace function public.save_collection(p_user uuid,p_expected bigint,p_data jsonb,p_cigars integer,p_humidors integer,p_photos text[],p_migration boolean default false) returns jsonb
language plpgsql security definer set search_path=public as $$
declare p profiles; old collections; current_revision bigint; cigar_limit int; humidor_limit int; photo_count int;
begin
 select * into strict p from profiles where id=p_user for update;
 if p.suspended then raise exception 'SUSPENDED'; end if;
 select * into old from collections where user_id=p_user;
 current_revision:=old.revision;
 if current_revision is distinct from p_expected then raise exception 'REVISION_CONFLICT'; end if;
 cigar_limit:=case when has_premium(p) then 5000 else 25 end;
 humidor_limit:=case when has_premium(p) then 100 else 1 end;
 -- Imported legacy records and later downgrades remain readable and editable.
 -- The first migration may exceed Free. Later additions above its limit are blocked.
 if not(p_migration and not p.migration_done) and
 ((p_cigars>cigar_limit and p_cigars>coalesce(old.cigar_count,0)) or (p_humidors>humidor_limit and p_humidors>coalesce(old.humidor_count,0))) then raise exception 'PLAN_LIMIT'; end if;
 if p_cigars>5000 or p_humidors>100 or octet_length(p_data::text)>3000000 then raise exception 'PLAN_LIMIT'; end if;
 select count(*) into photo_count from photos where user_id=p_user and hash=any(p_photos);
 if photo_count<>coalesce(array_length(p_photos,1),0) then raise exception 'PHOTO_MISSING'; end if;
 insert into collections(user_id,revision,data,cigar_count,humidor_count) values(p_user,1,p_data,p_cigars,p_humidors)
 on conflict(user_id) do update set revision=collections.revision+1,data=excluded.data,cigar_count=excluded.cigar_count,humidor_count=excluded.humidor_count,updated_at=now()
 returning revision into current_revision;
 if p_migration then update profiles set migration_done=true where id=p_user; end if;
 -- Grace period retains a concurrently uploaded photo until a later cleanup.
 delete from photos where user_id=p_user and not(hash=any(p_photos)) and created_at<now()-interval '7 days';
 return jsonb_build_object('revision',current_revision,'data',p_data);
end $$;
create or replace function public.put_photo(p_user uuid,p_hash text,p_data text) returns void
language plpgsql security definer set search_path=public as $$
declare p profiles; total bigint; cap bigint;
begin
 select * into strict p from profiles where id=p_user for update;
 if p.suspended then raise exception 'SUSPENDED'; end if;
 if exists(select 1 from photos where user_id=p_user and hash=p_hash) then return; end if;
 cap:=case when has_premium(p) then 104857600 else 10485760 end;
 select coalesce(sum(octet_length(data)),0) into total from photos where user_id=p_user;
 if total+octet_length(p_data)>cap then raise exception 'PLAN_LIMIT'; end if;
 insert into photos(user_id,hash,data) values(p_user,p_hash,p_data);
end $$;
create or replace function public.consume_ai(p_user uuid) returns integer
language plpgsql security definer set search_path=public as $$
declare p profiles; period_name text; cap int; used_now int;
begin
 select * into strict p from profiles where id=p_user for update;
 if p.suspended then raise exception 'SUSPENDED'; end if;
 if has_premium(p) then period_name:=to_char(now() at time zone 'UTC','YYYY-MM');cap:=30; else period_name:='intro';cap:=3; end if;
 insert into ai_usage(user_id,period,used) values(p_user,period_name,0) on conflict do nothing;
 select used into used_now from ai_usage where user_id=p_user and period=period_name;
 if used_now>=cap then raise exception 'AI_LIMIT'; end if;
 update ai_usage set used=used+1 where user_id=p_user and period=period_name returning used into used_now;
 return used_now;
end $$;
create or replace function public.report_ai_result(p_user uuid,p_reason text,p_result text) returns void
language plpgsql security definer set search_path=public as $$
begin
 perform 1 from profiles where id=p_user for update;
 if (select count(*) from ai_reports where user_id=p_user and created_at>now()-interval '1 day')>=20 then raise exception 'PLAN_LIMIT'; end if;
 insert into ai_reports(user_id,reason,result) values(p_user,p_reason,p_result);
end $$;
create or replace function public.admin_account_action(p_actor uuid,p_target uuid,p_action text,p_until timestamptz,p_reason text) returns void
language plpgsql security definer set search_path=public as $$
begin
 perform 1 from profiles where id=p_target for update;
 if p_action='suspend' then update profiles set suspended=true where id=p_target;
 elsif p_action='restore' then update profiles set suspended=false where id=p_target;
 elsif p_action='grant' then update profiles set complimentary_until=p_until where id=p_target;
 elsif p_action='revoke-grant' then update profiles set complimentary_until=null where id=p_target;
 else raise exception 'INVALID_ACTION'; end if;
 insert into admin_audit(actor,target,action,reason) values(p_actor,p_target,p_action,p_reason);
end $$;
-- Postgres grants function execution to PUBLIC by default. Explicitly remove it.
revoke all on function public.ensure_profile(uuid,text),public.has_premium(profiles),public.save_collection(uuid,bigint,jsonb,integer,integer,text[],boolean),public.put_photo(uuid,text,text),public.consume_ai(uuid),public.report_ai_result(uuid,text,text),public.admin_account_action(uuid,uuid,text,timestamptz,text) from public,anon,authenticated;
grant execute on function public.ensure_profile(uuid,text),public.has_premium(profiles),public.save_collection(uuid,bigint,jsonb,integer,integer,text[],boolean),public.put_photo(uuid,text,text),public.consume_ai(uuid),public.report_ai_result(uuid,text,text),public.admin_account_action(uuid,uuid,text,timestamptz,text) to service_role;
