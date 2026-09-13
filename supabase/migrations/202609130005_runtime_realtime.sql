begin;

do $$
declare
  v_table text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    return;
  end if;

  foreach v_table in array array[
    'app_settings',
    'announcements',
    'feature_flags',
    'user_sanctions',
    'profile_admin_controls',
    'user_roles'
  ]
  loop
    if to_regclass(format('public.%I', v_table)) is not null
      and not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = v_table
      ) then
      execute format('alter publication supabase_realtime add table public.%I', v_table);
    end if;
  end loop;
end $$;

commit;
