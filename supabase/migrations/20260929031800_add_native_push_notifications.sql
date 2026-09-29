-- Native push notifications via Expo Push Service.
-- Tokens are user-owned; delivery functions are internal SECURITY DEFINER helpers.

create extension if not exists pg_net with schema extensions;

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expo_push_token text not null unique,
  platform text not null check (platform in ('ios','android')),
  device_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

alter table public.push_tokens enable row level security;
revoke all on public.push_tokens from anon;
grant select, insert, update, delete on public.push_tokens to authenticated;

drop policy if exists push_tokens_select_own on public.push_tokens;
create policy push_tokens_select_own on public.push_tokens
for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists push_tokens_insert_own on public.push_tokens;
create policy push_tokens_insert_own on public.push_tokens
for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists push_tokens_update_own on public.push_tokens;
create policy push_tokens_update_own on public.push_tokens
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists push_tokens_delete_own on public.push_tokens;
create policy push_tokens_delete_own on public.push_tokens
for delete to authenticated using ((select auth.uid()) = user_id);

create index if not exists push_tokens_user_id_idx on public.push_tokens(user_id);

create or replace function public.register_push_token(p_token text,p_platform text,p_device_name text default null)
returns void language plpgsql security definer set search_path=''
as $$
declare v_user_id uuid:=auth.uid(); v_token text:=trim(coalesce(p_token,''));
begin
  if v_user_id is null then raise exception 'authentication required'; end if;
  if p_platform not in ('ios','android') then raise exception 'invalid platform'; end if;
  if length(v_token)<20 or length(v_token)>512 then raise exception 'invalid push token'; end if;
  insert into public.push_tokens(user_id,expo_push_token,platform,device_name,last_seen_at,updated_at)
  values(v_user_id,v_token,p_platform,nullif(left(trim(coalesce(p_device_name,'')),120),''),now(),now())
  on conflict(expo_push_token) do update
  set user_id=excluded.user_id,platform=excluded.platform,device_name=excluded.device_name,last_seen_at=now(),updated_at=now();
end $$;
revoke all on function public.register_push_token(text,text,text) from public,anon;
grant execute on function public.register_push_token(text,text,text) to authenticated;

create or replace function public.unregister_push_token(p_token text)
returns void language sql security definer set search_path=''
as $$ delete from public.push_tokens where user_id=auth.uid() and expo_push_token=trim(coalesce(p_token,'')); $$;
revoke all on function public.unregister_push_token(text) from public,anon;
grant execute on function public.unregister_push_token(text) to authenticated;

create or replace function public.dispatch_expo_push(
  p_user_id uuid,p_title text,p_body text,p_url text default '/notifications',
  p_preference text default null,p_data jsonb default '{}'::jsonb
) returns void language plpgsql security definer set search_path=''
as $$
declare v_enabled boolean:=true; v_payload jsonb;
begin
  if p_user_id is null or coalesce(trim(p_body),'')='' then return; end if;
  if p_preference is not null then
    select case p_preference
      when 'likes' then coalesce(np.likes_enabled,true)
      when 'comments' then coalesce(np.comments_enabled,true)
      when 'reposts' then coalesce(np.reposts_enabled,true)
      when 'follows' then coalesce(np.follows_enabled,true)
      when 'messages' then coalesce(np.messages_enabled,true)
      when 'system' then coalesce(np.system_enabled,true)
      else true end
    into v_enabled
    from (select 1) seed left join public.notification_preferences np on np.user_id=p_user_id;
  end if;
  if not coalesce(v_enabled,true) then return; end if;

  select jsonb_agg(jsonb_build_object(
    'to',pt.expo_push_token,'title',left(coalesce(nullif(trim(p_title),''),'Kitap'),100),
    'body',left(trim(p_body),500),'sound','default','priority','high','channelId','kitap-social',
    'data',coalesce(p_data,'{}'::jsonb)||jsonb_build_object('url',coalesce(nullif(p_url,''),'/notifications'))
  )) into v_payload
  from public.push_tokens pt where pt.user_id=p_user_id;

  if v_payload is null then return; end if;
  perform net.http_post(
    url:='https://exp.host/--/api/v2/push/send', body:=v_payload,
    headers:='{"Content-Type":"application/json","Accept":"application/json"}'::jsonb,
    timeout_milliseconds:=5000
  );
end $$;
revoke all on function public.dispatch_expo_push(uuid,text,text,text,text,jsonb) from public,anon,authenticated;

