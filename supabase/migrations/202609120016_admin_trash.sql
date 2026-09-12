begin;

create table if not exists public.admin_trash_items (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('post','review','quote','post_comment','comment')),
  target_id uuid not null,
  snapshot jsonb not null,
  reason text,
  deleted_by uuid references auth.users(id) on delete set null,
  deleted_at timestamptz not null default now(),
  restored_by uuid references auth.users(id) on delete set null,
  restored_at timestamptz
);

create unique index if not exists admin_trash_items_active_target_uidx
  on public.admin_trash_items(target_type,target_id)
  where restored_at is null;

create index if not exists admin_trash_items_deleted_at_idx
  on public.admin_trash_items(deleted_at desc);

alter table public.admin_trash_items enable row level security;

revoke all on table public.admin_trash_items from public, anon;
grant select on table public.admin_trash_items to authenticated;

drop policy if exists "admins can read trash" on public.admin_trash_items;
create policy "admins can read trash"
on public.admin_trash_items
for select
to authenticated
using (public.has_admin_role(array['moderator','admin','super_admin']));

create or replace function public.admin_delete_content(
  p_target_type text,
  p_target_id uuid,
  p_reason text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_admin_id uuid := auth.uid();
  v_snapshot jsonb;
  v_deleted boolean := false;
begin
  if v_admin_id is null or not public.has_admin_role(array['moderator','admin','super_admin']) then
    raise exception 'Yetkisiz erişim';
  end if;

  case p_target_type
    when 'post' then select to_jsonb(t) into v_snapshot from public.posts t where id=p_target_id;
    when 'review' then select to_jsonb(t) into v_snapshot from public.reviews t where id=p_target_id;
    when 'quote' then select to_jsonb(t) into v_snapshot from public.quotes t where id=p_target_id;
    when 'comment' then select to_jsonb(t) into v_snapshot from public.comments t where id=p_target_id;
    when 'post_comment' then select to_jsonb(t) into v_snapshot from public.post_comments t where id=p_target_id;
    else raise exception 'Desteklenmeyen içerik türü: %', p_target_type;
  end case;

  if v_snapshot is null then raise exception 'İçerik bulunamadı'; end if;

  insert into public.admin_trash_items(target_type,target_id,snapshot,reason,deleted_by)
  values(p_target_type,p_target_id,v_snapshot,coalesce(p_reason,''),v_admin_id)
  on conflict (target_type,target_id) where restored_at is null
  do update set snapshot=excluded.snapshot,reason=excluded.reason,deleted_by=excluded.deleted_by,deleted_at=now();

  case p_target_type
    when 'post' then delete from public.posts where id=p_target_id; v_deleted:=found;
    when 'review' then delete from public.reviews where id=p_target_id; v_deleted:=found;
    when 'quote' then delete from public.quotes where id=p_target_id; v_deleted:=found;
    when 'comment' then delete from public.comments where id=p_target_id; v_deleted:=found;
    when 'post_comment' then delete from public.post_comments where id=p_target_id; v_deleted:=found;
  end case;

  if not v_deleted then raise exception 'İçerik silinemedi'; end if;

  insert into public.admin_audit_logs(admin_id,action,target_type,target_id,reason,old_value,new_value)
  values(v_admin_id,'content_moved_to_trash',p_target_type,p_target_id::text,coalesce(p_reason,''),v_snapshot,jsonb_build_object('trashed',true));

  return jsonb_build_object('ok',true,'target_type',p_target_type,'target_id',p_target_id,'trashed',true);
end;
$function$;

revoke all on function public.admin_delete_content(text,uuid,text) from public;
grant execute on function public.admin_delete_content(text,uuid,text) to authenticated;

create or replace function public.admin_list_trash(
  p_target_type text default null,
  p_limit integer default 100,
  p_offset integer default 0
)
returns table(
  id uuid,
  target_type text,
  target_id uuid,
  snapshot jsonb,
  reason text,
  deleted_by uuid,
  deleted_username text,
  deleted_at timestamptz
)
language sql
security definer
set search_path = ''
as $$
  select t.id,t.target_type,t.target_id,t.snapshot,t.reason,t.deleted_by,p.username,t.deleted_at
  from public.admin_trash_items t
  left join public.profiles p on p.id=t.deleted_by
  where public.has_admin_role(array['moderator','admin','super_admin'])
    and t.restored_at is null
    and (coalesce(trim(p_target_type),'')='' or t.target_type=trim(p_target_type))
  order by t.deleted_at desc
  limit greatest(1,least(coalesce(p_limit,100),250))
  offset greatest(0,coalesce(p_offset,0));
$$;

revoke all on function public.admin_list_trash(text,integer,integer) from public;
grant execute on function public.admin_list_trash(text,integer,integer) to authenticated;

create or replace function public.admin_restore_trash(p_trash_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_item public.admin_trash_items%rowtype;
  v_admin_id uuid:=auth.uid();
begin
  if v_admin_id is null or not public.has_admin_role(array['moderator','admin','super_admin']) then
    raise exception 'Yetkisiz erişim';
  end if;

  select * into v_item
  from public.admin_trash_items
  where id=p_trash_id and restored_at is null
  for update;

  if not found then raise exception 'Çöp kutusu kaydı bulunamadı'; end if;

  case v_item.target_type
    when 'post' then
      if exists(select 1 from public.posts where id=v_item.target_id) then raise exception 'İçerik zaten mevcut'; end if;
      insert into public.posts select * from jsonb_populate_record(null::public.posts,v_item.snapshot);
    when 'review' then
      if exists(select 1 from public.reviews where id=v_item.target_id) then raise exception 'İçerik zaten mevcut'; end if;
      insert into public.reviews select * from jsonb_populate_record(null::public.reviews,v_item.snapshot);
    when 'quote' then
      if exists(select 1 from public.quotes where id=v_item.target_id) then raise exception 'İçerik zaten mevcut'; end if;
      insert into public.quotes select * from jsonb_populate_record(null::public.quotes,v_item.snapshot);
    when 'comment' then
      if exists(select 1 from public.comments where id=v_item.target_id) then raise exception 'İçerik zaten mevcut'; end if;
      insert into public.comments select * from jsonb_populate_record(null::public.comments,v_item.snapshot);
    when 'post_comment' then
      if exists(select 1 from public.post_comments where id=v_item.target_id) then raise exception 'İçerik zaten mevcut'; end if;
      insert into public.post_comments select * from jsonb_populate_record(null::public.post_comments,v_item.snapshot);
    else raise exception 'Desteklenmeyen içerik türü';
  end case;

  update public.admin_trash_items
  set restored_at=now(),restored_by=v_admin_id
  where id=v_item.id;

  insert into public.admin_audit_logs(admin_id,action,target_type,target_id,old_value,new_value)
  values(v_admin_id,'content_restored_from_trash',v_item.target_type,v_item.target_id::text,jsonb_build_object('trashed',true),v_item.snapshot);

  return jsonb_build_object('ok',true,'target_type',v_item.target_type,'target_id',v_item.target_id);
end;
$function$;

revoke all on function public.admin_restore_trash(uuid) from public;
grant execute on function public.admin_restore_trash(uuid) to authenticated;

commit;
