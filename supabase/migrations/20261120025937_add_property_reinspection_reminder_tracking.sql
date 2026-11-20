alter table public.inspections
  add column if not exists property_representative_reminder_sent_at timestamptz;
