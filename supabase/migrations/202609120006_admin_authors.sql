begin;

create table if not exists public.author_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  pen_name text,
  verified boolean not null default false,
  featured boolean not null default false,
  priority integer not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  check (pen_name is null or length(trim(pen_name)) between 1 and 120)
);

alter table public.author_profiles enable row level security;

drop policy if exists author_profiles_read on public.author_profiles;
create policy author_profiles_read
on public.author_profiles for select
to authenticated
using (true);

drop policy if exists author_profiles_admin_write on public.author_profiles;
create policy author_profiles_admin_write
on public.author_profiles for all
to authenticated
using (public.has_admin_role(array['admin','super_admin']))
with check (public.has_admin_role(array['admin','super_admin']));

grant select, insert, update, delete on public.author_profiles to authenticated;

create or replace function public.admin_list_authors(
  p_search text default '',
  p_limit integer default 100
)
returns table (
  user_id uuid,
  username text,
  full_name text,
  profile_image text,
  pen_name text,
  verified boolean,
  featured boolean,
  priority integer,
  work_count bigint,
  published_work_count bigint,
  draft_work_count bigint,
  last_work_updated_at timestamptz
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
    p.id as user_id,
    p.username::text,
    p.full_name::text,
    p.profile_image::text,
    ap.pen_name::text,
    coalesce(ap.verified, false) as verified,
    coalesce(ap.featured, false) as featured,
    coalesce(ap.priority, 0) as priority,
    count(w.id)::bigint as work_count,
    count(w.id) filter (where w.status = 'published')::bigint as published_work_count,
    count(w.id) filter (where w.status = 'draft')::bigint as draft_work_count,
    max(w.updated_at) as last_work_updated_at
  from public.profiles p
  join public.works w on w.author_id = p.id
  left join public.author_profiles ap on ap.user_id = p.id
  where
    coalesce(trim(p_search), '') = ''
    or coalesce(p.username, '') ilike '%' || trim(p_search) || '%'
    or coalesce(p.full_name, '') ilike '%' || trim(p_search) || '%'
    or coalesce(ap.pen_name, '') ilike '%' || trim(p_search) || '%'
    or p.id::text ilike '%' || trim(p_search) || '%'
  group by p.id, p.username, p.full_name, p.profile_image, ap.pen_name, ap.verified, ap.featured, ap.priority
  order by
    coalesce(ap.featured, false) desc,
    coalesce(ap.priority, 0) desc,
    count(w.id) desc,
    max(w.updated_at) desc nulls last
  limit greatest(1, least(coalesce(p_limit, 100), 200));
end;
$$;

revoke all on function public.admin_list_authors(text,integer) from public;
grant execute on function public.admin_list_authors(text,integer) to authenticated;

create or replace function public.admin_set_author_profile(
  p_user_id uuid,
  p_pen_name text default null,
  p_verified boolean default false,
  p_featured boolean default false,
  p_priority integer default 0
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

  if not exists(select 1 from public.works w where w.author_id = p_user_id) then
    raise exception 'author has no works';
  end if;

  select to_jsonb(ap) into v_old
  from public.author_profiles ap
  where ap.user_id = p_user_id;

  insert into public.author_profiles(
    user_id, pen_name, verified, featured, priority, updated_at, updated_by
  ) values (
    p_user_id,
    nullif(trim(coalesce(p_pen_name, '')), ''),
    coalesce(p_verified, false),
    coalesce(p_featured, false),
    coalesce(p_priority, 0),
    now(),
    auth.uid()
  )
  on conflict(user_id) do update set
    pen_name = excluded.pen_name,
    verified = excluded.verified,
    featured = excluded.featured,
    priority = excluded.priority,
    updated_at = now(),
    updated_by = auth.uid();

  select to_jsonb(ap) into v_new
  from public.author_profiles ap
  where ap.user_id = p_user_id;

  insert into public.admin_audit_logs(
    admin_id, action, target_type, target_id, old_value, new_value
  ) values (
    auth.uid(),
    'author_profile_update',
    'author',
    p_user_id::text,
    v_old,
    v_new
  );
end;
$$;

revoke all on function public.admin_set_author_profile(uuid,text,boolean,boolean,integer) from public;
grant execute on function public.admin_set_author_profile(uuid,text,boolean,boolean,integer) to authenticated;

commit;
