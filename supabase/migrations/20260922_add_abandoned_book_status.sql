create or replace function public.set_user_book_status(
  p_book_key text,
  p_book_title text,
  p_status text
)
returns public.user_book_status
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid;
  v_result public.user_book_status;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_book_key is null or btrim(p_book_key) = '' then
    raise exception 'Book key is required';
  end if;

  if p_status not in ('reading', 'read', 'want', 'abandoned') then
    raise exception 'Invalid book status';
  end if;

  insert into public.user_book_status (user_id, book_key, book_title, status)
  values (v_user_id, p_book_key, p_book_title, p_status)
  on conflict (user_id, book_key)
  do update set book_title = excluded.book_title, status = excluded.status
  returning * into v_result;

  return v_result;
end;
$function$;

drop function if exists public.get_my_shelf_counts();

create function public.get_my_shelf_counts()
returns table(
  want_count bigint,
  reading_count bigint,
  read_count bigint,
  abandoned_count bigint,
  total_count bigint
)
language sql
stable
set search_path = ''
as $function$
  select
    count(*) filter (where status = 'want')::bigint,
    count(*) filter (where status = 'reading')::bigint,
    count(*) filter (where status = 'read')::bigint,
    count(*) filter (where status = 'abandoned')::bigint,
    count(*)::bigint
  from public.user_book_status
  where user_id = (select auth.uid());
$function$;

grant execute on function public.get_my_shelf_counts() to authenticated;
grant execute on function public.set_user_book_status(text, text, text) to authenticated;
