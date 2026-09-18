begin;

alter table public.storage_cleanup_candidates
  add column if not exists auto_cleanup boolean not null default false,
  add column if not exists attempt_count integer not null default 0,
  add column if not exists last_attempt_at timestamptz,
  add column if not exists last_error text;

create or replace function public.queue_my_storage_cleanup(
  p_bucket text,
  p_object_name text,
  p_reason text default 'client_rollback_failed'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_bucket text := btrim(coalesce(p_bucket, ''));
  v_object_name text := btrim(coalesce(p_object_name, ''));
begin
  if v_user_id is null then
    raise exception 'authentication required';
  end if;

  if v_bucket not in ('post-images','story-images','avatars','event-images','work-covers') then
    raise exception 'unsupported storage bucket';
  end if;

  if v_object_name = ''
     or v_object_name not like (v_user_id::text || '/%')
     or position('..' in v_object_name) > 0 then
    raise exception 'invalid storage object path';
  end if;

  insert into public.storage_cleanup_candidates (
    bucket_id,
    object_name,
    reason,
    status,
    created_by,
    auto_cleanup,
    attempt_count,
    last_attempt_at,
    last_error
  )
  values (
    v_bucket,
    v_object_name,
    left(coalesce(nullif(btrim(p_reason), ''), 'client_rollback_failed'), 200),
    'pending',
    v_user_id,
    true,
    0,
    null,
    null
  )
  on conflict (bucket_id, object_name)
  do update
    set reason = excluded.reason,
        status = 'pending',
        created_by = excluded.created_by,
        auto_cleanup = true,
        attempt_count = 0,
        last_attempt_at = null,
        last_error = null,
        reviewed_by = null,
        reviewed_at = null,
        created_at = now();
end;
$$;

create or replace function public.get_automatic_storage_cleanup_candidates(
  p_limit integer default 200
)
returns table (
  id uuid,
  bucket_id text,
  object_name text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select c.id, c.bucket_id, c.object_name
  from public.storage_cleanup_candidates c
  where c.status = 'pending'
    and c.auto_cleanup = true
    and c.attempt_count < 5
  order by c.created_at asc
  limit greatest(1, least(coalesce(p_limit, 200), 200));
$$;

create or replace function public.record_automatic_storage_cleanup_result(
  p_ids uuid[],
  p_success boolean,
  p_error text default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if coalesce(array_length(p_ids, 1), 0) = 0 then
    return;
  end if;

  if p_success then
    update public.storage_cleanup_candidates
    set status = 'deleted',
        attempt_count = attempt_count + 1,
        last_attempt_at = now(),
        last_error = null,
        reviewed_at = now()
    where id = any(p_ids)
      and auto_cleanup = true
      and status = 'pending';
  else
    update public.storage_cleanup_candidates
    set attempt_count = attempt_count + 1,
        last_attempt_at = now(),
        last_error = left(coalesce(p_error, 'storage delete failed'), 500),
        status = case when attempt_count + 1 >= 5 then 'rejected' else 'pending' end,
        reviewed_at = case when attempt_count + 1 >= 5 then now() else reviewed_at end
    where id = any(p_ids)
      and auto_cleanup = true
      and status = 'pending';
  end if;
end;
$$;

revoke all on function public.get_automatic_storage_cleanup_candidates(integer)
from public, anon, authenticated;
revoke all on function public.record_automatic_storage_cleanup_result(uuid[], boolean, text)
from public, anon, authenticated;

grant execute on function public.get_automatic_storage_cleanup_candidates(integer)
to service_role;
grant execute on function public.record_automatic_storage_cleanup_result(uuid[], boolean, text)
to service_role;

grant select, update on public.storage_cleanup_candidates to service_role;

commit;