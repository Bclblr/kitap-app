begin;

insert into public.app_settings(key,value,description,public_read)
values
 ('follow_enabled','true'::jsonb,'Kullanıcı takip özelliğini açıp kapatır',true),
 ('home_feed_mode','"balanced"'::jsonb,'Ana akış sıralama modu: balanced/latest',true),
 ('default_content_filter','"standard"'::jsonb,'Varsayılan içerik filtresi: standard/strict/off',true)
on conflict(key) do nothing;

create table if not exists public.profile_admin_controls (
  user_id uuid primary key references auth.users(id) on delete cascade,
  verified boolean not null default false,
  follow_restricted boolean not null default false,
  content_filter_level text not null default 'standard' check(content_filter_level in ('standard','strict','off')),
  note text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
alter table public.profile_admin_controls enable row level security;
drop policy if exists profile_admin_controls_read on public.profile_admin_controls;
create policy profile_admin_controls_read on public.profile_admin_controls for select to authenticated using(true);
drop policy if exists profile_admin_controls_write on public.profile_admin_controls;
create policy profile_admin_controls_write on public.profile_admin_controls for all to authenticated
using(public.has_admin_role(array['admin','super_admin']))
with check(public.has_admin_role(array['admin','super_admin']));
grant select,insert,update,delete on public.profile_admin_controls to authenticated;

create table if not exists public.search_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  query text not null,
  scope text not null default 'all',
  result_count integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists search_events_created_idx on public.search_events(created_at desc);
create index if not exists search_events_query_idx on public.search_events(lower(query));
alter table public.search_events enable row level security;
revoke all on table public.search_events from public,anon,authenticated;

create table if not exists public.admin_config_snapshots (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete restrict,
  label text not null default '',
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.admin_config_snapshots enable row level security;
drop policy if exists admin_config_snapshots_read on public.admin_config_snapshots;
create policy admin_config_snapshots_read on public.admin_config_snapshots for select to authenticated
using(public.has_admin_role(array['admin','super_admin']));
revoke all on table public.admin_config_snapshots from public,anon;
grant select on public.admin_config_snapshots to authenticated;

create or replace function public.runtime_controls()
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_settings jsonb;
  v_announcement jsonb;
  v_restrictions jsonb := '[]'::jsonb;
  v_flags jsonb := '[]'::jsonb;
  v_role text := 'user';
begin
  select coalesce(jsonb_object_agg(s.key,s.value),'{}'::jsonb) into v_settings
  from public.app_settings s where s.public_read=true;

  select to_jsonb(a) into v_announcement
  from public.announcements a
  where a.active=true and a.starts_at<=now() and (a.ends_at is null or a.ends_at>now())
  order by a.starts_at desc limit 1;

  if auth.uid() is not null then
    v_role := public.current_app_role();
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',s.id,'type',s.sanction_type,'reason',s.reason,'starts_at',s.starts_at,'ends_at',s.ends_at
    ) order by s.created_at desc),'[]'::jsonb)
    into v_restrictions
    from public.user_sanctions s
    where s.user_id=auth.uid() and s.active=true and s.starts_at<=now() and (s.ends_at is null or s.ends_at>now());

    select coalesce(jsonb_agg(jsonb_build_object('key',f.key,'enabled',f.enabled)),'[]'::jsonb)
    into v_flags
    from public.feature_flags f
    where f.enabled=true and (
      coalesce(array_length(f.allowed_roles,1),0)=0 and coalesce(array_length(f.allowed_user_ids,1),0)=0
      or v_role=any(f.allowed_roles)
      or auth.uid()=any(f.allowed_user_ids)
    );
  end if;

  return jsonb_build_object(
    'settings',coalesce(v_settings,'{}'::jsonb),
    'announcement',v_announcement,
    'restrictions',v_restrictions,
    'feature_flags',v_flags,
    'role',v_role,
    'profile_control',case when auth.uid() is null then null else (
      select to_jsonb(pc) from public.profile_admin_controls pc where pc.user_id=auth.uid()
    ) end
  );
