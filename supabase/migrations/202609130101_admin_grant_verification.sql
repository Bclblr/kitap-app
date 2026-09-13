begin;

create or replace function public.admin_grant_verification(
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

  insert into public.verified_accounts (
    user_id,
    is_verified,
    verified_at,
    verified_by,
    revoked_at,
    revoked_by,
    reason
  )
  values (
    p_user_id,
    true,
    now(),
    v_admin_id,
    null,
    null,
    v_reason
  )
  on conflict (user_id) do update
  set
    is_verified = true,
    verified_at = now(),
    verified_by = v_admin_id,
    revoked_at = null,
    revoked_by = null,
    reason = v_reason,
    updated_at = now()
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
    'verification_granted',
    'user',
    p_user_id::text,
    v_reason,
    case
      when v_previous.user_id is null then null
      else jsonb_build_object(
        'is_verified', v_previous.is_verified,
        'verified_at', v_previous.verified_at,
        'verified_by', v_previous.verified_by,
        'revoked_at', v_previous.revoked_at,
        'revoked_by', v_previous.revoked_by
      )
    end,
    jsonb_build_object(
      'is_verified', v_row.is_verified,
      'verified_at', v_row.verified_at,
      'verified_by', v_row.verified_by
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
on function public.admin_grant_verification(uuid, text)
from public;

revoke all
on function public.admin_grant_verification(uuid, text)
from anon;

grant execute
on function public.admin_grant_verification(uuid, text)
to authenticated;

commit;
