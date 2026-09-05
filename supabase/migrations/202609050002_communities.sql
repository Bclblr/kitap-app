begin;
create table if not exists public.communities (
 id uuid primary key default gen_random_uuid(), name text not null, description text, image_url text,
 created_by uuid references auth.users(id), created_at timestamptz not null default now()
);
alter table public.communities add column if not exists kind text not null default 'community';
alter table public.communities add column if not exists visibility text not null default 'public';
alter table public.communities add column if not exists rules text not null default '';
alter table public.communities add column if not exists tags text[] not null default '{}';
alter table public.communities add column if not exists current_book text;
create table if not exists public.community_members (
 community_id uuid references public.communities(id) on delete cascade,
 user_id uuid references auth.users(id) on delete cascade, joined_at timestamptz not null default now(), primary key(community_id,user_id)
);
alter table public.community_members add column if not exists role text not null default 'member';
create index if not exists community_member_user_idx on public.community_members(user_id,community_id);
create or replace function public.community_access(cid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $community_access$
  select exists (
    select 1
    from public.communities c
    where c.id = cid
      and (
        c.visibility = 'public'
        or c.created_by = auth.uid()
        or exists (
          select 1
          from public.community_members m
          where m.community_id = cid
            and m.user_id = auth.uid()
        )
      )
  );
$community_access$;
create or replace function public.community_admin(cid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $community_admin$
  select
    exists (
      select 1
      from public.communities c
      where c.id = cid
        and c.created_by = auth.uid()
    )
    or exists (
      select 1
      from public.community_members m
      where m.community_id = cid
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    );
$community_admin$;
revoke all on function public.community_access(uuid) from public;
revoke all on function public.community_admin(uuid) from public;
grant execute on function public.community_access(uuid) to anon, authenticated;
grant execute on function public.community_admin(uuid) to authenticated;
alter table public.communities enable row level security;
alter table public.community_members enable row level security;
drop policy if exists community_visibility_guard on public.communities;
create policy community_visibility_guard on public.communities as restrictive for select using(created_by=auth.uid() or visibility='public' or public.community_access(id));
drop policy if exists community_read on public.communities;
create policy community_read on public.communities for select using(created_by=auth.uid() or visibility='public' or public.community_access(id));
drop policy if exists community_create on public.communities;
create policy community_create on public.communities for insert to authenticated with check(created_by=auth.uid() and visibility in('public','private') and kind in('community','book_club'));
drop policy if exists community_edit on public.communities;
create policy community_edit on public.communities for update to authenticated using(public.community_admin(id)) with check(public.community_admin(id));
drop policy if exists community_edit_guard on public.communities;
create policy community_edit_guard on public.communities as restrictive for update to authenticated using(public.community_admin(id)) with check(public.community_admin(id));
drop policy if exists member_read on public.community_members;
create policy member_read on public.community_members for select using(public.community_access(community_id));
drop policy if exists member_read_guard on public.community_members;
create policy member_read_guard on public.community_members as restrictive for select using(public.community_access(community_id));
drop policy if exists member_join on public.community_members;
create policy member_join on public.community_members for insert to authenticated with check(user_id=auth.uid() and role='member' and exists(select 1 from public.communities c where c.id=community_id and c.visibility='public'));
drop policy if exists member_join_guard on public.community_members;
create policy member_join_guard on public.community_members as restrictive for insert to authenticated with check(user_id=auth.uid() and role='member' and exists(select 1 from public.communities c where c.id=community_id and c.visibility='public'));
drop policy if exists member_leave on public.community_members;
create policy member_leave on public.community_members for delete to authenticated using((user_id=auth.uid() or public.community_admin(community_id)) and not exists(select 1 from public.communities c where c.id=community_id and c.created_by=user_id));
drop policy if exists member_leave_guard on public.community_members;
create policy member_leave_guard on public.community_members as restrictive for delete to authenticated using((user_id=auth.uid() or public.community_admin(community_id)) and not exists(select 1 from public.communities c where c.id=community_id and c.created_by=user_id));
drop policy if exists member_role_guard on public.community_members;
create policy member_role_guard on public.community_members as restrictive for update to authenticated using(false) with check(false);
grant select on public.communities,public.community_members to anon,authenticated;
grant insert,update on public.communities to authenticated;
grant insert,delete on public.community_members to authenticated;
create or replace function public.community_owner_join()
returns trigger
language plpgsql
security definer
set search_path = ''
as $community_owner_join$
begin
  insert into public.community_members (
    community_id,
    user_id,
    role
  )
  values (
    new.id,
    new.created_by,
    'owner'
  );

  return new;
end;
$community_owner_join$;
revoke all on function public.community_owner_join() from public;

drop trigger if exists community_owner_join on public.communities;
create trigger community_owner_join after insert on public.communities for each row execute function public.community_owner_join();
create or replace function public.community_owner_immutable()
returns trigger
language plpgsql
set search_path = ''
as $community_owner_immutable$
begin
  if new.created_by is distinct from old.created_by then
    raise exception 'Community owner cannot change';
  end if;

  return new;
end;
$community_owner_immutable$;
revoke all on function public.community_owner_immutable() from public;

drop trigger if exists community_owner_immutable on public.communities;
create trigger community_owner_immutable before update on public.communities for each row execute function public.community_owner_immutable();
-- Protect existing community posts, comments and likes without removing their policies.
do $$ begin
 if to_regclass('public.community_posts') is not null then
  alter table public.community_posts enable row level security;
  drop policy if exists community_post_access_guard on public.community_posts;
  create policy community_post_access_guard on public.community_posts as restrictive for all using(public.community_access(community_id)) with check(public.community_access(community_id) and user_id=auth.uid() and exists(select 1 from public.community_members m where m.community_id=community_posts.community_id and m.user_id=auth.uid()));
 end if;
 if to_regclass('public.community_post_comments') is not null then
  alter table public.community_post_comments enable row level security;
  drop policy if exists community_comment_access_guard on public.community_post_comments;
  create policy community_comment_access_guard on public.community_post_comments as restrictive for all using(exists(select 1 from public.community_posts p where p.id=post_id and public.community_access(p.community_id))) with check(user_id=auth.uid() and exists(select 1 from public.community_posts p where p.id=post_id and public.community_access(p.community_id)));
 end if;
 if to_regclass('public.community_post_likes') is not null then
  alter table public.community_post_likes enable row level security;
  drop policy if exists community_like_access_guard on public.community_post_likes;
  create policy community_like_access_guard on public.community_post_likes as restrictive for all using(exists(select 1 from public.community_posts p where p.id=post_id and public.community_access(p.community_id))) with check(user_id=auth.uid() and exists(select 1 from public.community_posts p where p.id=post_id and public.community_access(p.community_id)));
 end if;
end $$;
commit;
