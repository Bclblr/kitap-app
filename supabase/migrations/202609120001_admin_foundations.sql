begin;

-- Application-wide roles. Authentication continues to be handled by Supabase Auth.
create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'user' check (role in ('user','moderator','admin','super_admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

alter table public.user_roles enable row level security;

create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = ''
as $role$
  select coalesce(
    (select ur.role from public.user_roles ur where ur.user_id = auth.uid()),
    'user'
  );
$role$;

create or replace function public.has_admin_role(required_roles text[] default array['moderator','admin','super_admin'])
returns boolean
language sql
stable
security definer
set search_path = ''
as $admin$
  select auth.uid() is not null and public.current_app_role() = any(required_roles);
$admin$;

revoke all on function public.current_app_role() from public;
revoke all on function public.has_admin_role(text[]) from public;
grant execute on function public.current_app_role() to authenticated;
grant execute on function public.has_admin_role(text[]) to authenticated;

drop policy if exists user_roles_read_own_or_admin on public.user_roles;
create policy user_roles_read_own_or_admin
on public.user_roles for select to authenticated
using (user_id = auth.uid() or public.has_admin_role(array['admin','super_admin']));

-- Direct role writes are intentionally restricted to super admins.
drop policy if exists user_roles_manage_super_admin on public.user_roles;
create policy user_roles_manage_super_admin
on public.user_roles for all to authenticated
using (public.has_admin_role(array['super_admin']))
with check (public.has_admin_role(array['super_admin']));

grant select, insert, update, delete on public.user_roles to authenticated;

-- Permanent audit trail for every privileged action.
create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references auth.users(id) on delete restrict,
  action text not null,
  target_type text not null,
  target_id text,
  reason text,
  old_value jsonb,
  new_value jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_logs_created_idx on public.admin_audit_logs(created_at desc);
create index if not exists admin_audit_logs_admin_idx on public.admin_audit_logs(admin_id, created_at desc);
alter table public.admin_audit_logs enable row level security;
drop policy if exists admin_audit_read on public.admin_audit_logs;
create policy admin_audit_read on public.admin_audit_logs for select to authenticated
using (public.has_admin_role(array['admin','super_admin']));
drop policy if exists admin_audit_insert on public.admin_audit_logs;
create policy admin_audit_insert on public.admin_audit_logs for insert to authenticated
with check (admin_id = auth.uid() and public.has_admin_role());
grant select, insert on public.admin_audit_logs to authenticated;

-- Warnings, temporary restrictions and permanent account sanctions.
create table if not exists public.user_sanctions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sanction_type text not null check (sanction_type in (
    'warning','suspension','ban','comment_restriction','post_restriction',
    'message_restriction','community_restriction'
  )),
  reason text not null default '',
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);
create index if not exists user_sanctions_user_idx on public.user_sanctions(user_id, active, created_at desc);
alter table public.user_sanctions enable row level security;
drop policy if exists sanctions_admin_all on public.user_sanctions;
create policy sanctions_admin_all on public.user_sanctions for all to authenticated
using (public.has_admin_role())
with check (public.has_admin_role() and created_by = auth.uid());
drop policy if exists sanctions_user_read_own on public.user_sanctions;
create policy sanctions_user_read_own on public.user_sanctions for select to authenticated
using (user_id = auth.uid());
grant select, insert, update on public.user_sanctions to authenticated;

-- Unified moderation reports. Existing user_reports remains compatible and can be migrated later.
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('user','post','review','quote','comment','message','community','event')),
  target_id text not null,
  category text not null default 'other',
  description text not null default '',
  status text not null default 'pending' check (status in ('pending','reviewing','actioned','rejected')),
  assigned_to uuid references auth.users(id) on delete set null,
  resolution text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists reports_status_idx on public.reports(status, created_at desc);
create index if not exists reports_target_idx on public.reports(target_type, target_id);
alter table public.reports enable row level security;
drop policy if exists reports_submit on public.reports;
create policy reports_submit on public.reports for insert to authenticated
with check (reporter_id = auth.uid());
drop policy if exists reports_read_own_or_admin on public.reports;
create policy reports_read_own_or_admin on public.reports for select to authenticated
using (reporter_id = auth.uid() or public.has_admin_role());
drop policy if exists reports_admin_update on public.reports;
create policy reports_admin_update on public.reports for update to authenticated
using (public.has_admin_role())
with check (public.has_admin_role());
grant select, insert, update on public.reports to authenticated;

-- Central runtime settings used by the mobile app and admin panel.
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  description text not null default '',
  public_read boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
alter table public.app_settings enable row level security;
drop policy if exists app_settings_public_read on public.app_settings;
create policy app_settings_public_read on public.app_settings for select
using (public_read or public.has_admin_role(array['admin','super_admin']));
drop policy if exists app_settings_admin_write on public.app_settings;
create policy app_settings_admin_write on public.app_settings for all to authenticated
using (public.has_admin_role(array['admin','super_admin']))
with check (public.has_admin_role(array['admin','super_admin']));
grant select on public.app_settings to anon, authenticated;
grant insert, update, delete on public.app_settings to authenticated;

insert into public.app_settings(key,value,description,public_read)
values
 ('maintenance_mode','false'::jsonb,'Uygulamayı bakım moduna alır',true),
 ('registration_enabled','true'::jsonb,'Yeni kullanıcı kaydını açıp kapatır',true),
 ('community_creation_enabled','true'::jsonb,'Topluluk oluşturmayı açıp kapatır',true),
 ('event_creation_enabled','true'::jsonb,'Etkinlik oluşturmayı açıp kapatır',true),
 ('max_post_length','5000'::jsonb,'Maksimum gönderi karakteri',true),
 ('max_comment_length','2000'::jsonb,'Maksimum yorum karakteri',true),
 ('story_duration_hours','24'::jsonb,'Story görünürlük süresi',true)
on conflict(key) do nothing;

create table if not exists public.feature_flags (
  key text primary key,
  enabled boolean not null default false,
  description text not null default '',
  allowed_roles text[] not null default '{}',
  allowed_user_ids uuid[] not null default '{}',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
alter table public.feature_flags enable row level security;
drop policy if exists feature_flags_read on public.feature_flags;
create policy feature_flags_read on public.feature_flags for select to authenticated using(true);
drop policy if exists feature_flags_admin_write on public.feature_flags;
create policy feature_flags_admin_write on public.feature_flags for all to authenticated
using (public.has_admin_role(array['admin','super_admin']))
with check (public.has_admin_role(array['admin','super_admin']));
grant select on public.feature_flags to authenticated;
grant insert, update, delete on public.feature_flags to authenticated;

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  kind text not null default 'info' check (kind in ('info','warning','maintenance','feature','event')),
  action_route text,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);
alter table public.announcements enable row level security;
drop policy if exists announcements_read on public.announcements;
create policy announcements_read on public.announcements for select
using (active and starts_at <= now() and (ends_at is null or ends_at > now()) or public.has_admin_role(array['admin','super_admin']));
drop policy if exists announcements_admin_write on public.announcements;
create policy announcements_admin_write on public.announcements for all to authenticated
using (public.has_admin_role(array['admin','super_admin']))
with check (public.has_admin_role(array['admin','super_admin']) and created_by = auth.uid());
grant select on public.announcements to anon, authenticated;
grant insert, update, delete on public.announcements to authenticated;

commit;
