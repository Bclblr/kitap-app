begin;

-- Prevent duplicate unresolved reports for the same target.
create unique index if not exists reports_one_open_per_target_idx
on public.reports(reporter_id, target_type, target_id)
where status in ('pending','reviewing');

-- Basic abuse guard: a user cannot submit more than 30 moderation reports
-- within a rolling 10 minute window.
create or replace function public.guard_report_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_recent_count integer;
begin
  if auth.uid() is null or new.reporter_id <> auth.uid() then
    raise exception 'not_authorized';
  end if;

  select count(*)
    into v_recent_count
  from public.reports
  where reporter_id = auth.uid()
    and created_at >= now() - interval '10 minutes';

  if v_recent_count >= 30 then
    raise exception 'report_rate_limited';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_report_rate_limit() from public;

drop trigger if exists reports_rate_limit_guard on public.reports;
create trigger reports_rate_limit_guard
before insert on public.reports
for each row execute function public.guard_report_rate_limit();

-- Avoid repeated profile-report spam against the same account in a short period.
create or replace function public.guard_user_report_repeat()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null or new.reporter_id <> auth.uid() then
    raise exception 'not_authorized';
  end if;

  if exists (
    select 1
    from public.user_reports
    where reporter_id = auth.uid()
      and reported_id = new.reported_id
      and created_at >= now() - interval '24 hours'
  ) then
    raise exception 'report_already_submitted_recently';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_user_report_repeat() from public;

drop trigger if exists user_reports_repeat_guard on public.user_reports;
create trigger user_reports_repeat_guard
before insert on public.user_reports
for each row execute function public.guard_user_report_repeat();

-- Server-side follow guard. This is installed only when the existing follows
-- table has the expected follower/following UUID columns.
create or replace function public.guard_blocked_follow()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null or new.follower_id <> auth.uid() then
    raise exception 'not_authorized';
  end if;

  if new.follower_id = new.following_id then
    raise exception 'cannot_follow_self';
  end if;

  if public.readers_blocked(new.follower_id, new.following_id) then
    raise exception 'blocked_relationship';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_blocked_follow() from public;

do $$
begin
  if to_regclass('public.follows') is not null
     and exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'follows' and column_name = 'follower_id'
     )
     and exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'follows' and column_name = 'following_id'
     ) then
    execute 'drop trigger if exists follows_block_guard on public.follows';
    execute 'create trigger follows_block_guard before insert or update on public.follows for each row execute function public.guard_blocked_follow()';
  end if;
end
$$;

commit;
