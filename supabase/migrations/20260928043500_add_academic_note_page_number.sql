alter table public.academic_work_notes
  add column if not exists page_number integer;

alter table public.academic_work_notes
  drop constraint if exists academic_work_notes_page_number_check;

alter table public.academic_work_notes
  add constraint academic_work_notes_page_number_check
  check (page_number is null or page_number > 0);
