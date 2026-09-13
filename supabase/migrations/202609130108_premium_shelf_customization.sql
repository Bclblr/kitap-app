begin;

create table if not exists public.premium_shelf_customizations (
  user_id uuid primary key references auth.users(id) on delete cascade,
  want_label text not null default 'Okuyacağım' check (char_length(want_label) between 1 and 24),
  reading_label text not null default 'Okuyorum' check (char_length(reading_label) between 1 and 24),
  read_label text not null default 'Okudum' check (char_length(read_label) between 1 and 24),
  layout_key text not null default 'cozy' check (layout_key in ('cozy', 'compact')),
  accent_key text not null default 'purple' check (accent_key in ('purple', 'gold', 'midnight', 'forest')),
  show_counts boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.premium_shelf_customizations enable row level security;

drop policy if exists "Users can read own Premium shelf customization"
on public.premium_shelf_customizations;

create policy "Users can read own Premium shelf customization"
on public.premium_shelf_customizations
for select
to authenticated
using (auth.uid() = user_id);

revoke all on public.premium_shelf_customizations from anon;
revoke insert, update, delete on public.premium_shelf_customizations from authenticated;
grant select on public.premium_shelf_customizations to authenticated;

create or replace function public.set_premium_shelf_customization(
  p_want_label text,
  p_reading_label text,
  p_read_label text,
  p_layout_key text,
  p_accent_key text,
  p_show_counts boolean
)
returns public.premium_shelf_customizations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_want text := trim(coalesce(p_want_label, ''));
  v_reading text := trim(coalesce(p_reading_label, ''));
  v_read text := trim(coalesce(p_read_label, ''));
  v_layout text := lower(trim(coalesce(p_layout_key, '')));
  v_accent text := lower(trim(coalesce(p_accent_key, '')));
  v_row public.premium_shelf_customizations;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.premium_entitlements pe
    where pe.user_id = v_user_id
      and pe.status in ('active', 'trialing', 'grace_period')
      and pe.revoked_at is null
      and pe.starts_at <= now()
      and (pe.expires_at is null or pe.expires_at > now())
  ) then
    raise exception 'Premium required' using errcode = '42501';
  end if;

  if char_length(v_want) not between 1 and 24
     or char_length(v_reading) not between 1 and 24
     or char_length(v_read) not between 1 and 24 then
    raise exception 'Shelf labels must be between 1 and 24 characters' using errcode = '22023';
  end if;

  if v_layout not in ('cozy', 'compact') then
    raise exception 'Invalid shelf layout' using errcode = '22023';
  end if;

  if v_accent not in ('purple', 'gold', 'midnight', 'forest') then
    raise exception 'Invalid shelf accent' using errcode = '22023';
  end if;

  insert into public.premium_shelf_customizations (
    user_id,
    want_label,
    reading_label,
    read_label,
    layout_key,
    accent_key,
    show_counts
  )
  values (
    v_user_id,
    v_want,
    v_reading,
    v_read,
    v_layout,
    v_accent,
    coalesce(p_show_counts, true)
  )
  on conflict (user_id) do update
  set
    want_label = excluded.want_label,
    reading_label = excluded.reading_label,
    read_label = excluded.read_label,
    layout_key = excluded.layout_key,
    accent_key = excluded.accent_key,
    show_counts = excluded.show_counts,
    updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.set_premium_shelf_customization(text,text,text,text,text,boolean)
from public, anon;

grant execute on function public.set_premium_shelf_customization(text,text,text,text,text,boolean)
to authenticated;

comment on table public.premium_shelf_customizations is
'Premium-only presentation preferences for the three canonical reading-status shelves.';

commit;
