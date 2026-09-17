begin;

alter table public.reviews
  add column if not exists title text,
  add column if not exists topic text,
  add column if not exists tags text[] not null default '{}'::text[],
  add column if not exists contains_spoiler boolean not null default false;

alter table public.reviews
  drop constraint if exists reviews_title_length_check;

alter table public.reviews
  add constraint reviews_title_length_check
  check (title is null or char_length(title) <= 120);

alter table public.reviews
  drop constraint if exists reviews_topic_length_check;

alter table public.reviews
  add constraint reviews_topic_length_check
  check (topic is null or char_length(topic) <= 60);

alter table public.reviews
  drop constraint if exists reviews_tags_count_check;

alter table public.reviews
  add constraint reviews_tags_count_check
  check (cardinality(tags) <= 8);

comment on column public.reviews.title is 'Optional review headline shown above the review body.';
comment on column public.reviews.topic is 'Optional discovery topic selected while composing a review.';
comment on column public.reviews.tags is 'Optional lightweight labels attached to the review.';
comment on column public.reviews.contains_spoiler is 'True when the author marks the review as containing spoilers.';

commit;