end;
$$;
revoke all on function public.runtime_controls() from public;
grant execute on function public.runtime_controls() to anon,authenticated;

create or replace function public.log_search_event(p_query text,p_scope text default 'all',p_result_count integer default 0)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare v_q text:=left(trim(coalesce(p_query,'')),200);
begin
  if auth.uid() is null or length(v_q)<2 then return; end if;
  insert into public.search_events(user_id,query,scope,result_count)
  values(auth.uid(),v_q,left(coalesce(nullif(trim(p_scope),''),'all'),40),greatest(coalesce(p_result_count,0),0));
end;
$$;
revoke all on function public.log_search_event(text,text,integer) from public;
grant execute on function public.log_search_event(text,text,integer) to authenticated;

create or replace function public.admin_search_analytics(p_days integer default 30,p_limit integer default 30)
returns table(query text,search_count bigint,unique_users bigint,avg_results numeric,last_searched_at timestamptz)
language sql
security definer
set search_path=''
as $$
  select lower(trim(s.query)),count(*)::bigint,count(distinct s.user_id)::bigint,
    round(avg(s.result_count)::numeric,2),max(s.created_at)
  from public.search_events s
  where public.has_admin_role(array['admin','super_admin'])
    and s.created_at>=now()-(greatest(1,least(coalesce(p_days,30),365))||' days')::interval
  group by lower(trim(s.query))
  order by count(*) desc,max(s.created_at) desc
  limit greatest(1,least(coalesce(p_limit,30),100));
$$;
revoke all on function public.admin_search_analytics(integer,integer) from public;
grant execute on function public.admin_search_analytics(integer,integer) to authenticated;

create or replace function public.admin_list_sanctions(p_search text default '',p_active_only boolean default true,p_limit integer default 100)
returns table(id uuid,user_id uuid,username text,sanction_type text,reason text,starts_at timestamptz,ends_at timestamptz,active boolean,created_by uuid,created_at timestamptz)
language sql
security definer
set search_path=''
as $$
 select s.id,s.user_id,p.username,s.sanction_type,s.reason,s.starts_at,s.ends_at,
   (s.active and s.starts_at<=now() and (s.ends_at is null or s.ends_at>now())) as active,
   s.created_by,s.created_at
 from public.user_sanctions s left join public.profiles p on p.id=s.user_id
 where public.has_admin_role(array['moderator','admin','super_admin'])
   and (not coalesce(p_active_only,true) or (s.active and (s.ends_at is null or s.ends_at>now())))
   and (coalesce(trim(p_search),'')='' or coalesce(p.username,'') ilike '%'||trim(p_search)||'%' or s.user_id::text ilike '%'||trim(p_search)||'%' or s.reason ilike '%'||trim(p_search)||'%')
 order by s.created_at desc limit greatest(1,least(coalesce(p_limit,100),250));
$$;
revoke all on function public.admin_list_sanctions(text,boolean,integer) from public;
grant execute on function public.admin_list_sanctions(text,boolean,integer) to authenticated;

create or replace function public.admin_add_sanction(p_user_id uuid,p_type text,p_reason text default '',p_ends_at timestamptz default null)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare v_id uuid;
begin
 if not public.has_admin_role(array['moderator','admin','super_admin']) then raise exception 'not authorized'; end if;
 if p_type not in ('warning','suspension','ban','comment_restriction','post_restriction','message_restriction','community_restriction') then raise exception 'invalid sanction type'; end if;
 if not exists(select 1 from auth.users u where u.id=p_user_id) then raise exception 'user not found'; end if;
 if p_ends_at is not null and p_ends_at<=now() then raise exception 'end time must be in the future'; end if;
 insert into public.user_sanctions(user_id,sanction_type,reason,ends_at,created_by)
 values(p_user_id,p_type,coalesce(p_reason,''),p_ends_at,auth.uid()) returning id into v_id;
 insert into public.admin_audit_logs(admin_id,action,target_type,target_id,reason,new_value)
 values(auth.uid(),'sanction_added','user',p_user_id::text,coalesce(p_reason,''),jsonb_build_object('sanction_id',v_id,'type',p_type,'ends_at',p_ends_at));
 return v_id;
