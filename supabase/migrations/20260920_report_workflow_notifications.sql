-- Detailed report submission + reporter status notifications.
create or replace function public.submit_report(
  p_target_type text,
  p_target_id text,
  p_category text,
  p_description text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_report_id uuid;
  v_category text := lower(trim(coalesce(p_category,'')));
  v_allowed text[] := array['violence','hate','exploitation','suicide_self_harm','bullying_harassment','sexual_content','spam','misinformation','illegal_goods','intellectual_property','other'];
begin
  if v_user is null then raise exception 'authentication required' using errcode='42501'; end if;
  if p_target_type not in ('user','post','review','quote','comment','message','community','event') then raise exception 'invalid target type' using errcode='22023'; end if;
  if coalesce(trim(p_target_id),'') = '' then raise exception 'target id required' using errcode='22023'; end if;
  if not (v_category = any(v_allowed)) then raise exception 'invalid report category' using errcode='22023'; end if;

  insert into public.reports (reporter_id,target_type,target_id,category,description,status,source)
  values (v_user,p_target_type,trim(p_target_id),v_category,left(coalesce(trim(p_description),''),1000),'pending','app')
  returning id into v_report_id;

  insert into public.admin_notifications (title,message,target_type,target_value,action_route,created_by)
  values ('Şikâyetin incelemeye gönderildi','Bildirimin moderasyon ekibine ulaştı. Durum değiştiğinde burada bilgi vereceğiz.','user',v_user::text,null,v_user);

  return v_report_id;
end;
$$;

revoke all on function public.submit_report(text,text,text,text) from public;
grant execute on function public.submit_report(text,text,text,text) to authenticated;

create or replace function public.admin_update_report_status(
  p_report_id uuid,
  p_status text,
  p_resolution text default null
)
returns public.reports
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_id uuid := auth.uid();
  v_old public.reports;
  v_new public.reports;
  v_resolution text := nullif(trim(coalesce(p_resolution, '')), '');
  v_title text;
  v_message text;
begin
  if v_admin_id is null or not public.has_admin_role(array['moderator','admin','super_admin']) then
    raise exception 'Admin moderation access required' using errcode='42501';
  end if;
  if p_status not in ('pending','reviewing','actioned','rejected') then raise exception 'Invalid report status' using errcode='22023'; end if;
  if p_status in ('actioned','rejected') and v_resolution is null then raise exception 'Resolution is required for final moderation states' using errcode='22023'; end if;

  select * into v_old from public.reports where id=p_report_id for update;
  if not found then raise exception 'Report not found' using errcode='P0002'; end if;

  update public.reports
  set status=p_status,
      assigned_to=case when p_status='reviewing' then v_admin_id else coalesce(assigned_to,v_admin_id) end,
      resolution=v_resolution,
      resolved_at=case when p_status in ('actioned','rejected') then now() else null end,
      updated_at=now()
  where id=p_report_id
  returning * into v_new;

  insert into public.admin_audit_logs (admin_id,action,target_type,target_id,reason,old_value,new_value,metadata)
  values (
    v_admin_id,'report_status_changed','report',p_report_id::text,v_resolution,
    jsonb_build_object('status',v_old.status,'assigned_to',v_old.assigned_to,'resolution',v_old.resolution,'resolved_at',v_old.resolved_at),
    jsonb_build_object('status',v_new.status,'assigned_to',v_new.assigned_to,'resolution',v_new.resolution,'resolved_at',v_new.resolved_at),
    jsonb_build_object('reported_target_type',v_old.target_type,'reported_target_id',v_old.target_id,'category',v_old.category,'reporter_id',v_old.reporter_id)
  );

  if v_old.status is distinct from v_new.status then
    if p_status='reviewing' then
      v_title:='Şikâyetin inceleniyor';
      v_message:='Moderasyon ekibimiz bildirimin üzerinde inceleme başlattı.';
    elsif p_status='actioned' then
      v_title:='Şikâyetin sonuçlandı';
      v_message:='Bildirimin incelendi ve gerekli işlem uygulandı.' || case when v_resolution is not null then ' Sonuç: '||left(v_resolution,300) else '' end;
    elsif p_status='rejected' then
      v_title:='Şikâyetin incelendi';
      v_message:='Bildirimin incelendi; bu aşamada işlem uygulanmadı.' || case when v_resolution is not null then ' Açıklama: '||left(v_resolution,300) else '' end;
    else
      v_title:='Şikâyet durumu güncellendi';
      v_message:='Bildirimin yeniden bekleme durumuna alındı.';
    end if;

    insert into public.admin_notifications (title,message,target_type,target_value,action_route,created_by)
    values (v_title,v_message,'user',v_old.reporter_id::text,null,v_admin_id);
  end if;

  return v_new;
end;
$$;
