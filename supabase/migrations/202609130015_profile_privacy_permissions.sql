begin;

grant select, insert, update
on table public.profile_privacy_settings
to authenticated;

commit;
