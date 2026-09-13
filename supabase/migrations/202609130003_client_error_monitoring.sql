begin;

create table if not exists public.client_error_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  error_kind text not null default 'react_boundary',
  message text not null default '',
  stack text not null default '',
  component_stack text not null default '',
  platform text not null default '',
  app_version text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists client_error_events_created_idx
  on public.client_error_events(created_at desc);
create index if not exists client_error_events_user_idx
  on public.client_error_events(user_id, created_at desc);

alter table public.client_error_events enable row level security;
revoke all on table public.client_error_events from public, anon, authenticated;

create or replace function public.report_client_error(
  p_error_kind text,
  p_message text,
  p_stack text default '',
  p_component_stack text default '',
  p_platform text default '',
  p_app_version text default ''
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_recent_count integer := 0;
begin
  -- Monitoring is deliberately authenticated-only to avoid a public spam sink.
  if v_user_id is null then
    return;
  end if;

  select count(*)::integer
    into v_recent_count
  from public.client_error_events e
  where e.user_id = v_user_id
    and e.created_at >= now() - interval '1 hour';

  if v_recent_count >= 30 then
    return;
  end if;

  insert into public.client_error_events (
    user_id,
    error_kind,
    message,
    stack,
    component_stack,
    platform,
    app_version
  ) values (
    v_user_id,
    left(coalesce(nullif(trim(p_error_kind), ''), 'unknown'), 80),
    left(coalesce(p_message, ''), 1000),
    left(coalesce(p_stack, ''), 8000),
    left(coalesce(p_component_stack, ''), 8000),
    left(coalesce(p_platform, ''), 40),
    left(coalesce(p_app_version, ''), 40)
  );
end;
$function$;

revoke all on function public.report_client_error(text,text,text,text,text,text) from public;
grant execute on function public.report_client_error(text,text,text,text,text,text) to authenticated;

create or replace function public.admin_list_client_errors(
  p_limit integer default 100
)
returns table(
  id uuid,
  user_id uuid,
  error_kind text,
  message text,
  stack text,
  component_stack text,
  platform text,
  app_version text,
  created_at timestamptz
)
language sql
security definer
set search_path = ''
as $function$
  select
    e.id,
    e.user_id,
    e.error_kind,
    e.message,
    e.stack,
    e.component_stack,
    e.platform,
    e.app_version,
    e.created_at
  from public.client_error_events e
  where public.has_admin_role(array['admin','super_admin'])
  order by e.created_at desc
  limit greatest(1, least(coalesce(p_limit, 100), 500));
$function$;

revoke all on function public.admin_list_client_errors(integer) from public;
grant execute on function public.admin_list_client_errors(integer) to authenticated;

commit;
