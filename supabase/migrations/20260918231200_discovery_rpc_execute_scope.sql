begin;

revoke all on function public.get_hashtag_content(text, integer, timestamptz)
from public, anon;
revoke all on function public.get_trending_hashtags()
from public, anon;
revoke all on function public.get_same_book_readers(text)
from public, anon;

grant execute on function public.get_hashtag_content(text, integer, timestamptz)
to authenticated;
grant execute on function public.get_trending_hashtags()
to authenticated;
grant execute on function public.get_same_book_readers(text)
to authenticated;

commit;