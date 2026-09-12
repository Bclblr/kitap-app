begin;

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
create policy "Users can read own book status" on public.user_book_status for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can insert own book status" on public.user_book_status;
create policy "Users can insert own book status" on public.user_book_status for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can update own book status" on public.user_book_status;
create policy "Users can update own book status" on public.user_book_status for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can delete own book status" on public.user_book_status;
create policy "Users can delete own book status" on public.user_book_status for delete to authenticated using (auth.uid() = user_id);
grant select,insert,update,delete on public.user_book_status to authenticated;
revoke all on public.user_book_status from anon;

create table if not exists public.reading_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  daily_page_goal integer not null default 20 check (daily_page_goal >= 1 and daily_page_goal <= 10000),
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reading_preferences_user_unique unique (user_id)
);
alter table public.reading_preferences enable row level security;
drop policy if exists "Users can read own reading preferences" on public.reading_preferences;
create policy "Users can read own reading preferences" on public.reading_preferences for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can insert own reading preferences" on public.reading_preferences;
create policy "Users can insert own reading preferences" on public.reading_preferences for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can update own reading preferences" on public.reading_preferences;
create policy "Users can update own reading preferences" on public.reading_preferences for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can delete own reading preferences" on public.reading_preferences;
create policy "Users can delete own reading preferences" on public.reading_preferences for delete to authenticated using (auth.uid() = user_id);
grant select,insert,update,delete on public.reading_preferences to authenticated;
revoke all on public.reading_preferences from anon;

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
create policy "Users can read own reading progress" on public.reading_progress for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can insert own reading progress" on public.reading_progress;
create policy "Users can insert own reading progress" on public.reading_progress for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can update own reading progress" on public.reading_progress;
create policy "Users can update own reading progress" on public.reading_progress for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can delete own reading progress" on public.reading_progress;
create policy "Users can delete own reading progress" on public.reading_progress for delete to authenticated using (auth.uid() = user_id);
grant select,insert,update,delete on public.reading_progress to authenticated;
revoke all on public.reading_progress from anon;

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
create policy "Users can read own daily stats" on public.reading_daily_stats for select to authenticated using (auth.uid() = user_id);
grant select on public.reading_daily_stats to authenticated;
revoke all on public.reading_daily_stats from anon;

create or replace function public.set_reading_updated_at()
returns trigger language plpgsql set search_path to 'public' as $function$
begin new.updated_at = now(); return new; end;
$function$;

create or replace function public.set_reading_progress_updated_at()
returns trigger language plpgsql set search_path to 'public' as $function$
begin new.updated_at = now(); return new; end;
$function$;

drop trigger if exists set_user_book_status_updated_at on public.user_book_status;
create trigger set_user_book_status_updated_at before update on public.user_book_status for each row execute function public.set_reading_updated_at();
drop trigger if exists set_reading_preferences_updated_at on public.reading_preferences;
create trigger set_reading_preferences_updated_at before update on public.reading_preferences for each row execute function public.set_reading_updated_at();
drop trigger if exists set_reading_daily_stats_updated_at on public.reading_daily_stats;
create trigger set_reading_daily_stats_updated_at before update on public.reading_daily_stats for each row execute function public.set_reading_updated_at();
drop trigger if exists set_reading_progress_updated_at on public.reading_progress;
create trigger set_reading_progress_updated_at before update on public.reading_progress for each row execute function public.set_reading_progress_updated_at();

create or replace function public.set_user_book_status(p_book_key text, p_book_title text, p_status text)
returns public.user_book_status
language plpgsql security definer set search_path to '' as $function$
declare v_user_id uuid; v_result public.user_book_status;
begin
  v_user_id := auth.uid();
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_book_key is null or btrim(p_book_key) = '' then raise exception 'Book key is required'; end if;
  if p_status not in ('reading','read','want') then raise exception 'Invalid book status'; end if;
  insert into public.user_book_status(user_id,book_key,book_title,status)
  values(v_user_id,p_book_key,p_book_title,p_status)
  on conflict(user_id,book_key) do update set book_title=excluded.book_title,status=excluded.status
  returning * into v_result;
  return v_result;
end;
$function$;

create or replace function public.get_reading_dashboard()
returns table(today_pages_read integer,daily_page_goal integer,current_streak integer,timezone text)
language plpgsql security definer set search_path to '' as $function$
declare
  v_user_id uuid; v_timezone text := 'UTC'; v_goal integer := 20;
  v_today date; v_start_date date; v_check_date date; v_streak integer := 0;
begin
  v_user_id := auth.uid();
  if v_user_id is null then raise exception 'Authentication required'; end if;
  select rp.daily_page_goal,rp.timezone into v_goal,v_timezone
  from public.reading_preferences rp where rp.user_id=v_user_id;
  v_goal := coalesce(v_goal,20);
  v_timezone := coalesce(nullif(btrim(v_timezone),''),'UTC');
  begin v_today := (now() at time zone v_timezone)::date;
  exception when others then v_timezone := 'UTC'; v_today := (now() at time zone 'UTC')::date; end;
  if exists(select 1 from public.reading_daily_stats ds where ds.user_id=v_user_id and ds.reading_date=v_today and ds.pages_read>0) then
    v_start_date := v_today;
  elsif exists(select 1 from public.reading_daily_stats ds where ds.user_id=v_user_id and ds.reading_date=v_today-1 and ds.pages_read>0) then
    v_start_date := v_today-1;
  else v_start_date := null; end if;
  if v_start_date is not null then
    v_check_date := v_start_date;
    loop
      exit when not exists(select 1 from public.reading_daily_stats ds where ds.user_id=v_user_id and ds.reading_date=v_check_date and ds.pages_read>0);
      v_streak := v_streak+1; v_check_date := v_check_date-1;
    end loop;
  end if;
  return query select coalesce((select ds.pages_read from public.reading_daily_stats ds where ds.user_id=v_user_id and ds.reading_date=v_today),0),v_goal,v_streak,v_timezone;
