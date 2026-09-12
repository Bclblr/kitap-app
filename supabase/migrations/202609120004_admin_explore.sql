begin;

create table if not exists public.explore_featured_items (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('post','review','book','author','community','event','hashtag')),
  target_id text not null,
  title text,
  subtitle text,
  priority integer not null default 0,
  active boolean not null default true,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(target_type, target_id),
  check (ends_at is null or ends_at > starts_at)
);

create index if not exists explore_featured_items_sort_idx
  on public.explore_featured_items(active, priority desc, created_at desc);

alter table public.explore_featured_items enable row level security;

drop policy if exists explore_featured_items_read on public.explore_featured_items;
create policy explore_featured_items_read
on public.explore_featured_items for select
to authenticated
using (
  (active and starts_at <= now() and (ends_at is null or ends_at > now()))
  or public.has_admin_role(array['admin','super_admin'])
);

drop policy if exists explore_featured_items_admin_write on public.explore_featured_items;
create policy explore_featured_items_admin_write
on public.explore_featured_items for all
to authenticated
using (public.has_admin_role(array['admin','super_admin']))
with check (public.has_admin_role(array['admin','super_admin']));

grant select, insert, update, delete on public.explore_featured_items to authenticated;

create or replace function public.admin_upsert_explore_item(
  p_target_type text,
  p_target_id text,
  p_title text default null,
  p_subtitle text default null,
  p_priority integer default 0,
  p_active boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_old jsonb;
begin
  if not public.has_admin_role(array['admin','super_admin']) then
    raise exception 'not authorized';
  end if;

  if p_target_type not in ('post','review','book','author','community','event','hashtag') then
    raise exception 'invalid target type';
  end if;

  if trim(coalesce(p_target_id, '')) = '' then
    raise exception 'target id required';
  end if;

  select to_jsonb(e), e.id
    into v_old, v_id
  from public.explore_featured_items e
  where e.target_type = p_target_type
    and e.target_id = trim(p_target_id);

  if v_id is null then
    insert into public.explore_featured_items(
      target_type, target_id, title, subtitle, priority, active, created_by
    ) values (
      p_target_type,
      trim(p_target_id),
      nullif(trim(coalesce(p_title, '')), ''),
      nullif(trim(coalesce(p_subtitle, '')), ''),
      coalesce(p_priority, 0),
      coalesce(p_active, true),
      auth.uid()
    )
    returning id into v_id;
  else
    update public.explore_featured_items
    set title = nullif(trim(coalesce(p_title, '')), ''),
        subtitle = nullif(trim(coalesce(p_subtitle, '')), ''),
        priority = coalesce(p_priority, 0),
        active = coalesce(p_active, true),
        updated_at = now()
    where id = v_id;
  end if;

  insert into public.admin_audit_logs(
    admin_id, action, target_type, target_id, old_value, new_value
  ) values (
    auth.uid(),
    'explore_feature_update',
    'explore_item',
    v_id::text,
    v_old,
    jsonb_build_object(
      'target_type', p_target_type,
      'target_id', trim(p_target_id),
      'title', p_title,
      'subtitle', p_subtitle,
      'priority', coalesce(p_priority, 0),
      'active', coalesce(p_active, true)
    )
  );

  return v_id;
end;
$$;

revoke all on function public.admin_upsert_explore_item(text,text,text,text,integer,boolean) from public;
grant execute on function public.admin_upsert_explore_item(text,text,text,text,integer,boolean) to authenticated;

create or replace function public.admin_delete_explore_item(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb;
begin
  if not public.has_admin_role(array['admin','super_admin']) then
    raise exception 'not authorized';
  end if;

  select to_jsonb(e) into v_old
  from public.explore_featured_items e
  where e.id = p_id;

  if v_old is null then
    return;
  end if;

  delete from public.explore_featured_items where id = p_id;

  insert into public.admin_audit_logs(admin_id, action, target_type, target_id, old_value)
  values (auth.uid(), 'explore_feature_delete', 'explore_item', p_id::text, v_old);
end;
$$;

revoke all on function public.admin_delete_explore_item(uuid) from public;
grant execute on function public.admin_delete_explore_item(uuid) to authenticated;

commit;
