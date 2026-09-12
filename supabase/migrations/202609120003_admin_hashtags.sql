begin;

create table if not exists public.hashtag_controls (
  tag text primary key,
  blocked boolean not null default false,
  featured boolean not null default false,
  priority integer not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  check (tag = lower(tag)),
  check (tag !~ '^#')
);

alter table public.hashtag_controls enable row level security;

drop policy if exists hashtag_controls_read on public.hashtag_controls;
create policy hashtag_controls_read
on public.hashtag_controls for select
to authenticated
using (true);

drop policy if exists hashtag_controls_admin_write on public.hashtag_controls;
create policy hashtag_controls_admin_write
on public.hashtag_controls for all
to authenticated
using (public.has_admin_role(array['admin','super_admin']))
with check (public.has_admin_role(array['admin','super_admin']));

grant select on public.hashtag_controls to authenticated;
grant insert, update, delete on public.hashtag_controls to authenticated;

create or replace function public.admin_list_hashtags()
returns table (
  tag text,
  usage_count bigint,
  post_count bigint,
  review_count bigint,
  blocked boolean,
  featured boolean,
  priority integer,
  updated_at timestamptz
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
  with extracted as (
    select lower(m[1]) as tag, 'post'::text as source_type
    from public.posts p
    cross join lateral regexp_matches(coalesce(p.text, ''), '#([[:alnum:]_çğıöşüÇĞİÖŞÜ]+)', 'g') as m
    union all
    select lower(m[1]) as tag, 'review'::text as source_type
    from public.reviews r
    cross join lateral regexp_matches(coalesce(r.text, ''), '#([[:alnum:]_çğıöşüÇĞİÖŞÜ]+)', 'g') as m
  ), aggregated as (
    select
      e.tag,
      count(*)::bigint as usage_count,
      count(*) filter (where e.source_type = 'post')::bigint as post_count,
      count(*) filter (where e.source_type = 'review')::bigint as review_count
    from extracted e
    where e.tag <> ''
    group by e.tag
  )
  select
    coalesce(a.tag, hc.tag) as tag,
    coalesce(a.usage_count, 0)::bigint as usage_count,
    coalesce(a.post_count, 0)::bigint as post_count,
    coalesce(a.review_count, 0)::bigint as review_count,
    coalesce(hc.blocked, false) as blocked,
    coalesce(hc.featured, false) as featured,
    coalesce(hc.priority, 0) as priority,
    hc.updated_at
  from aggregated a
  full outer join public.hashtag_controls hc on hc.tag = a.tag
  order by coalesce(hc.featured, false) desc, coalesce(hc.priority, 0) desc, coalesce(a.usage_count, 0) desc, coalesce(a.tag, hc.tag) asc;
end;
$$;

revoke all on function public.admin_list_hashtags() from public;
grant execute on function public.admin_list_hashtags() to authenticated;

create or replace function public.admin_set_hashtag_control(
  p_tag text,
  p_blocked boolean default false,
  p_featured boolean default false,
  p_priority integer default 0
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tag text;
  v_old jsonb;
begin
  if not public.has_admin_role(array['admin','super_admin']) then
    raise exception 'not authorized';
  end if;

  v_tag := lower(trim(both '#' from trim(coalesce(p_tag, ''))));
  if v_tag = '' then
    raise exception 'invalid hashtag';
  end if;

  select to_jsonb(hc) into v_old
  from public.hashtag_controls hc
  where hc.tag = v_tag;

  insert into public.hashtag_controls(tag, blocked, featured, priority, updated_at, updated_by)
  values (v_tag, coalesce(p_blocked, false), coalesce(p_featured, false), coalesce(p_priority, 0), now(), auth.uid())
  on conflict(tag) do update set
    blocked = excluded.blocked,
    featured = excluded.featured,
    priority = excluded.priority,
    updated_at = now(),
    updated_by = auth.uid();

  insert into public.admin_audit_logs(admin_id, action, target_type, target_id, old_value, new_value)
  values (
    auth.uid(),
    'hashtag_control_update',
    'hashtag',
    v_tag,
    v_old,
    jsonb_build_object('blocked', coalesce(p_blocked, false), 'featured', coalesce(p_featured, false), 'priority', coalesce(p_priority, 0))
  );
end;
$$;

revoke all on function public.admin_set_hashtag_control(text, boolean, boolean, integer) from public;
grant execute on function public.admin_set_hashtag_control(text, boolean, boolean, integer) to authenticated;

commit;
