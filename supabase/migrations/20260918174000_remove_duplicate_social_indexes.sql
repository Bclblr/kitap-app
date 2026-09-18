begin;

drop index if exists public.likes_review_user_unique;
drop index if exists public.reposts_review_user_unique;

commit;