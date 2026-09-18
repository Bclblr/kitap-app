begin;

revoke all on function public.get_event_attendees(uuid)
from public, anon;

grant execute on function public.get_event_attendees(uuid)
to authenticated;

revoke all on function public.should_deliver_notification(uuid, text)
from public, anon, authenticated;

grant execute on function public.should_deliver_notification(uuid, text)
to service_role;

commit;