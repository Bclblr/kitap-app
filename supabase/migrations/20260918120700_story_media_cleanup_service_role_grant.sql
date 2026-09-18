begin;

grant execute on function public.storage_object_owner(text) to service_role;

commit;