end;
$$;
revoke all on function public.admin_add_sanction(uuid,text,text,timestamptz) from public;
grant execute on function public.admin_add_sanction(uuid,text,text,timestamptz) to authenticated;

create or replace function public.admin_revoke_sanction(p_sanction_id uuid,p_reason text default '')
returns void
language plpgsql
security definer
set search_path=''
as $$
declare v_old jsonb; v_user uuid;
begin
 if not public.has_admin_role(array['moderator','admin','super_admin']) then raise exception 'not authorized'; end if;
 select to_jsonb(s),s.user_id into v_old,v_user from public.user_sanctions s where s.id=p_sanction_id and s.active=true;
 if v_old is null then raise exception 'active sanction not found'; end if;
 update public.user_sanctions set active=false,revoked_at=now(),revoked_by=auth.uid() where id=p_sanction_id;
 insert into public.admin_audit_logs(admin_id,action,target_type,target_id,reason,old_value,new_value)
 values(auth.uid(),'sanction_revoked','user',v_user::text,coalesce(p_reason,''),v_old,jsonb_build_object('active',false));
end;
$$;
revoke all on function public.admin_revoke_sanction(uuid,text) from public;
grant execute on function public.admin_revoke_sanction(uuid,text) to authenticated;

create or replace function public.admin_list_profile_controls(p_search text default '',p_limit integer default 100)
returns table(user_id uuid,username text,full_name text,verified boolean,follow_restricted boolean,content_filter_level text,note text)
language sql
security definer
set search_path=''
as $$
 select p.id,p.username,p.full_name,coalesce(c.verified,false),coalesce(c.follow_restricted,false),coalesce(c.content_filter_level,'standard'),coalesce(c.note,'')
 from public.profiles p left join public.profile_admin_controls c on c.user_id=p.id
 where public.has_admin_role(array['admin','super_admin'])
  and (coalesce(trim(p_search),'')='' or coalesce(p.username,'') ilike '%'||trim(p_search)||'%' or coalesce(p.full_name,'') ilike '%'||trim(p_search)||'%' or p.id::text ilike '%'||trim(p_search)||'%')
 order by coalesce(c.verified,false) desc,lower(coalesce(p.username,''))
 limit greatest(1,least(coalesce(p_limit,100),200));
$$;
revoke all on function public.admin_list_profile_controls(text,integer) from public;
grant execute on function public.admin_list_profile_controls(text,integer) to authenticated;

create or replace function public.admin_set_profile_control(p_user_id uuid,p_verified boolean,p_follow_restricted boolean,p_content_filter_level text default 'standard',p_note text default '')
returns void
language plpgsql
security definer
set search_path=''
as $$
declare v_old jsonb; v_new jsonb;
begin
 if not public.has_admin_role(array['admin','super_admin']) then raise exception 'not authorized'; end if;
 if p_content_filter_level not in ('standard','strict','off') then raise exception 'invalid filter level'; end if;
 select to_jsonb(c) into v_old from public.profile_admin_controls c where c.user_id=p_user_id;
 insert into public.profile_admin_controls(user_id,verified,follow_restricted,content_filter_level,note,updated_at,updated_by)
 values(p_user_id,coalesce(p_verified,false),coalesce(p_follow_restricted,false),p_content_filter_level,left(coalesce(p_note,''),1000),now(),auth.uid())
 on conflict(user_id) do update set verified=excluded.verified,follow_restricted=excluded.follow_restricted,content_filter_level=excluded.content_filter_level,note=excluded.note,updated_at=now(),updated_by=auth.uid();
 select to_jsonb(c) into v_new from public.profile_admin_controls c where c.user_id=p_user_id;
 insert into public.admin_audit_logs(admin_id,action,target_type,target_id,old_value,new_value)
 values(auth.uid(),'profile_control_updated','user',p_user_id::text,v_old,v_new);
end;
$$;
revoke all on function public.admin_set_profile_control(uuid,boolean,boolean,text,text) from public;
grant execute on function public.admin_set_profile_control(uuid,boolean,boolean,text,text) to authenticated;

