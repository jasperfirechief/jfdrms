-- Restrict hydrant inspection and flow-test entry to administrators and personnel
-- assigned to an active duty roster for the current day. Active authenticated
-- users retain read access through the existing SELECT policies.

drop policy if exists "officers manage hydrant inspections" on public.hydrant_inspections;
create policy "on duty personnel and admins insert hydrant inspections"
on public.hydrant_inspections
for insert
to authenticated
with check (
  (select private.is_admin())
  or (select private.is_on_duty())
);

drop policy if exists "officers manage hydrant flow tests" on public.hydrant_flow_tests;
create policy "on duty personnel and admins insert hydrant flow tests"
on public.hydrant_flow_tests
for insert
to authenticated
with check (
  (select private.is_admin())
  or (select private.is_on_duty())
);
