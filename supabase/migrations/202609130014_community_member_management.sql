begin;

create or replace function public.set_community_member_role(
  p_community_id uuid,
  p_user_id uuid,
  p_role text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid;
  v_target_role text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_role not in ('member', 'admin') then
    raise exception 'Invalid community role';
  end if;

  if not public.community_admin(p_community_id) then
    raise exception 'Community admin permission required';
  end if;

  select c.created_by
    into v_owner_id
  from public.communities c
  where c.id = p_community_id;

  if v_owner_id is null then
    raise exception 'Community not found';
  end if;

  if p_user_id = v_owner_id then
    raise exception 'Community owner role cannot change';
  end if;

  select m.role
    into v_target_role
  from public.community_members m
  where m.community_id = p_community_id
    and m.user_id = p_user_id;

  if v_target_role is null then
    raise exception 'Community member not found';
  end if;

  update public.community_members
  set role = p_role
  where community_id = p_community_id
    and user_id = p_user_id;
end;
$$;

create or replace function public.remove_community_member(
  p_community_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.community_admin(p_community_id) then
    raise exception 'Community admin permission required';
  end if;

  select c.created_by
    into v_owner_id
  from public.communities c
  where c.id = p_community_id;

  if v_owner_id is null then
    raise exception 'Community not found';
  end if;

  if p_user_id = v_owner_id then
    raise exception 'Community owner cannot be removed';
  end if;

  delete from public.community_members
  where community_id = p_community_id
    and user_id = p_user_id;
end;
$$;

revoke all on function public.set_community_member_role(uuid, uuid, text) from public;
revoke all on function public.remove_community_member(uuid, uuid) from public;
grant execute on function public.set_community_member_role(uuid, uuid, text) to authenticated;
grant execute on function public.remove_community_member(uuid, uuid) to authenticated;

commit;
