-- Academic content layer: OpenAlex/Crossref metadata + user reading tools

create table if not exists public.academic_works (
  openalex_id text primary key,
  doi text,
  title text not null,
  abstract text,
  publication_year integer,
  publication_date date,
  work_type text,
  language text,
  journal_openalex_id text,
  journal_name text,
  primary_topic text,
  cited_by_count integer not null default 0,
  external_url text,
  open_access_url text,
  pdf_url text,
  metadata jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.academic_authors (
  openalex_id text primary key,
  orcid text,
  display_name text not null,
  institution_openalex_id text,
  institution_name text,
  works_count integer not null default 0,
  cited_by_count integer not null default 0,
  topics jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.academic_journals (
  openalex_id text primary key,
  issn_l text,
  issn jsonb not null default '[]'::jsonb,
  name text not null,
  publisher text,
  homepage_url text,
  country_code text,
  works_count integer not null default 0,
  cited_by_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.academic_institutions (
  openalex_id text primary key,
  name text not null,
  country_code text,
  city text,
  institution_type text,
  homepage_url text,
  works_count integer not null default 0,
  cited_by_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.academic_work_authors (
  work_openalex_id text not null references public.academic_works(openalex_id) on delete cascade,
  author_openalex_id text not null references public.academic_authors(openalex_id) on delete cascade,
  author_position text,
  is_corresponding boolean not null default false,
  primary key (work_openalex_id, author_openalex_id)
);

create table if not exists public.saved_academic_works (
  user_id uuid not null references auth.users(id) on delete cascade,
  work_openalex_id text not null,
  title text not null,
  author_summary text,
  journal_name text,
  publication_year integer,
  doi text,
  created_at timestamptz not null default now(),
  primary key (user_id, work_openalex_id)
);

create table if not exists public.academic_reading_status (
  user_id uuid not null references auth.users(id) on delete cascade,
  work_openalex_id text not null,
  title text not null,
  author_summary text,
  journal_name text,
  publication_year integer,
  status text not null check (status in ('want','reading','read')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, work_openalex_id)
);

create table if not exists public.academic_work_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  work_openalex_id text not null,
  work_title text not null,
  content text not null check (char_length(content) between 1 and 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.followed_academic_entities (
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null check (entity_type in ('author','journal','institution')),
  entity_openalex_id text not null,
  display_name text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, entity_type, entity_openalex_id)
);

create index if not exists saved_academic_works_user_created_idx on public.saved_academic_works(user_id, created_at desc);
create index if not exists academic_reading_status_user_status_idx on public.academic_reading_status(user_id, status, updated_at desc);
create index if not exists academic_work_notes_user_work_idx on public.academic_work_notes(user_id, work_openalex_id, created_at desc);
create index if not exists followed_academic_entities_user_type_idx on public.followed_academic_entities(user_id, entity_type, created_at desc);

alter table public.academic_works enable row level security;
alter table public.academic_authors enable row level security;
alter table public.academic_journals enable row level security;
alter table public.academic_institutions enable row level security;
alter table public.academic_work_authors enable row level security;
alter table public.saved_academic_works enable row level security;
alter table public.academic_reading_status enable row level security;
alter table public.academic_work_notes enable row level security;
alter table public.followed_academic_entities enable row level security;

drop policy if exists "academic_catalog_select" on public.academic_works;
create policy "academic_catalog_select" on public.academic_works for select to authenticated using (true);
drop policy if exists "academic_authors_select" on public.academic_authors;
create policy "academic_authors_select" on public.academic_authors for select to authenticated using (true);
drop policy if exists "academic_journals_select" on public.academic_journals;
create policy "academic_journals_select" on public.academic_journals for select to authenticated using (true);
drop policy if exists "academic_institutions_select" on public.academic_institutions;
create policy "academic_institutions_select" on public.academic_institutions for select to authenticated using (true);
drop policy if exists "academic_work_authors_select" on public.academic_work_authors;
create policy "academic_work_authors_select" on public.academic_work_authors for select to authenticated using (true);

drop policy if exists "academic_catalog_insert" on public.academic_works;
create policy "academic_catalog_insert" on public.academic_works for insert to authenticated with check (true);
drop policy if exists "academic_catalog_update" on public.academic_works;
create policy "academic_catalog_update" on public.academic_works for update to authenticated using (true) with check (true);
drop policy if exists "academic_authors_insert" on public.academic_authors;
create policy "academic_authors_insert" on public.academic_authors for insert to authenticated with check (true);
drop policy if exists "academic_authors_update" on public.academic_authors;
create policy "academic_authors_update" on public.academic_authors for update to authenticated using (true) with check (true);
drop policy if exists "academic_journals_insert" on public.academic_journals;
create policy "academic_journals_insert" on public.academic_journals for insert to authenticated with check (true);
drop policy if exists "academic_journals_update" on public.academic_journals;
create policy "academic_journals_update" on public.academic_journals for update to authenticated using (true) with check (true);
drop policy if exists "academic_institutions_insert" on public.academic_institutions;
create policy "academic_institutions_insert" on public.academic_institutions for insert to authenticated with check (true);
drop policy if exists "academic_institutions_update" on public.academic_institutions;
create policy "academic_institutions_update" on public.academic_institutions for update to authenticated using (true) with check (true);
drop policy if exists "academic_work_authors_insert" on public.academic_work_authors;
create policy "academic_work_authors_insert" on public.academic_work_authors for insert to authenticated with check (true);
drop policy if exists "academic_work_authors_update" on public.academic_work_authors;
create policy "academic_work_authors_update" on public.academic_work_authors for update to authenticated using (true) with check (true);

drop policy if exists "saved_academic_works_own" on public.saved_academic_works;
create policy "saved_academic_works_own" on public.saved_academic_works for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "academic_reading_status_own" on public.academic_reading_status;
create policy "academic_reading_status_own" on public.academic_reading_status for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "academic_work_notes_own" on public.academic_work_notes;
create policy "academic_work_notes_own" on public.academic_work_notes for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "followed_academic_entities_own" on public.followed_academic_entities;
create policy "followed_academic_entities_own" on public.followed_academic_entities for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update on public.academic_works to authenticated;
grant select, insert, update on public.academic_authors to authenticated;
grant select, insert, update on public.academic_journals to authenticated;
grant select, insert, update on public.academic_institutions to authenticated;
grant select, insert, update on public.academic_work_authors to authenticated;
grant select, insert, update, delete on public.saved_academic_works to authenticated;
grant select, insert, update, delete on public.academic_reading_status to authenticated;
grant select, insert, update, delete on public.academic_work_notes to authenticated;
grant select, insert, update, delete on public.followed_academic_entities to authenticated;
