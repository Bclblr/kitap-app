begin;

create or replace function public.get_premium_badge_user_ids(
  p_user_ids uuid[]
)
returns table (user_id uuid)
language sql
security definer
set search_path = ''
stable
as $$
  select distinct pe.user_id
  from public.premium_entitlements pe
  where auth.uid() is not null
    and pe.user_id = any(coalesce(p_user_ids, array[]::uuid[]))
    and pe.status in ('active', 'trialing', 'grace_period')
    and pe.revoked_at is null
    and pe.starts_at <= now()
    and (pe.expires_at is null or pe.expires_at > now());
$$;

revoke all on function public.get_premium_badge_user_ids(uuid[]) from public;
revoke all on function public.get_premium_badge_user_ids(uuid[]) from anon;
grant execute on function public.get_premium_badge_user_ids(uuid[]) to authenticated;

comment on function public.get_premium_badge_user_ids(uuid[]) is
'Returns only the user IDs that currently have Premium access, without exposing purchase source, product, transaction, or subscription metadata.';

commit;
