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
security definer
set search_path = ''
as $$
  with viewer as (
    select auth.uid() as id
  ),
  candidates as (
    select distinct
      p.id,
      p.username,
      p.full_name,
      p.profile_image,
      coalesce(privacy.is_private, false) as is_private
    from public.profiles p
    cross join viewer v
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
      v.id is not null
      and (
        p_mode is null
        or (p_mode = 'followers' and ff.id is not null)
        or (p_mode = 'following' and fg.id is not null)
      )
      and (
        p_mode is not null
        or p.id = v.id
        or coalesce(privacy.discoverable, true) = true
      )
      and not exists (
        select 1
        from public.user_blocks b
        where
          (b.blocker_id = v.id and b.blocked_id = p.id)
          or
          (b.blocker_id = p.id and b.blocked_id = v.id)
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
    c.is_private,
    exists (
      select 1
      from public.follow_requests fr
      where fr.requester_id = (select id from viewer)
        and fr.target_id = c.id
    ) as request_pending,
    exists (
      select 1
      from public.follows f
      where f.follower_id = (select id from viewer)
        and f.following_id = c.id
    ) as is_following
  from candidates c
  order by lower(coalesce(c.username, '')), c.id
  offset greatest(coalesce(p_offset, 0), 0)
  limit greatest(1, least(coalesce(p_limit, 30), 100));
$$;

revoke all
on function public.get_reader_directory(uuid, text, text, integer, integer)
from public, anon;

grant execute
on function public.get_reader_directory(uuid, text, text, integer, integer)
to authenticated;

comment on function public.get_reader_directory(uuid, text, text, integer, integer) is
'Authenticated reader directory. Privacy settings are evaluated server-side so RLS on profile_privacy_settings cannot cause hidden users to be treated as discoverable/public.';

commit;
