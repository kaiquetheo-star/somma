-- Clinical Engine: mesocycle position + rolling CNS fatigue (Zero-Cost protocol)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS mesocycle_week integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS cns_fatigue_score double precision NOT NULL DEFAULT 0;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_mesocycle_week_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_mesocycle_week_check
  CHECK (mesocycle_week >= 1 AND mesocycle_week <= 4);

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_cns_fatigue_score_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_cns_fatigue_score_check
  CHECK (cns_fatigue_score >= 0 AND cns_fatigue_score <= 100);

COMMENT ON COLUMN public.profiles.mesocycle_week IS '1–4 mesocycle week; week 4 triggers deload in deterministic Head Coach';
COMMENT ON COLUMN public.profiles.cns_fatigue_score IS 'Rolling CNS load from performance sync (iron +2/set, combat +3/round, spirit −1/flow)';
