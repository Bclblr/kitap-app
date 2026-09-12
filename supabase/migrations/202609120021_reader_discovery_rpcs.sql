begin;

create or replace function public.get_discover_communities(p_limit integer default 6)
returns table(id uuid, name text, description text, image_url text, member_count bigint, is_member boolean, created_at timestamptz)
language sql
set search_path to ''
as $function$
  select
    c.id,
    c.name,
    c.description,
    c.image_url,
    count(cm.user_id)::bigint as member_count,
    exists (
      select 1
      from public.community_members my_membership
      where my_membership.community_id = c.id
        and my_membership.user_id = auth.uid()
    ) as is_member,
    c.created_at
  from public.communities c
  left join public.community_members cm
    on cm.community_id = c.id
  where auth.uid() is not null
  group by c.id, c.name, c.description, c.image_url, c.created_at
  order by count(cm.user_id) desc, c.created_at desc
  limit greatest(1, least(coalesce(p_limit, 6), 20));
$function$;

create or replace function public.get_event_attendees(p_event_id uuid)
returns table(user_id uuid, username text, profile_image text)
language sql
security definer
set search_path to ''
as $function$
  select
    ea.user_id,
    coalesce(p.username, 'Kitap Okuru') as username,
    p.profile_image
  from public.event_attendees ea
  left join public.profiles p
    on p.id = ea.user_id
  where ea.event_id = p_event_id
  order by ea.created_at asc;
$function$;

create or replace function public.get_hashtag_content(
  p_hashtag text,
  p_limit integer default 20,
  p_before timestamptz default null
)
returns table(
  content_id uuid,
  content_type text,
  user_id uuid,
  username text,
  profile_image text,
  text text,
  image_url text,
  book_key text,
  book_title text,
  rating numeric,
  created_at timestamptz,
  likes_count bigint,
  comments_count bigint,
  reposts_count bigint
)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_hashtag text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  v_hashtag := lower(
    translate(
      regexp_replace(trim(p_hashtag), '^#', ''),
      'ÇĞİIÖŞÜ',
      'çğiıöşü'
    )
  );

  return query
  with post_hashtags as (
    select distinct on (p.id)
      p.id as content_id,
      'post'::text as content_type,
      p.user_id,
      coalesce(pr.username, 'Kullanıcı')::text as username,
      pr.profile_image::text as profile_image,
      coalesce(p.text, '')::text as text,
      p.image_url::text as image_url,
      p.book_key::text as book_key,
      p.book_title::text as book_title,
      p.rating::numeric as rating,
      p.created_at
    from public.posts p
    left join public.profiles pr on pr.id = p.user_id
    cross join lateral regexp_matches(
      coalesce(p.text, ''),
      '(^|[^A-Za-z0-9_çÇğĞıİöÖşŞüÜ])#([A-Za-z0-9_çÇğĞıİöÖşŞüÜ]{2,50})',
      'g'
    ) as m
    where lower(translate(m[2], 'ÇĞİIÖŞÜ', 'çğiıöşü')) = v_hashtag
      and (p_before is null or p.created_at < p_before)
  ),
  review_hashtags as (
    select distinct on (r.id)
      r.id as content_id,
      'review'::text as content_type,
      r.user_id,
      coalesce(pr.username, 'Kullanıcı')::text as username,
      pr.profile_image::text as profile_image,
      coalesce(r.text, '')::text as text,
      null::text as image_url,
      r.book_key::text as book_key,
      r.book_title::text as book_title,
      r.rating::numeric as rating,
      r.created_at
    from public.reviews r
    left join public.profiles pr on pr.id = r.user_id
    cross join lateral regexp_matches(
      coalesce(r.text, ''),
      '(^|[^A-Za-z0-9_çÇğĞıİöÖşŞüÜ])#([A-Za-z0-9_çÇğĞıİöÖşŞüÜ]{2,50})',
      'g'
    ) as m
    where lower(translate(m[2], 'ÇĞİIÖŞÜ', 'çğiıöşü')) = v_hashtag
      and (p_before is null or r.created_at < p_before)
  ),
  combined as (
    select * from post_hashtags
    union all
    select * from review_hashtags
  )
  select
    c.content_id,
    c.content_type,
    c.user_id,
    c.username,
    c.profile_image,
    c.text,
    c.image_url,
    c.book_key,
    c.book_title,
    c.rating,
    c.created_at,
    case
      when c.content_type = 'post' then (
        select count(*) from public.post_likes pl where pl.post_id = c.content_id
      )
      else (
        select count(*) from public.likes l where l.review_id = c.content_id
      )
    end::bigint as likes_count,
    case
      when c.content_type = 'post' then (
        select count(*) from public.post_comments pc where pc.post_id = c.content_id
      )
      else (
        select count(*) from public.comments cm where cm.review_id = c.content_id
      )
    end::bigint as comments_count,
    case
      when c.content_type = 'post' then (
        select count(*) from public.post_reposts prp where prp.post_id = c.content_id
      )
      else (
        select count(*) from public.reposts rp where rp.review_id = c.content_id
      )
    end::bigint as reposts_count
  from combined c
  order by c.created_at desc
  limit greatest(1, least(coalesce(p_limit, 20), 50));
