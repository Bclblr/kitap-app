begin;

create or replace function public.get_my_premium_access()
returns table (
  is_premium boolean,
  has_paid_premium boolean,
  has_admin_premium boolean,
  paid_sources text[],
  active_entitlements jsonb,
  all_entitlements jsonb,
  next_expiration_at timestamptz
)
language sql
security definer
set search_path = ''
as $$
  with mine as (
    select pe.*
    from public.premium_entitlements pe
    where pe.user_id = auth.uid()
  ),
  active as (
    select m.*
    from mine m
    where m.status in ('active', 'trialing', 'grace_period')
      and m.revoked_at is null
      and m.starts_at <= now()
      and (m.expires_at is null or m.expires_at > now())
  )
  select
    exists(select 1 from active) as is_premium,
    exists(select 1 from active where source in ('apple', 'google')) as has_paid_premium,
    exists(select 1 from active where source = 'admin_grant') as has_admin_premium,
    coalesce(
      (
        select array_agg(distinct source order by source)
        from active
        where source in ('apple', 'google')
      ),
      array[]::text[]
    ) as paid_sources,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', id,
            'user_id', user_id,
            'source', source,
            'status', status,
            'product_id', product_id,
            'entitlement_id', entitlement_id,
            'source_reference', source_reference,
            'starts_at', starts_at,
            'expires_at', expires_at,
            'revoked_at', revoked_at,
            'created_at', created_at,
            'updated_at', updated_at
          )
          order by created_at desc
        )
        from active
      ),
      '[]'::jsonb
    ) as active_entitlements,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', id,
            'user_id', user_id,
            'source', source,
            'status', status,
            'product_id', product_id,
            'entitlement_id', entitlement_id,
            'source_reference', source_reference,
            'starts_at', starts_at,
            'expires_at', expires_at,
            'revoked_at', revoked_at,
            'created_at', created_at,
            'updated_at', updated_at
          )
          order by created_at desc
        )
        from mine
      ),
      '[]'::jsonb
    ) as all_entitlements,
    case
      when exists(select 1 from active where expires_at is null) then null
      else (select max(expires_at) from active)
    end as next_expiration_at;
$$;

revoke all on function public.get_my_premium_access() from public;
revoke all on function public.get_my_premium_access() from anon;
grant execute on function public.get_my_premium_access() to authenticated;

comment on function public.get_my_premium_access() is
'Effective Premium access for the current user. Paid and admin entitlements coexist independently. Access is indefinite when any active entitlement has no expiry; otherwise effective access ends at the latest active entitlement expiration.';

commit;
