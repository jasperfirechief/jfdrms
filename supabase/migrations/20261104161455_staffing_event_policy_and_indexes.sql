drop policy if exists staffing_events_write on public.daily_staffing_events;

create policy staffing_events_insert on public.daily_staffing_events
  for insert to authenticated
  with check ((select private.is_admin()) or (select private.is_officer()));

create policy staffing_events_update on public.daily_staffing_events
  for update to authenticated
  using ((select private.is_admin()) or (select private.is_officer()))
  with check ((select private.is_admin()) or (select private.is_officer()));

create policy staffing_events_delete on public.daily_staffing_events
  for delete to authenticated
  using ((select private.is_admin()) or (select private.is_officer()));

create index if not exists daily_staffing_events_personnel_idx
  on public.daily_staffing_events (personnel_id);
create index if not exists daily_staffing_events_replacement_personnel_idx
  on public.daily_staffing_events (replacement_personnel_id);
create index if not exists daily_staffing_events_station_idx
  on public.daily_staffing_events (station_id);
create index if not exists daily_staffing_events_apparatus_idx
  on public.daily_staffing_events (apparatus_id);
create index if not exists daily_staffing_events_created_by_idx
  on public.daily_staffing_events (created_by);
