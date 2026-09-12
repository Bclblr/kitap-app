begin;

create or replace function public.enforce_sanction_insert()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare v_type text:=coalesce(TG_ARGV[0],'');
begin
  if auth.uid() is null then return new; end if;
  if public.has_admin_role(array['moderator','admin','super_admin']) then return new; end if;
  if exists(
    select 1 from public.user_sanctions s
    where s.user_id=auth.uid() and s.active=true and s.starts_at<=now()
      and (s.ends_at is null or s.ends_at>now())
      and s.sanction_type in ('ban','suspension',v_type)
  ) then
    raise exception 'Bu işlem hesabın için kısıtlandı';
  end if;
  return new;
end;
$$;

create or replace function public.enforce_follow_insert()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare v_enabled boolean:=true;
begin
  if auth.uid() is null then return new; end if;
  if public.has_admin_role(array['moderator','admin','super_admin']) then return new; end if;
  select coalesce((s.value#>>'{}')::boolean,true) into v_enabled from public.app_settings s where s.key='follow_enabled';
  if not coalesce(v_enabled,true) then raise exception 'Takip özelliği geçici olarak kapalı'; end if;
  if exists(select 1 from public.profile_admin_controls c where c.user_id=new.following_id and c.follow_restricted=true) then
    raise exception 'Bu kullanıcı için takip geçici olarak kısıtlı';
  end if;
  if exists(select 1 from public.user_sanctions s where s.user_id=auth.uid() and s.active=true and s.starts_at<=now() and (s.ends_at is null or s.ends_at>now()) and s.sanction_type in ('ban','suspension')) then
    raise exception 'Takip işlemi hesabın için kısıtlandı';
  end if;
  return new;
end;
$$;

create or replace function public.enforce_creation_setting()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare v_key text:=coalesce(TG_ARGV[0],''); v_enabled boolean:=true; v_restriction text:=coalesce(TG_ARGV[1],'');
begin
  if auth.uid() is null then return new; end if;
  if public.has_admin_role(array['moderator','admin','super_admin']) then return new; end if;
  if v_key<>'' then
    select coalesce((s.value#>>'{}')::boolean,true) into v_enabled from public.app_settings s where s.key=v_key;
    if not coalesce(v_enabled,true) then raise exception 'Bu özellik geçici olarak kapalı'; end if;
  end if;
  if exists(select 1 from public.user_sanctions s where s.user_id=auth.uid() and s.active=true and s.starts_at<=now() and (s.ends_at is null or s.ends_at>now()) and (s.sanction_type in ('ban','suspension') or (v_restriction<>'' and s.sanction_type=v_restriction))) then
    raise exception 'Bu işlem hesabın için kısıtlandı';
  end if;
  return new;
end;
$$;

-- Restriction triggers are additive and only created when the target table exists.
do $$ begin
  if to_regclass('public.posts') is not null then
    execute 'drop trigger if exists enforce_post_restriction on public.posts';
    execute 'create trigger enforce_post_restriction before insert on public.posts for each row execute function public.enforce_sanction_insert(''post_restriction'')';
  end if;
  if to_regclass('public.reviews') is not null then
    execute 'drop trigger if exists enforce_review_restriction on public.reviews';
    execute 'create trigger enforce_review_restriction before insert on public.reviews for each row execute function public.enforce_sanction_insert(''post_restriction'')';
  end if;
  if to_regclass('public.quotes') is not null then
    execute 'drop trigger if exists enforce_quote_restriction on public.quotes';
    execute 'create trigger enforce_quote_restriction before insert on public.quotes for each row execute function public.enforce_sanction_insert(''post_restriction'')';
  end if;
  if to_regclass('public.post_comments') is not null then
    execute 'drop trigger if exists enforce_post_comment_restriction on public.post_comments';
    execute 'create trigger enforce_post_comment_restriction before insert on public.post_comments for each row execute function public.enforce_sanction_insert(''comment_restriction'')';
  end if;
  if to_regclass('public.comments') is not null then
    execute 'drop trigger if exists enforce_comment_restriction on public.comments';
    execute 'create trigger enforce_comment_restriction before insert on public.comments for each row execute function public.enforce_sanction_insert(''comment_restriction'')';
  end if;
  if to_regclass('public.messages') is not null then
    execute 'drop trigger if exists enforce_message_restriction on public.messages';
    execute 'create trigger enforce_message_restriction before insert on public.messages for each row execute function public.enforce_sanction_insert(''message_restriction'')';
  end if;
  if to_regclass('public.follows') is not null then
    execute 'drop trigger if exists enforce_follow_control on public.follows';
    execute 'create trigger enforce_follow_control before insert or update of following_id on public.follows for each row execute function public.enforce_follow_insert()';
  end if;
  if to_regclass('public.communities') is not null then
    execute 'drop trigger if exists enforce_community_creation on public.communities';
    execute 'create trigger enforce_community_creation before insert on public.communities for each row execute function public.enforce_creation_setting(''community_creation_enabled'',''community_restriction'')';
  end if;
  if to_regclass('public.events') is not null then
    execute 'drop trigger if exists enforce_event_creation on public.events';
    execute 'create trigger enforce_event_creation before insert on public.events for each row execute function public.enforce_creation_setting(''event_creation_enabled'',''community_restriction'')';
  end if;
end $$;

-- Hidden/restricted admin controls are enforced at read time using restrictive RLS policies.
do $$ begin
  if to_regclass('public.events') is not null and to_regclass('public.event_admin_controls') is not null then
    execute 'drop policy if exists admin_event_visibility_restrictive on public.events';
    execute 'create policy admin_event_visibility_restrictive on public.events as restrictive for select to authenticated using (public.has_admin_role() or not exists(select 1 from public.event_admin_controls c where c.event_id=events.id and (c.hidden or c.cancelled)))';
  end if;
  if to_regclass('public.communities') is not null and to_regclass('public.community_admin_controls') is not null then
    execute 'drop policy if exists admin_community_visibility_restrictive on public.communities';
    execute 'create policy admin_community_visibility_restrictive on public.communities as restrictive for select to authenticated using (public.has_admin_role() or not exists(select 1 from public.community_admin_controls c where c.community_id=communities.id and c.restricted))';
  end if;
end $$;

create or replace function public.admin_visible_hashtags()
returns table(tag text,blocked boolean,featured boolean,priority integer)
language sql
stable
security definer
set search_path=''
as $$
  select h.tag,h.blocked,h.featured,h.priority
  from public.hashtag_controls h
  where public.has_admin_role() or not h.blocked
  order by h.featured desc,h.priority desc,h.tag;
$$;
revoke all on function public.admin_visible_hashtags() from public;
grant execute on function public.admin_visible_hashtags() to authenticated;

commit;