end;
$function$;

create or replace function public.get_trending_hashtags()
returns table(
  hashtag text,
  display_hashtag text,
  mention_count bigint,
  unique_users bigint,
  post_count bigint,
  review_count bigint,
  trend_score numeric,
  latest_mention_at timestamptz
)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  return query
  with source_content as (
    select
      'post'::text as content_type,
      p.id as content_id,
      p.user_id,
      p.text,
      p.created_at
    from public.posts p
    where p.created_at >= now() - interval '7 days'
      and p.text is not null
      and btrim(p.text) <> ''

    union all

    select
      'review'::text as content_type,
      r.id as content_id,
      r.user_id,
      r.text,
      r.created_at
    from public.reviews r
    where r.created_at >= now() - interval '7 days'
      and r.text is not null
      and btrim(r.text) <> ''
  ),
  extracted as (
    select
      sc.content_type,
      sc.content_id,
      sc.user_id,
      sc.created_at,
      m.match_array[2] as original_tag,
      lower(translate(m.match_array[2], 'ÇĞİIÖŞÜ', 'çğiıöşü')) as normalized_tag
    from source_content sc
    cross join lateral (
      select regexp_matches(
        sc.text,
        '(^|[^A-Za-z0-9_çÇğĞıİöÖşŞüÜ])#([A-Za-z0-9_çÇğĞıİöÖşŞüÜ]{2,50})',
        'g'
      ) as match_array
    ) m
  ),
  content_distinct as (
    select distinct
      e.content_type,
      e.content_id,
      e.user_id,
      e.created_at,
      e.normalized_tag,
      e.original_tag
    from extracted e
    where e.normalized_tag is not null
      and e.normalized_tag <> ''
  ),
  user_ranked as (
    select
      cd.*,
      row_number() over (
        partition by cd.user_id, cd.normalized_tag
        order by cd.created_at desc
      ) as user_tag_rank
    from content_distinct cd
  ),
  scored_mentions as (
    select
      ur.*,
      case
        when ur.created_at >= now() - interval '1 hour' then 4.0
        when ur.created_at >= now() - interval '6 hours' then 2.5
        when ur.created_at >= now() - interval '24 hours' then 1.5
        else 0.25
      end::numeric as time_weight
    from user_ranked ur
    where ur.user_tag_rank <= 3
       or ur.created_at < now() - interval '24 hours'
  ),
  base_stats as (
    select
      cd.normalized_tag as hashtag,
      count(*)::bigint as mention_count,
      count(distinct cd.user_id)::bigint as unique_users,
      count(*) filter (where cd.content_type = 'post')::bigint as post_count,
      count(*) filter (where cd.content_type = 'review')::bigint as review_count,
      max(cd.created_at) as latest_mention_at
    from content_distinct cd
    group by cd.normalized_tag
  ),
  weighted_stats as (
    select
      sm.normalized_tag as hashtag,
      sum(sm.time_weight)::numeric as weighted_mentions,
      count(distinct sm.user_id) filter (
        where sm.created_at >= now() - interval '24 hours'
      )::bigint as unique_users_24h,
      count(distinct sm.user_id)::bigint as unique_users_7d
    from scored_mentions sm
    group by sm.normalized_tag
  ),
  display_variants as (
    select
      x.normalized_tag as hashtag,
      x.original_tag as display_hashtag
    from (
      select
        cd.normalized_tag,
        cd.original_tag,
        count(*) as variant_count,
        row_number() over (
          partition by cd.normalized_tag
          order by count(*) desc, max(cd.created_at) desc
        ) as variant_rank
      from content_distinct cd
      group by cd.normalized_tag, cd.original_tag
    ) x
    where x.variant_rank = 1
  )
  select
    bs.hashtag,
    coalesce(dv.display_hashtag, bs.hashtag) as display_hashtag,
    bs.mention_count,
    bs.unique_users,
    bs.post_count,
    bs.review_count,
    (
      coalesce(ws.weighted_mentions, 0)
      + coalesce(ws.unique_users_24h, 0) * 2
      + coalesce(ws.unique_users_7d, 0) * 0.5
    )::numeric as trend_score,
    bs.latest_mention_at
  from base_stats bs
  left join weighted_stats ws on ws.hashtag = bs.hashtag
  left join display_variants dv on dv.hashtag = bs.hashtag
  order by
    trend_score desc,
    bs.unique_users desc,
    bs.mention_count desc,
    bs.latest_mention_at desc
  limit 10;
end;
$function$;

revoke all on function public.get_discover_communities(integer) from public, anon;
revoke all on function public.get_event_attendees(uuid) from public, anon;
revoke all on function public.get_hashtag_content(text,integer,timestamptz) from public, anon;
revoke all on function public.get_trending_hashtags() from public, anon;

grant execute on function public.get_discover_communities(integer) to authenticated;
grant execute on function public.get_event_attendees(uuid) to authenticated;
grant execute on function public.get_hashtag_content(text,integer,timestamptz) to authenticated;
grant execute on function public.get_trending_hashtags() to authenticated;

commit;
