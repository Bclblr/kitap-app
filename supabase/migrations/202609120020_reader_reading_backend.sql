begin;

-- Reading shelves/status -----------------------------------------------------
create table if not exists public.user_book_status (
  user_id uuid not null references auth.users(id) on delete cascade,
  book_key text not null,
  book_title text,
  status text not null check (status = any (array['reading'::text,'read'::text,'want'::text])),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, book_key)
);

create index if not exists user_book_status_book_status_updated_idx
  on public.user_book_status (book_key, status, updated_at desc);

alter table public.user_book_status enable row level security;
drop policy if exists "Users can read own book status" on public.user_book_status;
create policy "Users can read own book status" on public.user_book_status
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can insert own book status" on public.user_book_status;
create policy "Users can insert own book status" on public.user_book_status
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can update own book status" on public.user_book_status;
create policy "Users can update own book status" on public.user_book_status
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can delete own book status" on public.user_book_status;
create policy "Users can delete own book status" on public.user_book_status
  for delete to authenticated using (auth.uid() = user_id);

grant select, insert, update, delete on public.user_book_status to authenticated;
revoke all on public.user_book_status from anon;

-- Reading preferences -------------------------------------------------------
create table if not exists public.reading_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  daily_page_goal integer not null default 20 check (daily_page_goal between 1 and 10000),
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reading_preferences_user_unique unique (user_id)
);

alter table public.reading_preferences enable row level security;
drop policy if exists "Users can read own reading preferences" on public.reading_preferences;
create policy "Users can read own reading preferences" on public.reading_preferences
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can insert own reading preferences" on public.reading_preferences;
create policy "Users can insert own reading preferences" on public.reading_preferences
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can update own reading preferences" on public.reading_preferences;
create policy "Users can update own reading preferences" on public.reading_preferences
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can delete own reading preferences" on public.reading_preferences;
create policy "Users can delete own reading preferences" on public.reading_preferences
  for delete to authenticated using (auth.uid() = user_id);

grant select, insert, update, delete on public.reading_preferences to authenticated;
revoke all on public.reading_preferences from anon;

-- Reading progress ----------------------------------------------------------
create table if not exists public.reading_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  book_key text not null,
  book_title text,
  current_page integer not null default 0 check (current_page >= 0),
  total_pages integer check (total_pages is null or total_pages > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  furthest_page integer not null default 0 check (furthest_page >= 0),
  constraint reading_progress_page_range_check check (total_pages is null or current_page <= total_pages),
  constraint reading_progress_user_book_unique unique (user_id, book_key)
);

alter table public.reading_progress enable row level security;
drop policy if exists "Users can read own reading progress" on public.reading_progress;
create policy "Users can read own reading progress" on public.reading_progress
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can insert own reading progress" on public.reading_progress;
create policy "Users can insert own reading progress" on public.reading_progress
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can update own reading progress" on public.reading_progress;
create policy "Users can update own reading progress" on public.reading_progress
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can delete own reading progress" on public.reading_progress;
create policy "Users can delete own reading progress" on public.reading_progress
  for delete to authenticated using (auth.uid() = user_id);

grant select, insert, update, delete on public.reading_progress to authenticated;
revoke all on public.reading_progress from anon;

-- Daily reading stats -------------------------------------------------------
create table if not exists public.reading_daily_stats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reading_date date not null,
  pages_read integer not null default 0 check (pages_read >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reading_daily_stats_user_date_unique unique (user_id, reading_date)
);

create index if not exists reading_daily_stats_user_date_idx
  on public.reading_daily_stats (user_id, reading_date desc);

alter table public.reading_daily_stats enable row level security;
drop policy if exists "Users can read own daily stats" on public.reading_daily_stats;
create policy "Users can read own daily stats" on public.reading_daily_stats
  for select to authenticated using (auth.uid() = user_id);

grant select on public.reading_daily_stats to authenticated;
revoke all on public.reading_daily_stats from anon;

-- updated_at helpers --------------------------------------------------------
create or replace function public.set_reading_updated_at()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

