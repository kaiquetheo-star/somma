-- 7-day weekly microcycle storage (Head Coach plan)

alter table public.daily_protocols
  add column if not exists microcycle jsonb,
  add column if not exists week_start_date date;

comment on column public.daily_protocols.microcycle is
  '7-day plan: array of { day_index, is_rest_day, focus_label, blocks }';

comment on column public.daily_protocols.week_start_date is
  'Monday (ISO) anchoring day_index 1 for the stored microcycle';
