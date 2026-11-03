alter table public.preincident_plans
  add column if not exists worksheet_data jsonb not null default '{}'::jsonb,
  add column if not exists notes text;

create index if not exists preincident_plans_location_idx
  on public.preincident_plans (latitude, longitude);

comment on column public.preincident_plans.worksheet_data is
  'Structured answers to the Jasper Fire Department Pre-Fire Worksheet.';
comment on column public.preincident_plans.notes is
  'Operational notes maintained by authorized officers and administrators.';