-- Run once in a new Supabase project's SQL Editor. No service key is used by the app.
begin;
create extension if not exists pgcrypto with schema extensions;
create table if not exists public.beli_spaces (
  id uuid primary key default gen_random_uuid(), name text not null default 'Our dining list',
  owner_id uuid not null references auth.users(id) on delete cascade,
  invite_hash text not null unique, created_at timestamptz not null default now()
);
create table if not exists public.beli_members (
  space_id uuid not null references public.beli_spaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (length(display_name) between 1 and 40),
  avatar_letter text not null default 'W', avatar_color text not null default '#286ad7',
  primary key (space_id,user_id), unique(user_id)
);
create table if not exists public.beli_states (
  space_id uuid not null references public.beli_spaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null, revision bigint not null default 1,
  updated_at timestamptz not null default now(), primary key(space_id,user_id)
);
create table if not exists public.beli_wants (
  space_id uuid not null references public.beli_spaces(id) on delete cascade,
  restaurant_id text not null check (length(restaurant_id) < 100),
  added_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
  primary key(space_id,restaurant_id)
);
create or replace function public.beli_is_member(target_space uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.beli_members where space_id = target_space and user_id = (select auth.uid()));
$$;
alter table public.beli_spaces enable row level security;
alter table public.beli_members enable row level security;
alter table public.beli_states enable row level security;
alter table public.beli_wants enable row level security;
drop policy if exists member_read on public.beli_spaces;
create policy member_read on public.beli_spaces for select to authenticated using(public.beli_is_member(id));
drop policy if exists member_read on public.beli_members;
create policy member_read on public.beli_members for select to authenticated using(public.beli_is_member(space_id));
drop policy if exists member_read on public.beli_states;
create policy member_read on public.beli_states for select to authenticated using(public.beli_is_member(space_id));
drop policy if exists member_read on public.beli_wants;
create policy member_read on public.beli_wants for select to authenticated using(public.beli_is_member(space_id));
drop policy if exists member_add on public.beli_wants;
create policy member_add on public.beli_wants for insert to authenticated with check(public.beli_is_member(space_id) and added_by=(select auth.uid()));
drop policy if exists member_delete on public.beli_wants;
create policy member_delete on public.beli_wants for delete to authenticated using(public.beli_is_member(space_id));
revoke all on public.beli_spaces,public.beli_members,public.beli_states,public.beli_wants from anon,authenticated;
grant select on public.beli_spaces,public.beli_members,public.beli_states,public.beli_wants to authenticated;
grant insert,delete on public.beli_wants to authenticated;

create or replace function public.beli_create_space(member_name text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); sid uuid; token text;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if exists(select 1 from public.beli_members where user_id=uid) then raise exception 'ALREADY_IN_SPACE'; end if;
  if length(trim(member_name)) not between 1 and 40 then raise exception 'INVALID_NAME'; end if;
  token := encode(extensions.gen_random_bytes(16),'hex');
  insert into public.beli_spaces(owner_id,invite_hash) values(uid,encode(extensions.digest(token,'sha256'),'hex')) returning id into sid;
  insert into public.beli_members(space_id,user_id,display_name) values(sid,uid,trim(member_name));
  return jsonb_build_object('id',sid,'invite',token);
end; $$;
create or replace function public.beli_join_space(invite_token text,member_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); sid uuid;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if length(trim(member_name)) not between 1 and 40 then raise exception 'INVALID_NAME'; end if;
  select id into sid from public.beli_spaces where invite_hash=encode(extensions.digest(invite_token,'sha256'),'hex') for update;
  if sid is null then raise exception 'INVALID_INVITE'; end if;
  if exists(select 1 from public.beli_members where space_id=sid and user_id=uid) then return sid; end if;
  if exists(select 1 from public.beli_members where user_id=uid) then raise exception 'ALREADY_IN_SPACE'; end if;
  if (select count(*) from public.beli_members where space_id=sid)>=2 then raise exception 'SPACE_FULL'; end if;
  insert into public.beli_members(space_id,user_id,display_name,avatar_letter,avatar_color) values(sid,uid,trim(member_name),upper(left(trim(member_name),1)),'#718d7c');
  return sid;
