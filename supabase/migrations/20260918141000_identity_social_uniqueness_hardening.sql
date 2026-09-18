begin;

-- Backfill legacy saved_posts rows that predate user_id-based ownership.
update public.saved_posts sp
set user_id = p.id
from public.profiles p
where sp.user_id is null
  and lower(btrim(p.username)) = lower(btrim(sp.username));

do $$
begin
  if exists (
    select 1
    from public.saved_posts
    where user_id is null or post_id is null
  ) then
    raise exception 'saved_posts contains unresolved legacy ownership rows';
  end if;

  if exists (
    select 1
    from public.profiles
    where username is null or btrim(username) = ''
  ) then
    raise exception 'profiles contains blank usernames';
  end if;
end
$$;

alter table public.saved_posts
  alter column user_id set not null,
  alter column post_id set not null;

create unique index if not exists profiles_username_normalized_unique
  on public.profiles (lower(btrim(username)));

create unique index if not exists saved_posts_user_post_unique
  on public.saved_posts (user_id, post_id);

create unique index if not exists post_reposts_user_post_unique
  on public.post_reposts (user_id, post_id);

create unique index if not exists reposts_user_review_unique
  on public.reposts (user_id, review_id);

comment on index public.profiles_username_normalized_unique is
'Case-insensitive trimmed username uniqueness guarantee.';

commit;
