-- Personal cloud journal: keep all existing records, restrict member access to the owner identity.
-- Reversible by restoring the original membership helper from setup.sql.
create or replace function public.beli_is_member(target_space uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.jwt()->>'email') = 'wxy@beli.example.com'
    and exists(select 1 from public.beli_members where space_id=target_space and user_id=(select auth.uid()));
$$;

revoke execute on function public.beli_create_space(text), public.beli_join_space(text,text), public.beli_rotate_invite(uuid) from authenticated;
