begin;

create index if not exists messages_conversation_created_id_idx
  on public.messages (conversation_id, created_at desc, id desc);

create index if not exists messages_unread_conversation_created_idx
  on public.messages (conversation_id, created_at desc)
  where is_read = false;

create or replace function public.get_my_inbox(p_limit integer default 100)
returns table (
  conversation_id uuid,
  other_user_id uuid,
  last_message text,
  last_message_at timestamptz,
  conversation_updated_at timestamptz,
  unread_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with mine as (
    select
      c.id,
      case
        when c.user1_id = (select auth.uid()) then c.user2_id
        else c.user1_id
      end as other_user_id,
      c.updated_at,
      h.hidden_at
    from public.conversations c
    left join public.conversation_hidden h
      on h.conversation_id = c.id
     and h.user_id = (select auth.uid())
    where (select auth.uid()) is not null
      and (
        c.user1_id = (select auth.uid())
        or c.user2_id = (select auth.uid())
      )
  )
  select
    mine.id as conversation_id,
    mine.other_user_id,
    latest.content as last_message,
    latest.created_at as last_message_at,
    mine.updated_at as conversation_updated_at,
    coalesce(unread.unread_count, 0)::bigint as unread_count
  from mine
  left join lateral (
    select m.content, m.created_at
    from public.messages m
    where m.conversation_id = mine.id
      and (
        mine.hidden_at is null
        or m.created_at > mine.hidden_at
      )
    order by m.created_at desc, m.id desc
    limit 1
  ) latest on true
  left join lateral (
    select count(*)::bigint as unread_count
    from public.messages m
    where m.conversation_id = mine.id
      and m.is_read = false
      and m.sender_id <> (select auth.uid())
      and (
        mine.hidden_at is null
        or m.created_at > mine.hidden_at
      )
  ) unread on true
  where mine.hidden_at is null
     or latest.created_at is not null
  order by coalesce(latest.created_at, mine.updated_at) desc
  limit greatest(1, least(coalesce(p_limit, 100), 200));
$$;

revoke all on function public.get_my_inbox(integer) from public, anon;
grant execute on function public.get_my_inbox(integer) to authenticated;

comment on function public.get_my_inbox(integer) is
'Returns the authenticated users inbox summary with the latest visible message and unread count calculated server-side under existing RLS.';

commit;
