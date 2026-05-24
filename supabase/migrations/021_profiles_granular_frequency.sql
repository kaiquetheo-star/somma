-- Per-pillar weekly frequency (days per microcycle) for Head Coach scheduling

alter table public.profiles
  add column if not exists frequency_iron integer,
  add column if not exists frequency_combat integer,
  add column if not exists frequency_spirit integer;

comment on column public.profiles.frequency_iron is
  'Iron blocks per 7-day microcycle (0–7)';
comment on column public.profiles.frequency_combat is
  'Combat blocks per 7-day microcycle (0–7)';
comment on column public.profiles.frequency_spirit is
  'Spirit blocks per 7-day microcycle (0–7)';

-- Backfill from legacy global training_days_per_week
update public.profiles
set
  frequency_iron = coalesce(frequency_iron, training_days_per_week, 4),
  frequency_combat = coalesce(frequency_combat, training_days_per_week, 4),
  frequency_spirit = coalesce(frequency_spirit, training_days_per_week, 4)
where frequency_iron is null
   or frequency_combat is null
   or frequency_spirit is null;

alter table public.profiles
  drop constraint if exists profiles_frequency_iron_check;
alter table public.profiles
  add constraint profiles_frequency_iron_check
  check (frequency_iron is null or (frequency_iron >= 0 and frequency_iron <= 7));

alter table public.profiles
  drop constraint if exists profiles_frequency_combat_check;
alter table public.profiles
  add constraint profiles_frequency_combat_check
  check (frequency_combat is null or (frequency_combat >= 0 and frequency_combat <= 7));

alter table public.profiles
  drop constraint if exists profiles_frequency_spirit_check;
alter table public.profiles
  add constraint profiles_frequency_spirit_check
  check (frequency_spirit is null or (frequency_spirit >= 0 and frequency_spirit <= 7));
