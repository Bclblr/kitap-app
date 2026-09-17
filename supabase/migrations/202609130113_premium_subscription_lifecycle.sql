begin;

alter table public.premium_entitlements
  add column if not exists provider_event_type text,
  add column if not exists will_renew boolean;

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
  v_effective_status text;
  v_will_renew boolean;
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

  if p_provider_event_at is null then
    raise exception 'RevenueCat provider event time is required' using errcode = '22023';
  end if;

  if p_event_type not in (
    'INITIAL_PURCHASE',
    'RENEWAL',
    'PRODUCT_CHANGE',
    'CANCELLATION',
    'UNCANCELLATION',
    'BILLING_ISSUE',
    'EXPIRATION',
    'SUBSCRIPTION_PAUSED',
    'SUBSCRIPTION_EXTENDED'
  ) then
    raise exception 'Unsupported RevenueCat event type' using errcode = '22023';
  end if;

  v_effective_status := case
    when p_event_type = 'EXPIRATION' then 'expired'
    when p_event_type = 'SUBSCRIPTION_PAUSED' then 'inactive'
    when p_event_type = 'BILLING_ISSUE' then
      case
        when p_expires_at is not null and p_expires_at > p_provider_event_at
          then 'grace_period'
        else 'inactive'
      end
    when p_event_type = 'CANCELLATION' then
      case
        when p_expires_at is null then 'inactive'
        when p_expires_at <= p_provider_event_at then 'expired'
        when p_status = 'trialing' then 'trialing'
        else 'active'
      end
    when p_status = 'trialing' then 'trialing'
    else 'active'
  end;

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
  )
  values (
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

  select pe.*
  into v_existing
  from public.premium_entitlements pe
  where pe.user_id = p_user_id
    and pe.source = p_source
    and pe.source_reference = trim(p_source_reference)
  order by pe.created_at asc
  limit 1
  for update;

  v_will_renew := case
    when p_event_type in ('CANCELLATION', 'EXPIRATION', 'SUBSCRIPTION_PAUSED') then false
    when p_event_type in ('INITIAL_PURCHASE', 'RENEWAL', 'UNCANCELLATION') then true
    when found then v_existing.will_renew
    else null
  end;

  if found then
    if v_existing.provider_event_at is null
       or p_provider_event_at >= v_existing.provider_event_at then
      update public.premium_entitlements
      set
        status = v_effective_status,
        product_id = nullif(trim(coalesce(p_product_id, '')), ''),
        entitlement_id = 'premium',
        starts_at = least(v_existing.starts_at, v_started_at),
        expires_at = p_expires_at,
        revoked_at = null,
        provider_event_at = p_provider_event_at,
        provider_event_id = trim(p_event_id),
        provider_event_type = trim(p_event_type),
        will_renew = v_will_renew,
        updated_at = now()
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
      provider_event_id,
      provider_event_type,
      will_renew
    )
    values (
      p_user_id,
      p_source,
      v_effective_status,
      nullif(trim(coalesce(p_product_id, '')), ''),
      'premium',
      trim(p_source_reference),
      v_started_at,
      p_expires_at,
      null,
      p_provider_event_at,
      trim(p_event_id),
      trim(p_event_type),
      v_will_renew
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
  text, text, uuid, text, text, text, text,
  timestamptz, timestamptz, timestamptz
) from public, anon, authenticated;

grant execute on function public.process_revenuecat_premium_event(
  text, text, uuid, text, text, text, text,
  timestamptz, timestamptz, timestamptz
) to service_role;

comment on column public.premium_entitlements.provider_event_type is
'Latest accepted RevenueCat lifecycle event type for this paid entitlement.';

comment on column public.premium_entitlements.will_renew is
'Best-known auto-renew intent from RevenueCat lifecycle events. Cancellation, expiration and pause set false; purchase, renewal and uncancellation set true.';

comment on function public.process_revenuecat_premium_event(
  text, text, uuid, text, text, text, text,
  timestamptz, timestamptz, timestamptz
) is
'Service-role-only RevenueCat paid Premium sync. Cancellation preserves access until expiry, billing issues grant grace only while a future entitlement expiry exists, expiration ends access, and delayed events cannot overwrite newer provider state.';

commit;
