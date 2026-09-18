begin;

alter function public.get_hashtag_content(text, integer, timestamptz)
  security invoker;

alter function public.get_trending_hashtags()
  security invoker;

create or replace function public.get_same_book_readers(p_book_key text)
returns table(user_id uuid,username text,profile_image text)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_book_key is null or btrim(p_book_key) = '' then
    raise exception 'Book key is required';
  end if;

  return query
  select p.id, p.username, p.profile_image
  from public.user_book_status ubs
  join public.profiles p on p.id = ubs.user_id
  left join public.profile_privacy_settings privacy
    on privacy.user_id = ubs.user_id
  where ubs.book_key = p_book_key
    and ubs.status = 'reading'
    and ubs.user_id <> v_user_id
    and coalesce(privacy.discoverable, true) = true
    and not exists (
      select 1
      from public.user_blocks b
      where (b.blocker_id = v_user_id and b.blocked_id = ubs.user_id)
         or (b.blocker_id = ubs.user_id and b.blocked_id = v_user_id)
    )
  order by ubs.updated_at desc
  limit 10;
end;
$function$;

revoke all on function public.get_same_book_readers(text)
from public, anon;
grant execute on function public.get_same_book_readers(text)
to authenticated;

comment on function public.get_same_book_readers(text) is
'Authenticated same-book discovery. Only discoverable, non-blocked reader profiles are returned.';

commit;