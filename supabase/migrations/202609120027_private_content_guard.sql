begin;

create or replace function public.can_view_profile_content(p_owner uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_owner = auth.uid()
    or not coalesce((
      select s.is_private
      from public.profile_privacy_settings s
      where s.user_id = p_owner
    ), false)
    or exists (
      select 1
      from public.follows f
      where f.follower_id = auth.uid()
        and f.following_id = p_owner
    );
$$;

revoke all on function public.can_view_profile_content(uuid) from public;
grant execute on function public.can_view_profile_content(uuid) to anon, authenticated;

do $$
begin
  if to_regclass('public.posts') is not null then
    execute 'drop policy if exists private_profile_read_guard on public.posts';
    execute 'create policy private_profile_read_guard on public.posts as restrictive for select to public using (public.can_view_profile_content(user_id))';
  end if;

  if to_regclass('public.reviews') is not null then
    execute 'drop policy if exists private_profile_read_guard on public.reviews';
    execute 'create policy private_profile_read_guard on public.reviews as restrictive for select to public using (public.can_view_profile_content(user_id))';
  end if;

  if to_regclass('public.quotes') is not null then
    execute 'drop policy if exists private_profile_read_guard on public.quotes';
    execute 'create policy private_profile_read_guard on public.quotes as restrictive for select to public using (public.can_view_profile_content(user_id))';
  end if;

  if to_regclass('public.stories') is not null then
    execute 'drop policy if exists private_profile_read_guard on public.stories';
    execute 'create policy private_profile_read_guard on public.stories as restrictive for select to public using (public.can_view_profile_content(user_id))';
  end if;
end;
$$;

commit;
