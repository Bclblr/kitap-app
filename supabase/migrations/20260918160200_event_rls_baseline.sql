begin;

drop policy if exists "Authenticated users can view events" on public.events;
create policy "Authenticated users can view events" on public.events
for select to authenticated using (true);

drop policy if exists "Authenticated users can view event attendees" on public.event_attendees;
create policy "Authenticated users can view event attendees"
on public.event_attendees
for select to authenticated using (true);

drop policy if exists "Users can join events" on public.event_attendees;
create policy "Users can join events"
on public.event_attendees
for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "Users can leave events" on public.event_attendees;
create policy "Users can leave events"
on public.event_attendees
for delete to authenticated using (user_id = auth.uid());

grant select on public.events to authenticated;
grant select, insert, delete on public.event_attendees to authenticated;

commit;