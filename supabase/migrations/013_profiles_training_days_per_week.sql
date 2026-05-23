-- Weekly training availability for microcycle planning

alter table public.profiles
  add column if not exists training_days_per_week int;

comment on column public.profiles.training_days_per_week is
  'Days per week the athlete can train (1–7); drives AI microcycle volume';

alter table public.profiles
  drop constraint if exists profiles_training_days_per_week_check;

alter table public.profiles
  add constraint profiles_training_days_per_week_check
  check (
    training_days_per_week is null
    or (training_days_per_week between 1 and 7)
  );
