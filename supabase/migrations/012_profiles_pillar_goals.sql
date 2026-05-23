-- Per-pillar training goals on profiles (multidisciplinary coach context)

alter table public.profiles
  add column if not exists goal_iron text,
  add column if not exists goal_combat text,
  add column if not exists goal_flow text,
  add column if not exists goal_spirit text;

comment on column public.profiles.goal_iron is 'User intent for Iron coach (e.g. Hypertrophy, Strength)';
comment on column public.profiles.goal_combat is 'User intent for Combat coach (e.g. Cardio conditioning, Technical mastery)';
comment on column public.profiles.goal_flow is 'User intent for Flow coach (e.g. Mobility, Active recovery)';
comment on column public.profiles.goal_spirit is 'User intent for Spirit coach (e.g. Nervous system recovery, Breath mastery)';