create or replace function public.can_follow_user(p_target_user uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
 select auth.uid() is not null
   and coalesce((select (value#>>'{}')::boolean from public.app_settings where key='follow_enabled'),true)
   and not coalesce((select c.follow_restricted from public.profile_admin_controls c where c.user_id=p_target_user),false)
   and not exists(select 1 from public.user_sanctions s where s.user_id=auth.uid() and s.active=true and s.sanction_type in ('ban','suspension') and (s.ends_at is null or s.ends_at>now()));
$$;
revoke all on function public.can_follow_user(uuid) from public;
grant execute on function public.can_follow_user(uuid) to authenticated;

create or replace function public.admin_reported_message_context(p_report_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare v_report public.reports%rowtype; v_message jsonb;
begin
 if not public.has_admin_role(array['moderator','admin','super_admin']) then raise exception 'not authorized'; end if;
 select * into v_report from public.reports where id=p_report_id and target_type='message';
 if not found then raise exception 'reported message not found'; end if;
 if to_regclass('public.messages') is not null then
   execute 'select to_jsonb(m) from public.messages m where m.id::text=$1 limit 1' into v_message using v_report.target_id;
 end if;
 return jsonb_build_object('report',to_jsonb(v_report),'message',v_message);
end;
$$;
revoke all on function public.admin_reported_message_context(uuid) from public;
grant execute on function public.admin_reported_message_context(uuid) to authenticated;

create or replace function public.admin_security_health()
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare v jsonb;
begin
 if not public.has_admin_role(array['admin','super_admin']) then raise exception 'not authorized'; end if;
 select jsonb_build_object(
  'active_sanctions',(select count(*) from public.user_sanctions s where s.active=true and (s.ends_at is null or s.ends_at>now())),
  'pending_reports',(select count(*) from public.reports r where r.status='pending'),
  'super_admins',(select count(*) from public.user_roles u where u.role='super_admin'),
  'admins',(select count(*) from public.user_roles u where u.role='admin'),
  'moderators',(select count(*) from public.user_roles u where u.role='moderator'),
  'audit_24h',(select count(*) from public.admin_audit_logs a where a.created_at>=now()-interval '24 hours'),
  'searches_24h',(select count(*) from public.search_events s where s.created_at>=now()-interval '24 hours'),
  'database_size_bytes',pg_database_size(current_database()),
  'server_time',now()
 ) into v;
 return v;
end;
$$;
revoke all on function public.admin_security_health() from public;
grant execute on function public.admin_security_health() to authenticated;

create or replace function public.admin_create_config_snapshot(p_label text default '')
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare v_id uuid; v_snapshot jsonb;
begin
 if not public.has_admin_role(array['super_admin']) then raise exception 'not authorized'; end if;
 select jsonb_build_object(
  'app_settings',(select coalesce(jsonb_agg(to_jsonb(s)),'[]'::jsonb) from public.app_settings s),
  'feature_flags',(select coalesce(jsonb_agg(to_jsonb(f)),'[]'::jsonb) from public.feature_flags f),
  'profile_controls',(select coalesce(jsonb_agg(to_jsonb(c)),'[]'::jsonb) from public.profile_admin_controls c),
  'user_roles',(select coalesce(jsonb_agg(jsonb_build_object('user_id',u.user_id,'role',u.role)),'[]'::jsonb) from public.user_roles u)
 ) into v_snapshot;
 insert into public.admin_config_snapshots(created_by,label,snapshot) values(auth.uid(),left(coalesce(p_label,''),200),v_snapshot) returning id into v_id;
 insert into public.admin_audit_logs(admin_id,action,target_type,target_id,new_value)
 values(auth.uid(),'config_snapshot_created','system',v_id::text,jsonb_build_object('label',left(coalesce(p_label,''),200)));
 return v_id;
end;
$$;
revoke all on function public.admin_create_config_snapshot(text) from public;
grant execute on function public.admin_create_config_snapshot(text) to authenticated;

commit;
