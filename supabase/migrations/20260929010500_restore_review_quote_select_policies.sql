-- Restore the permissive SELECT policies required by PostgreSQL RLS.
-- The restrictive content_access_guard remains in place, so private-profile
-- and block visibility rules still apply to every visible row.

drop policy if exists reviews_select_visible on public.reviews;
create policy reviews_select_visible
on public.reviews
as permissive
for select
to anon, authenticated
using (public.can_view_user_content(user_id));

drop policy if exists quotes_select_visible on public.quotes;
create policy quotes_select_visible
on public.quotes
as permissive
for select
to anon, authenticated
using (public.can_view_user_content(user_id));
