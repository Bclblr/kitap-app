begin;

-- Fresh installs must be able to build the community feed schema without
-- depending on tables that happened to exist in the hosted project.
create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.community_post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.community_post_likes (
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index if not exists community_posts_community_created_idx
  on public.community_posts(community_id, created_at desc);
create index if not exists community_posts_user_idx
  on public.community_posts(user_id);
create index if not exists community_post_comments_post_created_idx
  on public.community_post_comments(post_id, created_at);
create index if not exists community_post_comments_user_idx
  on public.community_post_comments(user_id);
create index if not exists community_post_likes_user_idx
  on public.community_post_likes(user_id);

alter table public.community_posts enable row level security;
alter table public.community_post_comments enable row level security;
alter table public.community_post_likes enable row level security;

-- Fresh-install baseline policies. Restrictive hardening policies below are
-- intentionally layered on top of these permissive operation policies.
drop policy if exists "Authenticated users can view community posts"
  on public.community_posts;
create policy "Authenticated users can view community posts"
on public.community_posts
for select
to authenticated
using (true);

drop policy if exists "Community members can create posts"
  on public.community_posts;
create policy "Community members can create posts"
on public.community_posts
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.community_members cm
    where cm.community_id = community_posts.community_id
      and cm.user_id = auth.uid()
  )
);

drop policy if exists "Users can delete own community posts"
  on public.community_posts;
create policy "Users can delete own community posts"
on public.community_posts
for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "Authenticated users can view community post comments"
  on public.community_post_comments;
create policy "Authenticated users can view community post comments"
on public.community_post_comments
for select
to authenticated
using (true);

drop policy if exists "Users can comment on community posts"
  on public.community_post_comments;
create policy "Users can comment on community posts"
on public.community_post_comments
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Users can delete own community post comments"
  on public.community_post_comments;
create policy "Users can delete own community post comments"
on public.community_post_comments
for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "Authenticated users can view community post likes"
  on public.community_post_likes;
create policy "Authenticated users can view community post likes"
on public.community_post_likes
for select
to authenticated
using (true);

drop policy if exists "Users can like community posts"
  on public.community_post_likes;
create policy "Users can like community posts"
on public.community_post_likes
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Users can remove own community post likes"
  on public.community_post_likes;
create policy "Users can remove own community post likes"
on public.community_post_likes
for delete
to authenticated
using (user_id = auth.uid());

-- Recreate the restrictive community guards even on a clean database, because
-- the older migrations could only add them when these legacy tables already
-- existed.
drop policy if exists community_post_access_guard on public.community_posts;
create policy community_post_access_guard
on public.community_posts
as restrictive
for all
using (public.community_access(community_id))
with check (
  public.community_access(community_id)
  and user_id = auth.uid()
  and exists (
    select 1
    from public.community_members m
    where m.community_id = community_posts.community_id
      and m.user_id = auth.uid()
  )
);

drop policy if exists community_post_delete_guard on public.community_posts;
create policy community_post_delete_guard
on public.community_posts
as restrictive
for delete
using (user_id = auth.uid() or public.community_admin(community_id));

drop policy if exists community_post_update_guard on public.community_posts;
create policy community_post_update_guard
on public.community_posts
as restrictive
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists community_comment_access_guard
  on public.community_post_comments;
create policy community_comment_access_guard
on public.community_post_comments
as restrictive
for all
using (
  exists (
    select 1
    from public.community_posts p
    where p.id = post_id
      and public.community_access(p.community_id)
  )
)
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.community_posts p
    where p.id = post_id
      and public.community_access(p.community_id)
  )
);

drop policy if exists community_comment_delete_guard
  on public.community_post_comments;
create policy community_comment_delete_guard
on public.community_post_comments
as restrictive
for delete
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.community_posts p
    where p.id = post_id
      and public.community_admin(p.community_id)
  )
);

drop policy if exists community_comment_update_guard
  on public.community_post_comments;
create policy community_comment_update_guard
on public.community_post_comments
as restrictive
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists community_like_access_guard
  on public.community_post_likes;
create policy community_like_access_guard
on public.community_post_likes
as restrictive
for all
using (
  exists (
    select 1
    from public.community_posts p
    where p.id = post_id
      and public.community_access(p.community_id)
  )
)
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.community_posts p
    where p.id = post_id
      and public.community_access(p.community_id)
  )
);

drop policy if exists community_like_delete_guard
  on public.community_post_likes;
create policy community_like_delete_guard
on public.community_post_likes
as restrictive
for delete
using (user_id = auth.uid());

grant select, insert, update, delete
on public.community_posts, public.community_post_comments, public.community_post_likes
to authenticated;

-- Profiles need a permissive baseline before restrictive/profile privacy
-- hardening can compose with it on a fresh database.
drop policy if exists "Profiles are publicly readable" on public.profiles;
create policy "Profiles are publicly readable"
on public.profiles
for select
to anon, authenticated
using (true);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

grant select on public.profiles to anon, authenticated;
grant insert, update on public.profiles to authenticated;

-- Chat hardening migrations add restrictive guards. These permissive policies
-- are required so clean installs still have an operation policy to intersect
-- with those guards.
drop policy if exists "Users can view their conversations"
  on public.conversations;
create policy "Users can view their conversations"
on public.conversations
for select
to authenticated
using (auth.uid() = user1_id or auth.uid() = user2_id);

drop policy if exists "Users can create conversations"
  on public.conversations;
create policy "Users can create conversations"
on public.conversations
for insert
to authenticated
with check (auth.uid() = user1_id or auth.uid() = user2_id);

drop policy if exists "Users can update their conversations"
  on public.conversations;
create policy "Users can update their conversations"
on public.conversations
for update
to authenticated
using (auth.uid() = user1_id or auth.uid() = user2_id)
with check (auth.uid() = user1_id or auth.uid() = user2_id);

drop policy if exists "Users can view messages in their conversations"
  on public.messages;
create policy "Users can view messages in their conversations"
on public.messages
for select
to authenticated
using (
  exists (
    select 1
    from public.conversations c
    where c.id = messages.conversation_id
      and (c.user1_id = auth.uid() or c.user2_id = auth.uid())
  )
);

drop policy if exists "Users can send messages" on public.messages;
create policy "Users can send messages"
on public.messages
for insert
to authenticated
with check (
  sender_id = auth.uid()
  and exists (
    select 1
    from public.conversations c
    where c.id = messages.conversation_id
      and (c.user1_id = auth.uid() or c.user2_id = auth.uid())
  )
);

drop policy if exists "Users can mark messages as read" on public.messages;
create policy "Users can mark messages as read"
on public.messages
for update
to authenticated
using (
  exists (
    select 1
    from public.conversations c
    where c.id = messages.conversation_id
      and (c.user1_id = auth.uid() or c.user2_id = auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.conversations c
    where c.id = messages.conversation_id
      and (c.user1_id = auth.uid() or c.user2_id = auth.uid())
  )
);

grant select, insert, update on public.conversations to authenticated;
grant select, insert, update on public.messages to authenticated;

commit;
