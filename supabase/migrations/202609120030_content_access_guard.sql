begin;

create or replace function public.can_view_user_content(p_owner uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_owner is not null
    and (
      p_owner = auth.uid()
      or (
        not exists (
          select 1
          from public.user_blocks b
          where (b.blocker_id = auth.uid() and b.blocked_id = p_owner)
             or (b.blocker_id = p_owner and b.blocked_id = auth.uid())
        )
        and public.can_view_profile_content(p_owner)
      )
    );
$$;

revoke all on function public.can_view_user_content(uuid) from public;
grant execute on function public.can_view_user_content(uuid) to anon, authenticated;

do $$
begin
  if to_regclass('public.posts') is not null then
    execute 'drop policy if exists private_profile_read_guard on public.posts';
    execute 'drop policy if exists content_access_guard on public.posts';
    execute 'create policy content_access_guard on public.posts as restrictive for select to public using (public.can_view_user_content(user_id))';
  end if;

  if to_regclass('public.reviews') is not null then
    execute 'drop policy if exists private_profile_read_guard on public.reviews';
    execute 'drop policy if exists content_access_guard on public.reviews';
    execute 'create policy content_access_guard on public.reviews as restrictive for select to public using (public.can_view_user_content(user_id))';
  end if;

  if to_regclass('public.quotes') is not null then
    execute 'drop policy if exists private_profile_read_guard on public.quotes';
    execute 'drop policy if exists content_access_guard on public.quotes';
    execute 'create policy content_access_guard on public.quotes as restrictive for select to public using (public.can_view_user_content(user_id))';
  end if;

  if to_regclass('public.stories') is not null then
    execute 'drop policy if exists private_profile_read_guard on public.stories';
    execute 'drop policy if exists content_access_guard on public.stories';
    execute 'create policy content_access_guard on public.stories as restrictive for select to public using (public.can_view_user_content(user_id))';
  end if;
end;
$$;

commit;
