begin;

drop policy if exists "authenticated users can create posts"
  on public.posts;

drop policy if exists "authenticated users can view saved posts"
  on public.saved_posts;

drop policy if exists "authenticated users can save posts"
  on public.saved_posts;

commit;