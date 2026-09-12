begin;

create or replace function public.filter_discoverable_reader_candidates(p_ids uuid[])
returns table(
  id uuid,
  is_private boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    coalesce(s.is_private, false) as is_private
  from public.profiles p
  left join public.profile_privacy_settings s on s.user_id = p.id
  where p.id = any(coalesce(p_ids, array[]::uuid[]))
    and coalesce(s.discoverable, true)
    and p.id <> auth.uid()
    and not exists (
      select 1
      from public.user_blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = p.id)
         or (b.blocker_id = p.id and b.blocked_id = auth.uid())
    );
$$;

revoke all on function public.filter_discoverable_reader_candidates(uuid[]) from public;
grant execute on function public.filter_discoverable_reader_candidates(uuid[]) to authenticated;

commit;
