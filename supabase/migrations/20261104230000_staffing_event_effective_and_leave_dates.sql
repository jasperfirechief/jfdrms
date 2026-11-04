alter table public.daily_staffing_events
  add column if not exists effective_date date,
  add column if not exists leave_start_date date,
  add column if not exists leave_end_date date;

update public.daily_staffing_events e
set effective_date = coalesce(e.effective_date, s.staffing_date),
    leave_start_date = case when e.event_type = 'leave'
      then coalesce(e.leave_start_date, s.staffing_date) else null end,
    leave_end_date = case when e.event_type = 'leave'
      then coalesce(e.leave_end_date, s.staffing_date) else null end
from public.daily_staffing s
where s.staffing_id = e.staffing_id
  and (e.effective_date is null
    or (e.event_type = 'leave' and (e.leave_start_date is null or e.leave_end_date is null)));

alter table public.daily_staffing_events
  alter column effective_date set not null;

alter table public.daily_staffing_events
  drop constraint if exists daily_staffing_events_leave_dates_check;
alter table public.daily_staffing_events
  add constraint daily_staffing_events_leave_dates_check
  check (
    (event_type = 'swap' and leave_start_date is null and leave_end_date is null)
    or
    (event_type = 'leave' and leave_start_date is not null
      and effective_date = leave_start_date
      and (leave_end_date is null or leave_end_date >= leave_start_date))
  );
