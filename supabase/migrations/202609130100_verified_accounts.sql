begin;

-- Verified account status is intentionally independent from Premium.
-- Buying Premium must never create or change a verification record.
create table if not exists public.verified_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  is_verified boolean not null default false,
  verified_at timestamptz,
  verified_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete set null,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint verified_accounts_state_check check (
    (is_verified = true and verified_at is not null and revoked_at is null)
    or
    (is_verified = false)
  )
);

create index if not exists verified_accounts_active_idx
on public.verified_accounts (is_verified, updated_at desc);

create or replace function public.set_verified_accounts_updated_at()
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

drop trigger if exists verified_accounts_set_updated_at
on public.verified_accounts;

create trigger verified_accounts_set_updated_at
before update on public.verified_accounts
for each row
execute function public.set_verified_accounts_updated_at();

alter table public.verified_accounts enable row level security;

drop policy if exists verified_accounts_read_authenticated
on public.verified_accounts;

create policy verified_accounts_read_authenticated
on public.verified_accounts
for select
to authenticated
using (true);

-- Verification is server/admin controlled. Clients can only read status.
revoke all on table public.verified_accounts from anon;
revoke insert, update, delete on table public.verified_accounts from authenticated;
grant select on table public.verified_accounts to authenticated;

comment on table public.verified_accounts is
'Independent verified-account status. This is not a Premium entitlement and must never be derived from purchases.';

comment on column public.verified_accounts.is_verified is
'Whether the account currently has the platform verification badge.';

commit;
