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
    p_transferred_to[1],
    p_provider_event_at,
    p_environment,
    p_transferred_from,
    p_transferred_to
  )
  on conflict (event_id) do nothing;

  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    return false;
  end if;

  -- Lock eligible source entitlement rows so a concurrent lifecycle webhook
  -- for the same entitlement cannot race the transfer.
  --
  -- A stale transfer event must never move state that was already updated by
  -- a newer RevenueCat event.
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
    foreach v_destination in array p_transferred_to
    loop
      if v_destination is null
         or v_destination = any(p_transferred_from)
         or not exists (
           select 1
           from auth.users u
           where u.id = v_destination
         ) then
        continue;
      end if;

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
  end loop;

  -- Revoke only source rows whose known provider state is not newer than this
  -- transfer event.
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
'Service-role-only RevenueCat transfer sync. Source rows are locked, stale transfer events cannot override newer provider state, and destination upserts are timestamp-guarded.';

commit;
