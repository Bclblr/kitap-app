begin;

create or replace function public.admin_revoke_premium(
  p_user_id uuid,
  p_reason text default null
)
returns public.premium_entitlements
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_id uuid := auth.uid();
  v_row public.premium_entitlements;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  if v_admin_id is null
     or not public.has_admin_role(array['admin','super_admin']) then
    raise exception 'Admin permission required'
      using errcode = '42501';
  end if;

  if p_user_id is null
     or not exists (
       select 1
       from auth.users u
       where u.id = p_user_id
     ) then
    raise exception 'Target user not found'
      using errcode = 'P0002';
  end if;

  select pe.*
  into v_row
  from public.premium_entitlements pe
  where pe.user_id = p_user_id
    and pe.source = 'admin_grant'
    and coalesce(pe.source_reference, '') = 'admin'
    and pe.status in ('active','trialing','grace_period')
    and (pe.expires_at is null or pe.expires_at > now())
  order by pe.created_at desc
  limit 1
  for update;

  if not found then
    raise exception 'Active admin Premium grant not found'
      using errcode = 'P0002';
  end if;

  update public.premium_entitlements
  set
    status = 'revoked',
    revoked_at = now(),
    updated_at = now()
  where id = v_row.id
  returning * into v_row;

  insert into public.admin_audit_logs (
    admin_id,
    action,
    target_type,
    target_id,
    reason,
    old_value,
    new_value,
    metadata
  )
  values (
    v_admin_id,
    'premium_admin_revoked',
    'user',
    p_user_id::text,
    v_reason,
    jsonb_build_object(
      'entitlement_id', v_row.id,
      'source', 'admin_grant',
      'status', 'active'
    ),
    jsonb_build_object(
      'entitlement_id', v_row.id,
      'source', v_row.source,
      'status', v_row.status,
      'revoked_at', v_row.revoked_at
    ),
    jsonb_build_object(
      'revoke_scope', 'admin_grant_only'
    )
  );

  return v_row;
end;
$$;

revoke all
on function public.admin_revoke_premium(uuid, text)
from public;

revoke all
on function public.admin_revoke_premium(uuid, text)
from anon;

grant execute
on function public.admin_revoke_premium(uuid, text)
to authenticated;

commit;
