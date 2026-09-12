begin;

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
  v_deleted boolean := false;
begin
  if v_admin_id is null or not public.has_admin_role(array['moderator','admin','super_admin']) then
    raise exception 'Yetkisiz erişim';
  end if;

  case p_target_type
    when 'post' then
      delete from public.posts where id = p_target_id;
      v_deleted := found;
    when 'review' then
      delete from public.reviews where id = p_target_id;
      v_deleted := found;
    when 'quote' then
      delete from public.quotes where id = p_target_id;
      v_deleted := found;
    when 'comment' then
      delete from public.comments where id = p_target_id;
      v_deleted := found;
    when 'post_comment' then
      delete from public.post_comments where id = p_target_id;
      v_deleted := found;
    else
      raise exception 'Desteklenmeyen içerik türü: %', p_target_type;
  end case;

  if not v_deleted then
    raise exception 'İçerik bulunamadı';
  end if;

  insert into public.admin_audit_logs (
    admin_id,
    action,
    target_type,
    target_id,
    reason,
    new_value
  ) values (
    v_admin_id,
    'content_deleted',
    p_target_type,
    p_target_id::text,
    coalesce(p_reason, ''),
    jsonb_build_object('deleted', true)
  );

  return jsonb_build_object(
    'ok', true,
    'target_type', p_target_type,
    'target_id', p_target_id
  );
end;
$function$;

revoke all on function public.admin_delete_content(text, uuid, text) from public;
grant execute on function public.admin_delete_content(text, uuid, text) to authenticated;

commit;
