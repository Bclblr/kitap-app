begin;

-- Premium entitlements are server-managed. Keep direct client mutation blocked.
revoke all on table public.premium_entitlements from anon;
revoke insert, update, delete on table public.premium_entitlements from authenticated;

-- Paid RevenueCat rows must never be exposed through the webhook processor to clients.
revoke all on function public.process_revenuecat_premium_event(
  text, text, uuid, text, text, text, text,
  timestamptz, timestamptz, timestamptz
) from public, anon, authenticated;

grant execute on function public.process_revenuecat_premium_event(
  text, text, uuid, text, text, text, text,
  timestamptz, timestamptz, timestamptz
) to service_role;

-- Admin mutations stay callable by authenticated sessions, but the RPCs themselves
-- enforce admin/super_admin authorization before touching data.
revoke all on function public.admin_grant_premium(uuid, text, text) from public, anon;
grant execute on function public.admin_grant_premium(uuid, text, text) to authenticated;

revoke all on function public.admin_revoke_premium(uuid, text) from public, anon;
grant execute on function public.admin_revoke_premium(uuid, text) to authenticated;

-- Premium is the only entitlement represented by this table.
alter table public.premium_entitlements
  drop constraint if exists premium_entitlements_entitlement_id_check;

alter table public.premium_entitlements
  add constraint premium_entitlements_entitlement_id_check
  check (entitlement_id = 'premium');

-- Enforce a strict trust boundary between admin grants and paid store records.
alter table public.premium_entitlements
  drop constraint if exists premium_entitlements_source_boundary_check;

alter table public.premium_entitlements
  add constraint premium_entitlements_source_boundary_check
  check (
    (
      source = 'admin_grant'
      and source_reference = 'admin'
      and product_id is null
      and provider_event_at is null
      and provider_event_id is null
      and provider_event_type is null
      and will_renew is null
    )
    or
    (
      source in ('apple', 'google')
      and nullif(trim(coalesce(source_reference, '')), '') is not null
      and revoked_at is null
      and status <> 'revoked'
    )
  );

-- Identity and source ownership of an entitlement are immutable after creation.
create or replace function public.guard_premium_entitlement_identity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.user_id is distinct from old.user_id then
    raise exception 'Premium entitlement user_id is immutable'
      using errcode = '42501';
  end if;

  if new.source is distinct from old.source then
    raise exception 'Premium entitlement source is immutable'
      using errcode = '42501';
  end if;

  if coalesce(new.source_reference, '') is distinct from coalesce(old.source_reference, '') then
    raise exception 'Premium entitlement source_reference is immutable'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists premium_entitlements_guard_identity
on public.premium_entitlements;

create trigger premium_entitlements_guard_identity
before update on public.premium_entitlements
for each row
execute function public.guard_premium_entitlement_identity();

revoke all on function public.guard_premium_entitlement_identity() from public, anon, authenticated;

comment on constraint premium_entitlements_source_boundary_check
on public.premium_entitlements is
'Admin grants and paid Apple/Google entitlements are structurally isolated. Admin rows cannot carry provider data; paid rows cannot be revoked by admin-grant semantics.';

comment on function public.guard_premium_entitlement_identity() is
'Prevents changing the owner, source, or provider/admin reference of an existing Premium entitlement row.';

commit;
