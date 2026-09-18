begin;

-- Historical privileged records must survive account deletion without blocking it.
alter table public.admin_audit_logs
  alter column admin_id drop not null;

alter table public.user_sanctions
  alter column created_by drop not null;

do $$
declare
  v_constraint record;
begin
  for v_constraint in
    select c.conname, c.conrelid::regclass as table_name
    from pg_constraint c
    join pg_attribute a
      on a.attrelid = c.conrelid
     and a.attnum = any(c.conkey)
    where c.contype = 'f'
      and c.confrelid = 'auth.users'::regclass
      and (
        (c.conrelid = 'public.admin_audit_logs'::regclass and a.attname = 'admin_id')
        or
        (c.conrelid = 'public.user_sanctions'::regclass and a.attname = 'created_by')
      )
  loop
    execute format(
      'alter table %s drop constraint %I',
      v_constraint.table_name,
      v_constraint.conname
    );
  end loop;
end
$$;

alter table public.admin_audit_logs
  add constraint admin_audit_logs_admin_id_fkey
  foreign key (admin_id)
  references auth.users(id)
  on delete set null;

alter table public.user_sanctions
  add constraint user_sanctions_created_by_fkey
  foreign key (created_by)
  references auth.users(id)
  on delete set null;

comment on column public.admin_audit_logs.admin_id is
'Original privileged actor. Becomes NULL if that account is later deleted; the audit row remains immutable.';

comment on column public.user_sanctions.created_by is
'Original sanction creator. Becomes NULL if that account is later deleted so sanction history is preserved.';

commit;
