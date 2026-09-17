begin;

-- Role membership must only be changed through the audited super-admin RPC.
-- RLS remains enabled as defense in depth, but authenticated clients no longer
-- receive direct write privileges on the role table.
revoke insert, update, delete on table public.user_roles from authenticated;
revoke all on table public.user_roles from anon;
grant select on table public.user_roles to authenticated;

-- Keep role helper functions callable only by signed-in users.
revoke all on function public.current_app_role() from public, anon;
grant execute on function public.current_app_role() to authenticated;

revoke all on function public.has_admin_role(text[]) from public, anon;
grant execute on function public.has_admin_role(text[]) to authenticated;

-- Harden account-management RPC exposure.
revoke all on function public.admin_list_admin_accounts() from public, anon;
grant execute on function public.admin_list_admin_accounts() to authenticated;

revoke all on function public.admin_search_role_candidates(text, integer) from public, anon;
grant execute on function public.admin_search_role_candidates(text, integer) to authenticated;

revoke all on function public.admin_set_user_role(uuid, text) from public, anon;
grant execute on function public.admin_set_user_role(uuid, text) to authenticated;

-- Replace the role mutation RPC so concurrent changes cannot accidentally
-- remove the final super-admin account. All role mutations remain audited.
create or replace function public.admin_set_user_role(
  p_user_id uuid,
  p_role text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_old_role text;
  v_super_admin_count bigint;
begin
  if v_actor_id is null
     or not public.has_admin_role(array['super_admin']) then
    raise exception 'Super admin permission required'
      using errcode = '42501';
  end if;

  if p_user_id is null then
    raise exception 'User id is required'
      using errcode = '22023';
  end if;

  if p_role not in ('user','moderator','admin','super_admin') then
    raise exception 'Invalid role'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from auth.users u
    where u.id = p_user_id
  ) then
    raise exception 'User not found'
      using errcode = 'P0002';
  end if;

  -- Serialize privileged role changes so the last-super-admin guard cannot
  -- be defeated by two concurrent demotions.
  perform pg_advisory_xact_lock(hashtext('kitap-app:user_roles:super_admin'));

  select coalesce(ur.role, 'user')
  into v_old_role
  from (select p_user_id as user_id) target
  left join public.user_roles ur on ur.user_id = target.user_id;

  if p_user_id = v_actor_id
     and p_role is distinct from v_old_role then
    raise exception 'You cannot change your own role'
      using errcode = '42501';
  end if;

  if v_old_role = 'super_admin'
     and p_role <> 'super_admin' then
    select count(*)
    into v_super_admin_count
    from public.user_roles
    where role = 'super_admin';

    if v_super_admin_count <= 1 then
      raise exception 'At least one super admin must remain'
        using errcode = '23514';
    end if;
  end if;

  if p_role is not distinct from v_old_role then
    return;
  end if;

  insert into public.user_roles (
    user_id,
    role,
    updated_at,
    updated_by
  )
  values (
    p_user_id,
    p_role,
    now(),
    v_actor_id
  )
  on conflict (user_id) do update
  set
    role = excluded.role,
    updated_at = now(),
    updated_by = v_actor_id;

  insert into public.admin_audit_logs (
    admin_id,
    action,
    target_type,
    target_id,
    old_value,
    new_value,
    metadata
  )
  values (
    v_actor_id,
    'admin_role_changed',
    'user',
    p_user_id::text,
    jsonb_build_object('role', v_old_role),
    jsonb_build_object('role', p_role),
    jsonb_build_object(
      'authorization', 'super_admin_rpc',
      'direct_role_table_writes', false
    )
  );
end;
$$;

revoke all on function public.admin_set_user_role(uuid, text) from public, anon;
grant execute on function public.admin_set_user_role(uuid, text) to authenticated;

comment on function public.admin_set_user_role(uuid, text) is
'Super-admin-only audited role mutation. Direct authenticated writes to user_roles are revoked, self-role changes are blocked, and concurrent demotions cannot remove the final super admin.';

commit;
