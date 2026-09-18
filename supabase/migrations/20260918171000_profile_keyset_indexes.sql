begin;

create index if not exists posts_user_created_id_idx
  on public.posts (user_id, created_at desc, id desc);

create index if not exists reviews_user_created_id_idx
  on public.reviews (user_id, created_at desc, id desc);

create index if not exists quotes_user_created_id_idx
  on public.quotes (user_id, created_at desc, id desc);

create index if not exists post_reposts_user_created_id_idx
  on public.post_reposts (user_id, created_at desc, id desc);

commit;