-- Movement demonstration assets (MP4/WebP loops on Supabase Storage)
-- Run after 014_daily_protocols_microcycle.sql
-- IMPORTANT: Paste ONLY this file into Supabase SQL Editor (no markdown lines).

-- ---------------------------------------------------------------------------
-- Catalog columns: public Storage URL per library row
-- Example: https://<project>.supabase.co/storage/v1/object/public/movement_visuals/iron/barbell_bench_press.mp4
-- ---------------------------------------------------------------------------
alter table public.library_exercises
  add column if not exists visual_asset_url text;

alter table public.library_combat
  add column if not exists visual_asset_url text;

alter table public.library_flow_spirit
  add column if not exists visual_asset_url text;

comment on column public.library_exercises.visual_asset_url is
  'Public Supabase Storage URL for a short movement demo loop (MP4/WebP) in movement_visuals';

comment on column public.library_combat.visual_asset_url is
  'Public Supabase Storage URL for a short combo / strike demo loop (MP4/WebP) in movement_visuals';

comment on column public.library_flow_spirit.visual_asset_url is
  'Public Supabase Storage URL for a short asana / flow demo loop (MP4/WebP) in movement_visuals';

-- ---------------------------------------------------------------------------
-- Storage bucket: movement_visuals (public read — app streams without auth)
-- Path convention:
--   iron/{slug}.mp4
--   combat/{slug}.webp
--   flow/{slug}.webp  |  spirit/{slug}.webp
-- Upload via Dashboard or service role; clients read only.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'movement_visuals',
  'movement_visuals',
  true,
  15728640,
  array['video/mp4', 'video/webm', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "movement_visuals_select_public" on storage.objects;
drop policy if exists "movement_visuals_select_anon" on storage.objects;
drop policy if exists "movement_visuals_select_authenticated" on storage.objects;

-- Public read: anon + authenticated clients can stream movement loops
create policy "movement_visuals_select_public" on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'movement_visuals');
