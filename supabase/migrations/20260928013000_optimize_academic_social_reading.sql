create index if not exists reviews_academic_work_created_idx
  on public.reviews (academic_work_id, created_at desc)
  where content_kind = 'academic';

create index if not exists quotes_academic_work_created_idx
  on public.quotes (academic_work_id, created_at desc)
  where content_kind = 'academic';

drop policy if exists academic_reading_status_own on public.academic_reading_status;
create policy academic_reading_status_own
  on public.academic_reading_status
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
