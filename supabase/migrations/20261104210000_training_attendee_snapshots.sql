alter table public.training_attendees alter column personnel_id drop not null;
alter table public.training_attendees add column if not exists personnel_name text;
alter table public.training_attendees add column if not exists shift_at_training text;
alter table public.training_attendees drop constraint if exists training_attendees_personnel_id_fkey;
alter table public.training_attendees add constraint training_attendees_personnel_id_fkey foreign key (personnel_id) references public.personnel(id) on delete set null;