create or replace function public.set_reading_progress_updated_at()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

drop trigger if exists set_user_book_status_updated_at on public.user_book_status;
create trigger set_user_book_status_updated_at
before update on public.user_book_status
for each row execute function public.set_reading_updated_at();

drop trigger if exists set_reading_preferences_updated_at on public.reading_preferences;
create trigger set_reading_preferences_updated_at
before update on public.reading_preferences
for each row execute function public.set_reading_updated_at();

drop trigger if exists set_reading_daily_stats_updated_at on public.reading_daily_stats;
create trigger set_reading_daily_stats_updated_at
before update on public.reading_daily_stats
for each row execute function public.set_reading_updated_at();

drop trigger if exists set_reading_progress_updated_at on public.reading_progress;
create trigger set_reading_progress_updated_at
before update on public.reading_progress
for each row execute function public.set_reading_progress_updated_at();

-- User book status ----------------------------------------------------------
create or replace function public.set_user_book_status(p_book_key text, p_book_title text, p_status text)
returns public.user_book_status
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user_id uuid;
  v_result public.user_book_status;
begin
  v_user_id := auth.uid();
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_book_key is null or btrim(p_book_key) = '' then raise exception 'Book key is required'; end if;
  if p_status not in ('reading','read','want') then raise exception 'Invalid book status'; end if;

  insert into public.user_book_status (user_id, book_key, book_title, status)
  values (v_user_id, p_book_key, p_book_title, p_status)
  on conflict (user_id, book_key)
  do update set book_title = excluded.book_title, status = excluded.status
  returning * into v_result;
  return v_result;
end;
$function$;

-- Reading dashboard ---------------------------------------------------------
create or replace function public.get_reading_dashboard()
returns table(today_pages_read integer, daily_page_goal integer, current_streak integer, timezone text)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user_id uuid;
  v_timezone text := 'UTC';
  v_goal integer := 20;
  v_today date;
  v_start_date date;
  v_check_date date;
  v_streak integer := 0;
begin
  v_user_id := auth.uid();
  if v_user_id is null then raise exception 'Authentication required'; end if;

  select rp.daily_page_goal, rp.timezone
    into v_goal, v_timezone
  from public.reading_preferences rp
  where rp.user_id = v_user_id;

  v_goal := coalesce(v_goal, 20);
  v_timezone := coalesce(nullif(btrim(v_timezone), ''), 'UTC');

  begin
    v_today := (now() at time zone v_timezone)::date;
  exception when others then
    v_timezone := 'UTC';
    v_today := (now() at time zone 'UTC')::date;
  end;

  if exists (
    select 1 from public.reading_daily_stats ds
    where ds.user_id = v_user_id and ds.reading_date = v_today and ds.pages_read > 0
  ) then
    v_start_date := v_today;
  elsif exists (
    select 1 from public.reading_daily_stats ds
    where ds.user_id = v_user_id and ds.reading_date = v_today - 1 and ds.pages_read > 0
  ) then
    v_start_date := v_today - 1;
  else
    v_start_date := null;
  end if;

  if v_start_date is not null then
    v_check_date := v_start_date;
    loop
      exit when not exists (
        select 1 from public.reading_daily_stats ds
        where ds.user_id = v_user_id and ds.reading_date = v_check_date and ds.pages_read > 0
      );
      v_streak := v_streak + 1;
      v_check_date := v_check_date - 1;
    end loop;
  end if;

  return query
  select coalesce((
      select ds.pages_read from public.reading_daily_stats ds
      where ds.user_id = v_user_id and ds.reading_date = v_today
    ), 0),
    v_goal,
    v_streak,
    v_timezone;
end;
$function$;

-- Reading progress ----------------------------------------------------------
create or replace function public.update_reading_progress(
  p_book_key text,
  p_book_title text,
  p_current_page integer,
  p_total_pages integer
)
returns table(current_page integer, total_pages integer, furthest_page integer, added_pages integer, today_pages_read integer, updated_at timestamptz)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user_id uuid;
  v_old_furthest integer := 0;
  v_new_furthest integer := 0;
  v_added integer := 0;
  v_timezone text := 'UTC';
  v_today date;
