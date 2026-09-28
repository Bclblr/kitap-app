drop policy if exists "Stories are publicly readable" on public.stories;
drop policy if exists content_access_guard on public.stories;
drop policy if exists stories_select on public.stories;
create policy stories_select
  on public.stories for select
  to anon, authenticated
  using (expires_at > now() and public.can_view_user_content(user_id));

drop policy if exists "Users can create stories" on public.stories;
drop policy if exists "Users can create their own stories" on public.stories;
drop policy if exists stories_insert on public.stories;
create policy stories_insert
  on public.stories for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own stories" on public.stories;
drop policy if exists "Users can update their own stories" on public.stories;
drop policy if exists stories_update on public.stories;
create policy stories_update
  on public.stories for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own stories" on public.stories;
drop policy if exists "Users can delete their own stories" on public.stories;
drop policy if exists stories_delete on public.stories;
drop policy if exists story_owner_delete on public.stories;
drop policy if exists story_owner_delete_guard on public.stories;
create policy stories_delete
  on public.stories for delete
  to authenticated
  using ((select auth.uid()) = user_id);
