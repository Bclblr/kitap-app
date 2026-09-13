begin;

create or replace function public.admin_revoke_verification(
  p_user_id uuid,
  p_reason text default null
)
returns public.verified_accounts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_id uuid := auth.uid();
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
  v_previous public.verified_accounts;
  v_row public.verified_accounts;
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

  select va.*
  into v_previous
  from public.verified_accounts va
  where va.user_id = p_user_id
  for update;

  if not found or v_previous.is_verified is not true then
    raise exception 'Active verification not found'
      using errcode = 'P0002';
  end if;

  update public.verified_accounts
  set
    is_verified = false,
    revoked_at = now(),
    revoked_by = v_admin_id,
    reason = v_reason,
    updated_at = now()
  where user_id = p_user_id
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
    'verification_revoked',
    'user',
    p_user_id::text,
    v_reason,
    jsonb_build_object(
      'is_verified', v_previous.is_verified,
      'verified_at', v_previous.verified_at,
      'verified_by', v_previous.verified_by,
      'revoked_at', v_previous.revoked_at,
      'revoked_by', v_previous.revoked_by
    ),
    jsonb_build_object(
      'is_verified', v_row.is_verified,
      'verified_at', v_row.verified_at,
      'verified_by', v_row.verified_by,
      'revoked_at', v_row.revoked_at,
      'revoked_by', v_row.revoked_by
    ),
    jsonb_build_object(
      'source', 'admin_panel',
      'independent_from_premium', true
    )
  );

  return v_row;
end;
$$;

revoke all
on function public.admin_revoke_verification(uuid, text)
from public;

revoke all
on function public.admin_revoke_verification(uuid, text)
from anon;

grant execute
on function public.admin_revoke_verification(uuid, text)
to authenticated;

commit;
