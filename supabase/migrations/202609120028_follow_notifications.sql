begin;

create table if not exists public.social_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete cascade,
  type text not null check (type in ('follow_request','follow_accepted','follow_rejected')),
  message text not null default '',
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists social_notifications_user_created_idx
  on public.social_notifications(user_id, created_at desc);

alter table public.social_notifications enable row level security;

drop policy if exists social_notifications_select_own on public.social_notifications;
create policy social_notifications_select_own
on public.social_notifications for select to authenticated
using (user_id = auth.uid());

drop policy if exists social_notifications_update_own on public.social_notifications;
create policy social_notifications_update_own
on public.social_notifications for update to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists social_notifications_delete_own on public.social_notifications;
create policy social_notifications_delete_own
on public.social_notifications for delete to authenticated
using (user_id = auth.uid());

grant select, update, delete on public.social_notifications to authenticated;

create or replace function public.notify_follow_request_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.should_deliver_notification(new.target_id, 'follow') then
    delete from public.social_notifications
    where user_id = new.target_id
      and actor_id = new.requester_id
      and type = 'follow_request';

    insert into public.social_notifications(user_id, actor_id, type, message)
    values (new.target_id, new.requester_id, 'follow_request', 'sana takip isteği gönderdi');
  end if;
  return new;
end;
$$;

drop trigger if exists follow_request_notification_trigger on public.follow_requests;
create trigger follow_request_notification_trigger
after insert on public.follow_requests
for each row execute function public.notify_follow_request_created();

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
    where requester_id = p_requester and target_id = v_target
  ) then
    raise exception 'follow request not found';
  end if;

  if coalesce(p_accept, false) then
    insert into public.follows(follower_id, following_id)
    values (p_requester, v_target)
    on conflict do nothing;
  end if;

  delete from public.follow_requests
  where requester_id = p_requester and target_id = v_target;

  delete from public.social_notifications
  where user_id = v_target
    and actor_id = p_requester
    and type = 'follow_request';

  if public.should_deliver_notification(p_requester, 'follow') then
    insert into public.social_notifications(user_id, actor_id, type, message)
    values (
      p_requester,
      v_target,
      case when coalesce(p_accept, false) then 'follow_accepted' else 'follow_rejected' end,
      case when coalesce(p_accept, false)
        then 'takip isteğini kabul etti'
        else 'takip isteğini reddetti'
      end
    );
  end if;
end;
$$;

revoke all on function public.respond_follow_request(uuid, boolean) from public;
grant execute on function public.respond_follow_request(uuid, boolean) to authenticated;

commit;
