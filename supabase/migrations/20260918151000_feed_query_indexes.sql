begin;

create index if not exists posts_created_at_idx
  on public.posts (created_at desc);

create index if not exists posts_user_created_at_idx
  on public.posts (user_id, created_at desc);

create index if not exists reviews_created_at_idx
  on public.reviews (created_at desc);

create index if not exists reviews_user_created_at_idx
  on public.reviews (user_id, created_at desc);

create index if not exists quotes_created_at_idx
  on public.quotes (created_at desc);

create index if not exists post_comments_post_created_at_idx
  on public.post_comments (post_id, created_at asc);

create index if not exists comments_review_created_at_idx
  on public.comments (review_id, created_at asc);

create index if not exists saved_posts_user_created_at_idx
  on public.saved_posts (user_id, created_at desc);

commit;
