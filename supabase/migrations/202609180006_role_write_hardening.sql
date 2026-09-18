begin;

-- Role changes are server-authoritative through admin_set_user_role().
-- Prevent authenticated clients, including super admins, from bypassing
-- the RPC's self-demotion and last-super-admin protections or its audit log.
drop policy if exists user_roles_manage_super_admin on public.user_roles;

revoke insert, update, delete
on table public.user_roles
from authenticated;

-- Keep role reads available according to RLS.
grant select on table public.user_roles to authenticated;

-- Ensure the existing privileged RPC remains the only authenticated write path.
revoke all
on function public.admin_set_user_role(uuid,text)
from public, anon;

grant execute
on function public.admin_set_user_role(uuid,text)
to authenticated;

comment on table public.user_roles is
'Application roles. Authenticated clients may read according to RLS but role mutations must go through admin_set_user_role().';

commit;
