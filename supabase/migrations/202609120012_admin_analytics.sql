begin;

create or replace function public.admin_analytics_overview()
returns table (
  total_users bigint,
  users_7d bigint,
  users_30d bigint,
  total_posts bigint,
  posts_7d bigint,
  total_reviews bigint,
  reviews_7d bigint,
  total_quotes bigint,
  quotes_7d bigint,
  total_comments bigint,
  comments_7d bigint,
  total_communities bigint,
  total_events bigint,
  pending_reports bigint
)
language sql
security definer
set search_path = ''
as $$
  select
    (select count(*) from auth.users),
    (select count(*) from auth.users where created_at >= now() - interval '7 days'),
    (select count(*) from auth.users where created_at >= now() - interval '30 days'),
    (select count(*) from public.posts),
    (select count(*) from public.posts where created_at >= now() - interval '7 days'),
    (select count(*) from public.reviews),
    (select count(*) from public.reviews where created_at >= now() - interval '7 days'),
    (select count(*) from public.quotes),
    (select count(*) from public.quotes where created_at >= now() - interval '7 days'),
    ((select count(*) from public.post_comments) + (select count(*) from public.comments)),
    ((select count(*) from public.post_comments where created_at >= now() - interval '7 days') +
     (select count(*) from public.comments where created_at >= now() - interval '7 days')),
    (select count(*) from public.communities),
    (select count(*) from public.events),
    (select count(*) from public.reports where status = 'pending')
  where public.has_admin_role(array['admin','super_admin']);
$$;

revoke all on function public.admin_analytics_overview() from public;
grant execute on function public.admin_analytics_overview() to authenticated;

create or replace function public.admin_analytics_daily(p_days integer default 14)
returns table (
  day date,
  new_users bigint,
  posts bigint,
  reviews bigint,
  quotes bigint,
  comments bigint
)
language sql
security definer
set search_path = ''
as $$
  with days as (
    select generate_series(
      current_date - (greatest(1, least(coalesce(p_days,14), 90)) - 1),
      current_date,
      interval '1 day'
    )::date as day
  )
  select
    d.day,
    (select count(*) from auth.users u where u.created_at >= d.day and u.created_at < d.day + 1),
    (select count(*) from public.posts p where p.created_at >= d.day and p.created_at < d.day + 1),
    (select count(*) from public.reviews r where r.created_at >= d.day and r.created_at < d.day + 1),
    (select count(*) from public.quotes q where q.created_at >= d.day and q.created_at < d.day + 1),
    ((select count(*) from public.post_comments pc where pc.created_at >= d.day and pc.created_at < d.day + 1) +
     (select count(*) from public.comments c where c.created_at >= d.day and c.created_at < d.day + 1))
  from days d
  where public.has_admin_role(array['admin','super_admin'])
  order by d.day;
$$;

revoke all on function public.admin_analytics_daily(integer) from public;
grant execute on function public.admin_analytics_daily(integer) to authenticated;

commit;
