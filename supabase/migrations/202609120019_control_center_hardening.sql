begin;

-- Admin notes and per-user controls must not be readable by unrelated users.
drop policy if exists profile_admin_controls_read on public.profile_admin_controls;
create policy profile_admin_controls_read
on public.profile_admin_controls
for select
to authenticated
using (
  user_id = auth.uid()
  or public.has_admin_role(array['admin','super_admin'])
);

-- Public-facing clients can ask only for the verification flag, without exposing admin notes.
create or replace function public.public_profile_verifications(p_user_ids uuid[])
returns table(user_id uuid, verified boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, coalesce(c.verified,false)
  from public.profiles p
  left join public.profile_admin_controls c on c.user_id = p.id
  where p.id = any(coalesce(p_user_ids,'{}'::uuid[]));
$$;

revoke all on function public.public_profile_verifications(uuid[]) from public;
grant execute on function public.public_profile_verifications(uuid[]) to authenticated;

commit;