end; $$;
create or replace function public.beli_rotate_invite(target_space uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare token text;
begin
  if not exists(select 1 from public.beli_spaces where id=target_space and owner_id=auth.uid()) then raise exception 'OWNER_REQUIRED'; end if;
  token:=encode(extensions.gen_random_bytes(16),'hex');
  update public.beli_spaces set invite_hash=encode(extensions.digest(token,'sha256'),'hex') where id=target_space;
  return token;
end; $$;
create or replace function public.beli_save_state(target_space uuid,state_payload jsonb,expected_revision bigint)
returns bigint language plpgsql security definer set search_path = '' as $$
declare uid uuid:=auth.uid(); current_revision bigint;
begin
  if uid is null or not public.beli_is_member(target_space) then raise exception 'MEMBER_REQUIRED'; end if;
  if jsonb_typeof(state_payload) is distinct from 'object' or state_payload->>'version' is distinct from '2' or octet_length(state_payload::text)>5242880 then raise exception 'INVALID_STATE'; end if;
  -- Lock membership so first writes also serialize when no state row exists yet.
  perform 1 from public.beli_members where space_id=target_space and user_id=uid for update;
  select revision into current_revision from public.beli_states where space_id=target_space and user_id=uid for update;
  if coalesce(current_revision,0)<>expected_revision then raise exception 'SYNC_CONFLICT'; end if;
  insert into public.beli_states(space_id,user_id,payload,revision) values(target_space,uid,state_payload,1)
  on conflict(space_id,user_id) do update set payload=excluded.payload,revision=public.beli_states.revision+1,updated_at=now()
  returning revision into current_revision;
  return current_revision;
end; $$;
revoke all on function public.beli_is_member(uuid),public.beli_create_space(text),public.beli_join_space(text,text),public.beli_rotate_invite(uuid),public.beli_save_state(uuid,jsonb,bigint) from public,anon;
grant execute on function public.beli_is_member(uuid),public.beli_create_space(text),public.beli_join_space(text,text),public.beli_rotate_invite(uuid),public.beli_save_state(uuid,jsonb,bigint) to authenticated;

insert into storage.buckets(id,name,public) values('beli-photos','beli-photos',false) on conflict(id) do nothing;
drop policy if exists beli_photo_read on storage.objects;
create policy beli_photo_read on storage.objects for select to authenticated using(bucket_id='beli-photos' and split_part(name,'/',1) in (select space_id::text from public.beli_members where user_id=(select auth.uid())));
drop policy if exists beli_photo_add on storage.objects;
create policy beli_photo_add on storage.objects for insert to authenticated with check(bucket_id='beli-photos' and split_part(name,'/',2)=(select auth.uid())::text and split_part(name,'/',1) in (select space_id::text from public.beli_members where user_id=(select auth.uid())));
-- Photos are immutable per random ID; users can remove their own uploaded objects.
drop policy if exists beli_photo_delete on storage.objects;
create policy beli_photo_delete on storage.objects for delete to authenticated using(bucket_id='beli-photos' and split_part(name,'/',2)=(select auth.uid())::text);

do $$ begin alter publication supabase_realtime add table public.beli_states; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.beli_members; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.beli_wants; exception when duplicate_object then null; end $$;
create or replace function public.beli_update_name(member_name text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or length(trim(member_name)) not between 1 and 40 then raise exception 'INVALID_NAME'; end if;
  update public.beli_members set display_name=trim(member_name) where user_id=auth.uid();
end; $$;
revoke all on function public.beli_update_name(text) from public,anon;
grant execute on function public.beli_update_name(text) to authenticated;
commit;
