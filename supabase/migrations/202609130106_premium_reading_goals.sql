begin;

create table if not exists public.premium_reading_goals (
  user_id uuid primary key references auth.users(id) on delete cascade,
  weekly_page_goal integer not null default 140 check (weekly_page_goal between 1 and 70000),
  monthly_page_goal integer not null default 600 check (monthly_page_goal between 1 and 300000),
  yearly_book_goal integer not null default 24 check (yearly_book_goal between 1 and 1000),
  streak_goal_days integer not null default 7 check (streak_goal_days between 1 and 365),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.premium_reading_goals enable row level security;

drop policy if exists "Users can read own Premium goals" on public.premium_reading_goals;
create policy "Users can read own Premium goals"
on public.premium_reading_goals
for select
to authenticated
using (auth.uid() = user_id);

revoke all on public.premium_reading_goals from anon;
revoke insert, update, delete on public.premium_reading_goals from authenticated;
grant select on public.premium_reading_goals to authenticated;

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

  if not exists (
    select 1
    from public.premium_entitlements pe
    where pe.user_id = v_user_id
      and pe.status in ('active','trialing','grace_period')
      and pe.revoked_at is null
      and pe.starts_at <= now()
      and (pe.expires_at is null or pe.expires_at > now())
  ) then
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

  if not exists (
    select 1
    from public.premium_entitlements pe
    where pe.user_id = v_user_id
      and pe.status in ('active','trialing','grace_period')
      and pe.revoked_at is null
      and pe.starts_at <= now()
      and (pe.expires_at is null or pe.expires_at > now())
  ) then
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

revoke all on function public.set_premium_reading_goals(integer,integer,integer,integer) from public, anon;
revoke all on function public.get_premium_goal_dashboard() from public, anon;
grant execute on function public.set_premium_reading_goals(integer,integer,integer,integer) to authenticated;
grant execute on function public.get_premium_goal_dashboard() to authenticated;

commit;
