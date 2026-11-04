create table if not exists public.daily_staffing_events (
  event_id uuid primary key default gen_random_uuid(),
  staffing_id bigint not null references public.daily_staffing(staffing_id) on delete cascade,
  event_type text not null check (event_type in ('swap','leave')),
  personnel_id bigint not null references public.personnel(id),
  replacement_personnel_id bigint references public.personnel(id),
  station_id bigint references public.stations(station_id),
  apparatus_id bigint references public.apparatus(apparatus_id),
  leave_type text not null check (leave_type in ('sick','vacation','kelly_day','swap','other')),
  is_full_shift boolean not null default true,
  start_time time,
  end_time time,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint daily_staffing_events_swap_check
    check ((event_type = 'swap' and leave_type = 'swap' and replacement_personnel_id is not null)
        or (event_type = 'leave' and leave_type <> 'swap')),
  constraint daily_staffing_events_partial_time_check
    check (is_full_shift or (start_time is not null and end_time is not null))
);

create index if not exists daily_staffing_events_staffing_idx
  on public.daily_staffing_events (staffing_id, created_at);

alter table public.daily_staffing_events enable row level security;

drop policy if exists staffing_events_select on public.daily_staffing_events;
create policy staffing_events_select
  on public.daily_staffing_events for select to authenticated
  using ((select private.is_admin()) or (select private.is_officer()) or (select private.is_on_duty()));

drop policy if exists staffing_events_write on public.daily_staffing_events;
create policy staffing_events_write
  on public.daily_staffing_events for all to authenticated
  using ((select private.is_admin()) or (select private.is_officer()))
  with check ((select private.is_admin()) or (select private.is_officer()));

grant select, insert, update, delete on public.daily_staffing_events to authenticated;
grant select, insert, update, delete on public.daily_staffing_events to service_role;
