begin;
create or replace function public.readers_blocked(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $access_readers_blocked$
  select case
    when auth.uid() is null then false
    when auth.uid() <> a and auth.uid() <> b then false
    else exists (
      select 1
      from public.user_blocks
      where (blocker_id = a and blocked_id = b)
         or (blocker_id = b and blocked_id = a)
    )
  end;
$access_readers_blocked$;

revoke all on function public.readers_blocked(uuid, uuid) from public;
grant execute on function public.readers_blocked(uuid, uuid) to authenticated;
-- Existing discovery RPC must obey the caller's RLS rather than exposing private clubs.
do $$ declare fn record; begin
 for fn in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on p.pronamespace=n.oid where n.nspname='public' and p.proname='get_discover_communities'
 loop execute format('alter function %s security invoker',fn.signature); end loop;
end $$;
-- Participants may acknowledge receipt, never impersonate senders or move messages.
create or replace function public.reader_message_immutable()
returns trigger
language plpgsql
set search_path = ''
as $reader_message_immutable$
begin
  if new.id is distinct from old.id
     or new.conversation_id is distinct from old.conversation_id
     or new.sender_id is distinct from old.sender_id
     or new.created_at is distinct from old.created_at
     or new.content is distinct from old.content then
    raise exception 'Message identity and content cannot be changed';
  end if;

  if auth.uid() = old.sender_id
     and new.is_read is distinct from old.is_read then
    raise exception 'Only recipient can mark messages read';
  end if;

  return new;
end;
$reader_message_immutable$;
drop trigger if exists reader_message_immutable on public.messages;
create trigger reader_message_immutable before update on public.messages for each row execute function public.reader_message_immutable();
create or replace function public.reader_conversation_immutable()
returns trigger
language plpgsql
set search_path = ''
as $reader_conversation_immutable$
begin
  if new.id is distinct from old.id
     or new.user1_id is distinct from old.user1_id
     or new.user2_id is distinct from old.user2_id then
    raise exception 'Conversation participants cannot change';
  end if;

  return new;
end;
$reader_conversation_immutable$;
drop trigger if exists reader_conversation_immutable on public.conversations;
create trigger reader_conversation_immutable before update on public.conversations for each row execute function public.reader_conversation_immutable();
-- Restrict author ownership even when a legacy permissive policy already exists.
drop policy if exists community_create_guard on public.communities;
create policy community_create_guard on public.communities as restrictive for insert to authenticated with check(created_by=auth.uid() and visibility in('public','private') and kind in('community','book_club'));
drop policy if exists community_delete_guard on public.communities;
create policy community_delete_guard on public.communities as restrictive for delete to authenticated using(created_by=auth.uid());
do $$ begin
 if to_regclass('public.community_posts') is not null then
  drop policy if exists community_post_delete_guard on public.community_posts;
  create policy community_post_delete_guard on public.community_posts as restrictive for delete using(user_id=auth.uid() or public.community_admin(community_id));
  drop policy if exists community_post_update_guard on public.community_posts;
  create policy community_post_update_guard on public.community_posts as restrictive for update using(user_id=auth.uid()) with check(user_id=auth.uid());
 end if;
 if to_regclass('public.community_post_comments') is not null then
  drop policy if exists community_comment_delete_guard on public.community_post_comments;
  create policy community_comment_delete_guard on public.community_post_comments as restrictive for delete using(user_id=auth.uid() or exists(select 1 from public.community_posts p where p.id=post_id and public.community_admin(p.community_id)));
  drop policy if exists community_comment_update_guard on public.community_post_comments;
  create policy community_comment_update_guard on public.community_post_comments as restrictive for update using(user_id=auth.uid()) with check(user_id=auth.uid());
 end if;
 if to_regclass('public.community_post_likes') is not null then
  drop policy if exists community_like_delete_guard on public.community_post_likes;
  create policy community_like_delete_guard on public.community_post_likes as restrictive for delete using(user_id=auth.uid());
 end if;
end $$;
do $$ declare target text; begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  foreach target in array array['follows','user_blocks'] loop
   if to_regclass('public.' || target) is not null and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=target) then
    execute format('alter publication supabase_realtime add table public.%I',target);
   end if;
  end loop;
 end if;
end $$;
commit;
