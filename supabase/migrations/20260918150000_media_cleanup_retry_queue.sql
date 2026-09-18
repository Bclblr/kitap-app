begin;

create unique index if not exists storage_cleanup_pending_object_unique
  on public.storage_cleanup_candidates (bucket_id, object_name)
  where status = 'pending';

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
    created_by
  )
  values (
    v_bucket,
    v_object_name,
    left(coalesce(nullif(btrim(p_reason), ''), 'client_rollback_failed'), 200),
    'pending',
    v_user_id
  )
  on conflict (bucket_id, object_name) where status = 'pending'
  do update
    set reason = excluded.reason,
        created_at = now(),
        created_by = excluded.created_by;
end;
$$;

revoke all on function public.queue_my_storage_cleanup(text,text,text)
from public, anon;

grant execute on function public.queue_my_storage_cleanup(text,text,text)
to authenticated;

comment on function public.queue_my_storage_cleanup(text,text,text) is
'Queues cleanup only for authenticated users own storage paths after client rollback failure.';

commit;
