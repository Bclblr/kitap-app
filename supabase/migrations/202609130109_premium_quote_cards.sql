begin;

alter table public.quotes
  add column if not exists card_template_key text not null default 'classic';

alter table public.quotes
  drop constraint if exists quotes_card_template_key_check;

alter table public.quotes
  add constraint quotes_card_template_key_check
  check (card_template_key in ('classic', 'editorial', 'noir', 'minimal'));

create or replace function public.enforce_quote_card_template_access()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_premium boolean := false;
begin
  if new.card_template_key is null or btrim(new.card_template_key) = '' then
    new.card_template_key := 'classic';
  end if;

  new.card_template_key := lower(btrim(new.card_template_key));

  if new.card_template_key not in ('classic', 'editorial', 'noir', 'minimal') then
    raise exception 'Invalid quote card template' using errcode = '22023';
  end if;

  if new.card_template_key = 'classic' then
    return new;
  end if;

  if auth.uid() is null or new.user_id <> auth.uid() then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select exists (
    select 1
    from public.premium_entitlements pe
    where pe.user_id = auth.uid()
      and pe.status in ('active', 'trialing', 'grace_period')
      and pe.revoked_at is null
      and pe.starts_at <= now()
      and (pe.expires_at is null or pe.expires_at > now())
  ) into v_is_premium;

  if not v_is_premium then
    raise exception 'Premium required for this quote card template' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists quotes_premium_card_guard on public.quotes;
create trigger quotes_premium_card_guard
before insert or update of card_template_key, user_id
on public.quotes
for each row
execute function public.enforce_quote_card_template_access();

comment on column public.quotes.card_template_key is
'Visual quote-card template. classic is free; editorial, noir and minimal require active Premium access at write time.';

commit;
