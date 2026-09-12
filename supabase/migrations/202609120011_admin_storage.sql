begin;

create table if not exists public.storage_cleanup_candidates (
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null,
  object_name text not null,
  reason text not null default '',
  status text not null default 'pending' check (status in ('pending','approved','rejected','deleted')),
  created_by uuid not null references auth.users(id) on delete restrict,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(bucket_id, object_name)
);

alter table public.storage_cleanup_candidates enable row level security;

drop policy if exists storage_cleanup_admin_all on public.storage_cleanup_candidates;
create policy storage_cleanup_admin_all
on public.storage_cleanup_candidates for all to authenticated
using (public.has_admin_role(array['admin','super_admin']))
with check (public.has_admin_role(array['admin','super_admin']));

grant select, insert, update on public.storage_cleanup_candidates to authenticated;

create or replace function public.admin_storage_bucket_stats()
returns table (
  bucket_id text,
  bucket_name text,
  is_public boolean,
  file_size_limit bigint,
  object_count bigint,
  total_bytes bigint
)
language sql
security definer
set search_path = ''
as $$
  select
    b.id::text,
    b.name::text,
    b.public,
    b.file_size_limit,
    count(o.id)::bigint,
    coalesce(sum(nullif(o.metadata->>'size','')::bigint),0)::bigint
  from storage.buckets b
  left join storage.objects o on o.bucket_id = b.id
  where public.has_admin_role(array['admin','super_admin'])
  group by b.id,b.name,b.public,b.file_size_limit
  order by b.name;
$$;

revoke all on function public.admin_storage_bucket_stats() from public;
grant execute on function public.admin_storage_bucket_stats() to authenticated;

create or replace function public.admin_list_storage_objects(
  p_bucket text default null,
  p_search text default '',
  p_limit integer default 200
)
returns table (
  id uuid,
  bucket_id text,
  object_name text,
  owner_id text,
  created_at timestamptz,
  updated_at timestamptz,
  last_accessed_at timestamptz,
  size_bytes bigint,
  mimetype text,
  referenced boolean,
  cleanup_status text
)
language sql
security definer
set search_path = ''
as $$
  select
    o.id,
    o.bucket_id::text,
    o.name::text,
    o.owner_id::text,
    o.created_at,
    o.updated_at,
    o.last_accessed_at,
    coalesce(nullif(o.metadata->>'size','')::bigint,0),
    o.metadata->>'mimetype',
    case
      when o.bucket_id = 'work-covers' then exists(
        select 1
        from public.works w
        where w.cover_url is not null
          and position('/work-covers/' in w.cover_url) > 0
          and position(o.name in w.cover_url) > 0
      )
      else true
    end as referenced,
    c.status
  from storage.objects o
  left join public.storage_cleanup_candidates c
    on c.bucket_id=o.bucket_id and c.object_name=o.name
  where public.has_admin_role(array['admin','super_admin'])
    and (p_bucket is null or p_bucket='' or o.bucket_id=p_bucket)
    and (
      coalesce(trim(p_search),'')=''
      or lower(o.name) like '%' || lower(left(trim(p_search),200)) || '%'
      or lower(o.bucket_id) like '%' || lower(left(trim(p_search),200)) || '%'
    )
  order by o.created_at desc
  limit greatest(1,least(coalesce(p_limit,200),500));
$$;

revoke all on function public.admin_list_storage_objects(text,text,integer) from public;
grant execute on function public.admin_list_storage_objects(text,text,integer) to authenticated;

create or replace function public.admin_mark_storage_cleanup(
  p_bucket text,
  p_object_name text,
  p_reason text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_referenced boolean := false;
begin
  if not public.has_admin_role(array['admin','super_admin']) then
    raise exception 'not authorized';
  end if;

  if not exists(
    select 1 from storage.objects o
    where o.bucket_id=p_bucket and o.name=p_object_name
  ) then
    raise exception 'storage object not found';
  end if;

  if p_bucket='work-covers' then
    select exists(
      select 1 from public.works w
      where w.cover_url is not null
        and position('/work-covers/' in w.cover_url) > 0
        and position(p_object_name in w.cover_url) > 0
    ) into v_referenced;

    if v_referenced then
      raise exception 'referenced work cover cannot be marked for cleanup';
    end if;
  end if;

  insert into public.storage_cleanup_candidates(
    bucket_id,object_name,reason,status,created_by,reviewed_by,reviewed_at
  ) values (
    p_bucket,p_object_name,trim(coalesce(p_reason,'')),'pending',auth.uid(),null,null
  )
  on conflict(bucket_id,object_name)
  do update set
    reason=excluded.reason,
    status='pending',
    created_by=auth.uid(),
    reviewed_by=null,
    reviewed_at=null
  returning id into v_id;

  insert into public.admin_audit_logs(admin_id,action,target_type,target_id,new_value)
  values(
    auth.uid(),'storage_cleanup_marked','storage_object',p_bucket || '/' || p_object_name,
    jsonb_build_object('bucket_id',p_bucket,'object_name',p_object_name,'reason',trim(coalesce(p_reason,'')))
  );

  return v_id;
end;
$$;

revoke all on function public.admin_mark_storage_cleanup(text,text,text) from public;
grant execute on function public.admin_mark_storage_cleanup(text,text,text) to authenticated;

create or replace function public.admin_review_storage_cleanup(
  p_bucket text,
  p_object_name text,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_admin_role(array['admin','super_admin']) then
    raise exception 'not authorized';
  end if;

  if p_status not in ('approved','rejected') then
    raise exception 'invalid cleanup status';
  end if;

  update public.storage_cleanup_candidates
  set status=p_status,reviewed_by=auth.uid(),reviewed_at=now()
  where bucket_id=p_bucket and object_name=p_object_name;

  if not found then raise exception 'cleanup candidate not found'; end if;

  insert into public.admin_audit_logs(admin_id,action,target_type,target_id,new_value)
  values(
    auth.uid(),'storage_cleanup_reviewed','storage_object',p_bucket || '/' || p_object_name,
    jsonb_build_object('status',p_status)
  );
end;
$$;

revoke all on function public.admin_review_storage_cleanup(text,text,text) from public;
grant execute on function public.admin_review_storage_cleanup(text,text,text) to authenticated;

commit;
