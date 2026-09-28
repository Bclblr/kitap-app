alter table public.academic_search_cache
  drop constraint if exists academic_search_cache_entity_type_check;

alter table public.academic_search_cache
  add constraint academic_search_cache_entity_type_check
  check (entity_type in (
    'works','articles','theses','authors','journals','institutions',
    'work_detail','author_detail','journal_detail','institution_detail',
    'author_works','journal_works','institution_authors',
    'book_search','book_author_search','book_author_works','book_record'
  ));
