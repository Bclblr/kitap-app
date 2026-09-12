begin;

create table if not exists public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 1 and 120),
  message text not null check (length(trim(message)) between 1 and 1000),
  target_type text not null default 'all' check (target_type in ('all','user','role')),
  target_value text,
  action_route text,
  active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (
    (target_type = 'all' and target_value is null)
    or (target_type = 'user' and target_value is not null)
    or (target_type = 'role' and target_value in ('user','moderator','admin','super_admin'))
  )
);

create table if not exists public.admin_notification_reads (
  notification_id uuid not null references public.admin_notifications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (notification_id, user_id)
);

alter table public.admin_notifications enable row level security;
alter table public.admin_notification_reads enable row level security;

drop policy if exists admin_notifications_admin_read on public.admin_notifications;
create policy admin_notifications_admin_read
on public.admin_notifications for select to authenticated
using (public.has_admin_role(array['admin','super_admin']));

drop policy if exists admin_notifications_admin_write on public.admin_notifications;
create policy admin_notifications_admin_write
on public.admin_notifications for all to authenticated
using (public.has_admin_role(array['admin','super_admin']))
with check (public.has_admin_role(array['admin','super_admin']));

drop policy if exists admin_notification_reads_own on public.admin_notification_reads;
create policy admin_notification_reads_own
on public.admin_notification_reads for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

grant select, insert, update, delete on public.admin_notifications to authenticated;
grant select, insert, update, delete on public.admin_notification_reads to authenticated;

create or replace function public.admin_send_notification(
  p_title text,
  p_message text,
  p_target_type text default 'all',
  p_target_value text default null,
  p_action_route text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.has_admin_role(array['admin','super_admin']) then
    raise exception 'not authorized';
  end if;
  if coalesce(trim(p_title), '') = '' or coalesce(trim(p_message), '') = '' then
    raise exception 'title and message are required';
  end if;
  if p_target_type not in ('all','user','role') then
    raise exception 'invalid target type';
  end if;
  if p_target_type = 'user' then
    if p_target_value is null or not exists(select 1 from public.profiles p where p.id::text = p_target_value) then
      raise exception 'target user not found';
    end if;
  elsif p_target_type = 'role' then
    if p_target_value not in ('user','moderator','admin','super_admin') then
      raise exception 'invalid target role';
    end if;
  else
    p_target_value := null;
  end if;

  insert into public.admin_notifications(title,message,target_type,target_value,action_route,created_by)
  values(trim(p_title),trim(p_message),p_target_type,p_target_value,nullif(trim(coalesce(p_action_route,'')),''),auth.uid())
  returning id into v_id;

  insert into public.admin_audit_logs(admin_id,action,target_type,target_id,new_value)
  values(auth.uid(),'admin_notification_sent','admin_notification',v_id::text,
    jsonb_build_object('title',trim(p_title),'target_type',p_target_type,'target_value',p_target_value));
  return v_id;
end;
$$;

revoke all on function public.admin_send_notification(text,text,text,text,text) from public;
grant execute on function public.admin_send_notification(text,text,text,text,text) to authenticated;

create or replace function public.get_my_admin_notifications(p_limit integer default 100)
returns table(id uuid,title text,message text,action_route text,created_at timestamptz,read boolean)
language sql
security definer
set search_path = ''
as $$
  select n.id,n.title,n.message,n.action_route,n.created_at,(r.user_id is not null) as read
  from public.admin_notifications n
  left join public.admin_notification_reads r on r.notification_id=n.id and r.user_id=auth.uid()
  where auth.uid() is not null and n.active=true and (
    n.target_type='all'
    or (n.target_type='user' and n.target_value=auth.uid()::text)
    or (n.target_type='role' and n.target_value=public.current_app_role())
  )
  order by n.created_at desc
  limit greatest(1,least(coalesce(p_limit,100),200));
$$;

revoke all on function public.get_my_admin_notifications(integer) from public;
grant execute on function public.get_my_admin_notifications(integer) to authenticated;

create or replace function public.mark_admin_notification_read(p_notification_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not exists(select 1 from public.get_my_admin_notifications(200) n where n.id=p_notification_id) then
    raise exception 'notification not available';
  end if;
  insert into public.admin_notification_reads(notification_id,user_id)
  values(p_notification_id,auth.uid()) on conflict(notification_id,user_id) do nothing;
end;
$$;

revoke all on function public.mark_admin_notification_read(uuid) from public;
grant execute on function public.mark_admin_notification_read(uuid) to authenticated;

commit;
