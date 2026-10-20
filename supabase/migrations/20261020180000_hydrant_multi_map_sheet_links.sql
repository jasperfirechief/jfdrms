create table if not exists public.hydrant_asset_map_sheets (
  id bigint generated always as identity primary key,
  hydrant_id text not null references public.hydrant_assets(id) on delete cascade,
  map_sheet text not null,
  verified boolean not null default false,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  unique (hydrant_id, map_sheet)
);
create index if not exists hydrant_asset_map_sheets_sheet_idx
  on public.hydrant_asset_map_sheets (map_sheet, hydrant_id);
alter table public.hydrant_asset_map_sheets enable row level security;
drop policy if exists "active users read hydrant asset map sheets" on public.hydrant_asset_map_sheets;
create policy "active users read hydrant asset map sheets"
  on public.hydrant_asset_map_sheets for select to authenticated
  using (exists (select 1 from public.users u where u.user_id = (select auth.uid()) and u.active = true));
drop policy if exists "officers manage hydrant asset map sheets" on public.hydrant_asset_map_sheets;
create policy "officers manage hydrant asset map sheets"
  on public.hydrant_asset_map_sheets for all to authenticated
  using (exists (select 1 from public.users u where u.user_id = (select auth.uid()) and u.active = true and u.app_role = any (array['admin'::text,'officer'::text])))
  with check (exists (select 1 from public.users u where u.user_id = (select auth.uid()) and u.active = true and u.app_role = any (array['admin'::text,'officer'::text])));
insert into public.hydrant_asset_map_sheets (hydrant_id, map_sheet, verified, source)
select id, map_sheet, false, 'legacy_import'
from public.hydrant_assets
where nullif(trim(map_sheet), '') is not null
on conflict (hydrant_id, map_sheet) do nothing;
