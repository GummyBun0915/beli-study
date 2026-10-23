-- Existing installations: derive the creator avatar from their name. No records deleted.
begin;
create or replace function public.beli_create_space(member_name text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); sid uuid; token text;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if exists(select 1 from public.beli_members where user_id=uid) then raise exception 'ALREADY_IN_SPACE'; end if;
  if length(trim(member_name)) not between 1 and 40 then raise exception 'INVALID_NAME'; end if;
  token := encode(extensions.gen_random_bytes(16),'hex');
  insert into public.beli_spaces(owner_id,invite_hash) values(uid,encode(extensions.digest(token,'sha256'),'hex')) returning id into sid;
  insert into public.beli_members(space_id,user_id,display_name,avatar_letter) values(sid,uid,trim(member_name),upper(left(trim(member_name),1)));
  return jsonb_build_object('id',sid,'invite',token);
end; $$;
update public.beli_members set avatar_letter=upper(left(trim(display_name),1)) where avatar_letter is distinct from upper(left(trim(display_name),1));
commit;
