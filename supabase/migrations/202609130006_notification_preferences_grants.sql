begin;

-- notification-settings.tsx reads the current user's row and upserts changes.
-- Table-level privileges are required in addition to RLS policies.
grant select, insert, update on table public.notification_preferences to authenticated;

commit;
