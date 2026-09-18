begin;

create or replace function public.can_message_user(
  p_sender uuid,
  p_target uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when auth.uid() is null then false
    when p_sender is null or p_target is null then false
    when p_sender <> auth.uid() then false
    when p_sender = p_target then false
    when exists (
      select 1
      from public.user_blocks
      where (blocker_id = p_sender and blocked_id = p_target)
         or (blocker_id = p_target and blocked_id = p_sender)
    ) then false
    else case coalesce(
      (
        select message_permission
        from public.profile_privacy_settings
        where user_id = p_target
      ),
      'everyone'
    )
      when 'everyone' then true
      when 'followers' then exists (
        select 1
        from public.follows
        where follower_id = p_sender
          and following_id = p_target
      )
      when 'nobody' then false
      else false
    end
  end;
$$;

revoke all on function public.can_message_user(uuid, uuid)
from public, anon;

grant execute on function public.can_message_user(uuid, uuid)
to authenticated;

comment on function public.can_message_user(uuid, uuid) is
'Authenticated messaging policy check. The supplied sender must equal auth.uid(); clients cannot impersonate another sender.';

commit;
