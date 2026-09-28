create table if not exists public.story_views (
  story_id uuid not null references public.stories(id) on delete cascade,
  viewer_id uuid not null references public.profiles(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (story_id, viewer_id)
);

alter table public.story_views enable row level security;

grant select, insert, update on public.story_views to authenticated;
revoke all on public.story_views from anon;

drop policy if exists story_views_insert_own on public.story_views;
create policy story_views_insert_own
  on public.story_views for insert to authenticated
  with check (
    viewer_id = (select auth.uid())
    and exists (
      select 1 from public.stories s
      where s.id = story_id
        and s.user_id <> (select auth.uid())
        and s.expires_at > now()
        and public.can_view_user_content(s.user_id)
    )
  );

drop policy if exists story_views_update_own on public.story_views;
create policy story_views_update_own
  on public.story_views for update to authenticated
  using (viewer_id = (select auth.uid()))
  with check (viewer_id = (select auth.uid()));

drop policy if exists story_views_select_owner_or_self on public.story_views;
create policy story_views_select_owner_or_self
  on public.story_views for select to authenticated
  using (
    viewer_id = (select auth.uid())
    or exists (
      select 1 from public.stories s
      where s.id = story_id and s.user_id = (select auth.uid())
    )
  );

create index if not exists story_views_story_viewed_idx
  on public.story_views (story_id, viewed_at desc);

create index if not exists story_views_viewer_idx
  on public.story_views (viewer_id, viewed_at desc);
