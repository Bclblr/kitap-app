begin;

create or replace function public.get_premium_year_report(
  p_year integer default null
)
returns table(
  report_year integer,
  total_pages bigint,
  active_days bigint,
  books_completed bigint,
  goal_hit_days bigint,
  best_day date,
  best_day_pages integer,
  best_month integer,
  best_month_pages bigint,
  average_pages_active_day numeric,
  monthly_series jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_timezone text := 'UTC';
  v_goal integer := 20;
  v_today date;
  v_year integer;
  v_year_start date;
  v_year_end date;
  v_total_pages bigint := 0;
  v_active_days bigint := 0;
  v_books_completed bigint := 0;
  v_goal_hit_days bigint := 0;
  v_best_day date := null;
  v_best_day_pages integer := 0;
  v_best_month integer := null;
  v_best_month_pages bigint := 0;
  v_average numeric := 0;
  v_monthly_series jsonb := '[]'::jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.premium_entitlements pe
    where pe.user_id = v_user_id
      and pe.status in ('active', 'trialing', 'grace_period')
      and pe.revoked_at is null
      and pe.starts_at <= now()
      and (pe.expires_at is null or pe.expires_at > now())
  ) then
    raise exception 'Premium required'
      using errcode = '42501';
  end if;

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

  v_year := coalesce(p_year, extract(year from v_today)::integer);

  if v_year < 2000 or v_year > extract(year from v_today)::integer then
    raise exception 'Invalid report year'
      using errcode = '22023';
  end if;

  v_year_start := make_date(v_year, 1, 1);
  v_year_end := make_date(v_year, 12, 31);

  select
    coalesce(sum(ds.pages_read), 0)::bigint,
    count(*) filter (where ds.pages_read > 0)::bigint,
    count(*) filter (where ds.pages_read >= v_goal)::bigint,
    coalesce(round(avg(ds.pages_read) filter (where ds.pages_read > 0), 1), 0)
  into
    v_total_pages,
    v_active_days,
    v_goal_hit_days,
    v_average
  from public.reading_daily_stats ds
  where ds.user_id = v_user_id
    and ds.reading_date between v_year_start and v_year_end;

  select count(*)::bigint
  into v_books_completed
  from public.user_book_status ubs
  where ubs.user_id = v_user_id
    and ubs.status = 'read'
    and ubs.updated_at >= v_year_start::timestamptz
    and ubs.updated_at < (v_year_end + 1)::timestamptz;

  select ds.reading_date, ds.pages_read
  into v_best_day, v_best_day_pages
  from public.reading_daily_stats ds
  where ds.user_id = v_user_id
    and ds.reading_date between v_year_start and v_year_end
    and ds.pages_read > 0
  order by ds.pages_read desc, ds.reading_date desc
  limit 1;

  v_best_day_pages := coalesce(v_best_day_pages, 0);

  select
    extract(month from ds.reading_date)::integer,
    sum(ds.pages_read)::bigint
  into v_best_month, v_best_month_pages
  from public.reading_daily_stats ds
  where ds.user_id = v_user_id
    and ds.reading_date between v_year_start and v_year_end
  group by extract(month from ds.reading_date)
  having sum(ds.pages_read) > 0
  order by sum(ds.pages_read) desc, extract(month from ds.reading_date) desc
  limit 1;

  v_best_month_pages := coalesce(v_best_month_pages, 0);

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'month', months.month_number,
        'pages', coalesce(month_totals.pages, 0),
        'active_days', coalesce(month_totals.active_days, 0)
      )
      order by months.month_number
    ),
    '[]'::jsonb
  )
  into v_monthly_series
  from generate_series(1, 12) as months(month_number)
  left join (
    select
      extract(month from ds.reading_date)::integer as month_number,
      sum(ds.pages_read)::bigint as pages,
      count(*) filter (where ds.pages_read > 0)::bigint as active_days
    from public.reading_daily_stats ds
    where ds.user_id = v_user_id
      and ds.reading_date between v_year_start and v_year_end
    group by extract(month from ds.reading_date)
  ) month_totals
    on month_totals.month_number = months.month_number;

  return query
  select
    v_year,
    v_total_pages,
    v_active_days,
    v_books_completed,
    v_goal_hit_days,
    v_best_day,
    v_best_day_pages,
    v_best_month,
    v_best_month_pages,
    v_average,
    v_monthly_series;
end;
$$;

revoke all on function public.get_premium_year_report(integer) from public;
revoke all on function public.get_premium_year_report(integer) from anon;
grant execute on function public.get_premium_year_report(integer) to authenticated;

comment on function public.get_premium_year_report(integer) is
'Premium-only annual reading report with monthly page totals and completed-book count.';

commit;
