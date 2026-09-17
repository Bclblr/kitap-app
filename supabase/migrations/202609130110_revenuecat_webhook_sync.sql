begin;

alter table public.premium_entitlements
  add column if not exists provider_event_at timestamptz,
  add column if not exists provider_event_id text;

create table if not exists public.revenuecat_webhook_events (
  event_id text primary key,
  event_type text not null,
  app_user_id uuid not null references auth.users(id) on delete cascade,
  source text not null check (source in ('apple', 'google')),
  product_id text,
  source_reference text not null,
  provider_event_at timestamptz not null,
  processed boolean not null default false,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

alter table public.revenuecat_webhook_events enable row level security;

revoke all on table public.revenuecat_webhook_events from public, anon, authenticated;
grant select, insert, update on table public.revenuecat_webhook_events to service_role;

create index if not exists revenuecat_webhook_events_user_idx
  on public.revenuecat_webhook_events (app_user_id, provider_event_at desc);

create or replace function public.process_revenuecat_premium_event(
  p_event_id text,
  p_event_type text,
  p_user_id uuid,
  p_source text,
  p_product_id text,
  p_source_reference text,
  p_status text,
  p_started_at timestamptz,
  p_expires_at timestamptz,
  p_provider_event_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted integer := 0;
  v_existing public.premium_entitlements;
  v_started_at timestamptz := coalesce(p_started_at, p_provider_event_at, now());
begin
  if coalesce(trim(p_event_id), '') = '' then
    raise exception 'RevenueCat event id is required' using errcode = '22023';
  end if;

  if coalesce(trim(p_event_type), '') = '' then
    raise exception 'RevenueCat event type is required' using errcode = '22023';
  end if;

  if p_user_id is null then
    raise exception 'RevenueCat user id is required' using errcode = '22023';
  end if;

  if p_source not in ('apple', 'google') then
    raise exception 'Invalid RevenueCat source' using errcode = '22023';
  end if;

  if coalesce(trim(p_source_reference), '') = '' then
    raise exception 'RevenueCat source reference is required' using errcode = '22023';
  end if;

  if p_status not in ('inactive', 'active', 'trialing', 'grace_period', 'expired') then
    raise exception 'Invalid paid Premium status' using errcode = '22023';
  end if;

  if p_provider_event_at is null then
    raise exception 'RevenueCat provider event time is required' using errcode = '22023';
  end if;

  if p_expires_at is not null and p_expires_at <= v_started_at then
    v_started_at := p_expires_at - interval '1 second';
  end if;

  insert into public.revenuecat_webhook_events (
    event_id,
    event_type,
    app_user_id,
    source,
    product_id,
    source_reference,
    provider_event_at
  ) values (
    trim(p_event_id),
    trim(p_event_type),
    p_user_id,
    p_source,
    nullif(trim(coalesce(p_product_id, '')), ''),
    trim(p_source_reference),
    p_provider_event_at
  )
  on conflict (event_id) do nothing;

  get diagnostics v_inserted = row_count;

  if v_inserted = 0 then
    return false;
  end if;

  select *
  into v_existing
  from public.premium_entitlements pe
  where pe.user_id = p_user_id
    and pe.source = p_source
    and pe.source_reference = trim(p_source_reference)
  order by pe.created_at asc
  limit 1
  for update;

  if found then
    if v_existing.provider_event_at is null
       or p_provider_event_at >= v_existing.provider_event_at then
      update public.premium_entitlements
      set
        status = p_status,
        product_id = nullif(trim(coalesce(p_product_id, '')), ''),
        entitlement_id = 'premium',
        starts_at = least(v_existing.starts_at, v_started_at),
        expires_at = p_expires_at,
        revoked_at = null,
        provider_event_at = p_provider_event_at,
        provider_event_id = trim(p_event_id)
      where id = v_existing.id;
    end if;
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
      revoked_at,
      provider_event_at,
      provider_event_id
    ) values (
      p_user_id,
      p_source,
      p_status,
      nullif(trim(coalesce(p_product_id, '')), ''),
      'premium',
      trim(p_source_reference),
      v_started_at,
      p_expires_at,
      null,
      p_provider_event_at,
      trim(p_event_id)
    );
  end if;

  update public.revenuecat_webhook_events
  set processed = true,
      processed_at = now()
  where event_id = trim(p_event_id);

  return true;
end;
$$;

revoke all on function public.process_revenuecat_premium_event(
  text,
  text,
  uuid,
  text,
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  timestamptz
) from public, anon, authenticated;

grant execute on function public.process_revenuecat_premium_event(
  text,
  text,
  uuid,
  text,
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  timestamptz
) to service_role;

comment on table public.revenuecat_webhook_events is
'Idempotency and audit metadata for authenticated RevenueCat webhook deliveries. No client role can read or write this table.';

comment on function public.process_revenuecat_premium_event(
  text,
  text,
  uuid,
  text,
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  timestamptz
) is
'Service-role-only RevenueCat paid Premium sync. Idempotent by event id and ignores older provider events so delayed webhooks cannot overwrite newer state.';

commit;
