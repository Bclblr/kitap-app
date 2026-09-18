begin;

create or replace function public.get_reader_directory(
  p_target uuid default null,
  p_mode text default null,
  p_query text default null,
  p_offset integer default 0,
  p_limit integer default 30
)
returns table (
  id uuid,
  username text,
  full_name text,
  profile_image text,
  is_private boolean,
  request_pending boolean,
  is_following boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  with candidates as (
    select distinct
      p.id,
      p.username,
      p.full_name,
      p.profile_image
    from public.profiles p
    left join public.follows ff
      on p_mode = 'followers'
     and ff.following_id = p_target
     and ff.follower_id = p.id
    left join public.follows fg
      on p_mode = 'following'
     and fg.follower_id = p_target
     and fg.following_id = p.id
    left join public.profile_privacy_settings privacy
      on privacy.user_id = p.id
    where
      (
        p_mode is null
        or (p_mode = 'followers' and ff.id is not null)
        or (p_mode = 'following' and fg.id is not null)
      )
      and (
        p_mode is not null
        or coalesce(privacy.discoverable, true) = true
      )
      and (
        nullif(btrim(coalesce(p_query, '')), '') is null
        or p.username ilike '%' || btrim(p_query) || '%'
        or p.full_name ilike '%' || btrim(p_query) || '%'
      )
  )
  select
    c.id,
    c.username,
    c.full_name,
    c.profile_image,
    coalesce(privacy.is_private, false) as is_private,
    exists (
      select 1
      from public.follow_requests fr
      where fr.requester_id = (select auth.uid())
        and fr.target_id = c.id
    ) as request_pending,
    exists (
      select 1
      from public.follows f
      where f.follower_id = (select auth.uid())
        and f.following_id = c.id
    ) as is_following
  from candidates c
  left join public.profile_privacy_settings privacy
    on privacy.user_id = c.id
  order by lower(coalesce(c.username, '')), c.id
  offset greatest(coalesce(p_offset, 0), 0)
  limit greatest(1, least(coalesce(p_limit, 30), 100));
$$;

revoke all on function public.get_reader_directory(uuid, text, text, integer, integer)
  from public, anon;
grant execute on function public.get_reader_directory(uuid, text, text, integer, integer)
  to authenticated;

create or replace function public.get_profile_content_stats(p_target uuid)
returns table (
  review_count bigint,
  quote_count bigint,
  book_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    (select count(*) from public.reviews r where r.user_id = p_target)::bigint,
    (select count(*) from public.quotes q where q.user_id = p_target)::bigint,
    (
      select count(distinct book_key)
      from (
        select r.book_key from public.reviews r where r.user_id = p_target and r.book_key is not null
        union all
        select q.book_key from public.quotes q where q.user_id = p_target and q.book_key is not null
        union all
        select p.book_key from public.posts p where p.user_id = p_target and p.book_key is not null
      ) books
    )::bigint;
$$;

revoke all on function public.get_profile_content_stats(uuid) from public, anon;
grant execute on function public.get_profile_content_stats(uuid) to authenticated;

create or replace function public.get_my_shelf_counts()
returns table (
  want_count bigint,
  reading_count bigint,
  read_count bigint,
  total_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $
  select
    count(*) filter (where status = 'want')::bigint,
    count(*) filter (where status = 'reading')::bigint,
    count(*) filter (where status = 'read')::bigint,
    count(*)::bigint
  from public.user_book_status
  where user_id = (select auth.uid());
$;

revoke all on function public.get_my_shelf_counts() from public, anon;
grant execute on function public.get_my_shelf_counts() to authenticated;

commit;
