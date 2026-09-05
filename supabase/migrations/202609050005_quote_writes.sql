begin;
create table if not exists public.quotes (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 book_key text not null default '', book_title text not null default '', text text not null,
 created_at timestamptz not null default now()
);
alter table public.quotes enable row level security;
create index if not exists quote_author_created_idx on public.quotes(user_id,created_at desc);
drop policy if exists reader_quote_read on public.quotes;
create policy reader_quote_read on public.quotes for select using(true);
drop policy if exists reader_quote_insert on public.quotes;
create policy reader_quote_insert on public.quotes for insert to authenticated with check(user_id=auth.uid());
drop policy if exists reader_quote_insert_guard on public.quotes;
create policy reader_quote_insert_guard on public.quotes as restrictive for insert to authenticated with check(user_id=auth.uid());
drop policy if exists reader_quote_update_guard on public.quotes;
create policy reader_quote_update_guard on public.quotes as restrictive for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
drop policy if exists reader_quote_delete_guard on public.quotes;
create policy reader_quote_delete_guard on public.quotes as restrictive for delete to authenticated using(user_id=auth.uid());
grant select on public.quotes to anon,authenticated;
grant insert, update, delete on public.quotes to authenticated;
commit;
