-- Legacy core schema baseline.
-- These tables pre-dated the repository migration history in the remote project.
-- Keep this migration additive/idempotent so fresh local databases can replay the chain.

begin;

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null default 'Kitap Okuru',
  bio text default '',
  profile_image text,
  cover_image text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  full_name text
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  text text,
  image_url text,
  book_key text,
  book_title text,
  rating integer default 0,
  created_at timestamptz default now(),
  user_id uuid references auth.users(id) on delete cascade
);

create table if not exists public.post_likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(post_id,user_id)
);

create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.post_reposts (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.saved_posts (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.posts(id) on delete cascade,
  username text not null,
  created_at timestamptz default now(),
  user_id uuid references auth.users(id) on delete cascade
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  book_key text not null,
  book_title text not null,
  rating integer not null check(rating between 1 and 5),
  text text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.likes (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(review_id,user_id)
);

create table if not exists public.reposts (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(review_id,user_id)
);

create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  username text not null,
  text text,
  image_url text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user1_id uuid not null references auth.users(id) on delete cascade,
  user2_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_pair_key text generated always as (
    least(user1_id::text,user2_id::text) || '_' || greatest(user1_id::text,user2_id::text)
  ) stored,
  constraint conversations_no_self_chat check(user1_id<>user2_id),
  constraint conversations_unique_user_pair unique(user_pair_key)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  is_read boolean not null default false,
  constraint messages_content_not_empty check(length(trim(content))>0)
);

create table if not exists public.follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint follows_no_self check(follower_id<>following_id),
  unique(follower_id,following_id)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete cascade,
  type text not null,
  review_id uuid references public.reviews(id) on delete cascade,
  message text not null,
  read boolean not null default false,
  created_at timestamptz not null default now(),
  post_id uuid references public.posts(id) on delete cascade
);

create index if not exists posts_user_id_idx on public.posts(user_id);
create index if not exists post_likes_post_id_idx on public.post_likes(post_id);
create index if not exists post_comments_post_id_idx on public.post_comments(post_id);
create index if not exists post_reposts_post_id_idx on public.post_reposts(post_id);
create index if not exists comments_user_id_idx on public.comments(user_id);
create index if not exists likes_user_id_idx on public.likes(user_id);
create index if not exists reposts_user_id_idx on public.reposts(user_id);
create index if not exists stories_user_id_idx on public.stories(user_id);
create index if not exists stories_created_at_idx on public.stories(created_at desc);
create index if not exists stories_expires_at_idx on public.stories(expires_at);
create index if not exists conversations_user1_idx on public.conversations(user1_id);
create index if not exists conversations_user2_idx on public.conversations(user2_id);
create index if not exists conversations_updated_at_idx on public.conversations(updated_at desc);
create index if not exists messages_conversation_idx on public.messages(conversation_id);
create index if not exists messages_sender_idx on public.messages(sender_id);
create index if not exists messages_created_at_idx on public.messages(created_at);
create index if not exists follows_follower_id_idx on public.follows(follower_id);
create index if not exists follows_following_id_idx on public.follows(following_id);

alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.post_likes enable row level security;
alter table public.post_comments enable row level security;
alter table public.post_reposts enable row level security;
alter table public.saved_posts enable row level security;
alter table public.reviews enable row level security;
alter table public.comments enable row level security;
alter table public.likes enable row level security;
alter table public.reposts enable row level security;
alter table public.stories enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.follows enable row level security;
alter table public.notifications enable row level security;

commit;
