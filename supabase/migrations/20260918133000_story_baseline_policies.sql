begin;

drop policy if exists "Stories are publicly readable" on public.stories;
create policy "Stories are publicly readable"
on public.stories
for select
to anon, authenticated
using (expires_at > now());

drop policy if exists "Users can create stories" on public.stories;
create policy "Users can create stories"
on public.stories
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own stories" on public.stories;
create policy "Users can update own stories"
on public.stories
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own stories" on public.stories;
create policy "Users can delete own stories"
on public.stories
for delete
to authenticated
using (auth.uid() = user_id);

grant select on public.stories to anon, authenticated;
grant insert, update, delete on public.stories to authenticated;

commit;
