begin;

drop policy if exists interaction_post_parent_visibility_select on public.post_comments;
create policy interaction_post_parent_visibility_select
on public.post_comments
as restrictive for select
to anon, authenticated
using (
  exists (
    select 1
    from public.posts p
    where p.id = post_comments.post_id
  )
);

drop policy if exists interaction_post_parent_visibility_insert on public.post_comments;
create policy interaction_post_parent_visibility_insert
on public.post_comments
as restrictive for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.posts p
    where p.id = post_comments.post_id
  )
);

drop policy if exists interaction_post_like_parent_visibility_select on public.post_likes;
create policy interaction_post_like_parent_visibility_select
on public.post_likes
as restrictive for select
to anon, authenticated
using (
  exists (
    select 1
    from public.posts p
    where p.id = post_likes.post_id
  )
);

drop policy if exists interaction_post_like_parent_visibility_insert on public.post_likes;
create policy interaction_post_like_parent_visibility_insert
on public.post_likes
as restrictive for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.posts p
    where p.id = post_likes.post_id
  )
);

drop policy if exists interaction_post_repost_parent_visibility_select on public.post_reposts;
create policy interaction_post_repost_parent_visibility_select
on public.post_reposts
as restrictive for select
to anon, authenticated
using (
  exists (
    select 1
    from public.posts p
    where p.id = post_reposts.post_id
  )
);

drop policy if exists interaction_post_repost_parent_visibility_insert on public.post_reposts;
create policy interaction_post_repost_parent_visibility_insert
on public.post_reposts
as restrictive for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.posts p
    where p.id = post_reposts.post_id
  )
);

drop policy if exists interaction_review_parent_visibility_select on public.comments;
create policy interaction_review_parent_visibility_select
on public.comments
as restrictive for select
to authenticated
using (
  exists (
    select 1
    from public.reviews r
    where r.id = comments.review_id
  )
);

drop policy if exists interaction_review_parent_visibility_insert on public.comments;
create policy interaction_review_parent_visibility_insert
on public.comments
as restrictive for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.reviews r
    where r.id = comments.review_id
  )
);

drop policy if exists interaction_review_like_parent_visibility_select on public.likes;
create policy interaction_review_like_parent_visibility_select
on public.likes
as restrictive for select
to authenticated
using (
  exists (
    select 1
    from public.reviews r
    where r.id = likes.review_id
  )
);

drop policy if exists interaction_review_like_parent_visibility_insert on public.likes;
create policy interaction_review_like_parent_visibility_insert
on public.likes
as restrictive for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.reviews r
    where r.id = likes.review_id
  )
);

drop policy if exists interaction_review_repost_parent_visibility_select on public.reposts;
create policy interaction_review_repost_parent_visibility_select
on public.reposts
as restrictive for select
to authenticated
using (
  exists (
    select 1
    from public.reviews r
    where r.id = reposts.review_id
  )
);

drop policy if exists interaction_review_repost_parent_visibility_insert on public.reposts;
create policy interaction_review_repost_parent_visibility_insert
on public.reposts
as restrictive for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.reviews r
    where r.id = reposts.review_id
  )
);

commit;