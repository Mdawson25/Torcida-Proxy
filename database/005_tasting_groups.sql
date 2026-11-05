-- Run after migration 004. Private group data is accessible only through the server RPC.
begin;
alter table public.profiles add column if not exists group_join_at timestamptz;
alter table public.profiles add column if not exists group_join_attempts integer not null default 0;
create table if not exists public.tasting_groups(id uuid primary key default gen_random_uuid(),owner_id uuid not null references public.profiles(id) on delete cascade,name text not null check(length(name) between 1 and 100),invite_hash text not null unique);
create table if not exists public.tasting_members(group_id uuid references public.tasting_groups(id) on delete cascade,user_id uuid references public.profiles(id) on delete cascade,display_name text not null check(length(display_name) between 1 and 60),primary key(group_id,user_id));
create table if not exists public.tasting_sessions(id uuid primary key default gen_random_uuid(),group_id uuid not null references public.tasting_groups(id) on delete cascade,title text not null check(length(title) between 1 and 100),lineup text not null check(length(lineup) between 1 and 2000),revealed boolean not null default false,created_at timestamptz not null default now());
create table if not exists public.tasting_entries(session_id uuid references public.tasting_sessions(id) on delete cascade,user_id uuid references public.profiles(id) on delete cascade,rating integer not null check(rating between 1 and 5),notes text not null check(length(notes)<=2000),primary key(session_id,user_id));
alter table public.tasting_groups enable row level security;
alter table public.tasting_members enable row level security;
alter table public.tasting_sessions enable row level security;
alter table public.tasting_entries enable row level security;
revoke all on public.tasting_groups,public.tasting_members,public.tasting_sessions,public.tasting_entries from public,anon,authenticated;
grant select,insert,update,delete on public.tasting_groups,public.tasting_members,public.tasting_sessions,public.tasting_entries to service_role;
create or replace function public.tasting_group_action(p_user uuid,p_action text,p_group uuid default null,p_session uuid default null,p_data jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare p profiles; g tasting_groups; s tasting_sessions; state jsonb; chosen uuid;
begin
 select * into strict p from profiles where id=p_user for update;
 if p.suspended then raise exception 'SUSPENDED'; end if;
 if p_action='list' then
  return jsonb_build_object('groups',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'name',a.name) order by a.name) from tasting_groups a join tasting_members m on m.group_id=a.id where m.user_id=p_user),'[]'::jsonb));
 end if;
 if p_action in ('create','join') then
  if length(trim(coalesce(p_data->>'displayName',''))) not between 1 and 60 then raise exception 'GROUP_INPUT'; end if;
  if (select count(*) from tasting_members where user_id=p_user)>=20 then raise exception 'GROUP_LIMIT'; end if;
 end if;
 if p_action='create' then
  if length(trim(coalesce(p_data->>'name',''))) not between 1 and 100 or coalesce(p_data->>'hash','') !~ '^[a-f0-9]{64}$' then raise exception 'GROUP_INPUT'; end if;
  insert into tasting_groups(owner_id,name,invite_hash) values(p_user,trim(p_data->>'name'),p_data->>'hash') returning * into g;
  insert into tasting_members values(g.id,p_user,trim(p_data->>'displayName'));
 elsif p_action='join' then
  if p.group_join_at is null or p.group_join_at<now()-interval '1 minute' then update profiles set group_join_at=now(),group_join_attempts=1 where id=p_user;
  elsif p.group_join_attempts>=5 then return jsonb_build_object('error','Wait one minute before trying another invite.');
  else update profiles set group_join_attempts=group_join_attempts+1 where id=p_user; end if;
  select * into g from tasting_groups where invite_hash=p_data->>'hash' for update;
  if not found then return jsonb_build_object('error','This invite code is invalid.'); end if;
  if (select count(*) from tasting_members where group_id=g.id)>=50 then return jsonb_build_object('error','This group is full.'); end if;
  insert into tasting_members values(g.id,p_user,trim(p_data->>'displayName')) on conflict(group_id,user_id) do nothing;
 else
  select * into g from tasting_groups where id=p_group for update;
  if not found or not exists(select 1 from tasting_members where group_id=g.id and user_id=p_user) then raise exception 'GROUP_ACCESS'; end if;
 end if;
 if p_action in ('session','reveal','rotate','delete') and g.owner_id<>p_user then raise exception 'GROUP_ACCESS'; end if;
 if p_action='rotate' then
  if coalesce(p_data->>'hash','') !~ '^[a-f0-9]{64}$' then raise exception 'GROUP_INPUT'; end if;
  update tasting_groups set invite_hash=p_data->>'hash' where id=g.id;
 elsif p_action='delete' then delete from tasting_groups where id=g.id;return jsonb_build_object('deleted',true);
 elsif p_action='leave' then
  if g.owner_id=p_user then raise exception 'GROUP_HOST'; end if;
  delete from tasting_entries where user_id=p_user and session_id in(select id from tasting_sessions where group_id=g.id);
  delete from tasting_members where group_id=g.id and user_id=p_user;return jsonb_build_object('left',true);
 elsif p_action='session' then
  if length(trim(coalesce(p_data->>'title',''))) not between 1 and 100 or length(trim(coalesce(p_data->>'lineup',''))) not between 1 and 2000 then raise exception 'GROUP_INPUT'; end if;
  if (select count(*) from tasting_sessions where group_id=g.id)>=100 then raise exception 'GROUP_LIMIT'; end if;
  insert into tasting_sessions(group_id,title,lineup) values(g.id,trim(p_data->>'title'),trim(p_data->>'lineup'));
 elsif p_action in ('rate','reveal') then
  select * into s from tasting_sessions where id=p_session and group_id=g.id for update;
  if not found then raise exception 'GROUP_ACCESS'; end if;
  if p_action='reveal' then update tasting_sessions set revealed=true where id=s.id;
  else
   if s.revealed then raise exception 'GROUP_REVEALED'; end if;
   if coalesce(p_data->>'rating','') !~ '^[1-5]$' or length(coalesce(p_data->>'notes',''))>2000 then raise exception 'GROUP_INPUT'; end if;
   insert into tasting_entries values(s.id,p_user,(p_data->>'rating')::integer,coalesce(p_data->>'notes','')) on conflict(session_id,user_id) do update set rating=excluded.rating,notes=excluded.notes;
  end if;
 elsif p_action not in ('create','join','get','rotate','delete','leave') then raise exception 'GROUP_INPUT'; end if;
 select jsonb_build_object('id',g.id,'name',g.name,'isHost',g.owner_id=p_user,
  'members',coalesce((select jsonb_agg(jsonb_build_object('display_name',m.display_name) order by m.display_name) from tasting_members m where m.group_id=g.id),'[]'::jsonb),
  'sessions',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'title',a.title,'lineup',a.lineup,'revealed',a.revealed,
   'mine',(select jsonb_build_object('rating',e.rating,'notes',e.notes) from tasting_entries e where e.session_id=a.id and e.user_id=p_user),
   'entries',case when a.revealed then coalesce((select jsonb_agg(jsonb_build_object('display_name',m.display_name,'rating',e.rating,'notes',e.notes)) from tasting_entries e join tasting_members m on m.user_id=e.user_id and m.group_id=g.id where e.session_id=a.id),'[]'::jsonb) else '[]'::jsonb end) order by a.created_at desc) from tasting_sessions a where a.group_id=g.id),'[]'::jsonb)) into state;
 return jsonb_build_object('group',state);
end $$;
revoke all on function public.tasting_group_action(uuid,text,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.tasting_group_action(uuid,text,uuid,uuid,jsonb) to service_role;
commit;
