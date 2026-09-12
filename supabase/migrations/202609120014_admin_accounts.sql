begin;

create or replace function public.admin_list_admin_accounts()
returns table (
  user_id uuid,
  username text,
  full_name text,
  profile_image text,
  role text,
  updated_at timestamptz,
  updated_by uuid
)
language sql
security definer
set search_path = ''
as $$
  select
    ur.user_id,
    p.username,
    p.full_name,
    p.profile_image,
    ur.role,
    ur.updated_at,
    ur.updated_by
  from public.user_roles ur
  left join public.profiles p on p.id = ur.user_id
  where public.has_admin_role(array['super_admin'])
    and ur.role in ('moderator','admin','super_admin')
  order by
    case ur.role when 'super_admin' then 1 when 'admin' then 2 else 3 end,
    lower(coalesce(p.username,'')),
    ur.user_id;
$$;

revoke all on function public.admin_list_admin_accounts() from public;
grant execute on function public.admin_list_admin_accounts() to authenticated;

create or replace function public.admin_search_role_candidates(
  p_search text default '',
  p_limit integer default 50
)
returns table (
  user_id uuid,
  username text,
  full_name text,
  profile_image text,
  role text
)
language sql
security definer
set search_path = ''
as $$
  select
    p.id,
    p.username,
    p.full_name,
    p.profile_image,
    coalesce(ur.role,'user')
  from public.profiles p
  left join public.user_roles ur on ur.user_id = p.id
  where public.has_admin_role(array['super_admin'])
    and (
      coalesce(trim(p_search),'') = ''
      or lower(coalesce(p.username,'')) like '%' || lower(left(trim(p_search),200)) || '%'
      or lower(coalesce(p.full_name,'')) like '%' || lower(left(trim(p_search),200)) || '%'
      or p.id::text like '%' || lower(left(trim(p_search),200)) || '%'
    )
  order by lower(coalesce(p.username,'')), p.id
  limit greatest(1,least(coalesce(p_limit,50),100));
$$;

revoke all on function public.admin_search_role_candidates(text,integer) from public;
grant execute on function public.admin_search_role_candidates(text,integer) to authenticated;

create or replace function public.admin_set_user_role(
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
  v_super_admin_count bigint;
begin
  if not public.has_admin_role(array['super_admin']) then
    raise exception 'not authorized';
  end if;

  if p_user_id is null then raise exception 'user id is required'; end if;
  if p_role not in ('user','moderator','admin','super_admin') then
    raise exception 'invalid role';
  end if;
  if not exists(select 1 from auth.users u where u.id = p_user_id) then
    raise exception 'user not found';
  end if;

  select coalesce(ur.role,'user') into v_old_role
  from (select p_user_id as user_id) x
  left join public.user_roles ur on ur.user_id = x.user_id;

  if p_user_id = auth.uid() and p_role is distinct from v_old_role then
    raise exception 'you cannot change your own role';
  end if;

  if v_old_role = 'super_admin' and p_role <> 'super_admin' then
    select count(*) into v_super_admin_count
    from public.user_roles
    where role = 'super_admin';

    if v_super_admin_count <= 1 then
      raise exception 'at least one super admin must remain';
    end if;
  end if;

  insert into public.user_roles(user_id,role,updated_at,updated_by)
  values(p_user_id,p_role,now(),auth.uid())
  on conflict(user_id) do update set
    role = excluded.role,
    updated_at = now(),
    updated_by = auth.uid();

  insert into public.admin_audit_logs(
    admin_id,action,target_type,target_id,old_value,new_value
  ) values (
    auth.uid(),
    'admin_role_changed',
    'user',
    p_user_id::text,
    jsonb_build_object('role',v_old_role),
    jsonb_build_object('role',p_role)
  );
end;
$$;

revoke all on function public.admin_set_user_role(uuid,text) from public;
grant execute on function public.admin_set_user_role(uuid,text) to authenticated;

commit;
