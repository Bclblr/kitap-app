begin;

-- Audit history is append-only and must never be client-authored directly.
revoke all on table public.admin_audit_logs from anon;
revoke insert, update, delete on table public.admin_audit_logs from authenticated;
grant select on table public.admin_audit_logs to authenticated;

-- Admins can read the audit trail through RLS, but ordinary users cannot.
drop policy if exists admin_audit_read on public.admin_audit_logs;
create policy admin_audit_read
on public.admin_audit_logs
for select
to authenticated
using (public.has_admin_role(array['admin','super_admin']));

-- Remove the old direct-client insert path. Privileged SECURITY DEFINER RPCs
-- continue to write audit rows as part of the same transaction as the action.
drop policy if exists admin_audit_insert on public.admin_audit_logs;

create or replace function public.guard_admin_audit_immutability()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'Admin audit logs are append-only'
    using errcode = '42501';
end;
$$;

drop trigger if exists admin_audit_logs_immutable
on public.admin_audit_logs;

create trigger admin_audit_logs_immutable
before update or delete on public.admin_audit_logs
for each row
execute function public.guard_admin_audit_immutability();

revoke all
on function public.guard_admin_audit_immutability()
from public, anon, authenticated;

-- Audit viewer RPCs are authenticated-only; their internal role checks remain
-- authoritative for admin/super_admin access.
revoke all
on function public.admin_list_audit_logs(text,text,text,uuid,integer,integer)
from public, anon;

grant execute
on function public.admin_list_audit_logs(text,text,text,uuid,integer,integer)
to authenticated;

revoke all
on function public.admin_audit_filter_options()
from public, anon;

grant execute
on function public.admin_audit_filter_options()
to authenticated;

-- These indexes keep Premium/verification/role audit investigations fast.
create index if not exists admin_audit_logs_action_created_idx
on public.admin_audit_logs(action, created_at desc);

create index if not exists admin_audit_logs_target_created_idx
on public.admin_audit_logs(target_type, target_id, created_at desc);

comment on table public.admin_audit_logs is
'Append-only privileged action history. Application clients cannot insert, update or delete rows directly; privileged server-side RPCs write audit records transactionally.';

commit;
