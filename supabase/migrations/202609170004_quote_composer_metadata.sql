begin;

alter table public.quotes
  add column if not exists title text,
  add column if not exists topic text,
  add column if not exists page_number integer,
  add column if not exists note text;

alter table public.quotes drop constraint if exists quotes_title_length_check;
alter table public.quotes add constraint quotes_title_length_check
  check (title is null or char_length(title) <= 120);

alter table public.quotes drop constraint if exists quotes_topic_length_check;
alter table public.quotes add constraint quotes_topic_length_check
  check (topic is null or char_length(topic) <= 60);

alter table public.quotes drop constraint if exists quotes_page_number_check;
alter table public.quotes add constraint quotes_page_number_check
  check (page_number is null or page_number between 1 and 100000);

alter table public.quotes drop constraint if exists quotes_note_length_check;
alter table public.quotes add constraint quotes_note_length_check
  check (note is null or char_length(note) <= 300);

commit;
