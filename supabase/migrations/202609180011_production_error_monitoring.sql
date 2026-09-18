begin;

create index if not exists client_error_events_kind_created_idx
  on public.client_error_events(error_kind, created_at desc);

create or replace function public.admin_client_error_summary(
  p_hours integer default 24
)
returns table (
  total_events bigint,
  fatal_events bigint,
  boundary_events bigint,
  affected_users bigint,
  latest_event_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $function$
  select
    count(*)::bigint,
    count(*) filter (where e.error_kind = 'global_fatal_js')::bigint,
    count(*) filter (where e.error_kind = 'react_boundary')::bigint,
    count(distinct e.user_id)::bigint,
    max(e.created_at)
  from public.client_error_events e
  where public.has_admin_role(array['admin','super_admin'])
    and e.created_at >= now() - make_interval(hours => greatest(1, least(coalesce(p_hours, 24), 720)));
$function$;

revoke all on function public.admin_client_error_summary(integer) from public, anon;
grant execute on function public.admin_client_error_summary(integer) to authenticated;

do $do$
begin
  if exists (
    select 1
    from cron.job
    where jobname = 'client-error-retention'
  ) then
    perform cron.unschedule('client-error-retention');
  end if;

  perform cron.schedule(
    'client-error-retention',
    '20 3 * * *',
    $cron$
      delete from public.client_error_events
      where created_at < now() - interval '30 days';
    $cron$
  );
end
$do$;

commit;
