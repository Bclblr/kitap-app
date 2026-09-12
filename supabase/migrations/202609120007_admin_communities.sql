begin;

create table if not exists public.community_admin_controls (
  community_id uuid primary key references public.communities(id) on delete cascade,
  verified boolean not null default false,
  featured boolean not null default false,
  priority integer not null default 0,
  restricted boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

alter table public.community_admin_controls enable row level security;

drop policy if exists community_admin_controls_read on public.community_admin_controls;
create policy community_admin_controls_read
on public.community_admin_controls for select
to authenticated
using (true);

drop policy if exists community_admin_controls_write on public.community_admin_controls;
create policy community_admin_controls_write
on public.community_admin_controls for all
to authenticated
using (public.has_admin_role(array['admin','super_admin']))
with check (public.has_admin_role(array['admin','super_admin']));

grant select, insert, update, delete on public.community_admin_controls to authenticated;

create or replace function public.admin_list_communities(
  p_search text default '',
  p_limit integer default 100
)
returns table (
  id uuid,
  name text,
  description text,
  image_url text,
  kind text,
  visibility text,
  created_by uuid,
  owner_username text,
  member_count bigint,
  admin_count bigint,
  verified boolean,
  featured boolean,
  priority integer,
  restricted boolean,
  created_at timestamptz
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
    c.id,
    c.name::text,
    c.description::text,
    c.image_url::text,
    c.kind::text,
    c.visibility::text,
    c.created_by,
    coalesce(p.username, 'Kitap Okuru')::text as owner_username,
    count(m.user_id)::bigint as member_count,
    count(m.user_id) filter (where m.role in ('owner','admin'))::bigint as admin_count,
    coalesce(ac.verified, false) as verified,
    coalesce(ac.featured, false) as featured,
    coalesce(ac.priority, 0) as priority,
    coalesce(ac.restricted, false) as restricted,
    c.created_at
  from public.communities c
  left join public.profiles p on p.id = c.created_by
  left join public.community_members m on m.community_id = c.id
  left join public.community_admin_controls ac on ac.community_id = c.id
  where
    coalesce(trim(p_search), '') = ''
    or c.name ilike '%' || trim(p_search) || '%'
    or coalesce(c.description, '') ilike '%' || trim(p_search) || '%'
    or coalesce(p.username, '') ilike '%' || trim(p_search) || '%'
    or c.id::text ilike '%' || trim(p_search) || '%'
  group by c.id, p.username, ac.verified, ac.featured, ac.priority, ac.restricted
  order by
    coalesce(ac.featured, false) desc,
    coalesce(ac.priority, 0) desc,
    count(m.user_id) desc,
    c.created_at desc
  limit greatest(1, least(coalesce(p_limit, 100), 200));
end;
$$;

revoke all on function public.admin_list_communities(text,integer) from public;
grant execute on function public.admin_list_communities(text,integer) to authenticated;

create or replace function public.admin_set_community_control(
  p_community_id uuid,
  p_verified boolean default false,
  p_featured boolean default false,
  p_priority integer default 0,
  p_restricted boolean default false
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

  if not exists(select 1 from public.communities c where c.id = p_community_id) then
    raise exception 'community not found';
  end if;

  select to_jsonb(ac) into v_old
  from public.community_admin_controls ac
  where ac.community_id = p_community_id;

  insert into public.community_admin_controls(
    community_id, verified, featured, priority, restricted, updated_at, updated_by
  ) values (
    p_community_id,
    coalesce(p_verified, false),
    coalesce(p_featured, false),
    coalesce(p_priority, 0),
    coalesce(p_restricted, false),
    now(),
    auth.uid()
  )
  on conflict(community_id) do update set
    verified = excluded.verified,
    featured = excluded.featured,
    priority = excluded.priority,
    restricted = excluded.restricted,
    updated_at = now(),
    updated_by = auth.uid();

  select to_jsonb(ac) into v_new
  from public.community_admin_controls ac
  where ac.community_id = p_community_id;

  insert into public.admin_audit_logs(
    admin_id, action, target_type, target_id, old_value, new_value
  ) values (
    auth.uid(),
    'community_control_update',
    'community',
    p_community_id::text,
    v_old,
    v_new
  );
end;
$$;

revoke all on function public.admin_set_community_control(uuid,boolean,boolean,integer,boolean) from public;
grant execute on function public.admin_set_community_control(uuid,boolean,boolean,integer,boolean) to authenticated;

create or replace function public.admin_list_community_members(p_community_id uuid)
returns table (
  user_id uuid,
  username text,
  full_name text,
  role text,
  joined_at timestamptz
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
    m.user_id,
    coalesce(p.username, 'Kitap Okuru')::text,
    p.full_name::text,
    m.role::text,
    m.joined_at
  from public.community_members m
  left join public.profiles p on p.id = m.user_id
  where m.community_id = p_community_id
  order by case m.role when 'owner' then 0 when 'admin' then 1 else 2 end, m.joined_at asc;
end;
$$;

revoke all on function public.admin_list_community_members(uuid) from public;
grant execute on function public.admin_list_community_members(uuid) to authenticated;

create or replace function public.admin_set_community_member_role(
  p_community_id uuid,
  p_user_id uuid,
  p_role text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old_role text;
begin
  if not public.has_admin_role(array['admin','super_admin']) then
    raise exception 'not authorized';
  end if;

  if p_role not in ('member','admin') then
    raise exception 'invalid role';
  end if;

  select m.role into v_old_role
  from public.community_members m
  where m.community_id = p_community_id and m.user_id = p_user_id;

  if v_old_role is null then
    raise exception 'member not found';
  end if;

  if v_old_role = 'owner' then
    raise exception 'owner role cannot be changed here';
  end if;

  update public.community_members
  set role = p_role
  where community_id = p_community_id and user_id = p_user_id;

  insert into public.admin_audit_logs(
    admin_id, action, target_type, target_id, old_value, new_value
  ) values (
    auth.uid(),
    'community_member_role_update',
    'community_member',
    p_community_id::text || ':' || p_user_id::text,
    jsonb_build_object('role', v_old_role),
    jsonb_build_object('role', p_role)
  );
end;
$$;

revoke all on function public.admin_set_community_member_role(uuid,uuid,text) from public;
grant execute on function public.admin_set_community_member_role(uuid,uuid,text) to authenticated;

commit;
