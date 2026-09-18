begin;

-- Moderation state changes and their audit entries must succeed or fail together.
-- Clients keep read access to reports, but status changes are server-authoritative.
drop policy if exists reports_admin_update on public.reports;
revoke update on table public.reports from authenticated;

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
begin
  if v_admin_id is null
     or not public.has_admin_role(array['moderator','admin','super_admin']) then
    raise exception 'Admin moderation access required'
      using errcode = '42501';
  end if;

  if p_status not in ('pending','reviewing','actioned','rejected') then
    raise exception 'Invalid report status'
      using errcode = '22023';
  end if;

  if p_status in ('actioned','rejected') and v_resolution is null then
    raise exception 'Resolution is required for final moderation states'
      using errcode = '22023';
  end if;

  select *
  into v_old
  from public.reports
  where id = p_report_id
  for update;

  if not found then
    raise exception 'Report not found'
      using errcode = 'P0002';
  end if;

  update public.reports
  set
    status = p_status,
    assigned_to = case
      when p_status = 'reviewing' then v_admin_id
      else coalesce(assigned_to, v_admin_id)
    end,
    resolution = v_resolution,
    resolved_at = case
      when p_status in ('actioned','rejected') then now()
      else null
    end,
    updated_at = now()
  where id = p_report_id
  returning *
  into v_new;

  insert into public.admin_audit_logs (
    admin_id,
    action,
    target_type,
    target_id,
    reason,
    old_value,
    new_value,
    metadata
  )
  values (
    v_admin_id,
    'report_status_changed',
    'report',
    p_report_id::text,
    v_resolution,
    jsonb_build_object(
      'status', v_old.status,
      'assigned_to', v_old.assigned_to,
      'resolution', v_old.resolution,
      'resolved_at', v_old.resolved_at
    ),
    jsonb_build_object(
      'status', v_new.status,
      'assigned_to', v_new.assigned_to,
      'resolution', v_new.resolution,
      'resolved_at', v_new.resolved_at
    ),
    jsonb_build_object(
      'reported_target_type', v_old.target_type,
      'reported_target_id', v_old.target_id,
      'category', v_old.category,
      'reporter_id', v_old.reporter_id
    )
  );

  return v_new;
end;
$$;

revoke all
on function public.admin_update_report_status(uuid,text,text)
from public, anon;

grant execute
on function public.admin_update_report_status(uuid,text,text)
to authenticated;

comment on function public.admin_update_report_status(uuid,text,text) is
'Atomically updates a moderation report and appends the corresponding immutable admin audit entry.';

commit;
