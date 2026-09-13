begin;

create table if not exists public.community_invites (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  inviter_id uuid not null references auth.users(id) on delete cascade,
  invitee_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined','cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (community_id, invitee_id)
);

create index if not exists community_invites_invitee_idx
  on public.community_invites(invitee_id, status, created_at desc);
create index if not exists community_invites_community_idx
  on public.community_invites(community_id, status, created_at desc);

alter table public.community_invites enable row level security;

create or replace function public.invite_to_community(p_community_id uuid, p_invitee_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  invite_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.community_admin(p_community_id) then
    raise exception 'Not allowed to invite to this community';
  end if;

  if p_invitee_id = auth.uid() then
    raise exception 'You cannot invite yourself';
  end if;

  if exists (
    select 1 from public.community_members
    where community_id = p_community_id and user_id = p_invitee_id
  ) then
    raise exception 'User is already a member';
  end if;

  insert into public.community_invites (community_id, inviter_id, invitee_id, status, created_at, responded_at)
  values (p_community_id, auth.uid(), p_invitee_id, 'pending', now(), null)
  on conflict (community_id, invitee_id)
  do update set
    inviter_id = excluded.inviter_id,
    status = 'pending',
    created_at = now(),
    responded_at = null
  returning id into invite_id;

  return invite_id;
end;
$$;

create or replace function public.respond_to_community_invite(p_invite_id uuid, p_accept boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  invite_row public.community_invites%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into invite_row
  from public.community_invites
  where id = p_invite_id
    and invitee_id = auth.uid()
    and status = 'pending'
  for update;

  if invite_row.id is null then
    raise exception 'Pending invitation not found';
  end if;

  if p_accept then
    insert into public.community_members (community_id, user_id, role)
    values (invite_row.community_id, auth.uid(), 'member')
    on conflict (community_id, user_id) do nothing;

    update public.community_invites
    set status = 'accepted', responded_at = now()
    where id = p_invite_id;
  else
    update public.community_invites
    set status = 'declined', responded_at = now()
    where id = p_invite_id;
  end if;

  return true;
end;
$$;

create or replace function public.get_my_community_invites()
returns table (
  invite_id uuid,
  community_id uuid,
  community_name text,
  community_image_url text,
  inviter_id uuid,
  inviter_username text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    i.id,
    i.community_id,
    c.name,
    c.image_url,
    i.inviter_id,
    coalesce(p.username, 'Kullanıcı'),
    i.created_at
  from public.community_invites i
  join public.communities c on c.id = i.community_id
  left join public.profiles p on p.id = i.inviter_id
  where i.invitee_id = auth.uid()
    and i.status = 'pending'
  order by i.created_at desc;
$$;

revoke all on function public.invite_to_community(uuid, uuid) from public;
revoke all on function public.respond_to_community_invite(uuid, boolean) from public;
revoke all on function public.get_my_community_invites() from public;
grant execute on function public.invite_to_community(uuid, uuid) to authenticated;
grant execute on function public.respond_to_community_invite(uuid, boolean) to authenticated;
grant execute on function public.get_my_community_invites() to authenticated;

drop policy if exists community_invites_read on public.community_invites;
create policy community_invites_read on public.community_invites
for select to authenticated
using (invitee_id = auth.uid() or public.community_admin(community_id));

revoke all on public.community_invites from anon;
grant select on public.community_invites to authenticated;

commit;
