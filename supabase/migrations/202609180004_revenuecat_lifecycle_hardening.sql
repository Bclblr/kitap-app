begin;

alter table public.premium_entitlements
  add column if not exists provider_environment text;

alter table public.premium_entitlements
  drop constraint if exists premium_entitlements_provider_environment_check;

alter table public.premium_entitlements
  add constraint premium_entitlements_provider_environment_check
  check (provider_environment is null or provider_environment in ('SANDBOX','PRODUCTION'));

alter table public.revenuecat_webhook_events
  alter column app_user_id drop not null,
  alter column source drop not null,
  alter column source_reference drop not null;

alter table public.revenuecat_webhook_events
  add column if not exists environment text,
  add column if not exists cancel_reason text,
  add column if not exists expiration_reason text,
  add column if not exists transferred_from uuid[],
  add column if not exists transferred_to uuid[];

alter table public.revenuecat_webhook_events
  drop constraint if exists revenuecat_webhook_events_environment_check;

alter table public.revenuecat_webhook_events
  add constraint revenuecat_webhook_events_environment_check
  check (environment is null or environment in ('SANDBOX','PRODUCTION'));

drop function if exists public.process_revenuecat_premium_event(
  text, text, uuid, text, text, text, text,
  timestamptz, timestamptz, timestamptz
);

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
  p_provider_event_at timestamptz,
  p_environment text,
  p_cancel_reason text default null,
  p_expiration_reason text default null
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
  if p_source not in ('apple','google') then
    raise exception 'Invalid RevenueCat source' using errcode = '22023';
  end if;
  if coalesce(trim(p_source_reference), '') = '' then
    raise exception 'RevenueCat source reference is required' using errcode = '22023';
  end if;
  if p_provider_event_at is null then
    raise exception 'RevenueCat provider event time is required' using errcode = '22023';
  end if;
  if p_environment not in ('SANDBOX','PRODUCTION') then
    raise exception 'Invalid RevenueCat environment' using errcode = '22023';
  end if;
  if p_event_type not in (
    'INITIAL_PURCHASE','RENEWAL','PRODUCT_CHANGE','CANCELLATION',
    'UNCANCELLATION','BILLING_ISSUE','EXPIRATION',
    'SUBSCRIPTION_PAUSED','SUBSCRIPTION_EXTENDED'
  ) then
    raise exception 'Unsupported RevenueCat event type' using errcode = '22023';
  end if;

  v_effective_status := case
    when p_event_type = 'EXPIRATION' then 'expired'
    when p_event_type = 'SUBSCRIPTION_PAUSED' then
      case
        when p_expires_at is not null and p_expires_at <= p_provider_event_at then 'expired'
        when p_status = 'trialing' then 'trialing'
        else 'active'
      end
    when p_event_type = 'BILLING_ISSUE' then
      case
        when p_expires_at is not null and p_expires_at > p_provider_event_at then 'grace_period'
        else 'inactive'
      end
    when p_event_type = 'CANCELLATION'
      and upper(coalesce(p_cancel_reason,'')) = 'CUSTOMER_SUPPORT'
      then 'inactive'
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

  v_will_renew := case
    when p_event_type in ('CANCELLATION','EXPIRATION','SUBSCRIPTION_PAUSED') then false
    when p_event_type in ('INITIAL_PURCHASE','RENEWAL','UNCANCELLATION') then true
    when found then v_existing.will_renew
    else null
  end;

  if p_expires_at is not null and p_expires_at <= v_started_at then
    v_started_at := p_expires_at - interval '1 second';
  end if;

  insert into public.revenuecat_webhook_events (
    event_id,event_type,app_user_id,source,product_id,source_reference,
    provider_event_at,environment,cancel_reason,expiration_reason
  ) values (
    trim(p_event_id),trim(p_event_type),p_user_id,p_source,
    nullif(trim(coalesce(p_product_id,'')),''),
    trim(p_source_reference),p_provider_event_at,p_environment,
    nullif(trim(coalesce(p_cancel_reason,'')),''),
    nullif(trim(coalesce(p_expiration_reason,'')),'')
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
    when p_event_type in ('CANCELLATION','EXPIRATION','SUBSCRIPTION_PAUSED') then false
    when p_event_type in ('INITIAL_PURCHASE','RENEWAL','UNCANCELLATION') then true
    when found then v_existing.will_renew
    else null
  end;

  if found then
    if v_existing.provider_event_at is null
       or p_provider_event_at >= v_existing.provider_event_at then
      update public.premium_entitlements
      set
        status = v_effective_status,
        product_id = nullif(trim(coalesce(p_product_id,'')),''),
        entitlement_id = 'premium',
        starts_at = least(v_existing.starts_at, v_started_at),
        expires_at = p_expires_at,
        revoked_at = null,
        provider_event_at = p_provider_event_at,
        provider_event_id = trim(p_event_id),
        provider_event_type = trim(p_event_type),
        provider_environment = p_environment,
        will_renew = v_will_renew,
        updated_at = now()
      where id = v_existing.id;
    end if;
  else
    insert into public.premium_entitlements (
      user_id,source,status,product_id,entitlement_id,source_reference,
      starts_at,expires_at,revoked_at,provider_event_at,provider_event_id,
      provider_event_type,provider_environment,will_renew
    ) values (
      p_user_id,p_source,v_effective_status,
      nullif(trim(coalesce(p_product_id,'')),''),
      'premium',trim(p_source_reference),v_started_at,p_expires_at,null,
      p_provider_event_at,trim(p_event_id),trim(p_event_type),
      p_environment,v_will_renew
    );
  end if;

  update public.revenuecat_webhook_events
  set processed = true, processed_at = now()
  where event_id = trim(p_event_id);

  return true;
end;
$$;

create or replace function public.process_revenuecat_transfer_event(
  p_event_id text,
  p_transferred_from uuid[],
  p_transferred_to uuid[],
  p_provider_event_at timestamptz,
  p_environment text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted integer := 0;
  v_row public.premium_entitlements;
  v_destination uuid;
begin
  if coalesce(trim(p_event_id),'') = '' then
    raise exception 'RevenueCat event id is required' using errcode = '22023';
  end if;
  if p_provider_event_at is null then
    raise exception 'RevenueCat provider event time is required' using errcode = '22023';
  end if;
  if p_environment not in ('SANDBOX','PRODUCTION') then
    raise exception 'Invalid RevenueCat environment' using errcode = '22023';
  end if;
  if coalesce(array_length(p_transferred_from,1),0) = 0
     or coalesce(array_length(p_transferred_to,1),0) = 0 then
    raise exception 'RevenueCat transfer users are required' using errcode = '22023';
  end if;

  insert into public.revenuecat_webhook_events (
    event_id,event_type,app_user_id,provider_event_at,environment,
    transferred_from,transferred_to
  ) values (
    trim(p_event_id),'TRANSFER',p_transferred_to[1],p_provider_event_at,
    p_environment,p_transferred_from,p_transferred_to
  )
  on conflict (event_id) do nothing;

  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    return false;
  end if;

  for v_row in
    select pe.*
    from public.premium_entitlements pe
    where pe.user_id = any(p_transferred_from)
      and pe.source in ('apple','google')
      and pe.status in ('active','trialing','grace_period')
      and pe.revoked_at is null
      and (pe.expires_at is null or pe.expires_at > p_provider_event_at)
      and (pe.provider_environment is null or pe.provider_environment = p_environment)
  loop
    foreach v_destination in array p_transferred_to
    loop
      if v_destination is null
         or v_destination = any(p_transferred_from)
         or not exists(select 1 from auth.users u where u.id = v_destination) then
        continue;
      end if;

      insert into public.premium_entitlements (
        user_id,source,status,product_id,entitlement_id,source_reference,
        starts_at,expires_at,revoked_at,provider_event_at,provider_event_id,
        provider_event_type,provider_environment,will_renew
      ) values (
        v_destination,v_row.source,v_row.status,v_row.product_id,'premium',
        v_row.source_reference,v_row.starts_at,v_row.expires_at,null,
        p_provider_event_at,trim(p_event_id),'TRANSFER',p_environment,
        v_row.will_renew
      )
      on conflict (user_id, source, (coalesce(source_reference,'')))
      do update set
        status = excluded.status,
        product_id = excluded.product_id,
        starts_at = least(public.premium_entitlements.starts_at, excluded.starts_at),
        expires_at = excluded.expires_at,
        provider_event_at = excluded.provider_event_at,
        provider_event_id = excluded.provider_event_id,
        provider_event_type = excluded.provider_event_type,
        provider_environment = excluded.provider_environment,
        will_renew = excluded.will_renew,
        updated_at = now();
    end loop;
  end loop;

  update public.premium_entitlements pe
  set
    status = 'inactive',
    provider_event_at = p_provider_event_at,
    provider_event_id = trim(p_event_id),
    provider_event_type = 'TRANSFER',
    provider_environment = p_environment,
    will_renew = false,
    updated_at = now()
  where pe.user_id = any(p_transferred_from)
    and pe.source in ('apple','google')
    and pe.status in ('active','trialing','grace_period')
    and (pe.provider_environment is null or pe.provider_environment = p_environment)
    and (pe.provider_event_at is null or p_provider_event_at >= pe.provider_event_at);

  update public.revenuecat_webhook_events
  set processed = true, processed_at = now()
  where event_id = trim(p_event_id);

  return true;
end;
$$;

revoke all on function public.process_revenuecat_premium_event(
  text,text,uuid,text,text,text,text,timestamptz,timestamptz,timestamptz,text,text,text
) from public, anon, authenticated;
grant execute on function public.process_revenuecat_premium_event(
  text,text,uuid,text,text,text,text,timestamptz,timestamptz,timestamptz,text,text,text
) to service_role;

revoke all on function public.process_revenuecat_transfer_event(
  text,uuid[],uuid[],timestamptz,text
) from public, anon, authenticated;
grant execute on function public.process_revenuecat_transfer_event(
  text,uuid[],uuid[],timestamptz,text
) to service_role;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'premium_entitlements'
  ) then
    alter publication supabase_realtime add table public.premium_entitlements;
  end if;
end
$$;

comment on column public.premium_entitlements.provider_environment is
'RevenueCat store environment for paid rows: SANDBOX or PRODUCTION. NULL is reserved for legacy rows created before environment tracking.';

comment on function public.process_revenuecat_transfer_event(text,uuid[],uuid[],timestamptz,text) is
'Moves effective paid Premium access from RevenueCat transfer source users to destination users without mutating entitlement identity fields.';

commit;
