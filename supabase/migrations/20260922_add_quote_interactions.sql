create table if not exists public.quote_likes (
  quote_id uuid not null references public.quotes(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (quote_id, user_id)
);

create table if not exists public.quote_reposts (
  quote_id uuid not null references public.quotes(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (quote_id, user_id)
);

create table if not exists public.quote_comments (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  text text not null check (char_length(trim(text)) between 1 and 1000),
  created_at timestamptz not null default now()
);

alter table public.quote_likes enable row level security;
alter table public.quote_reposts enable row level security;
alter table public.quote_comments enable row level security;

drop policy if exists quote_likes_select on public.quote_likes;
create policy quote_likes_select on public.quote_likes for select to anon, authenticated using (true);
drop policy if exists quote_likes_insert on public.quote_likes;
create policy quote_likes_insert on public.quote_likes for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists quote_likes_delete on public.quote_likes;
create policy quote_likes_delete on public.quote_likes for delete to authenticated using (auth.uid() = user_id);

drop policy if exists quote_reposts_select on public.quote_reposts;
create policy quote_reposts_select on public.quote_reposts for select to anon, authenticated using (true);
drop policy if exists quote_reposts_insert on public.quote_reposts;
create policy quote_reposts_insert on public.quote_reposts for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists quote_reposts_delete on public.quote_reposts;
create policy quote_reposts_delete on public.quote_reposts for delete to authenticated using (auth.uid() = user_id);

drop policy if exists quote_comments_select on public.quote_comments;
create policy quote_comments_select on public.quote_comments for select to anon, authenticated using (true);
drop policy if exists quote_comments_insert on public.quote_comments;
create policy quote_comments_insert on public.quote_comments for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists quote_comments_update on public.quote_comments;
create policy quote_comments_update on public.quote_comments for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists quote_comments_delete on public.quote_comments;
create policy quote_comments_delete on public.quote_comments for delete to authenticated using (auth.uid() = user_id);

create index if not exists quote_comments_quote_id_created_at_idx on public.quote_comments (quote_id, created_at);
create index if not exists quote_likes_quote_id_idx on public.quote_likes (quote_id);
create index if not exists quote_reposts_quote_id_idx on public.quote_reposts (quote_id);


grant select on table public.quote_likes to anon, authenticated;
grant insert, delete on table public.quote_likes to authenticated;

grant select on table public.quote_reposts to anon, authenticated;
grant insert, delete on table public.quote_reposts to authenticated;

grant select on table public.quote_comments to anon, authenticated;
grant insert, update, delete on table public.quote_comments to authenticated;