end;
$function$;

create or replace function public.update_reading_progress(p_book_key text,p_book_title text,p_current_page integer,p_total_pages integer)
returns table(current_page integer,total_pages integer,furthest_page integer,added_pages integer,today_pages_read integer,updated_at timestamptz)
language plpgsql security definer set search_path to '' as $function$
declare
  v_user_id uuid; v_old_furthest integer := 0; v_new_furthest integer := 0;
  v_added integer := 0; v_timezone text := 'UTC'; v_today date;
begin
  v_user_id := auth.uid();
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_book_key is null or btrim(p_book_key)='' then raise exception 'Book key is required'; end if;
  if p_current_page is null or p_current_page<0 then raise exception 'Current page must be zero or greater'; end if;
  if p_total_pages is null or p_total_pages<=0 then raise exception 'Total pages must be greater than zero'; end if;
  if p_current_page>p_total_pages then raise exception 'Current page cannot exceed total pages'; end if;
  select rp.furthest_page into v_old_furthest from public.reading_progress rp
  where rp.user_id=v_user_id and rp.book_key=p_book_key for update;
  if not found then v_old_furthest := 0; end if;
  v_new_furthest := greatest(v_old_furthest,p_current_page);
  v_added := greatest(p_current_page-v_old_furthest,0);
  insert into public.reading_progress(user_id,book_key,book_title,current_page,total_pages,furthest_page)
  values(v_user_id,p_book_key,p_book_title,p_current_page,p_total_pages,v_new_furthest)
  on conflict(user_id,book_key) do update set
    book_title=excluded.book_title,current_page=excluded.current_page,total_pages=excluded.total_pages,
    furthest_page=greatest(public.reading_progress.furthest_page,excluded.current_page);
  select rprefs.timezone into v_timezone from public.reading_preferences rprefs where rprefs.user_id=v_user_id;
  if v_timezone is null or btrim(v_timezone)='' then v_timezone := 'UTC'; end if;
  begin v_today := (now() at time zone v_timezone)::date;
  exception when others then v_timezone := 'UTC'; v_today := (now() at time zone 'UTC')::date; end;
  if v_added>0 then
    insert into public.reading_daily_stats(user_id,reading_date,pages_read)
    values(v_user_id,v_today,v_added)
    on conflict(user_id,reading_date) do update set pages_read=public.reading_daily_stats.pages_read+excluded.pages_read;
  end if;
  return query
  select rp.current_page,rp.total_pages,rp.furthest_page,v_added,coalesce(ds.pages_read,0),rp.updated_at
  from public.reading_progress rp
  left join public.reading_daily_stats ds on ds.user_id=v_user_id and ds.reading_date=v_today
  where rp.user_id=v_user_id and rp.book_key=p_book_key;
end;
$function$;

create or replace function public.get_same_book_readers(p_book_key text)
returns table(user_id uuid,username text,profile_image text)
language plpgsql security definer set search_path to '' as $function$
declare v_user_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_book_key is null or btrim(p_book_key)='' then raise exception 'Book key is required'; end if;
  return query
  select p.id,p.username,p.profile_image
  from public.user_book_status ubs join public.profiles p on p.id=ubs.user_id
  where ubs.book_key=p_book_key and ubs.status='reading' and ubs.user_id<>v_user_id
  order by ubs.updated_at desc limit 10;
end;
$function$;

create or replace function public.get_popular_books()
returns table(book_key text,book_title text,reading_count bigint,read_count bigint,want_count bigint,total_users bigint,popularity_score bigint)
language plpgsql security definer set search_path to '' as $function$
declare v_user_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then raise exception 'Authentication required'; end if;
  return query
  select ubs.book_key,max(ubs.book_title),
    count(*) filter(where ubs.status='reading'),
    count(*) filter(where ubs.status='read'),
    count(*) filter(where ubs.status='want'),
    count(*),
    (count(*) filter(where ubs.status='reading')*3 + count(*) filter(where ubs.status='want')*2 + count(*) filter(where ubs.status='read'))
  from public.user_book_status ubs
  group by ubs.book_key
  order by 7 desc,6 desc,max(ubs.updated_at) desc
  limit 10;
end;
$function$;

revoke all on function public.set_user_book_status(text,text,text) from public,anon;
revoke all on function public.get_reading_dashboard() from public,anon;
revoke all on function public.update_reading_progress(text,text,integer,integer) from public,anon;
revoke all on function public.get_same_book_readers(text) from public,anon;
revoke all on function public.get_popular_books() from public,anon;
grant execute on function public.set_user_book_status(text,text,text) to authenticated;
grant execute on function public.get_reading_dashboard() to authenticated;
grant execute on function public.update_reading_progress(text,text,integer,integer) to authenticated;
grant execute on function public.get_same_book_readers(text) to authenticated;
grant execute on function public.get_popular_books() to authenticated;

commit;
