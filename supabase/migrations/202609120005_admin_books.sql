begin;

-- Admins need to review every authored work, including drafts.
drop policy if exists works_admin_read on public.works;
create policy works_admin_read
on public.works for select
to authenticated
using (public.has_admin_role(array['admin','super_admin']));

drop policy if exists works_admin_update on public.works;
create policy works_admin_update
on public.works for update
to authenticated
using (public.has_admin_role(array['admin','super_admin']))
with check (public.has_admin_role(array['admin','super_admin']));

drop policy if exists chapters_admin_read on public.work_chapters;
create policy chapters_admin_read
on public.work_chapters for select
to authenticated
using (public.has_admin_role(array['admin','super_admin']));

grant select, update on public.works to authenticated;
grant select on public.work_chapters to authenticated;

create or replace function public.admin_list_works(
  p_search text default '',
  p_status text default 'all',
  p_limit integer default 100
)
returns table (
  id uuid,
  author_id uuid,
  author_username text,
  title text,
  description text,
  cover_url text,
  genre text,
  tags text[],
  status text,
  language text,
  audience text,
  completed boolean,
  chapter_count bigint,
  published_chapter_count bigint,
  created_at timestamptz,
  updated_at timestamptz,
  published_at timestamptz
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
    w.id,
    w.author_id,
    coalesce(p.username, 'Kitap Okuru')::text,
    w.title,
    w.description,
    w.cover_url,
    w.genre,
    w.tags,
    w.status,
    w.language,
    w.audience,
    w.completed,
    count(c.id)::bigint as chapter_count,
    count(c.id) filter (where c.status = 'published')::bigint as published_chapter_count,
    w.created_at,
    w.updated_at,
    w.published_at
  from public.works w
  left join public.profiles p on p.id = w.author_id
  left join public.work_chapters c on c.work_id = w.id
  where
    (coalesce(trim(p_search), '') = ''
      or w.title ilike '%' || trim(p_search) || '%'
      or coalesce(p.username, '') ilike '%' || trim(p_search) || '%'
      or coalesce(w.genre, '') ilike '%' || trim(p_search) || '%')
    and (p_status = 'all' or w.status = p_status)
  group by w.id, p.username
  order by w.updated_at desc
  limit greatest(1, least(coalesce(p_limit, 100), 200));
end;
$$;

revoke all on function public.admin_list_works(text,text,integer) from public;
grant execute on function public.admin_list_works(text,text,integer) to authenticated;

create or replace function public.admin_update_work_state(
  p_work_id uuid,
  p_status text,
  p_completed boolean
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

  if p_status not in ('draft','published') then
    raise exception 'invalid status';
  end if;

  select to_jsonb(w) into v_old
  from public.works w
  where w.id = p_work_id;

  if v_old is null then
    raise exception 'work not found';
  end if;

  update public.works
  set status = p_status,
      completed = coalesce(p_completed, false),
      published_at = case
        when p_status = 'published' then coalesce(published_at, now())
        else published_at
      end,
      updated_at = now()
  where id = p_work_id;

  select to_jsonb(w) into v_new
  from public.works w
  where w.id = p_work_id;

  insert into public.admin_audit_logs(
    admin_id, action, target_type, target_id, old_value, new_value
  ) values (
    auth.uid(),
    'work_state_update',
    'work',
    p_work_id::text,
    v_old,
    v_new
  );
end;
$$;

revoke all on function public.admin_update_work_state(uuid,text,boolean) from public;
grant execute on function public.admin_update_work_state(uuid,text,boolean) to authenticated;

commit;
