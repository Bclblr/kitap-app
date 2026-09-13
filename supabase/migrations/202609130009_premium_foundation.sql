begin;

create table if not exists public.premium_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null check (source in ('apple', 'google', 'admin_grant')),
  status text not null default 'active' check (
    status in ('inactive', 'active', 'trialing', 'grace_period', 'expired', 'revoked')
  ),
  product_id text,
  entitlement_id text not null default 'premium',
  source_reference text,
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint premium_entitlements_dates_check check (
    expires_at is null or expires_at > starts_at
  ),
  constraint premium_entitlements_revoked_check check (
    status <> 'revoked' or revoked_at is not null
  )
);

create unique index if not exists premium_entitlements_source_unique
on public.premium_entitlements (
  user_id,
  source,
  coalesce(source_reference, '')
);

create index if not exists premium_entitlements_user_status_idx
on public.premium_entitlements (user_id, status, expires_at);

create or replace function public.set_premium_entitlements_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists premium_entitlements_set_updated_at
on public.premium_entitlements;

create trigger premium_entitlements_set_updated_at
before update on public.premium_entitlements
for each row
execute function public.set_premium_entitlements_updated_at();

alter table public.premium_entitlements enable row level security;

drop policy if exists "users_read_own_premium_entitlements"
on public.premium_entitlements;

create policy "users_read_own_premium_entitlements"
on public.premium_entitlements
for select
to authenticated
using (auth.uid() = user_id);

revoke all on table public.premium_entitlements from anon;
revoke insert, update, delete on table public.premium_entitlements from authenticated;
grant select on table public.premium_entitlements to authenticated;

comment on table public.premium_entitlements is
'Premium access records. Multiple rows per user allow paid and admin-granted access to coexist safely.';

comment on column public.premium_entitlements.source is
'Origin of premium access: Apple purchase, Google Play purchase, or an admin grant.';

comment on column public.premium_entitlements.source_reference is
'Provider transaction/subscription identifier or an admin-grant identifier. Never trust values supplied directly by the client.';

commit;