begin
  v_user_id := auth.uid();
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_book_key is null or btrim(p_book_key) = '' then raise exception 'Book key is required'; end if;
  if p_current_page is null or p_current_page < 0 then raise exception 'Current page must be zero or greater'; end if;
  if p_total_pages is null or p_total_pages <= 0 then raise exception 'Total pages must be greater than zero'; end if;
  if p_current_page > p_total_pages then raise exception 'Current page cannot exceed total pages'; end if;

  select rp.furthest_page into v_old_furthest
  from public.reading_progress rp
  where rp.user_id = v_user_id and rp.book_key = p_book_key
  for update;

  if not found then v_old_furthest := 0; end if;
  v_new_furthest := greatest(v_old_furthest, p_current_page);
  v_added := greatest(p_current_page - v_old_furthest, 0);

  insert into public.reading_progress (
    user_id, book_key, book_title, current_page, total_pages, furthest_page
  ) values (
    v_user_id, p_book_key, p_book_title, p_current_page, p_total_pages, v_new_furthest
  )
  on conflict (user_id, book_key)
  do update set
    book_title = excluded.book_title,
    current_page = excluded.current_page,
    total_pages = excluded.total_pages,
    furthest_page = greatest(public.reading_progress.furthest_page, excluded.current_page);

  select rprefs.timezone into v_timezone
  from public.reading_preferences rprefs
  where rprefs.user_id = v_user_id;

  if v_timezone is null or btrim(v_timezone) = '' then v_timezone := 'UTC'; end if;
  begin
    v_today := (now() at time zone v_timezone)::date;
  exception when others then
    v_timezone := 'UTC';
    v_today := (now() at time zone 'UTC')::date;
  end;

  if v_added > 0 then
    insert into public.reading_daily_stats (user_id, reading_date, pages_read)
    values (v_user_id, v_today, v_added)
    on conflict (user_id, reading_date)
    do update set pages_read = public.reading_daily_stats.pages_read + excluded.pages_read;
  end if;

  return query
  select rp.current_page, rp.total_pages, rp.furthest_page, v_added,
         coalesce(ds.pages_read, 0), rp.updated_at
  from public.reading_progress rp
  left join public.reading_daily_stats ds
    on ds.user_id = v_user_id and ds.reading_date = v_today
  where rp.user_id = v_user_id and rp.book_key = p_book_key;
end;
$function$;

-- Same-book readers ---------------------------------------------------------
create or replace function public.get_same_book_readers(p_book_key text)
returns table(user_id uuid, username text, profile_image text)
language plpgsql
security definer
set search_path to ''
as $function$
declare v_user_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_book_key is null or btrim(p_book_key) = '' then raise exception 'Book key is required'; end if;

  return query
  select p.id, p.username, p.profile_image
  from public.user_book_status ubs
  join public.profiles p on p.id = ubs.user_id
  where ubs.book_key = p_book_key
    and ubs.status = 'reading'
    and ubs.user_id <> v_user_id
  order by ubs.updated_at desc
  limit 10;
end;
$function$;

-- Popular books -------------------------------------------------------------
create or replace function public.get_popular_books()
returns table(book_key text, book_title text, reading_count bigint, read_count bigint, want_count bigint, total_users bigint, popularity_score bigint)
language plpgsql
security definer
set search_path to ''
as $function$
declare v_user_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then raise exception 'Authentication required'; end if;

  return query
  select
    ubs.book_key,
    max(ubs.book_title),
    count(*) filter (where ubs.status = 'reading'),
    count(*) filter (where ubs.status = 'read'),
    count(*) filter (where ubs.status = 'want'),
    count(*),
    (
      count(*) filter (where ubs.status = 'reading') * 3
      + count(*) filter (where ubs.status = 'want') * 2
      + count(*) filter (where ubs.status = 'read')
    )
  from public.user_book_status ubs
  group by ubs.book_key
  order by 7 desc, 6 desc, max(ubs.updated_at) desc
  limit 10;
