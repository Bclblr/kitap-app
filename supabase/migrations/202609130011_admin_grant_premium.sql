begin;

create or replace function public.admin_grant_premium(
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
  if v_admin_id is null or not public.has_admin_role(array['admin','super_admin']) then
    raise exception 'Admin permission required'
      using errcode = '42501';
  end if;

  if p_user_id is null or not exists (
    select 1 from auth.users u where u.id = p_user_id
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
  order by pe.created_at desc
  limit 1
  for update;

  if found then
    update public.premium_entitlements
    set status = 'active',
        product_id = null,
        entitlement_id = 'premium',
        starts_at = now(),
        expires_at = null,
        revoked_at = null,
        updated_at = now()
    where id = v_row.id
    returning * into v_row;
  else
    insert into public.premium_entitlements (
      user_id,
      source,
      status,
      product_id,
      entitlement_id,
      source_reference,
      starts_at,
      expires_at,
      revoked_at
    )
    values (
      p_user_id,
      'admin_grant',
      'active',
      null,
      'premium',
      'admin',
      now(),
      null,
      null
    )
    returning * into v_row;
  end if;

  insert into public.admin_audit_logs (
    admin_id,
    action,
    target_type,
    target_id,
    reason,
    new_value,
    metadata
  )
  values (
    v_admin_id,
    'premium_admin_granted',
    'user',
    p_user_id::text,
    v_reason,
    jsonb_build_object(
      'entitlement_id', v_row.id,
      'source', v_row.source,
      'status', v_row.status,
      'expires_at', v_row.expires_at
    ),
    jsonb_build_object('grant_type', 'free_admin_grant')
  );

  return v_row;
end;
$$;

revoke all on function public.admin_grant_premium(uuid, text) from public;
revoke all on function public.admin_grant_premium(uuid, text) from anon;
grant execute on function public.admin_grant_premium(uuid, text) to authenticated;

comment on function public.admin_grant_premium(uuid, text) is
'Allows admin/super_admin users to grant free, indefinite Premium access. Paid Apple/Google entitlements are never modified.';

commit;
