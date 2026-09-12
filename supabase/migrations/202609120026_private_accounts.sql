begin;

alter table public.profile_privacy_settings
  add column if not exists is_private boolean not null default false;

create table if not exists public.follow_requests (
  requester_id uuid not null references auth.users(id) on delete cascade,
  target_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (requester_id, target_id),
  check (requester_id <> target_id)
);

create index if not exists follow_requests_target_created_idx
  on public.follow_requests(target_id, created_at desc);

alter table public.follow_requests enable row level security;

drop policy if exists follow_requests_participants_read on public.follow_requests;
create policy follow_requests_participants_read
on public.follow_requests
for select
to authenticated
using (auth.uid() in (requester_id, target_id));

drop policy if exists follow_requests_requester_insert on public.follow_requests;
create policy follow_requests_requester_insert
on public.follow_requests
for insert
to authenticated
with check (
  requester_id = auth.uid()
  and requester_id <> target_id
  and not exists (
    select 1
    from public.user_blocks b
    where (b.blocker_id = requester_id and b.blocked_id = target_id)
       or (b.blocker_id = target_id and b.blocked_id = requester_id)
  )
);

drop policy if exists follow_requests_participants_delete on public.follow_requests;
create policy follow_requests_participants_delete
on public.follow_requests
for delete
to authenticated
using (auth.uid() in (requester_id, target_id));

grant select, insert, delete on public.follow_requests to authenticated;

create or replace function public.request_follow(p_target uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_private boolean := false;
begin
  if v_user is null then
    raise exception 'authentication required';
  end if;

  if p_target is null or p_target = v_user then
    raise exception 'invalid follow target';
  end if;

  if exists (
    select 1 from public.user_blocks b
    where (b.blocker_id = v_user and b.blocked_id = p_target)
       or (b.blocker_id = p_target and b.blocked_id = v_user)
  ) then
    raise exception 'follow blocked';
  end if;

  if exists (
    select 1 from public.follows f
    where f.follower_id = v_user and f.following_id = p_target
  ) then
    delete from public.follow_requests
    where requester_id = v_user and target_id = p_target;
    return 'following';
  end if;

  select coalesce(s.is_private, false)
  into v_private
  from public.profile_privacy_settings s
  where s.user_id = p_target;

  v_private := coalesce(v_private, false);

  if v_private then
    insert into public.follow_requests(requester_id, target_id)
    values (v_user, p_target)
    on conflict (requester_id, target_id) do nothing;
    return 'requested';
  end if;

  insert into public.follows(follower_id, following_id)
  values (v_user, p_target)
  on conflict do nothing;

  delete from public.follow_requests
  where requester_id = v_user and target_id = p_target;

  return 'following';
end;
$$;

revoke all on function public.request_follow(uuid) from public;
grant execute on function public.request_follow(uuid) to authenticated;

create or replace function public.cancel_follow_request(p_target uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.follow_requests
  where requester_id = auth.uid()
    and target_id = p_target;
$$;

revoke all on function public.cancel_follow_request(uuid) from public;
grant execute on function public.cancel_follow_request(uuid) to authenticated;

create or replace function public.respond_follow_request(
  p_requester uuid,
  p_accept boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target uuid := auth.uid();
begin
  if v_target is null then
    raise exception 'authentication required';
  end if;

  if not exists (
    select 1 from public.follow_requests
    where requester_id = p_requester
      and target_id = v_target
  ) then
    raise exception 'follow request not found';
  end if;

  if coalesce(p_accept, false) then
    insert into public.follows(follower_id, following_id)
    values (p_requester, v_target)
    on conflict do nothing;
  end if;

  delete from public.follow_requests
  where requester_id = p_requester
    and target_id = v_target;
end;
$$;

revoke all on function public.respond_follow_request(uuid, boolean) from public;
grant execute on function public.respond_follow_request(uuid, boolean) to authenticated;

create or replace function public.get_follow_relationship(p_target uuid)
returns table(
  is_following boolean,
  request_pending boolean,
  is_private boolean,
  can_view_content boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1 from public.follows f
      where f.follower_id = auth.uid()
        and f.following_id = p_target
    ) as is_following,
    exists (
      select 1 from public.follow_requests r
      where r.requester_id = auth.uid()
        and r.target_id = p_target
    ) as request_pending,
    coalesce((
      select s.is_private
      from public.profile_privacy_settings s
      where s.user_id = p_target
    ), false) as is_private,
    (
      p_target = auth.uid()
      or not coalesce((
        select s.is_private
        from public.profile_privacy_settings s
        where s.user_id = p_target
      ), false)
      or exists (
        select 1 from public.follows f
        where f.follower_id = auth.uid()
          and f.following_id = p_target
      )
    ) as can_view_content;
$$;

revoke all on function public.get_follow_relationship(uuid) from public;
grant execute on function public.get_follow_relationship(uuid) to authenticated;

create or replace function public.enforce_private_follow_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.follower_id = new.following_id then
    raise exception 'cannot follow self';
  end if;

  if exists (
    select 1 from public.user_blocks b
    where (b.blocker_id = new.follower_id and b.blocked_id = new.following_id)
       or (b.blocker_id = new.following_id and b.blocked_id = new.follower_id)
  ) then
    raise exception 'follow blocked';
  end if;

  if not coalesce((
    select s.is_private
    from public.profile_privacy_settings s
    where s.user_id = new.following_id
  ), false) then
    return new;
  end if;

  if auth.uid() = new.following_id and exists (
    select 1 from public.follow_requests r
    where r.requester_id = new.follower_id
      and r.target_id = new.following_id
  ) then
    return new;
  end if;

  raise exception 'private account requires approved follow request';
end;
$$;

drop trigger if exists enforce_private_follow_insert_trigger on public.follows;
create trigger enforce_private_follow_insert_trigger
before insert on public.follows
for each row execute function public.enforce_private_follow_insert();

commit;
