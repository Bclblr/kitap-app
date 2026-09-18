begin;

-- Historical/administrative actor UUIDs must not block deletion of the Auth
-- identity. Keep the UUID value for audit/history, but remove the live FK
-- dependency on auth.users.
alter table public.admin_audit_logs
  drop constraint if exists admin_audit_logs_admin_id_fkey;

alter table public.admin_config_snapshots
  drop constraint if exists admin_config_snapshots_created_by_fkey;

alter table public.admin_notifications
  drop constraint if exists admin_notifications_created_by_fkey;

alter table public.announcements
  drop constraint if exists announcements_created_by_fkey;

alter table public.explore_featured_items
  drop constraint if exists explore_featured_items_created_by_fkey;

alter table public.storage_cleanup_candidates
  drop constraint if exists storage_cleanup_candidates_created_by_fkey;

comment on column public.admin_audit_logs.admin_id is
'Historical actor UUID. Intentionally not FK-bound to auth.users so immutable audit history survives account deletion.';

comment on column public.admin_config_snapshots.created_by is
'Historical creator UUID. Intentionally not FK-bound to auth.users so snapshots do not block account deletion.';

comment on column public.admin_notifications.created_by is
'Historical creator UUID. Intentionally not FK-bound to auth.users so notifications do not block account deletion.';

comment on column public.announcements.created_by is
'Historical creator UUID. Intentionally not FK-bound to auth.users so announcements do not block account deletion.';

comment on column public.explore_featured_items.created_by is
'Historical creator UUID. Intentionally not FK-bound to auth.users so featured-item history does not block account deletion.';

comment on column public.storage_cleanup_candidates.created_by is
'Historical creator UUID. Intentionally not FK-bound to auth.users so cleanup history does not block account deletion.';

commit;
