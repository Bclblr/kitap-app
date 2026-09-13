begin;

create table if not exists public.premium_profile_customizations (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme_key text not null default 'purple'
    check (theme_key in ('purple','gold','midnight','forest')),
  layout_key text not null default 'classic'
    check (layout_key in ('classic','spotlight')),
  highlight_text text not null default ''
    check (char_length(highlight_text) <= 80),
  show_premium_frame boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.premium_profile_customizations enable row level security;

drop policy if exists "Authenticated users can read Premium profile customization"
on public.premium_profile_customizations;

create policy "Authenticated users can read Premium profile customization"
on public.premium_profile_customizations
for select
to authenticated
using (true);

revoke all on public.premium_profile_customizations from anon;
revoke insert, update, delete on public.premium_profile_customizations from authenticated;
grant select on public.premium_profile_customizations to authenticated;

create or replace function public.set_premium_profile_customization(
  p_theme_key text,
  p_layout_key text,
  p_highlight_text text,
  p_show_premium_frame boolean
)
returns public.premium_profile_customizations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_theme text := lower(trim(coalesce(p_theme_key, '')));
  v_layout text := lower(trim(coalesce(p_layout_key, '')));
  v_highlight text := trim(coalesce(p_highlight_text, ''));
  v_row public.premium_profile_customizations;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.premium_entitlements pe
    where pe.user_id = v_user_id
      and pe.status in ('active','trialing','grace_period')
      and pe.revoked_at is null
      and pe.starts_at <= now()
      and (pe.expires_at is null or pe.expires_at > now())
  ) then
    raise exception 'Premium required' using errcode = '42501';
  end if;

  if v_theme not in ('purple','gold','midnight','forest') then
    raise exception 'Invalid Premium profile theme' using errcode = '22023';
  end if;

  if v_layout not in ('classic','spotlight') then
    raise exception 'Invalid Premium profile layout' using errcode = '22023';
  end if;

  if char_length(v_highlight) > 80 then
    raise exception 'Highlight text is too long' using errcode = '22023';
  end if;

  insert into public.premium_profile_customizations (
    user_id,
    theme_key,
    layout_key,
    highlight_text,
    show_premium_frame
  )
  values (
    v_user_id,
    v_theme,
    v_layout,
    v_highlight,
    coalesce(p_show_premium_frame, true)
  )
  on conflict (user_id) do update
  set theme_key = excluded.theme_key,
      layout_key = excluded.layout_key,
      highlight_text = excluded.highlight_text,
      show_premium_frame = excluded.show_premium_frame,
      updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.set_premium_profile_customization(text,text,text,boolean) from public, anon;
grant execute on function public.set_premium_profile_customization(text,text,text,boolean) to authenticated;

comment on table public.premium_profile_customizations is
'Public-facing Premium profile presentation preferences. Writes are Premium-gated through a security-definer RPC.';

commit;
