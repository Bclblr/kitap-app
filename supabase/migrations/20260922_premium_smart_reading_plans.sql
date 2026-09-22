create table if not exists public.premium_reading_plans (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  book_key text not null,
  book_title text not null,
  current_page integer not null default 0 check (current_page >= 0),
  total_pages integer not null check (total_pages > 0),
  target_date date not null,
  daily_pages integer not null check (daily_pages > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.premium_reading_plans enable row level security;

drop policy if exists "Premium users can read own reading plan" on public.premium_reading_plans;
create policy "Premium users can read own reading plan"
on public.premium_reading_plans for select to authenticated
using (
  user_id = (select auth.uid())
  and public.has_effective_premium((select auth.uid()))
);

drop policy if exists "Premium users can insert own reading plan" on public.premium_reading_plans;
create policy "Premium users can insert own reading plan"
on public.premium_reading_plans for insert to authenticated
with check (
  user_id = (select auth.uid())
  and public.has_effective_premium((select auth.uid()))
);

drop policy if exists "Premium users can update own reading plan" on public.premium_reading_plans;
create policy "Premium users can update own reading plan"
on public.premium_reading_plans for update to authenticated
using (
  user_id = (select auth.uid())
  and public.has_effective_premium((select auth.uid()))
)
with check (
  user_id = (select auth.uid())
  and public.has_effective_premium((select auth.uid()))
);

drop policy if exists "Premium users can delete own reading plan" on public.premium_reading_plans;
create policy "Premium users can delete own reading plan"
on public.premium_reading_plans for delete to authenticated
using (
  user_id = (select auth.uid())
  and public.has_effective_premium((select auth.uid()))
);

grant select, insert, update, delete on public.premium_reading_plans to authenticated;
