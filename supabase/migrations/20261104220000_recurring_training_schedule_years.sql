create or replace function public.ensure_training_schedule_year(target_year integer)
returns integer
language plpgsql
security definer
set search_path = public, private, auth
as $$
declare
  inserted_count integer := 0;
begin
  if not (private.is_admin() or private.is_officer()) then
    raise exception 'Officer or administrator access required';
  end if;
  if target_year < 2027 or target_year > 2100 then
    raise exception 'Training schedule year must be between 2027 and 2100';
  end if;
  insert into public.training_schedule
    (schedule_date, shift, lesson, subject, details, start_time, end_time, source_year, source_date)
  with dates as (
    select d::date as schedule_date
    from generate_series(make_date(target_year,1,1), make_date(target_year,12,31), interval '1 day') d
    where extract(isodow from d) between 1 and 5
  ),
  shift_days as (
    select schedule_date,
      case mod(((schedule_date - date '2027-01-01') % 3 + 3) % 3, 3)
        when 0 then 'C' when 1 then 'A' else 'B'
      end as shift,
      row_number() over (
        partition by case mod(((schedule_date - date '2027-01-01') % 3 + 3) % 3, 3)
          when 0 then 'C' when 1 then 'A' else 'B'
        end order by schedule_date
      ) as sequence_number
    from dates
  ),
  templates as (
    select shift, lesson, subject, details, start_time, end_time,
      coalesce(source_date, schedule_date) as source_date,
      row_number() over (partition by shift order by schedule_date) as sequence_number,
      count(*) over (partition by shift) as sequence_count
    from public.training_schedule
    where schedule_date >= date '2026-01-01'
      and schedule_date <= date '2026-12-31'
  )
  select d.schedule_date, d.shift, t.lesson, t.subject, t.details,
    t.start_time, t.end_time, 2026, t.source_date
  from shift_days d
  join templates t
    on t.shift = d.shift
   and t.sequence_number = mod(d.sequence_number - 1, t.sequence_count) + 1
  on conflict (schedule_date, shift) do nothing;
  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;
revoke all on function public.ensure_training_schedule_year(integer) from public;
grant execute on function public.ensure_training_schedule_year(integer) to authenticated;