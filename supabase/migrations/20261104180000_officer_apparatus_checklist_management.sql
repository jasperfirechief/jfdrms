-- Allow administrators and officers to manage apparatus check categories and items.
-- Apparatus check completion permissions remain unchanged.

drop policy if exists check_categories_admin_write on public.apparatus_check_categories;
create policy check_categories_admin_officer_write
on public.apparatus_check_categories
for all to authenticated
using ((select private.is_admin()) or (select private.is_officer()))
with check ((select private.is_admin()) or (select private.is_officer()));

drop policy if exists check_items_admin_write on public.apparatus_check_items;
create policy check_items_admin_officer_write
on public.apparatus_check_items
for all to authenticated
using ((select private.is_admin()) or (select private.is_officer()))
with check ((select private.is_admin()) or (select private.is_officer()));
