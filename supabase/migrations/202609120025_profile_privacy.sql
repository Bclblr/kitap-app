begin;

create table if not exists public.profile_privacy_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  discoverable boolean not null default true,
  message_permission text not null default 'everyone'
    check (message_permission in ('everyone','followers','nobody')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profile_privacy_settings enable row level security;

drop policy if exists profile_privacy_select_own on public.profile_privacy_settings;
create policy profile_privacy_select_own
on public.profile_privacy_settings for select to authenticated
using (user_id = auth.uid());

drop policy if exists profile_privacy_insert_own on public.profile_privacy_settings;
create policy profile_privacy_insert_own
on public.profile_privacy_settings for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists profile_privacy_update_own on public.profile_privacy_settings;
create policy profile_privacy_update_own
on public.profile_privacy_settings for update to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.touch_profile_privacy_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profile_privacy_touch_updated_at on public.profile_privacy_settings;
create trigger profile_privacy_touch_updated_at
before update on public.profile_privacy_settings
for each row execute function public.touch_profile_privacy_updated_at();

create or replace function public.can_message_user(p_sender uuid, p_target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_sender is null or p_target is null then false
    when p_sender = p_target then false
    when exists (
      select 1 from public.user_blocks
      where (blocker_id = p_sender and blocked_id = p_target)
         or (blocker_id = p_target and blocked_id = p_sender)
    ) then false
    else case coalesce(
      (select message_permission from public.profile_privacy_settings where user_id = p_target),
      'everyone'
    )
      when 'everyone' then true
      when 'followers' then exists (
        select 1 from public.follows
        where follower_id = p_sender and following_id = p_target
      )
      when 'nobody' then false
      else true
    end
  end;
$$;

revoke all on function public.can_message_user(uuid, uuid) from public;
grant execute on function public.can_message_user(uuid, uuid) to authenticated;

create or replace function public.search_visible_profiles(p_query text, p_limit integer default 10)
returns table(
  id uuid,
  username text,
  profile_image text,
  bio text
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.username, p.profile_image, p.bio
  from public.profiles p
  left join public.profile_privacy_settings s on s.user_id = p.id
  where (coalesce(s.discoverable, true) or p.id = auth.uid())
    and p.username ilike '%' || coalesce(p_query, '') || '%'
    and not exists (
      select 1 from public.user_blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = p.id)
         or (b.blocker_id = p.id and b.blocked_id = auth.uid())
    )
  order by
    case when lower(p.username) = lower(coalesce(p_query,'')) then 0 else 1 end,
    p.username
  limit greatest(1, least(coalesce(p_limit,10), 50));
$$;

revoke all on function public.search_visible_profiles(text, integer) from public;
grant execute on function public.search_visible_profiles(text, integer) to authenticated;

-- Enforce recipient message preferences for every new message.
drop policy if exists message_privacy_guard on public.messages;
create policy message_privacy_guard
on public.messages
as restrictive
for insert
to authenticated
with check (
  sender_id = auth.uid()
  and exists (
    select 1
    from public.conversations c
    where c.id = conversation_id
      and auth.uid() in (c.user1_id, c.user2_id)
      and public.can_message_user(
        auth.uid(),
        case when c.user1_id = auth.uid() then c.user2_id else c.user1_id end
      )
  )
);

insert into public.profile_privacy_settings(user_id)
select id from auth.users
on conflict (user_id) do nothing;

commit;
