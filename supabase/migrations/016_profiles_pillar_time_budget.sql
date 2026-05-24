-- Per-pillar session time budgets (minutes) for Head Coach scaling

alter table public.profiles
  add column if not exists available_time_iron integer,
  add column if not exists available_time_combat integer,
  add column if not exists available_time_spirit integer;

comment on column public.profiles.available_time_iron is
  'Typical Iron session duration in minutes (e.g. 45–90)';
comment on column public.profiles.available_time_combat is
  'Typical Combat session duration in minutes';
comment on column public.profiles.available_time_spirit is
  'Typical Spirit / breathwork session duration in minutes';

alter table public.profiles
  drop constraint if exists profiles_available_time_iron_check;
alter table public.profiles
  add constraint profiles_available_time_iron_check
  check (available_time_iron is null or (available_time_iron >= 15 and available_time_iron <= 180));

alter table public.profiles
  drop constraint if exists profiles_available_time_combat_check;
alter table public.profiles
  add constraint profiles_available_time_combat_check
  check (available_time_combat is null or (available_time_combat >= 10 and available_time_combat <= 120));

alter table public.profiles
  drop constraint if exists profiles_available_time_spirit_check;
alter table public.profiles
  add constraint profiles_available_time_spirit_check
  check (available_time_spirit is null or (available_time_spirit >= 5 and available_time_spirit <= 90));
