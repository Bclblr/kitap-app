begin;
create table if not exists public.story_likes (
 story_id uuid references public.stories(id) on delete cascade,
 user_id uuid references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(), primary key(story_id,user_id)
);
alter table public.story_likes enable row level security;
drop policy if exists story_like_read on public.story_likes;
create policy story_like_read on public.story_likes for select to authenticated using(user_id=auth.uid() or exists(select 1 from public.stories s where s.id=story_id and s.user_id=auth.uid()));
drop policy if exists story_like_insert on public.story_likes;
create policy story_like_insert on public.story_likes for insert to authenticated with check(user_id=auth.uid() and exists(select 1 from public.stories s where s.id=story_id and s.expires_at>now() and not public.readers_blocked(auth.uid(),s.user_id)));
drop policy if exists story_like_delete on public.story_likes;
create policy story_like_delete on public.story_likes for delete to authenticated using(user_id=auth.uid());
revoke all on public.story_likes from anon;
grant select, insert, delete on public.story_likes to authenticated;
alter table public.stories enable row level security;
drop policy if exists story_owner_delete on public.stories;
create policy story_owner_delete on public.stories for delete to authenticated using(user_id=auth.uid());
drop policy if exists story_owner_delete_guard on public.stories;
create policy story_owner_delete_guard on public.stories as restrictive for delete to authenticated using(user_id=auth.uid());
grant delete on public.stories to authenticated;
commit;
