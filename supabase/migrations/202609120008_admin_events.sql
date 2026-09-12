begin;

create table if not exists public.event_admin_controls (
  event_id uuid primary key references public.events(id) on delete cascade,
  featured boolean not null default false,
  priority integer not null default 0,
  hidden boolean not null default false,
  cancelled boolean not null default false,
  note text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

alter table public.event_admin_controls enable row level security;

drop policy if exists event_admin_controls_read on public.event_admin_controls;
create policy event_admin_controls_read
on public.event_admin_controls for select
to authenticated
using (true);

drop policy if exists event_admin_controls_write on public.event_admin_controls;
create policy event_admin_controls_write
on public.event_admin_controls for all
to authenticated
using (public.has_admin_role(array['admin','super_admin']))
with check (public.has_admin_role(array['admin','super_admin']));

grant select, insert, update, delete on public.event_admin_controls to authenticated;

create or replace function public.admin_list_events(
  p_search text default '',
  p_limit integer default 100
)
returns table (
  id uuid,
  title text,
  description text,
  event_date timestamptz,
  location text,
  image_url text,
  created_by uuid,
  owner_username text,
  attendee_count bigint,
  featured boolean,
  priority integer,
  hidden boolean,
  cancelled boolean,
  note text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_admin_role(array['moderator','admin','super_admin']) then
    raise exception 'not authorized';
  end if;

  return query
  select
    e.id,
    e.title::text,
    e.description::text,
    e.event_date,
    e.location::text,
    e.image_url::text,
    e.created_by,
    coalesce(p.username, 'Kitap Okuru')::text as owner_username,
    count(a.user_id)::bigint as attendee_count,
    coalesce(c.featured, false) as featured,
    coalesce(c.priority, 0) as priority,
    coalesce(c.hidden, false) as hidden,
    coalesce(c.cancelled, false) as cancelled,
    c.note::text
  from public.events e
  left join public.profiles p on p.id = e.created_by
  left join public.event_attendees a on a.event_id = e.id
  left join public.event_admin_controls c on c.event_id = e.id
  where
    coalesce(trim(p_search), '') = ''
    or e.title ilike '%' || trim(p_search) || '%'
    or coalesce(e.description, '') ilike '%' || trim(p_search) || '%'
    or coalesce(e.location, '') ilike '%' || trim(p_search) || '%'
    or coalesce(p.username, '') ilike '%' || trim(p_search) || '%'
    or e.id::text ilike '%' || trim(p_search) || '%'
  group by
    e.id, e.title, e.description, e.event_date, e.location, e.image_url, e.created_by,
    p.username, c.featured, c.priority, c.hidden, c.cancelled, c.note
  order by
    coalesce(c.featured, false) desc,
    coalesce(c.priority, 0) desc,
    e.event_date asc
  limit greatest(1, least(coalesce(p_limit, 100), 200));
end;
$$;

revoke all on function public.admin_list_events(text,integer) from public;
grant execute on function public.admin_list_events(text,integer) to authenticated;

create or replace function public.admin_set_event_control(
  p_event_id uuid,
  p_featured boolean default false,
  p_priority integer default 0,
  p_hidden boolean default false,
  p_cancelled boolean default false,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb;
  v_new jsonb;
begin
  if not public.has_admin_role(array['admin','super_admin']) then
    raise exception 'not authorized';
  end if;

  if not exists(select 1 from public.events e where e.id = p_event_id) then
    raise exception 'event not found';
  end if;

  select to_jsonb(c) into v_old
  from public.event_admin_controls c
  where c.event_id = p_event_id;

  insert into public.event_admin_controls(
    event_id, featured, priority, hidden, cancelled, note, updated_at, updated_by
  ) values (
    p_event_id,
    coalesce(p_featured, false),
    coalesce(p_priority, 0),
    coalesce(p_hidden, false),
    coalesce(p_cancelled, false),
    nullif(trim(coalesce(p_note, '')), ''),
    now(),
    auth.uid()
  )
  on conflict(event_id) do update set
    featured = excluded.featured,
    priority = excluded.priority,
    hidden = excluded.hidden,
    cancelled = excluded.cancelled,
    note = excluded.note,
    updated_at = now(),
    updated_by = auth.uid();

  select to_jsonb(c) into v_new
  from public.event_admin_controls c
  where c.event_id = p_event_id;

  insert into public.admin_audit_logs(
    admin_id, action, target_type, target_id, old_value, new_value
  ) values (
    auth.uid(),
    'event_control_update',
    'event',
    p_event_id::text,
    v_old,
    v_new
  );
end;
$$;

revoke all on function public.admin_set_event_control(uuid,boolean,integer,boolean,boolean,text) from public;
grant execute on function public.admin_set_event_control(uuid,boolean,integer,boolean,boolean,text) to authenticated;

create or replace function public.admin_list_event_attendees(p_event_id uuid)
returns table (
  user_id uuid,
  username text,
  full_name text,
  profile_image text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_admin_role(array['admin','super_admin']) then
    raise exception 'not authorized';
  end if;

  return query
  select
    a.user_id,
    coalesce(p.username, 'Kitap Okuru')::text,
    p.full_name::text,
    p.profile_image::text
  from public.event_attendees a
  left join public.profiles p on p.id = a.user_id
  where a.event_id = p_event_id
  order by coalesce(p.username, 'Kitap Okuru') asc;
end;
$$;

revoke all on function public.admin_list_event_attendees(uuid) from public;
grant execute on function public.admin_list_event_attendees(uuid) to authenticated;

create or replace function public.admin_remove_event_attendee(
  p_event_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_admin_role(array['admin','super_admin']) then
    raise exception 'not authorized';
  end if;

  if not exists(
    select 1 from public.event_attendees a
    where a.event_id = p_event_id and a.user_id = p_user_id
  ) then
    raise exception 'attendee not found';
  end if;

  delete from public.event_attendees
  where event_id = p_event_id and user_id = p_user_id;

  insert into public.admin_audit_logs(
    admin_id, action, target_type, target_id, old_value, new_value
  ) values (
    auth.uid(),
    'event_attendee_removed',
    'event_attendee',
    p_event_id::text || ':' || p_user_id::text,
    jsonb_build_object('event_id', p_event_id, 'user_id', p_user_id),
    null
  );
end;
$$;

revoke all on function public.admin_remove_event_attendee(uuid,uuid) from public;
grant execute on function public.admin_remove_event_attendee(uuid,uuid) to authenticated;

commit;
