begin;

revoke all on function public.admin_analytics_overview()
from public, anon;

revoke all on function public.admin_analytics_daily(integer)
from public, anon;

grant execute on function public.admin_analytics_overview()
to authenticated;

grant execute on function public.admin_analytics_daily(integer)
to authenticated;

comment on function public.admin_analytics_overview() is
'Admin analytics overview. Caller must satisfy the internal admin/super_admin role guard.';

comment on function public.admin_analytics_daily(integer) is
'Admin analytics daily series. Caller must satisfy the internal admin/super_admin role guard.';

commit;
