begin;

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
  v_distinct_destinations uuid[];
begin
  if coalesce(trim(p_event_id),'') = '' then
    raise exception 'RevenueCat event id is required' using errcode = '22023';
  end if;

  if p_provider_event_at is null then
    raise exception 'RevenueCat provider event time is required' using errcode = '22023';
  end if;

  if p_environment is not null
     and p_environment not in ('SANDBOX','PRODUCTION') then
    raise exception 'Invalid RevenueCat environment' using errcode = '22023';
  end if;

  if coalesce(array_length(p_transferred_from,1),0) = 0
     or coalesce(array_length(p_transferred_to,1),0) = 0 then
    raise exception 'RevenueCat transfer users are required' using errcode = '22023';
  end if;

  select array_agg(distinct destination order by destination)
  into v_distinct_destinations
  from unnest(p_transferred_to) as destination
  where destination is not null;

  if coalesce(array_length(v_distinct_destinations,1),0) <> 1 then
    raise exception 'RevenueCat transfer destination must resolve to exactly one user'
      using errcode = '22023';
  end if;

  v_destination := v_distinct_destinations[1];

  if v_destination = any(p_transferred_from) then
    raise exception 'RevenueCat transfer destination cannot also be a source user'
      using errcode = '22023';
  end if;

  if not exists (
    select 1 from auth.users u where u.id = v_destination
  ) then
    raise exception 'RevenueCat transfer destination user does not exist'
      using errcode = '22023';
  end if;

  insert into public.revenuecat_webhook_events (
    event_id,
    event_type,
    app_user_id,
    provider_event_at,
    environment,
    transferred_from,
    transferred_to
  ) values (
    trim(p_event_id),
    'TRANSFER',
    v_destination,
    p_provider_event_at,
    p_environment,
    p_transferred_from,
    array[v_destination]
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
      and (
        p_environment is null
        or pe.provider_environment is null
        or pe.provider_environment = p_environment
      )
      and (
        pe.provider_event_at is null
        or p_provider_event_at >= pe.provider_event_at
      )
    order by pe.id
    for update
  loop
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
      provider_environment,
      will_renew
    ) values (
      v_destination,
      v_row.source,
      v_row.status,
      v_row.product_id,
      'premium',
      v_row.source_reference,
      v_row.starts_at,
      v_row.expires_at,
      null,
      p_provider_event_at,
      trim(p_event_id),
      'TRANSFER',
      coalesce(p_environment, v_row.provider_environment),
      v_row.will_renew
    )
    on conflict (user_id, source, (coalesce(source_reference,'')))
    do update set
      status = excluded.status,
      product_id = excluded.product_id,
      starts_at = least(
        public.premium_entitlements.starts_at,
        excluded.starts_at
      ),
      expires_at = excluded.expires_at,
      revoked_at = null,
      provider_event_at = excluded.provider_event_at,
      provider_event_id = excluded.provider_event_id,
      provider_event_type = excluded.provider_event_type,
      provider_environment = excluded.provider_environment,
      will_renew = excluded.will_renew,
      updated_at = now()
    where
      public.premium_entitlements.provider_event_at is null
      or excluded.provider_event_at >= public.premium_entitlements.provider_event_at;
  end loop;

  update public.premium_entitlements pe
  set
    status = 'inactive',
    provider_event_at = p_provider_event_at,
    provider_event_id = trim(p_event_id),
    provider_event_type = 'TRANSFER',
    provider_environment = coalesce(
      p_environment,
      pe.provider_environment
    ),
    will_renew = false,
    updated_at = now()
  where pe.user_id = any(p_transferred_from)
    and pe.source in ('apple','google')
    and pe.status in ('active','trialing','grace_period')
    and (
      p_environment is null
      or pe.provider_environment is null
      or pe.provider_environment = p_environment
    )
    and (
      pe.provider_event_at is null
      or p_provider_event_at >= pe.provider_event_at
    );

  update public.revenuecat_webhook_events
  set
    processed = true,
    processed_at = now()
  where event_id = trim(p_event_id);

  return true;
end;
$$;

revoke all on function public.process_revenuecat_transfer_event(
  text,uuid[],uuid[],timestamptz,text
) from public, anon, authenticated;

grant execute on function public.process_revenuecat_transfer_event(
  text,uuid[],uuid[],timestamptz,text
) to service_role;

comment on function public.process_revenuecat_transfer_event(
  text,uuid[],uuid[],timestamptz,text
) is
'Service-role-only RevenueCat transfer sync. Destination aliases must resolve to exactly one application user before paid state can move.';

commit;