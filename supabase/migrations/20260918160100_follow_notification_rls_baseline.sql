begin;

drop policy if exists "Users can view follows" on public.follows;
create policy "Users can view follows" on public.follows
for select to authenticated using (true);

drop policy if exists "Users can create their own follows" on public.follows;
create policy "Users can create their own follows" on public.follows
for insert to authenticated with check (auth.uid() = follower_id);

drop policy if exists "Users can delete their own follows" on public.follows;
create policy "Users can delete their own follows" on public.follows
for delete to authenticated using (auth.uid() = follower_id);

drop policy if exists "Users can view own notifications" on public.notifications;
create policy "Users can view own notifications" on public.notifications
for select to authenticated using (user_id = auth.uid());

drop policy if exists "Users can create notifications" on public.notifications;
create policy "Users can create notifications" on public.notifications
for insert to authenticated with check (actor_id = auth.uid());

drop policy if exists "Users can update own notifications" on public.notifications;
create policy "Users can update own notifications" on public.notifications
for update to authenticated using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Users can delete own notifications" on public.notifications;
create policy "Users can delete own notifications" on public.notifications
for delete to authenticated using (user_id = auth.uid());

grant select, insert, delete on public.follows to authenticated;
grant select, insert, update, delete on public.notifications to authenticated;

commit;