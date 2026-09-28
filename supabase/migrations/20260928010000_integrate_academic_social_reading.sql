alter table public.academic_reading_status
  drop constraint if exists academic_reading_status_status_check;
alter table public.academic_reading_status
  add constraint academic_reading_status_status_check
  check (status = any (array['want'::text,'reading'::text,'read'::text,'abandoned'::text]));
alter table public.academic_reading_status
  add column if not exists work_type text;

alter table public.saved_academic_works
  add column if not exists work_type text;

alter table public.reviews
  add column if not exists content_kind text not null default 'book',
  add column if not exists academic_work_id text,
  add column if not exists academic_work_type text,
  add column if not exists academic_author_summary text;
alter table public.reviews
  drop constraint if exists reviews_content_kind_check;
alter table public.reviews
  add constraint reviews_content_kind_check check (content_kind in ('book','academic'));
alter table public.reviews
  drop constraint if exists reviews_academic_reference_check;
alter table public.reviews
  add constraint reviews_academic_reference_check
  check (content_kind <> 'academic' or academic_work_id is not null);

alter table public.quotes
  add column if not exists content_kind text not null default 'book',
  add column if not exists academic_work_id text,
  add column if not exists academic_work_type text,
  add column if not exists academic_author_summary text;
alter table public.quotes
  drop constraint if exists quotes_content_kind_check;
alter table public.quotes
  add constraint quotes_content_kind_check check (content_kind in ('book','academic'));
alter table public.quotes
  drop constraint if exists quotes_academic_reference_check;
alter table public.quotes
  add constraint quotes_academic_reference_check
  check (content_kind <> 'academic' or academic_work_id is not null);

create index if not exists reviews_academic_work_id_idx
  on public.reviews (academic_work_id) where content_kind='academic';
create index if not exists quotes_academic_work_id_idx
  on public.quotes (academic_work_id) where content_kind='academic';
create index if not exists academic_reading_status_user_status_idx
  on public.academic_reading_status (user_id,status,updated_at desc);
