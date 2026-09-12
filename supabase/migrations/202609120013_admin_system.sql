begin;

insert into public.app_settings(key,value,description,public_read)
values
 ('minimum_app_version','"1.0.0"'::jsonb,'Desteklenen minimum uygulama sürümü',true),
 ('latest_app_version','"1.0.0"'::jsonb,'Yayınlanan en güncel uygulama sürümü',true),
 ('force_update_enabled','false'::jsonb,'Minimum sürüm altındaki istemcilerde zorunlu güncellemeyi açar',true)
on conflict(key) do nothing;

create or replace function public.admin_list_system_settings()
returns table (
  key text,
  value jsonb,
  description text,
  public_read boolean,
  updated_at timestamptz,
  updated_by uuid
)
language sql
security definer
set search_path = ''
as $$
  select s.key,s.value,s.description,s.public_read,s.updated_at,s.updated_by
  from public.app_settings s
  where public.has_admin_role(array['admin','super_admin'])
  order by s.key;
$$;

revoke all on function public.admin_list_system_settings() from public;
grant execute on function public.admin_list_system_settings() to authenticated;

create or replace function public.admin_set_system_setting(
  p_key text,
  p_value jsonb,
  p_description text default null,
  p_public_read boolean default null
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
  if coalesce(trim(p_key),'')='' then raise exception 'setting key is required'; end if;
  if p_value is null then raise exception 'setting value is required'; end if;

  select to_jsonb(s) into v_old from public.app_settings s where s.key=trim(p_key);

  insert into public.app_settings(key,value,description,public_read,updated_at,updated_by)
  values(
    trim(p_key),p_value,coalesce(p_description,''),coalesce(p_public_read,false),now(),auth.uid()
  )
  on conflict(key) do update set
    value=excluded.value,
    description=coalesce(p_description,public.app_settings.description),
    public_read=coalesce(p_public_read,public.app_settings.public_read),
    updated_at=now(),
    updated_by=auth.uid();

  select to_jsonb(s) into v_new from public.app_settings s where s.key=trim(p_key);

  insert into public.admin_audit_logs(admin_id,action,target_type,target_id,old_value,new_value)
  values(auth.uid(),'system_setting_updated','app_setting',trim(p_key),v_old,v_new);
end;
$$;

revoke all on function public.admin_set_system_setting(text,jsonb,text,boolean) from public;
grant execute on function public.admin_set_system_setting(text,jsonb,text,boolean) to authenticated;

create or replace function public.admin_list_feature_flags()
returns table (
  key text,
  enabled boolean,
  description text,
  allowed_roles text[],
  allowed_user_ids uuid[],
  updated_at timestamptz,
  updated_by uuid
)
language sql
security definer
set search_path = ''
as $$
  select f.key,f.enabled,f.description,f.allowed_roles,f.allowed_user_ids,f.updated_at,f.updated_by
  from public.feature_flags f
  where public.has_admin_role(array['admin','super_admin'])
  order by f.key;
$$;

revoke all on function public.admin_list_feature_flags() from public;
grant execute on function public.admin_list_feature_flags() to authenticated;

create or replace function public.admin_save_feature_flag(
  p_key text,
  p_enabled boolean default false,
  p_description text default '',
  p_allowed_roles text[] default '{}',
  p_allowed_user_ids uuid[] default '{}'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_role text;
begin
  if not public.has_admin_role(array['admin','super_admin']) then
    raise exception 'not authorized';
  end if;
  if coalesce(trim(p_key),'')='' then raise exception 'flag key is required'; end if;

  foreach v_role in array coalesce(p_allowed_roles,'{}'::text[]) loop
    if v_role not in ('user','moderator','admin','super_admin') then
      raise exception 'invalid allowed role: %',v_role;
    end if;
  end loop;

  select to_jsonb(f) into v_old from public.feature_flags f where f.key=trim(p_key);

  insert into public.feature_flags(key,enabled,description,allowed_roles,allowed_user_ids,updated_at,updated_by)
  values(
    trim(p_key),coalesce(p_enabled,false),trim(coalesce(p_description,'')),
    coalesce(p_allowed_roles,'{}'::text[]),coalesce(p_allowed_user_ids,'{}'::uuid[]),now(),auth.uid()
  )
  on conflict(key) do update set
    enabled=excluded.enabled,
    description=excluded.description,
    allowed_roles=excluded.allowed_roles,
    allowed_user_ids=excluded.allowed_user_ids,
    updated_at=now(),
    updated_by=auth.uid();

  select to_jsonb(f) into v_new from public.feature_flags f where f.key=trim(p_key);

  insert into public.admin_audit_logs(admin_id,action,target_type,target_id,old_value,new_value)
  values(auth.uid(),'feature_flag_saved','feature_flag',trim(p_key),v_old,v_new);
end;
$$;

revoke all on function public.admin_save_feature_flag(text,boolean,text,text[],uuid[]) from public;
grant execute on function public.admin_save_feature_flag(text,boolean,text,text[],uuid[]) to authenticated;

create or replace function public.admin_delete_feature_flag(p_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_old jsonb;
begin
  if not public.has_admin_role(array['admin','super_admin']) then raise exception 'not authorized'; end if;
  select to_jsonb(f) into v_old from public.feature_flags f where f.key=trim(p_key);
  if v_old is null then raise exception 'feature flag not found'; end if;
  delete from public.feature_flags where key=trim(p_key);
  insert into public.admin_audit_logs(admin_id,action,target_type,target_id,old_value)
  values(auth.uid(),'feature_flag_deleted','feature_flag',trim(p_key),v_old);
end;
$$;

revoke all on function public.admin_delete_feature_flag(text) from public;
grant execute on function public.admin_delete_feature_flag(text) to authenticated;

commit;
