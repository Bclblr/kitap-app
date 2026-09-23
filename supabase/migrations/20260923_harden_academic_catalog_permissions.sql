-- Keep shared academic catalog metadata read-only from client sessions.
create index if not exists academic_work_authors_author_idx
  on public.academic_work_authors(author_openalex_id);

drop policy if exists "academic_catalog_insert" on public.academic_works;
drop policy if exists "academic_catalog_update" on public.academic_works;
drop policy if exists "academic_authors_insert" on public.academic_authors;
drop policy if exists "academic_authors_update" on public.academic_authors;
drop policy if exists "academic_journals_insert" on public.academic_journals;
drop policy if exists "academic_journals_update" on public.academic_journals;
drop policy if exists "academic_institutions_insert" on public.academic_institutions;
drop policy if exists "academic_institutions_update" on public.academic_institutions;
drop policy if exists "academic_work_authors_insert" on public.academic_work_authors;
drop policy if exists "academic_work_authors_update" on public.academic_work_authors;

revoke insert, update on public.academic_works from authenticated;
revoke insert, update on public.academic_authors from authenticated;
revoke insert, update on public.academic_journals from authenticated;
revoke insert, update on public.academic_institutions from authenticated;
revoke insert, update on public.academic_work_authors from authenticated;
