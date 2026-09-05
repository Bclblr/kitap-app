-- Additive migration. Run in staging first; no production rows are modified.
begin;
create table if not exists public.user_blocks (
  blocker_id uuid references auth.users(id) on delete cascade,
  blocked_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(blocker_id, blocked_id), check(blocker_id <> blocked_id)
);
alter table public.user_blocks enable row level security;
drop policy if exists blocks_read on public.user_blocks;
create policy blocks_read on public.user_blocks for select to authenticated using(auth.uid() in (blocker_id, blocked_id));
drop policy if exists blocks_write on public.user_blocks;
create policy blocks_write on public.user_blocks for all to authenticated using(auth.uid() = blocker_id) with check(auth.uid() = blocker_id);
grant select, insert, delete on public.user_blocks to authenticated;
create or replace function public.readers_blocked(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $reader_blocked$
  select case
    when auth.uid() is null then false
    when auth.uid() <> a and auth.uid() <> b then false
    else exists (
      select 1
      from public.user_blocks
      where (blocker_id = a and blocked_id = b)
         or (blocker_id = b and blocked_id = a)
    )
  end;
$reader_blocked$;
revoke all on function public.readers_blocked(uuid,uuid) from public;
grant execute on function public.readers_blocked(uuid,uuid) to authenticated;

create table if not exists public.user_reports (
 id uuid primary key default gen_random_uuid(), reporter_id uuid not null references auth.users(id) on delete cascade,
 reported_id uuid not null references auth.users(id) on delete cascade, category text not null check(category in ('spam','harassment','inappropriate','impersonation','other')),
 description text not null default '' check(length(description)<=2000), created_at timestamptz not null default now(), check(reporter_id<>reported_id)
);
alter table public.user_reports enable row level security;
drop policy if exists reports_own on public.user_reports;
create policy reports_own on public.user_reports for select to authenticated using(reporter_id=auth.uid());
drop policy if exists reports_insert on public.user_reports;
create policy reports_insert on public.user_reports for insert to authenticated with check(reporter_id=auth.uid());
grant select, insert on public.user_reports to authenticated;

create table if not exists public.conversation_hidden (
 user_id uuid references auth.users(id) on delete cascade,
 conversation_id uuid references public.conversations(id) on delete cascade,
 hidden_at timestamptz not null default now(), primary key(user_id,conversation_id)
);
alter table public.conversation_hidden enable row level security;
drop policy if exists hidden_own on public.conversation_hidden;
create policy hidden_own on public.conversation_hidden for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid() and exists(select 1 from public.conversations c where c.id=conversation_id and auth.uid() in(c.user1_id,c.user2_id)));
grant select, insert, update, delete on public.conversation_hidden to authenticated;
-- Restrictive policies remain effective alongside pre-existing permissive policies.
alter table public.conversations enable row level security;
drop policy if exists conversation_participant_guard on public.conversations;
create policy conversation_participant_guard on public.conversations as restrictive for all to authenticated using(auth.uid() in(user1_id,user2_id)) with check(auth.uid() in(user1_id,user2_id));
alter table public.messages enable row level security;
drop policy if exists message_participant_guard on public.messages;
create policy message_participant_guard on public.messages as restrictive for all to authenticated using(exists(select 1 from public.conversations c where c.id=conversation_id and auth.uid() in(c.user1_id,c.user2_id))) with check(exists(select 1 from public.conversations c where c.id=conversation_id and auth.uid() in(c.user1_id,c.user2_id)));
drop policy if exists message_send_guard on public.messages;
create policy message_send_guard on public.messages as restrictive for insert to authenticated with check(sender_id=auth.uid() and exists(select 1 from public.conversations c where c.id=conversation_id and not public.readers_blocked(c.user1_id,c.user2_id)));
revoke all on public.messages, public.conversations from anon;

create table if not exists public.works (
 id uuid primary key default gen_random_uuid(), author_id uuid not null references auth.users(id) on delete cascade,
 title text not null check(length(trim(title)) between 1 and 160), description text not null default '', cover_url text,
 genre text not null default '', tags text[] not null default '{}', status text not null default 'draft' check(status in('draft','published')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), published_at timestamptz
);
create table if not exists public.work_chapters (
 id uuid primary key default gen_random_uuid(), work_id uuid not null references public.works(id) on delete cascade,
 title text not null check(length(trim(title)) between 1 and 160), content text not null default '',
 position integer not null default 1 check(position>0), status text not null default 'draft' check(status in('draft','published')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), published_at timestamptz,
 unique(work_id,position)
);
create index if not exists works_author_idx on public.works(author_id,updated_at desc);
create index if not exists works_published_idx on public.works(status,published_at desc);
alter table public.works enable row level security;
alter table public.work_chapters enable row level security;
drop policy if exists works_read on public.works;
create policy works_read on public.works for select using(status='published' or author_id=auth.uid());
drop policy if exists works_owner on public.works;
create policy works_owner on public.works for all to authenticated using(author_id=auth.uid()) with check(author_id=auth.uid());
drop policy if exists chapters_read on public.work_chapters;
create policy chapters_read on public.work_chapters for select using(exists(select 1 from public.works w where w.id=work_id and (w.author_id=auth.uid() or (w.status='published' and work_chapters.status='published'))));
drop policy if exists chapters_owner on public.work_chapters;
create policy chapters_owner on public.work_chapters for all to authenticated using(exists(select 1 from public.works w where w.id=work_id and w.author_id=auth.uid())) with check(exists(select 1 from public.works w where w.id=work_id and w.author_id=auth.uid()));
grant select on public.works, public.work_chapters to anon, authenticated;
grant insert, update, delete on public.works, public.work_chapters to authenticated;
create or replace function public.reader_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $reader_updated_at$
begin
  new.updated_at = now();

  if new.status = 'published'
     and new.published_at is null then
    new.published_at = now();
  end if;

  return new;
end;
$reader_updated_at$;
drop trigger if exists works_updated on public.works;
create trigger works_updated before insert or update on public.works for each row execute function public.reader_updated_at();
drop trigger if exists chapters_updated on public.work_chapters;
create trigger chapters_updated before insert or update on public.work_chapters for each row execute function public.reader_updated_at();
commit;
