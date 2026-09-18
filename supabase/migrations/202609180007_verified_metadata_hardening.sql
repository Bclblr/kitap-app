begin;

-- Public app code only needs to know whether an account is verified.
-- Keep row visibility broad for authenticated users, but restrict readable columns
-- so moderation metadata cannot be fetched directly from the table.
revoke select on table public.verified_accounts from authenticated;
grant select (user_id, is_verified)
on table public.verified_accounts
to authenticated;

-- Admin-only metadata reader. This keeps reason/audit actor/timestamps available
-- to privileged tooling without exposing them through ordinary table SELECTs.
create or replace function public.admin_list_verified_accounts()
returns table (
  user_id uuid,
  is_verified boolean,
  verified_at timestamptz,
  verified_by uuid,
  revoked_at timestamptz,
  revoked_by uuid,
  reason text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = ''
as $$
  select
    v.user_id,
    v.is_verified,
    v.verified_at,
    v.verified_by,
    v.revoked_at,
    v.revoked_by,
    v.reason,
    v.created_at,
    v.updated_at
  from public.verified_accounts v
  where public.has_admin_role(array['admin','super_admin'])
  order by v.updated_at desc;
$$;

revoke all
on function public.admin_list_verified_accounts()
from public, anon;

grant execute
on function public.admin_list_verified_accounts()
to authenticated;

comment on table public.verified_accounts is
'Verification state. Authenticated clients may directly read only user_id and is_verified; privileged metadata is exposed through admin-only RPCs.';

commit;
