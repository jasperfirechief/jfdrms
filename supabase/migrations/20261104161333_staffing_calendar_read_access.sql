drop policy if exists staffing_select on public.daily_staffing;
create policy staffing_select on public.daily_staffing
  for select to authenticated using (true);

drop policy if exists app_assign_select on public.daily_app_assignments;
create policy app_assign_select on public.daily_app_assignments
  for select to authenticated using (true);

drop policy if exists crew_select on public.daily_personnel_assignments;
create policy crew_select on public.daily_personnel_assignments
  for select to authenticated using (true);

drop policy if exists staffing_events_select on public.daily_staffing_events;
create policy staffing_events_select on public.daily_staffing_events
  for select to authenticated using (true);