create or replace function public.push_on_interaction_notification()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_actor_name text; v_pref text; v_url text:='/notifications';
begin
  if new.active is false then return new; end if;
  if tg_op='UPDATE' and old.active is not distinct from true then return new; end if;
  select coalesce(nullif(p.full_name,''),nullif(p.username,''),'Bir okur') into v_actor_name
  from public.profiles p where p.id=new.actor_id;
  v_pref:=case new.type when 'like' then 'likes' when 'comment' then 'comments' when 'repost' then 'reposts' else null end;
  if new.target_type in ('post','review','quote') and new.target_id is not null then
    v_url:='/content?type='||new.target_type||'&id='||new.target_id::text;
  end if;
  perform public.dispatch_expo_push(new.user_id,coalesce(v_actor_name,'Kitap'),
    coalesce(new.message,'Yeni bir bildirimin var.'),v_url,v_pref,
    jsonb_build_object('kind','interaction','notificationId',new.id,'targetType',new.target_type,'targetId',new.target_id));
  return new;
end $$;
revoke all on function public.push_on_interaction_notification() from public,anon,authenticated;
drop trigger if exists push_interaction_notification_after_insert on public.notifications;
drop trigger if exists push_interaction_notification_after_change on public.notifications;
create trigger push_interaction_notification_after_change
after insert or update of active on public.notifications
for each row execute function public.push_on_interaction_notification();

create or replace function public.push_on_social_notification()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_actor_name text;
begin
  select coalesce(nullif(p.full_name,''),nullif(p.username,''),'Bir okur') into v_actor_name
  from public.profiles p where p.id=new.actor_id;
  perform public.dispatch_expo_push(new.user_id,coalesce(v_actor_name,'Kitap'),
    coalesce(new.message,'Yeni bir takip bildirimin var.'),'/notifications','follows',
    jsonb_build_object('kind','social','notificationId',new.id,'type',new.type));
  return new;
end $$;
revoke all on function public.push_on_social_notification() from public,anon,authenticated;
drop trigger if exists push_social_notification_after_insert on public.social_notifications;
create trigger push_social_notification_after_insert after insert on public.social_notifications
for each row execute function public.push_on_social_notification();

create or replace function public.push_on_message()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_recipient uuid; v_sender_name text; v_url text;
begin
  select case when c.user1_id=new.sender_id then c.user2_id else c.user1_id end into v_recipient
  from public.conversations c where c.id=new.conversation_id and new.sender_id in(c.user1_id,c.user2_id);
  if v_recipient is null or v_recipient=new.sender_id then return new; end if;
  select coalesce(nullif(p.full_name,''),nullif(p.username,''),'Bir okur') into v_sender_name
  from public.profiles p where p.id=new.sender_id;
  v_url:='/chat?conversationId='||new.conversation_id::text||'&userId='||new.sender_id::text;
  perform public.dispatch_expo_push(v_recipient,coalesce(v_sender_name,'Yeni mesaj'),
    case when length(trim(coalesce(new.content,'')))>120 then left(trim(new.content),117)||'...'
         when trim(coalesce(new.content,''))='' then 'Sana yeni bir mesaj gönderdi.' else trim(new.content) end,
    v_url,'messages',jsonb_build_object('kind','message','conversationId',new.conversation_id,'messageId',new.id,'senderId',new.sender_id));
  return new;
end $$;
revoke all on function public.push_on_message() from public,anon,authenticated;
drop trigger if exists push_message_after_insert on public.messages;
create trigger push_message_after_insert after insert on public.messages
for each row execute function public.push_on_message();

create or replace function public.push_on_admin_notification()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_user_id uuid;
begin
  if new.active is false then return new; end if;
  if new.target_type='user' then
    begin v_user_id:=new.target_value::uuid; exception when invalid_text_representation then return new; end;
    perform public.dispatch_expo_push(v_user_id,coalesce(new.title,'Kitap'),new.message,
      case when coalesce(new.action_route,'') like '/%' then new.action_route else '/notifications' end,
      'system',jsonb_build_object('kind','system','notificationId',new.id));
  elsif new.target_type in('all','everyone') then
    for v_user_id in select distinct pt.user_id from public.push_tokens pt loop
      perform public.dispatch_expo_push(v_user_id,coalesce(new.title,'Kitap'),new.message,
        case when coalesce(new.action_route,'') like '/%' then new.action_route else '/notifications' end,
        'system',jsonb_build_object('kind','system','notificationId',new.id));
    end loop;
  end if;
  return new;
end $$;
revoke all on function public.push_on_admin_notification() from public,anon,authenticated;
drop trigger if exists push_admin_notification_after_insert on public.admin_notifications;
create trigger push_admin_notification_after_insert after insert on public.admin_notifications
for each row execute function public.push_on_admin_notification();
