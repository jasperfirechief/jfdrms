create table if not exists public.training_schedule (
  id uuid primary key default gen_random_uuid(),
  schedule_date date not null,
  shift text not null check (shift in ('A','B','C')),
  lesson text,
  subject text not null,
  details text,
  start_time time not null default '09:00',
  end_time time not null default '12:00',
  source_year integer not null default 2026,
  source_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(schedule_date, shift)
);
create index if not exists training_schedule_shift_date_idx on public.training_schedule(shift, schedule_date);
create table if not exists public.training_records (
  id uuid primary key default gen_random_uuid(),
  record_type text not null check (record_type in ('daily','event')),
  training_date date not null,
  shift text check (shift is null or shift in ('A','B','C')),
  staffing_id bigint references public.daily_staffing(staffing_id) on delete set null,
  schedule_id uuid references public.training_schedule(id) on delete set null,
  subject text not null,
  lesson text,
  category text,
  start_time time not null,
  end_time time not null,
  location text,
  instructor text,
  description text,
  notes text,
  conducted boolean not null default false,
  signed_by uuid references auth.users(id) on delete set null,
  signed_by_name text,
  signed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time),
  check ((record_type = 'daily' and shift is not null) or record_type = 'event')
);
create index if not exists training_records_date_idx on public.training_records(training_date desc);
create index if not exists training_records_type_shift_idx on public.training_records(record_type, shift, training_date desc);
create index if not exists training_records_schedule_idx on public.training_records(schedule_id);
create unique index if not exists training_records_daily_unique_idx on public.training_records(training_date, shift) where record_type = 'daily';
create table if not exists public.training_attendees (
  id uuid primary key default gen_random_uuid(),
  training_record_id uuid not null references public.training_records(id) on delete cascade,
  personnel_id bigint not null references public.personnel(id) on delete restrict,
  hours numeric(5,2) not null default 0 check (hours >= 0),
  attendance_notes text,
  created_at timestamptz not null default now(),
  unique(training_record_id, personnel_id)
);
create index if not exists training_attendees_personnel_idx on public.training_attendees(personnel_id, training_record_id);
alter table public.training_schedule enable row level security;
alter table public.training_records enable row level security;
alter table public.training_attendees enable row level security;
drop policy if exists training_schedule_read on public.training_schedule;
create policy training_schedule_read on public.training_schedule for select to authenticated using (true);
drop policy if exists training_schedule_admin_write on public.training_schedule;
create policy training_schedule_admin_write on public.training_schedule for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
drop policy if exists training_records_read on public.training_records;
create policy training_records_read on public.training_records for select to authenticated using ((select private.is_admin()) or (select private.is_officer()) or (select private.is_on_duty()));
drop policy if exists training_records_staff_write on public.training_records;
create policy training_records_staff_write on public.training_records for insert to authenticated with check ((select private.is_admin()) or (select private.is_officer()));
drop policy if exists training_records_staff_update on public.training_records;
create policy training_records_staff_update on public.training_records for update to authenticated using ((select private.is_admin()) or (select private.is_officer())) with check ((select private.is_admin()) or (select private.is_officer()));
drop policy if exists training_records_admin_delete on public.training_records;
create policy training_records_admin_delete on public.training_records for delete to authenticated using ((select private.is_admin()));
drop policy if exists training_attendees_read on public.training_attendees;
create policy training_attendees_read on public.training_attendees for select to authenticated using (exists (select 1 from public.training_records r where r.id = training_record_id));
drop policy if exists training_attendees_staff_write on public.training_attendees;
create policy training_attendees_staff_write on public.training_attendees for all to authenticated using (exists (select 1 from public.training_records r where r.id = training_record_id and ((select private.is_admin()) or (select private.is_officer())))) with check (exists (select 1 from public.training_records r where r.id = training_record_id and ((select private.is_admin()) or (select private.is_officer()))));
grant select, insert, update, delete on public.training_schedule to authenticated;
grant select, insert, update, delete on public.training_records to authenticated;
grant select, insert, update, delete on public.training_attendees to authenticated;
