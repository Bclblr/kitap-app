begin;

create or replace function public.admin_list_audit_logs(
  p_search text default '',
  p_action text default null,
  p_target_type text default null,
  p_admin_id uuid default null,
  p_limit integer default 100,
  p_offset integer default 0
)
returns table (
  id uuid,
  admin_id uuid,
  admin_username text,
  admin_full_name text,
  action text,
  target_type text,
  target_id text,
  reason text,
  old_value jsonb,
  new_value jsonb,
  metadata jsonb,
  created_at timestamptz
)
language sql
security definer
set search_path = ''
as $$
  select
    l.id,
    l.admin_id,
    p.username,
    p.full_name,
    l.action,
    l.target_type,
    l.target_id,
    l.reason,
    l.old_value,
    l.new_value,
    l.metadata,
    l.created_at
  from public.admin_audit_logs l
  left join public.profiles p on p.id = l.admin_id
  where public.has_admin_role(array['admin','super_admin'])
    and (p_admin_id is null or l.admin_id = p_admin_id)
    and (coalesce(trim(p_action),'') = '' or l.action = trim(p_action))
    and (coalesce(trim(p_target_type),'') = '' or l.target_type = trim(p_target_type))
    and (
      coalesce(trim(p_search),'') = ''
      or lower(coalesce(p.username,'')) like '%' || lower(left(trim(p_search),200)) || '%'
      or lower(coalesce(p.full_name,'')) like '%' || lower(left(trim(p_search),200)) || '%'
      or lower(coalesce(l.action,'')) like '%' || lower(left(trim(p_search),200)) || '%'
      or lower(coalesce(l.target_type,'')) like '%' || lower(left(trim(p_search),200)) || '%'
      or lower(coalesce(l.target_id,'')) like '%' || lower(left(trim(p_search),200)) || '%'
      or l.admin_id::text like '%' || lower(left(trim(p_search),200)) || '%'
    )
  order by l.created_at desc
  limit greatest(1, least(coalesce(p_limit,100), 250))
  offset greatest(0, coalesce(p_offset,0));
$$;

revoke all on function public.admin_list_audit_logs(text,text,text,uuid,integer,integer) from public;
grant execute on function public.admin_list_audit_logs(text,text,text,uuid,integer,integer) to authenticated;

create or replace function public.admin_audit_filter_options()
returns table (
  actions text[],
  target_types text[]
)
language sql
security definer
set search_path = ''
as $$
  select
    coalesce(array_agg(distinct l.action order by l.action) filter (where l.action is not null), '{}'::text[]),
    coalesce(array_agg(distinct l.target_type order by l.target_type) filter (where l.target_type is not null), '{}'::text[])
  from public.admin_audit_logs l
  where public.has_admin_role(array['admin','super_admin']);
$$;

revoke all on function public.admin_audit_filter_options() from public;
grant execute on function public.admin_audit_filter_options() to authenticated;

commit;
