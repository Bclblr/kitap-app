begin;


create or replace function public.has_effective_premium(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_user_id is not null
    and exists (
      select 1
      from public.premium_entitlements pe
      where pe.user_id = p_user_id
        and pe.status in ('active','trialing','grace_period')
        and pe.revoked_at is null
        and pe.starts_at <= now()
        and (pe.expires_at is null or pe.expires_at > now())
        and (
          pe.source = 'admin_grant'
          or (
            pe.source in ('apple','google')
            and pe.provider_environment = 'PRODUCTION'
          )
        )
    );
$$;

revoke all on function public.has_effective_premium(uuid)
from public, anon, authenticated;

create or replace function public.get_my_premium_access()
returns table (
  is_premium boolean,
  has_paid_premium boolean,
  has_admin_premium boolean,
  paid_sources text[],
  active_entitlements jsonb,
  all_entitlements jsonb,
  next_expiration_at timestamptz
)
language sql
security definer
set search_path = ''
as $$
  with mine as (
    select pe.*
    from public.premium_entitlements pe
    where pe.user_id = auth.uid()
  ),
  effective as (
    select m.*
    from mine m
    where m.status in ('active','trialing','grace_period')
      and m.revoked_at is null
      and m.starts_at <= now()
      and (m.expires_at is null or m.expires_at > now())
      and (
        m.source = 'admin_grant'
        or (
          m.source in ('apple','google')
          and m.provider_environment = 'PRODUCTION'
        )
      )
  )
  select
    exists(select 1 from effective) as is_premium,
    exists(
      select 1 from effective
      where source in ('apple','google')
        and provider_environment = 'PRODUCTION'
    ) as has_paid_premium,
    exists(
      select 1 from effective
      where source = 'admin_grant'
    ) as has_admin_premium,
    coalesce(
      (
        select array_agg(distinct source order by source)
        from effective
        where source in ('apple','google')
          and provider_environment = 'PRODUCTION'
      ),
      array[]::text[]
    ) as paid_sources,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', id,
            'user_id', user_id,
            'source', source,
            'status', status,
            'product_id', product_id,
            'entitlement_id', entitlement_id,
            'source_reference', source_reference,
            'starts_at', starts_at,
            'expires_at', expires_at,
            'revoked_at', revoked_at,
            'provider_environment', provider_environment,
            'created_at', created_at,
            'updated_at', updated_at
          )
          order by created_at desc
        )
        from effective
      ),
      '[]'::jsonb
    ) as active_entitlements,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', id,
            'user_id', user_id,
            'source', source,
            'status', status,
            'product_id', product_id,
            'entitlement_id', entitlement_id,
            'source_reference', source_reference,
            'starts_at', starts_at,
            'expires_at', expires_at,
            'revoked_at', revoked_at,
            'provider_environment', provider_environment,
            'created_at', created_at,
            'updated_at', updated_at
          )
          order by created_at desc
        )
        from mine
      ),
      '[]'::jsonb
    ) as all_entitlements,
    case
      when exists(select 1 from effective where expires_at is null) then null
      else (select max(expires_at) from effective)
    end as next_expiration_at;
$$;

revoke all on function public.get_my_premium_access()
from public, anon;
grant execute on function public.get_my_premium_access()
to authenticated;

