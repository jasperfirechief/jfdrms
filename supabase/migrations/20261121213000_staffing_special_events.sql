-- Special staffing events are documented separately from regular shift staffing.
create table if not exists public.staffing_special_events (
 event_id uuid primary key default gen_random_uuid(), event_date date not null,
 event_name text not null check(length(trim(event_name)) between 1 and 160),
 location text not null check(length(trim(location)) between 1 and 300),
 start_time time not null, end_time time not null, details text,
 personnel_needed integer not null check(personnel_needed between 1 and 100),
 created_by uuid not null references auth.users(id), created_by_email text not null,
 full_notified_at timestamptz, day_before_notified_at timestamptz, cancelled_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(end_time>start_time)
);
create index if not exists staffing_special_events_date_idx on public.staffing_special_events(event_date) where cancelled_at is null;
create table if not exists public.staffing_special_event_signups (
 signup_id uuid primary key default gen_random_uuid(),
 event_id uuid not null references public.staffing_special_events(event_id) on delete cascade,
 personnel_id bigint not null references public.personnel(id),
 signup_type text not null default 'volunteer' check(signup_type in ('volunteer','admin_added')),
 added_by uuid references auth.users(id), notes text, created_at timestamptz not null default now(),
 unique(event_id,personnel_id)
);
create index if not exists staffing_special_event_signups_event_idx on public.staffing_special_event_signups(event_id);
alter table public.staffing_special_events enable row level security;
alter table public.staffing_special_event_signups enable row level security;
revoke all on public.staffing_special_events from anon,authenticated;
revoke all on public.staffing_special_event_signups from anon,authenticated;
grant all on public.staffing_special_events to service_role;
grant all on public.staffing_special_event_signups to service_role;
create or replace function public.add_staffing_special_event_signup(p_event_id uuid,p_personnel_id bigint,p_signup_type text,p_added_by uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_event public.staffing_special_events%rowtype; v_count integer; v_signup public.staffing_special_event_signups%rowtype;
begin
 select * into v_event from public.staffing_special_events where event_id=p_event_id and cancelled_at is null for update;
 if not found then raise exception 'Event not found or cancelled'; end if;
 select count(*) into v_count from public.staffing_special_event_signups where event_id=p_event_id;
 if v_count>=v_event.personnel_needed and p_signup_type='volunteer' then raise exception 'Event is already full'; end if;
 insert into public.staffing_special_event_signups(event_id,personnel_id,signup_type,added_by)
 values(p_event_id,p_personnel_id,p_signup_type,p_added_by) returning * into v_signup;
 return jsonb_build_object('signup_id',v_signup.signup_id,'count',v_count+1,'needed',v_event.personnel_needed);
end; $$;
revoke all on function public.add_staffing_special_event_signup(uuid,bigint,text,uuid) from public,anon,authenticated;
grant execute on function public.add_staffing_special_event_signup(uuid,bigint,text,uuid) to service_role;
