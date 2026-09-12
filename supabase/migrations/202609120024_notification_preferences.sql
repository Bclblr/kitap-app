begin;

create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  likes_enabled boolean not null default true,
  comments_enabled boolean not null default true,
  reposts_enabled boolean not null default true,
  follows_enabled boolean not null default true,
  messages_enabled boolean not null default true,
  system_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;

drop policy if exists notification_preferences_select_own on public.notification_preferences;
create policy notification_preferences_select_own
on public.notification_preferences
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists notification_preferences_insert_own on public.notification_preferences;
create policy notification_preferences_insert_own
on public.notification_preferences
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists notification_preferences_update_own on public.notification_preferences;
create policy notification_preferences_update_own
on public.notification_preferences
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists notification_preferences_delete_own on public.notification_preferences;
create policy notification_preferences_delete_own
on public.notification_preferences
for delete
to authenticated
using (user_id = auth.uid());

create or replace function public.touch_notification_preferences_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists notification_preferences_touch_updated_at on public.notification_preferences;
create trigger notification_preferences_touch_updated_at
before update on public.notification_preferences
for each row execute function public.touch_notification_preferences_updated_at();

create or replace function public.should_deliver_notification(
  p_user_id uuid,
  p_kind text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case lower(coalesce(p_kind, ''))
    when 'like' then coalesce((select likes_enabled from public.notification_preferences where user_id = p_user_id), true)
    when 'comment' then coalesce((select comments_enabled from public.notification_preferences where user_id = p_user_id), true)
    when 'repost' then coalesce((select reposts_enabled from public.notification_preferences where user_id = p_user_id), true)
    when 'follow' then coalesce((select follows_enabled from public.notification_preferences where user_id = p_user_id), true)
    when 'message' then coalesce((select messages_enabled from public.notification_preferences where user_id = p_user_id), true)
    when 'system' then coalesce((select system_enabled from public.notification_preferences where user_id = p_user_id), true)
    else true
  end;
$$;

grant execute on function public.should_deliver_notification(uuid, text) to authenticated;

commit;
