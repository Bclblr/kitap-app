alter table public.posts add column if not exists view_count integer not null default 0;
alter table public.reviews add column if not exists view_count integer not null default 0;
alter table public.quotes add column if not exists view_count integer not null default 0;

create table if not exists public.content_views (
  id uuid primary key default gen_random_uuid(),
  content_type text not null check (content_type in ('post','review','quote')),
  content_id uuid not null,
  viewer_id uuid not null references auth.users(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  unique (content_type, content_id, viewer_id)
);

alter table public.content_views enable row level security;
revoke all on table public.content_views from anon, authenticated;

create or replace function public.record_content_view(
  p_content_type text,
  p_content_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_viewer uuid := auth.uid();
  v_owner uuid;
  v_inserted integer := 0;
  v_count integer := 0;
begin
  if v_viewer is null then return 0; end if;

  if p_content_type = 'post' then
    select user_id, view_count into v_owner, v_count from public.posts where id = p_content_id;
  elsif p_content_type = 'review' then
    select user_id, view_count into v_owner, v_count from public.reviews where id = p_content_id;
  elsif p_content_type = 'quote' then
    select user_id, view_count into v_owner, v_count from public.quotes where id = p_content_id;
  else
    raise exception 'unsupported content type';
  end if;

  if not found then return 0; end if;
  if v_owner = v_viewer then return coalesce(v_count, 0); end if;

  insert into public.content_views (content_type, content_id, viewer_id)
  values (p_content_type, p_content_id, v_viewer)
  on conflict (content_type, content_id, viewer_id) do nothing;

  get diagnostics v_inserted = row_count;

  if v_inserted = 1 then
    if p_content_type = 'post' then
      update public.posts set view_count = view_count + 1 where id = p_content_id returning view_count into v_count;
    elsif p_content_type = 'review' then
      update public.reviews set view_count = view_count + 1 where id = p_content_id returning view_count into v_count;
    else
      update public.quotes set view_count = view_count + 1 where id = p_content_id returning view_count into v_count;
    end if;
  end if;

  return coalesce(v_count, 0);
end;
$$;

revoke all on function public.record_content_view(text, uuid) from public;
grant execute on function public.record_content_view(text, uuid) to authenticated;
