begin;

drop function if exists public.admin_client_error_summary(integer);

create function public.admin_client_error_summary(
  p_hours integer default 24
)
returns table(
  total_events bigint,
  fatal_events bigint,
  boundary_events bigint,
  affected_users bigint,
  latest_event_at timestamptz,
  alert_level text
)
language sql
stable
security definer
set search_path = ''
as $$
  with stats as (
    select
      count(*)::bigint as total_events,
      count(*) filter (where e.error_kind = 'global_fatal_js')::bigint as fatal_events,
      count(*) filter (where e.error_kind = 'react_boundary')::bigint as boundary_events,
      count(distinct e.user_id)::bigint as affected_users,
      max(e.created_at) as latest_event_at
    from public.client_error_events e
    where public.has_admin_role(array['admin','super_admin'])
      and e.created_at >= now() - make_interval(
        hours => greatest(1, least(coalesce(p_hours, 24), 720))
      )
  )
  select
    s.total_events,
    s.fatal_events,
    s.boundary_events,
    s.affected_users,
    s.latest_event_at,
    case
      when s.fatal_events >= 3 or s.total_events >= 25 then 'critical'
      when s.fatal_events >= 1 or s.total_events >= 10 then 'warning'
      else 'ok'
    end as alert_level
  from stats s;
$$;

revoke all on function public.admin_client_error_summary(integer)
from public, anon;

grant execute on function public.admin_client_error_summary(integer)
to authenticated;

comment on function public.admin_client_error_summary(integer) is
'Admin-only client error summary with threshold-based alert level for production monitoring.';

commit;
