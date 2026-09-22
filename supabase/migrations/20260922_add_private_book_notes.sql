create table if not exists public.book_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  book_key text not null,
  book_title text not null,
  content text not null check (char_length(btrim(content)) between 1 and 5000),
  page_number integer null check (page_number is null or page_number > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists book_notes_user_book_idx
  on public.book_notes (user_id, book_key, created_at desc);

alter table public.book_notes enable row level security;

drop policy if exists "Users can read own book notes" on public.book_notes;
create policy "Users can read own book notes"
on public.book_notes for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Users can create own book notes" on public.book_notes;
create policy "Users can create own book notes"
on public.book_notes for insert to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists "Users can update own book notes" on public.book_notes;
create policy "Users can update own book notes"
on public.book_notes for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "Users can delete own book notes" on public.book_notes;
create policy "Users can delete own book notes"
on public.book_notes for delete to authenticated
using (user_id = (select auth.uid()));

grant select, insert, update, delete on public.book_notes to authenticated;
