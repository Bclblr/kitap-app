begin;

-- Premium management screens need to inspect entitlement state for users,
-- while normal users must continue to see only their own rows.
drop policy if exists "admins_read_premium_entitlements"
on public.premium_entitlements;

create policy "admins_read_premium_entitlements"
on public.premium_entitlements
for select
to authenticated
using (public.has_admin_role(array['admin','super_admin']));

grant select
on table public.premium_entitlements
to authenticated;

commit;
