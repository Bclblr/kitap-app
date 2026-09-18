begin;

alter table public.events
  alter column created_by drop not null;

alter table public.communities
  alter column created_by drop not null;

alter table public.events
  drop constraint if exists events_created_by_fkey;

alter table public.communities
  drop constraint if exists communities_created_by_fkey;

alter table public.events
  add constraint events_created_by_fkey
  foreign key (created_by)
  references public.profiles(id)
  on delete set null;

alter table public.communities
  add constraint communities_created_by_fkey
  foreign key (created_by)
  references public.profiles(id)
  on delete set null;

comment on column public.events.created_by is
'Event creator. Set NULL when the owning profile is deleted so account deletion cannot be blocked.';

comment on column public.communities.created_by is
'Community creator. Set NULL when the owning profile is deleted so account deletion cannot be blocked.';

commit;