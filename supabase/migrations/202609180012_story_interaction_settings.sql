begin;

alter table public.stories
  add column if not exists allow_likes boolean not null default true,
  add column if not exists allow_replies boolean not null default true;

drop policy if exists story_like_insert on public.story_likes;
create policy story_like_insert
on public.story_likes
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.stories s
    where s.id = story_id
      and s.expires_at > now()
      and s.allow_likes = true
      and not public.readers_blocked(auth.uid(), s.user_id)
  )
);

commit;
