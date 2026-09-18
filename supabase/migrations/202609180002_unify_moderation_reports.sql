begin;

-- Mark report provenance and keep a stable pointer for migrated legacy rows.
alter table public.reports
  add column if not exists source text not null default 'app',
  add column if not exists legacy_user_report_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'reports_source_check'
      and conrelid = 'public.reports'::regclass
  ) then
    alter table public.reports
      add constraint reports_source_check
      check (source in ('app','legacy_user_reports'));
  end if;
end
$$;

create unique index if not exists reports_legacy_user_report_idx
on public.reports(legacy_user_report_id)
where legacy_user_report_id is not null;

-- Preserve all legacy user_reports in the unified moderation table.
-- The normal report insert guard requires auth.uid(); migrations run without
-- an end-user auth context, so disable it only for this controlled backfill.
alter table public.reports disable trigger reports_rate_limit_guard;
-- At most one unresolved report may exist for the same reporter/target;
-- older duplicates are retained as migrated historical duplicates.
with legacy as (
  select
    ur.*,
    row_number() over (
      partition by ur.reporter_id, ur.reported_id
      order by ur.created_at desc, ur.id desc
    ) as rn,
    exists (
      select 1
      from public.reports r
      where r.reporter_id = ur.reporter_id
        and r.target_type = 'user'
        and r.target_id = ur.reported_id::text
        and r.status in ('pending','reviewing')
    ) as already_open
  from public.user_reports ur
)
insert into public.reports (
  reporter_id,
  target_type,
  target_id,
  category,
  description,
  status,
  resolution,
  resolved_at,
  created_at,
  updated_at,
  source,
  legacy_user_report_id
)
select
  l.reporter_id,
  'user',
  l.reported_id::text,
  l.category,
  l.description,
  case
    when not l.already_open and l.rn = 1 then 'pending'
    else 'rejected'
  end,
  case
    when not l.already_open and l.rn = 1 then null
    else 'Eski user_reports kaydı tek moderasyon akışına taşınırken yinelenen tarihsel kayıt olarak korundu.'
  end,
  case
    when not l.already_open and l.rn = 1 then null
    else l.created_at
  end,
  l.created_at,
  l.created_at,
  'legacy_user_reports',
  l.id
from legacy l
where not exists (
  select 1
  from public.reports r
  where r.legacy_user_report_id = l.id
)
on conflict do nothing;

alter table public.reports enable trigger reports_rate_limit_guard;

-- Compatibility bridge for older app builds that still submit to user_reports.
create or replace function public.mirror_legacy_user_report()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_has_open boolean;
begin
  select exists (
    select 1
    from public.reports r
    where r.reporter_id = new.reporter_id
      and r.target_type = 'user'
      and r.target_id = new.reported_id::text
      and r.status in ('pending','reviewing')
  )
  into v_has_open;

  insert into public.reports (
    reporter_id,
    target_type,
    target_id,
    category,
    description,
    status,
    resolution,
    resolved_at,
    created_at,
    updated_at,
    source,
    legacy_user_report_id
  )
  values (
    new.reporter_id,
    'user',
    new.reported_id::text,
    new.category,
    new.description,
    case when v_has_open then 'rejected' else 'pending' end,
    case
      when v_has_open then 'Eski istemciden gelen yinelenen şikâyet uyumluluk köprüsüyle kaydedildi.'
      else null
    end,
    case when v_has_open then now() else null end,
    new.created_at,
    new.created_at,
    'legacy_user_reports',
    new.id
  )
  on conflict do nothing;

  return new;
end;
$$;

revoke all on function public.mirror_legacy_user_report() from public;

drop trigger if exists mirror_legacy_user_report_to_reports on public.user_reports;
create trigger mirror_legacy_user_report_to_reports
after insert on public.user_reports
for each row execute function public.mirror_legacy_user_report();

-- Admins continue to see everything in reports; ordinary users only see their own.
-- user_reports remains read-compatible for legacy clients but is no longer the
-- moderation source of truth.
comment on table public.user_reports is
  'Deprecated compatibility table. New clients write public.reports; inserts are mirrored to reports for older app builds.';

comment on table public.reports is
  'Canonical moderation report table used by all current clients and the admin moderation panel.';

commit;
