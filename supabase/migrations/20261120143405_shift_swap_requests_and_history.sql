create table if not exists public.shift_swap_requests (
  swap_id uuid primary key default gen_random_uuid(),
  member_one_id bigint not null references public.personnel(id),
  member_two_id bigint not null references public.personnel(id),
  member_one_regular_shift text,
  member_two_regular_shift text,
  member_one_swap_date date not null,
  member_two_swap_date date not null,
  member_one_full_shift boolean not null default true,
  member_two_full_shift boolean not null default true,
  member_one_start_time time,
  member_one_end_time time,
  member_two_start_time time,
  member_two_end_time time,
  member_one_minutes integer not null,
  member_two_minutes integer not null,
  reason text not null,
  status text not null default 'pending' check (status in ('pending','approved','denied','cancelled')),
  submitted_by uuid references auth.users(id),
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  review_notes text,
  cancelled_by uuid references auth.users(id),
  cancelled_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint shift_swap_distinct_members check (member_one_id <> member_two_id),
  constraint shift_swap_equal_duration check (member_one_minutes > 0 and member_one_minutes = member_two_minutes),
  constraint shift_swap_reason check (length(trim(reason)) > 0),
  constraint shift_swap_time_ranges check (
    (member_one_full_shift or (member_one_start_time is not null and member_one_end_time is not null and member_one_start_time <> member_one_end_time))
    and (member_two_full_shift or (member_two_start_time is not null and member_two_end_time is not null and member_two_start_time <> member_two_end_time))
  )
);

alter table public.shift_swap_requests
  add column if not exists member_one_regular_date date,
  add column if not exists member_two_regular_date date,
  add column if not exists member_one_calendar_event_id uuid,
  add column if not exists member_two_calendar_event_id uuid,
  add column if not exists approved_at timestamptz;

alter table public.shift_swap_requests drop constraint if exists shift_swap_same_28_day_cycle;
alter table public.shift_swap_requests add constraint shift_swap_same_28_day_cycle check (
  member_one_regular_date is not null and member_two_regular_date is not null
  and member_one_regular_date <> member_two_regular_date
  and member_one_swap_date = member_two_regular_date
  and member_two_swap_date = member_one_regular_date
  and floor((member_one_regular_date - date '2026-11-28') / 28.0) = floor((member_one_swap_date - date '2026-11-28') / 28.0)
  and floor((member_one_regular_date - date '2026-11-28') / 28.0) = floor((member_two_regular_date - date '2026-11-28') / 28.0)
  and floor((member_one_regular_date - date '2026-11-28') / 28.0) = floor((member_two_swap_date - date '2026-11-28') / 28.0)
);

create index if not exists shift_swap_status_date_idx
  on public.shift_swap_requests(status, member_one_regular_date, member_two_regular_date);

create table if not exists public.shift_swap_history (
  history_id bigint generated always as identity primary key,
  swap_id uuid not null references public.shift_swap_requests(swap_id) on delete cascade,
  action text not null,
  changed_by uuid references auth.users(id),
  changed_at timestamptz not null default now(),
  details jsonb not null default '{}'::jsonb
);

create or replace function public.record_shift_swap_history()
returns trigger language plpgsql security invoker set search_path=public as $$
begin
  if TG_OP='INSERT' then
    insert into public.shift_swap_history(swap_id,action,changed_by,details)
    values(new.swap_id,'submitted',auth.uid(),to_jsonb(new));
    return new;
  end if;
  insert into public.shift_swap_history(swap_id,action,changed_by,details)
  values(
    new.swap_id,
    case
      when old.status='approved' and new.status='pending' then 'edited_after_approval'
      when old.status is distinct from new.status then new.status
      when old.status='approved' then 'edited_after_approval'
      else 'edited'
    end,
    auth.uid(),
    jsonb_build_object('before',to_jsonb(old),'after',to_jsonb(new))
  );
  return new;
end $$;

create or replace function public.touch_shift_swap_updated_at()
returns trigger language plpgsql security invoker set search_path=public as $$
begin
  new.updated_at=now();
  return new;
end $$;

drop trigger if exists shift_swap_history_trigger on public.shift_swap_requests;
create trigger shift_swap_history_trigger
after insert or update on public.shift_swap_requests
for each row execute function public.record_shift_swap_history();

drop trigger if exists shift_swap_updated_at_trigger on public.shift_swap_requests;
create trigger shift_swap_updated_at_trigger
before update on public.shift_swap_requests
for each row execute function public.touch_shift_swap_updated_at();

alter table public.shift_swap_requests enable row level security;
alter table public.shift_swap_history enable row level security;

drop policy if exists shift_swap_request_select on public.shift_swap_requests;
create policy shift_swap_request_select on public.shift_swap_requests
for select to authenticated using (private.is_admin() or private.is_officer());

drop policy if exists shift_swap_request_insert on public.shift_swap_requests;
create policy shift_swap_request_insert on public.shift_swap_requests
for insert to authenticated
with check ((private.is_admin() or private.is_officer()) and submitted_by=auth.uid() and status='pending');

drop policy if exists shift_swap_request_update on public.shift_swap_requests;
create policy shift_swap_request_update on public.shift_swap_requests
for update to authenticated
using (private.is_admin() or (private.is_officer() and submitted_by=auth.uid() and status in ('pending','approved')))
with check (private.is_admin() or (private.is_officer() and submitted_by=auth.uid() and status in ('pending','cancelled')));

drop policy if exists shift_swap_history_select on public.shift_swap_history;
create policy shift_swap_history_select on public.shift_swap_history
for select to authenticated using (private.is_admin() or private.is_officer());

drop policy if exists shift_swap_history_insert on public.shift_swap_history;
create policy shift_swap_history_insert on public.shift_swap_history
for insert to authenticated with check ((private.is_admin() or private.is_officer()) and changed_by=auth.uid());

grant select,insert,update on public.shift_swap_requests to authenticated;
grant select,insert on public.shift_swap_history to authenticated;
