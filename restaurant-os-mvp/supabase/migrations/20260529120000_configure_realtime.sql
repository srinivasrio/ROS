-- Recreate supabase_realtime publication with only the requested tables
drop publication if exists supabase_realtime;

create publication supabase_realtime for table
  public.orders,
  public.order_items,
  public.tables,
  public.service_requests,
  public.waiter_assignments,
  public.waiter_workloads,
  public.service_assignments,
  public.staff_tasks,
  public.attendance;
