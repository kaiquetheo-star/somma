-- Lottie / SVG movement demonstrations (bundled in app — zero hosting cost)
-- Run after 008_iron_biomechanics.sql (library tables from 004 / 007)
-- IMPORTANT: Paste ONLY this file into Supabase SQL Editor (no markdown lines).

alter table public.library_exercises
  add column if not exists visual_asset_url text,
  add column if not exists visual_asset_type text;

alter table public.library_combat
  add column if not exists visual_asset_url text,
  add column if not exists visual_asset_type text;

alter table public.library_flow_spirit
  add column if not exists visual_asset_url text,
  add column if not exists visual_asset_type text;

alter table public.library_exercises
  drop constraint if exists library_exercises_visual_asset_type_check;

alter table public.library_combat
  drop constraint if exists library_combat_visual_asset_type_check;

alter table public.library_flow_spirit
  drop constraint if exists library_flow_spirit_visual_asset_type_check;

alter table public.library_exercises
  add constraint library_exercises_visual_asset_type_check
  check (visual_asset_type is null or visual_asset_type in ('lottie', 'svg'));

alter table public.library_combat
  add constraint library_combat_visual_asset_type_check
  check (visual_asset_type is null or visual_asset_type in ('lottie', 'svg'));

alter table public.library_flow_spirit
  add constraint library_flow_spirit_visual_asset_type_check
  check (visual_asset_type is null or visual_asset_type in ('lottie', 'svg'));

comment on column public.library_exercises.visual_asset_url is
  'Bundled asset path or URI for movement demo (e.g. assets/lottie/iron/barbell_bench_press.json)';

comment on column public.library_exercises.visual_asset_type is
  'Renderer for visual_asset_url: lottie | svg';

comment on column public.library_combat.visual_asset_url is
  'Bundled asset path or URI for combo / strike demo';

comment on column public.library_combat.visual_asset_type is
  'Renderer for visual_asset_url: lottie | svg';

comment on column public.library_flow_spirit.visual_asset_url is
  'Bundled asset path or URI for asana / flow demo';

comment on column public.library_flow_spirit.visual_asset_type is
  'Renderer for visual_asset_url: lottie | svg';
