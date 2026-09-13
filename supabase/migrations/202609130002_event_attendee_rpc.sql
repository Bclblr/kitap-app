begin;

create or replace function public.get_event_attendees(p_event_id uuid)
returns table (
  user_id uuid,
  username text,
  profile_image text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    a.user_id,
    coalesce(p.username, 'Kitap Okuru')::text as username,
    p.profile_image::text as profile_image
  from public.event_attendees a
  left join public.profiles p on p.id = a.user_id
  where a.event_id = p_event_id
    and exists (
      select 1
      from public.events e
      where e.id = a.event_id
    )
    and (
      auth.uid() is null
      or not exists (
        select 1
        from public.user_blocks b
        where (b.blocker_id = auth.uid() and b.blocked_id = a.user_id)
           or (b.blocker_id = a.user_id and b.blocked_id = auth.uid())
      )
    )
  order by coalesce(p.username, 'Kitap Okuru') asc, a.user_id;
$$;

revoke all on function public.get_event_attendees(uuid) from public;
grant execute on function public.get_event_attendees(uuid) to anon, authenticated;

commit;
