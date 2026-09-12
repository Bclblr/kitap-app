begin;

-- Account deletion is executed by the delete-account Edge Function so storage
-- objects can be removed through the Storage API before the Auth user is deleted.
-- Remove the old client-callable RPC to prevent bypassing that cleanup path.
drop function if exists public.delete_my_account();

create or replace function public.get_my_storage_objects()
returns table(bucket_id text, object_name text)
language sql
security definer
set search_path = ''
as $$
  select so.bucket_id, so.name
  from storage.objects so
  where auth.uid() is not null
    and (
      so.owner_id = auth.uid()
      or so.name = auth.uid()::text
      or so.name like auth.uid()::text || '/%'
    )
  order by so.bucket_id, so.name;
$$;

revoke all on function public.get_my_storage_objects() from public;
revoke all on function public.get_my_storage_objects() from anon;
grant execute on function public.get_my_storage_objects() to authenticated;

commit;
