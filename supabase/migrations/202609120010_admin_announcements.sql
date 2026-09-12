begin;

create or replace function public.admin_list_announcements(
  p_limit integer default 100
)
returns table (
  id uuid,
  title text,
  body text,
  kind text,
  action_route text,
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean,
  created_by uuid,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = ''
as $$
  select
    a.id,
    a.title,
    a.body,
    a.kind,
    a.action_route,
    a.starts_at,
    a.ends_at,
    a.active,
    a.created_by,
    a.created_at,
    a.updated_at
  from public.announcements a
  where public.has_admin_role(array['admin','super_admin'])
  order by a.created_at desc
  limit greatest(1, least(coalesce(p_limit, 100), 200));
$$;

revoke all on function public.admin_list_announcements(integer) from public;
grant execute on function public.admin_list_announcements(integer) to authenticated;

create or replace function public.admin_save_announcement(
  p_id uuid default null,
  p_title text default '',
  p_body text default '',
  p_kind text default 'info',
  p_action_route text default null,
  p_starts_at timestamptz default now(),
  p_ends_at timestamptz default null,
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
  v_new jsonb;
begin
  if not public.has_admin_role(array['admin','super_admin']) then
    raise exception 'not authorized';
  end if;

  if coalesce(trim(p_title), '') = '' or coalesce(trim(p_body), '') = '' then
    raise exception 'title and body are required';
  end if;

  if p_kind not in ('info','warning','maintenance','feature','event') then
    raise exception 'invalid announcement kind';
  end if;

  if p_ends_at is not null and p_ends_at <= p_starts_at then
    raise exception 'ends_at must be after starts_at';
  end if;

  if p_id is null then
    insert into public.announcements(
      title, body, kind, action_route, starts_at, ends_at, active, created_by
    ) values (
      trim(p_title),
      trim(p_body),
      p_kind,
      nullif(trim(coalesce(p_action_route, '')), ''),
      coalesce(p_starts_at, now()),
      p_ends_at,
      coalesce(p_active, true),
      auth.uid()
    )
    returning id into v_id;

    select to_jsonb(a) into v_new from public.announcements a where a.id = v_id;

    insert into public.admin_audit_logs(
      admin_id, action, target_type, target_id, new_value
    ) values (
      auth.uid(), 'announcement_created', 'announcement', v_id::text, v_new
    );
  else
    select to_jsonb(a) into v_old from public.announcements a where a.id = p_id;
    if v_old is null then raise exception 'announcement not found'; end if;

    update public.announcements
    set title = trim(p_title),
        body = trim(p_body),
        kind = p_kind,
        action_route = nullif(trim(coalesce(p_action_route, '')), ''),
        starts_at = coalesce(p_starts_at, starts_at),
        ends_at = p_ends_at,
        active = coalesce(p_active, active),
        updated_at = now()
    where id = p_id
    returning id into v_id;

    select to_jsonb(a) into v_new from public.announcements a where a.id = v_id;

    insert into public.admin_audit_logs(
      admin_id, action, target_type, target_id, old_value, new_value
    ) values (
      auth.uid(), 'announcement_updated', 'announcement', v_id::text, v_old, v_new
    );
  end if;

  return v_id;
end;
$$;

revoke all on function public.admin_save_announcement(uuid,text,text,text,text,timestamptz,timestamptz,boolean) from public;
grant execute on function public.admin_save_announcement(uuid,text,text,text,text,timestamptz,timestamptz,boolean) to authenticated;

create or replace function public.admin_delete_announcement(p_id uuid)
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

  select to_jsonb(a) into v_old from public.announcements a where a.id = p_id;
  if v_old is null then raise exception 'announcement not found'; end if;

  delete from public.announcements where id = p_id;

  insert into public.admin_audit_logs(
    admin_id, action, target_type, target_id, old_value
  ) values (
    auth.uid(), 'announcement_deleted', 'announcement', p_id::text, v_old
  );
end;
$$;

revoke all on function public.admin_delete_announcement(uuid) from public;
grant execute on function public.admin_delete_announcement(uuid) to authenticated;

commit;
