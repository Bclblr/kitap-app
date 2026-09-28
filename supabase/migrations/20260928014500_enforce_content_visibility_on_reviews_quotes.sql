drop policy if exists "Reviews are viewable by everyone" on public.reviews;
drop policy if exists reviews_select on public.reviews;

drop policy if exists "Quotes are viewable by everyone" on public.quotes;
drop policy if exists quotes_select_authenticated on public.quotes;
drop policy if exists reader_quote_read on public.quotes;
