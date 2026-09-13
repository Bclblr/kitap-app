begin;

create or replace function public.get_premium_reading_stats()
returns table(
  period_start date,
  period_end date,
  total_pages_30d bigint,
  active_days_30d bigint,
  average_pages_active_day numeric,
  best_day_pages integer,
  best_day date,
  goal_hit_days bigint,
  pages_last_7d bigint,
  pages_previous_7d bigint,
  current_streak integer,
  daily_page_goal integer,
  daily_series jsonb
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
  v_period_start date;
  v_total_pages bigint := 0;
  v_active_days bigint := 0;
  v_average numeric := 0;
  v_best_pages integer := 0;
  v_best_day date := null;
  v_goal_hit_days bigint := 0;
  v_last_7d bigint := 0;
  v_previous_7d bigint := 0;
  v_streak integer := 0;
  v_start_date date;
  v_check_date date;
  v_series jsonb := '[]'::jsonb;
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

  v_period_start := v_today - 29;

  select
    coalesce(sum(ds.pages_read), 0)::bigint,
    count(*) filter (where ds.pages_read > 0)::bigint,
    coalesce(round(avg(ds.pages_read) filter (where ds.pages_read > 0), 1), 0),
    count(*) filter (where ds.pages_read >= v_goal)::bigint
  into
    v_total_pages,
    v_active_days,
    v_average,
    v_goal_hit_days
  from public.reading_daily_stats ds
  where ds.user_id = v_user_id
    and ds.reading_date between v_period_start and v_today;

  select ds.reading_date, ds.pages_read
  into v_best_day, v_best_pages
  from public.reading_daily_stats ds
  where ds.user_id = v_user_id
    and ds.reading_date between v_period_start and v_today
    and ds.pages_read > 0
  order by ds.pages_read desc, ds.reading_date desc
  limit 1;

  v_best_pages := coalesce(v_best_pages, 0);

  select coalesce(sum(ds.pages_read), 0)::bigint
  into v_last_7d
  from public.reading_daily_stats ds
  where ds.user_id = v_user_id
    and ds.reading_date between (v_today - 6) and v_today;

  select coalesce(sum(ds.pages_read), 0)::bigint
  into v_previous_7d
  from public.reading_daily_stats ds
  where ds.user_id = v_user_id
    and ds.reading_date between (v_today - 13) and (v_today - 7);

  if exists (
    select 1
    from public.reading_daily_stats ds
    where ds.user_id = v_user_id
      and ds.reading_date = v_today
      and ds.pages_read > 0
  ) then
    v_start_date := v_today;
  elsif exists (
    select 1
    from public.reading_daily_stats ds
    where ds.user_id = v_user_id
      and ds.reading_date = v_today - 1
      and ds.pages_read > 0
  ) then
    v_start_date := v_today - 1;
  else
    v_start_date := null;
  end if;

  if v_start_date is not null then
    v_check_date := v_start_date;
    loop
      exit when not exists (
        select 1
        from public.reading_daily_stats ds
        where ds.user_id = v_user_id
          and ds.reading_date = v_check_date
          and ds.pages_read > 0
      );
      v_streak := v_streak + 1;
      v_check_date := v_check_date - 1;
    end loop;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'date', days.day::date,
        'pages', coalesce(ds.pages_read, 0)
      )
      order by days.day
    ),
    '[]'::jsonb
  )
  into v_series
  from generate_series(
    v_period_start::timestamp,
    v_today::timestamp,
    interval '1 day'
  ) as days(day)
  left join public.reading_daily_stats ds
    on ds.user_id = v_user_id
   and ds.reading_date = days.day::date;

  return query
  select
    v_period_start,
    v_today,
    v_total_pages,
    v_active_days,
    v_average,
    v_best_pages,
    v_best_day,
    v_goal_hit_days,
    v_last_7d,
    v_previous_7d,
    v_streak,
    v_goal,
    v_series;
end;
$$;

revoke all on function public.get_premium_reading_stats() from public;
revoke all on function public.get_premium_reading_stats() from anon;
grant execute on function public.get_premium_reading_stats() to authenticated;

comment on function public.get_premium_reading_stats() is
'Premium-only 30-day reading analytics. Premium authorization is enforced server-side.';

commit;