create or replace function public.get_premium_badge_user_ids(p_user_ids uuid[])
returns table (user_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct pe.user_id
  from public.premium_entitlements pe
  where auth.uid() is not null
    and pe.user_id = any(coalesce(p_user_ids, array[]::uuid[]))
    and pe.status in ('active','trialing','grace_period')
    and pe.revoked_at is null
    and pe.starts_at <= now()
    and (pe.expires_at is null or pe.expires_at > now())
    and (
      pe.source = 'admin_grant'
      or (
        pe.source in ('apple','google')
        and pe.provider_environment = 'PRODUCTION'
      )
    );
$$;

revoke all on function public.get_premium_badge_user_ids(uuid[])
from public, anon;
grant execute on function public.get_premium_badge_user_ids(uuid[])
to authenticated;


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

  if not public.has_effective_premium(v_user_id) then
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

  if not public.has_effective_premium(v_user_id) then
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

create or replace function public.set_premium_reading_goals(
  p_weekly_page_goal integer,
  p_monthly_page_goal integer,
  p_yearly_book_goal integer,
  p_streak_goal_days integer
)
returns public.premium_reading_goals
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_row public.premium_reading_goals;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_effective_premium(v_user_id) then
    raise exception 'Premium required' using errcode = '42501';
  end if;

  if p_weekly_page_goal is null or p_weekly_page_goal not between 1 and 70000 then
    raise exception 'Weekly page goal must be between 1 and 70000' using errcode = '22023';
  end if;

  if p_monthly_page_goal is null or p_monthly_page_goal not between 1 and 300000 then
    raise exception 'Monthly page goal must be between 1 and 300000' using errcode = '22023';
  end if;

  if p_yearly_book_goal is null or p_yearly_book_goal not between 1 and 1000 then
    raise exception 'Yearly book goal must be between 1 and 1000' using errcode = '22023';
  end if;

  if p_streak_goal_days is null or p_streak_goal_days not between 1 and 365 then
    raise exception 'Streak goal must be between 1 and 365' using errcode = '22023';
  end if;

  insert into public.premium_reading_goals (
    user_id,
    weekly_page_goal,
    monthly_page_goal,
    yearly_book_goal,
    streak_goal_days
  )
  values (
    v_user_id,
    p_weekly_page_goal,
    p_monthly_page_goal,
    p_yearly_book_goal,
    p_streak_goal_days
  )
  on conflict (user_id) do update
  set weekly_page_goal = excluded.weekly_page_goal,
      monthly_page_goal = excluded.monthly_page_goal,
      yearly_book_goal = excluded.yearly_book_goal,
      streak_goal_days = excluded.streak_goal_days,
      updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.get_premium_goal_dashboard()
returns table(
  weekly_page_goal integer,
  weekly_pages_read bigint,
  monthly_page_goal integer,
  monthly_pages_read bigint,
  yearly_book_goal integer,
  yearly_books_completed bigint,
  streak_goal_days integer,
  current_streak integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_timezone text := 'UTC';
  v_today date;
  v_week_start date;
  v_month_start date;
  v_year_start date;
  v_weekly integer := 140;
  v_monthly integer := 600;
  v_yearly integer := 24;
  v_streak_goal integer := 7;
  v_current_streak integer := 0;
  v_check_date date;
  v_start_date date;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_effective_premium(v_user_id) then
    raise exception 'Premium required' using errcode = '42501';
  end if;

  select rp.timezone into v_timezone
  from public.reading_preferences rp
  where rp.user_id = v_user_id;

  v_timezone := coalesce(nullif(btrim(v_timezone), ''), 'UTC');
  begin
    v_today := (now() at time zone v_timezone)::date;
  exception when others then
    v_today := (now() at time zone 'UTC')::date;
  end;

  select
    prg.weekly_page_goal,
    prg.monthly_page_goal,
    prg.yearly_book_goal,
    prg.streak_goal_days
  into v_weekly, v_monthly, v_yearly, v_streak_goal
  from public.premium_reading_goals prg
  where prg.user_id = v_user_id;

  v_weekly := coalesce(v_weekly, 140);
  v_monthly := coalesce(v_monthly, 600);
  v_yearly := coalesce(v_yearly, 24);
  v_streak_goal := coalesce(v_streak_goal, 7);

  v_week_start := date_trunc('week', v_today::timestamp)::date;
  v_month_start := date_trunc('month', v_today::timestamp)::date;
  v_year_start := make_date(extract(year from v_today)::integer, 1, 1);

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
  end if;

  if v_start_date is not null then
    v_check_date := v_start_date;
    loop
      exit when not exists (
        select 1 from public.reading_daily_stats ds
        where ds.user_id = v_user_id and ds.reading_date = v_check_date and ds.pages_read > 0
      );
      v_current_streak := v_current_streak + 1;
      v_check_date := v_check_date - 1;
    end loop;
  end if;

  return query
  select
    v_weekly,
    coalesce((select sum(ds.pages_read)::bigint from public.reading_daily_stats ds where ds.user_id = v_user_id and ds.reading_date between v_week_start and v_today), 0),
    v_monthly,
    coalesce((select sum(ds.pages_read)::bigint from public.reading_daily_stats ds where ds.user_id = v_user_id and ds.reading_date between v_month_start and v_today), 0),
    v_yearly,
    coalesce((select count(*)::bigint from public.user_book_status ubs where ubs.user_id = v_user_id and ubs.status = 'read' and ubs.updated_at >= v_year_start::timestamptz and ubs.updated_at < (v_year_start + interval '1 year')), 0),
    v_streak_goal,
    v_current_streak;
end;
$$;

create or replace function public.set_premium_profile_customization(
  p_theme_key text,
  p_layout_key text,
  p_highlight_text text,
  p_show_premium_frame boolean
)
returns public.premium_profile_customizations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_theme text := lower(trim(coalesce(p_theme_key, '')));
  v_layout text := lower(trim(coalesce(p_layout_key, '')));
  v_highlight text := trim(coalesce(p_highlight_text, ''));
  v_row public.premium_profile_customizations;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_effective_premium(v_user_id) then
    raise exception 'Premium required' using errcode = '42501';
  end if;

  if v_theme not in ('purple','gold','midnight','forest') then
    raise exception 'Invalid Premium profile theme' using errcode = '22023';
  end if;

  if v_layout not in ('classic','spotlight') then
    raise exception 'Invalid Premium profile layout' using errcode = '22023';
  end if;

  if char_length(v_highlight) > 80 then
    raise exception 'Highlight text is too long' using errcode = '22023';
  end if;

  insert into public.premium_profile_customizations (
    user_id,
    theme_key,
    layout_key,
    highlight_text,
    show_premium_frame
  )
  values (
    v_user_id,
    v_theme,
    v_layout,
    v_highlight,
    coalesce(p_show_premium_frame, true)
  )
  on conflict (user_id) do update
  set theme_key = excluded.theme_key,
      layout_key = excluded.layout_key,
      highlight_text = excluded.highlight_text,
      show_premium_frame = excluded.show_premium_frame,
      updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.set_premium_shelf_customization(
  p_want_label text,
  p_reading_label text,
  p_read_label text,
  p_layout_key text,
  p_accent_key text,
  p_show_counts boolean
)
returns public.premium_shelf_customizations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_want text := trim(coalesce(p_want_label, ''));
  v_reading text := trim(coalesce(p_reading_label, ''));
  v_read text := trim(coalesce(p_read_label, ''));
  v_layout text := lower(trim(coalesce(p_layout_key, '')));
  v_accent text := lower(trim(coalesce(p_accent_key, '')));
  v_row public.premium_shelf_customizations;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_effective_premium(v_user_id) then
    raise exception 'Premium required' using errcode = '42501';
  end if;

  if char_length(v_want) not between 1 and 24
     or char_length(v_reading) not between 1 and 24
     or char_length(v_read) not between 1 and 24 then
    raise exception 'Shelf labels must be between 1 and 24 characters' using errcode = '22023';
  end if;

  if v_layout not in ('cozy', 'compact') then
    raise exception 'Invalid shelf layout' using errcode = '22023';
  end if;

  if v_accent not in ('purple', 'gold', 'midnight', 'forest') then
    raise exception 'Invalid shelf accent' using errcode = '22023';
  end if;

  insert into public.premium_shelf_customizations (
    user_id,
    want_label,
    reading_label,
    read_label,
    layout_key,
    accent_key,
    show_counts
  )
  values (
    v_user_id,
    v_want,
    v_reading,
    v_read,
    v_layout,
    v_accent,
    coalesce(p_show_counts, true)
  )
  on conflict (user_id) do update
  set
    want_label = excluded.want_label,
    reading_label = excluded.reading_label,
    read_label = excluded.read_label,
    layout_key = excluded.layout_key,
    accent_key = excluded.accent_key,
    show_counts = excluded.show_counts,
    updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.enforce_quote_card_template_access()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_premium boolean := false;
begin
  if new.card_template_key is null or btrim(new.card_template_key) = '' then
    new.card_template_key := 'classic';
  end if;

  new.card_template_key := lower(btrim(new.card_template_key));

  if new.card_template_key not in ('classic', 'editorial', 'noir', 'minimal') then
    raise exception 'Invalid quote card template' using errcode = '22023';
  end if;

  if new.card_template_key = 'classic' then
    return new;
  end if;

  if auth.uid() is null or new.user_id <> auth.uid() then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  v_is_premium := public.has_effective_premium(auth.uid());

  if not v_is_premium then
    raise exception 'Premium required for this quote card template' using errcode = '42501';
  end if;

  return new;
end;
$$;

comment on function public.has_effective_premium(uuid) is
'Authoritative Premium gate. Admin grants are effective; Apple/Google entitlements count only when RevenueCat environment is PRODUCTION. SANDBOX never grants production Premium access.';

comment on function public.get_my_premium_access() is
'Server-authoritative Premium summary. SANDBOX RevenueCat rows remain in history but never grant effective production Premium access.';

comment on function public.get_premium_badge_user_ids(uuid[]) is
'Returns Premium badge users using production-effective access only; SANDBOX paid entitlements are excluded.';

commit;