end;
$function$;

-- Discover communities ------------------------------------------------------
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
      select 1 from public.community_members my_membership
      where my_membership.community_id = c.id
        and my_membership.user_id = auth.uid()
    ) as is_member,
    c.created_at
  from public.communities c
  left join public.community_members cm on cm.community_id = c.id
  where auth.uid() is not null
  group by c.id, c.name, c.description, c.image_url, c.created_at
  order by count(cm.user_id) desc, c.created_at desc
  limit greatest(1, least(coalesce(p_limit, 6), 20));
$function$;

-- Event attendees -----------------------------------------------------------
create or replace function public.get_event_attendees(p_event_id uuid)
returns table(user_id uuid, username text, profile_image text)
language sql
security definer
set search_path to ''
as $function$
  select ea.user_id, coalesce(p.username, 'Kitap Okuru'), p.profile_image
  from public.event_attendees ea
  left join public.profiles p on p.id = ea.user_id
  where ea.event_id = p_event_id
  order by ea.created_at asc;
$function$;

-- Hashtag content -----------------------------------------------------------
create or replace function public.get_hashtag_content(
  p_hashtag text,
  p_limit integer default 20,
  p_before timestamptz default null
)
returns table(
  content_id uuid, content_type text, user_id uuid, username text, profile_image text,
  text text, image_url text, book_key text, book_title text, rating numeric,
  created_at timestamptz, likes_count bigint, comments_count bigint, reposts_count bigint
)
language plpgsql
security definer
set search_path to ''
as $function$
declare v_hashtag text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  v_hashtag := lower(translate(regexp_replace(trim(p_hashtag), '^#', ''), 'ÇĞİIÖŞÜ', 'çğiıöşü'));

  return query
  with post_hashtags as (
    select distinct on (p.id)
      p.id, 'post'::text, p.user_id, coalesce(pr.username, 'Kullanıcı')::text,
      pr.profile_image::text, coalesce(p.text, '')::text, p.image_url::text,
      p.book_key::text, p.book_title::text, p.rating::numeric, p.created_at
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
      r.id, 'review'::text, r.user_id, coalesce(pr.username, 'Kullanıcı')::text,
      pr.profile_image::text, coalesce(r.text, '')::text, null::text,
      r.book_key::text, r.book_title::text, r.rating::numeric, r.created_at
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
    c.id,
    c."text",
    c.user_id,
    c.coalesce,
    c.profile_image,
    c.coalesce_1,
    c.image_url,
    c.book_key,
    c.book_title,
    c.rating,
    c.created_at,
    case when c."text" = 'post' then (select count(*) from public.post_likes pl where pl.post_id = c.id)
         else (select count(*) from public.likes l where l.review_id = c.id) end::bigint,
    case when c."text" = 'post' then (select count(*) from public.post_comments pc where pc.post_id = c.id)
         else (select count(*) from public.comments cm where cm.review_id = c.id) end::bigint,
    case when c."text" = 'post' then (select count(*) from public.post_reposts prp where prp.post_id = c.id)
         else (select count(*) from public.reposts rp where rp.review_id = c.id) end::bigint
  from combined c
  order by c.created_at desc
  limit greatest(1, least(coalesce(p_limit, 20), 50));
end;
$function$;

-- Trending hashtags ---------------------------------------------------------
create or replace function public.get_trending_hashtags()
returns table(hashtag text, display_hashtag text, mention_count bigint, unique_users bigint, post_count bigint, review_count bigint, trend_score numeric, latest_mention_at timestamptz)
language plpgsql
security definer
set search_path to ''
as $function$
declare v_user_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then raise exception 'Authentication required'; end if;

  return query
  with source_content as (
    select 'post'::text as content_type, p.id as content_id, p.user_id, p.text, p.created_at
    from public.posts p
    where p.created_at >= now() - interval '7 days' and p.text is not null and btrim(p.text) <> ''
    union all
    select 'review'::text, r.id, r.user_id, r.text, r.created_at
    from public.reviews r
    where r.created_at >= now() - interval '7 days' and r.text is not null and btrim(r.text) <> ''
  ),
  extracted as (
    select sc.content_type, sc.content_id, sc.user_id, sc.created_at,
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
    select distinct e.content_type, e.content_id, e.user_id, e.created_at, e.normalized_tag, e.original_tag
    from extracted e
    where e.normalized_tag is not null and e.normalized_tag <> ''
  ),
  user_ranked as (
    select cd.*,
           row_number() over (
             partition by cd.user_id, cd.normalized_tag
             order by cd.created_at desc
           ) as user_tag_rank
    from content_distinct cd
  ),
  scored_mentions as (
    select ur.*,
           case
             when ur.created_at >= now() - interval '1 hour' then 4.0
             when ur.created_at >= now() - interval '6 hours' then 2.5
             when ur.created_at >= now() - interval '24 hours' then 1.5
             else 0.25
           end::numeric as time_weight
    from user_ranked ur
    where ur.user_tag_rank <= 3 or ur.created_at < now() - interval '24 hours'
  ),
  base_stats as (
    select cd.normalized_tag as hashtag,
           count(*)::bigint as mention_count,
           count(distinct cd.user_id)::bigint as unique_users,
           count(*) filter (where cd.content_type = 'post')::bigint as post_count,
           count(*) filter (where cd.content_type = 'review')::bigint as review_count,
           max(cd.created_at) as latest_mention_at
    from content_distinct cd
    group by cd.normalized_tag
  ),
  weighted_stats as (
    select sm.normalized_tag as hashtag,
           sum(sm.time_weight)::numeric as weighted_mentions,
           count(distinct sm.user_id) filter (where sm.created_at >= now() - interval '24 hours')::bigint as unique_users_24h,
           count(distinct sm.user_id)::bigint as unique_users_7d
    from scored_mentions sm
    group by sm.normalized_tag
  ),
  display_variants as (
    select x.normalized_tag as hashtag, x.original_tag as display_hashtag
    from (
      select cd.normalized_tag, cd.original_tag,
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
  select bs.hashtag,
         coalesce(dv.display_hashtag, bs.hashtag),
         bs.mention_count,
         bs.unique_users,
         bs.post_count,
         bs.review_count,
         (coalesce(ws.weighted_mentions, 0) + coalesce(ws.unique_users_24h, 0) * 2 + coalesce(ws.unique_users_7d, 0) * 0.5)::numeric,
         bs.latest_mention_at
  from base_stats bs
  left join weighted_stats ws on ws.hashtag = bs.hashtag
  left join display_variants dv on dv.hashtag = bs.hashtag
  order by 7 desc, bs.unique_users desc, bs.mention_count desc, bs.latest_mention_at desc
  limit 10;
end;
$function$;

-- Function permissions ------------------------------------------------------
revoke all on function public.set_user_book_status(text,text,text) from public, anon;
revoke all on function public.get_reading_dashboard() from public, anon;
revoke all on function public.update_reading_progress(text,text,integer,integer) from public, anon;
revoke all on function public.get_same_book_readers(text) from public, anon;
revoke all on function public.get_popular_books() from public, anon;
revoke all on function public.get_discover_communities(integer) from public, anon;
revoke all on function public.get_event_attendees(uuid) from public, anon;
revoke all on function public.get_hashtag_content(text,integer,timestamptz) from public, anon;
revoke all on function public.get_trending_hashtags() from public, anon;

grant execute on function public.set_user_book_status(text,text,text) to authenticated;
grant execute on function public.get_reading_dashboard() to authenticated;
grant execute on function public.update_reading_progress(text,text,integer,integer) to authenticated;
grant execute on function public.get_same_book_readers(text) to authenticated;
grant execute on function public.get_popular_books() to authenticated;
grant execute on function public.get_discover_communities(integer) to authenticated;
grant execute on function public.get_event_attendees(uuid) to authenticated;
grant execute on function public.get_hashtag_content(text,integer,timestamptz) to authenticated;
grant execute on function public.get_trending_hashtags() to authenticated;

commit;
