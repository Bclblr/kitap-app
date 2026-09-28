create index if not exists story_likes_user_id_idx
  on public.story_likes (user_id);

drop policy if exists story_like_delete on public.story_likes;
create policy story_like_delete
  on public.story_likes for delete to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists story_like_read on public.story_likes;
create policy story_like_read
  on public.story_likes for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.stories s
      where s.id = story_likes.story_id
        and s.user_id = (select auth.uid())
    )
  );

drop policy if exists story_like_insert on public.story_likes;
create policy story_like_insert
  on public.story_likes for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.stories s
      where s.id = story_likes.story_id
        and s.expires_at > now()
        and s.allow_likes = true
        and not public.readers_blocked((select auth.uid()), s.user_id)
    )
  );
