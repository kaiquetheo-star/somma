import type { ClinicalExitInterview } from '@/types/clinical';

/** Shape archetype for Natural Target Timeline steering */
export type TargetArchetype = 'AESTHETIC_V_TAPER' | 'POWERBUILDER_BULK' | 'LEAN_RECOMP';

export const TARGET_ARCHETYPE_OPTIONS: { id: TargetArchetype; label: string; description: string }[] = [
  { id: 'AESTHETIC_V_TAPER', label: 'Aesthetic V-Taper', description: 'Wide shoulders, narrow waist — delt/lat priority' },
  { id: 'POWERBUILDER_BULK', label: 'Powerbuilder Bulk', description: 'Mass + strength — compound intensity baseline' },
  { id: 'LEAN_RECOMP', label: 'Lean Recomp', description: 'Simultaneous fat loss + muscle gain — moderate deficit' },
];

/** Biological Passport — maps to `profiles` anthropometric + pillar goal columns */
export interface BiologicalProfile {
  date_of_birth: string | null;
  weight_kg: number | null;
  height_cm: number | null;
  body_fat_percentage: number | null;
  current_injuries: string | null;
  baseline_stress_level: number | null;
  goal_iron: string | null;
  goal_combat: string | null;
  goal_flow: string | null;
  goal_spirit: string | null;
  /** Weekly availability for microcycle planning (1–7) */
  training_days_per_week: number | null;
  /** Typical session duration per pillar (minutes) */
  available_time_iron: number | null;
  available_time_combat: number | null;
  available_time_spirit: number | null;
  /** Pillar blocks per 7-day microcycle (0–7 each) */
  frequency_iron: number | null;
  frequency_combat: number | null;
  frequency_spirit: number | null;
  /** Mesocycle week 1–4; week 4 = deload (Clinical Law III) */
  mesocycle_week: number | null;
  /** Rolling CNS fatigue 0–100 from performance sync */
  cns_fatigue_score: number | null;
  /** Month 1 exit interview — calibrates Month 2 target loads */
  clinical_exit_interview: ClinicalExitInterview | null;
  /** User-reported body fat estimate (%) for timeline calculation */
  current_body_fat_estimate: number | null;
  /** Selected shape archetype driving volume allocation + natural timeline */
  target_archetype: TargetArchetype | null;
}

export const PILLAR_FREQUENCY_MIN = 0;
export const PILLAR_FREQUENCY_MAX = 7;
export const DEFAULT_FREQUENCY_IRON = 4;
export const DEFAULT_FREQUENCY_COMBAT = 4;
export const DEFAULT_FREQUENCY_SPIRIT = 4;

export const TIME_BUDGET_PRESETS = [
  { id: '45', label: '45m', iron: 45, combat: 30, spirit: 20 },
  { id: '60', label: '60m', iron: 60, combat: 40, spirit: 25 },
  { id: '90', label: '90m', iron: 90, combat: 50, spirit: 30 },
  { id: 'max', label: 'Unlimited / Max Results', iron: 180, combat: 120, spirit: 90 },
] as const;

export type TimeBudgetPresetId = (typeof TIME_BUDGET_PRESETS)[number]['id'];

export const DEFAULT_AVAILABLE_TIME_IRON = 45;
export const DEFAULT_AVAILABLE_TIME_COMBAT = 30;
export const DEFAULT_AVAILABLE_TIME_SPIRIT = 20;

export const TRAINING_DAYS_MIN = 1;
export const TRAINING_DAYS_MAX = 7;
export const DEFAULT_TRAINING_DAYS_PER_WEEK = 4;

export const PILLAR_GOAL_PRESETS = {
  iron: [
    'Hypertrophy',
    'Strength',
    'Powerbuilding',
    'Maintenance',
    'Rehab / joint-safe',
  ],
  combat: [
    'Cardio conditioning',
    'Technical mastery',
    'Fight prep',
    'Footwork & defense',
    'Stress relief',
  ],
  flow: [
    'Mobility',
    'Active recovery',
    'Flexibility',
    'Pre-workout primer',
  ],
  spirit: [
    'Nervous system recovery',
    'Sleep prep',
    'Breath mastery',
    'Mindfulness',
  ],
} as const;

export type PillarGoalKey = keyof typeof PILLAR_GOAL_PRESETS;

export const initialBiologicalProfile: BiologicalProfile = {
  date_of_birth: null,
  weight_kg: null,
  height_cm: null,
  body_fat_percentage: null,
  current_injuries: null,
  baseline_stress_level: null,
  goal_iron: null,
  goal_combat: null,
  goal_flow: null,
  goal_spirit: null,
  training_days_per_week: DEFAULT_TRAINING_DAYS_PER_WEEK,
  available_time_iron: DEFAULT_AVAILABLE_TIME_IRON,
  available_time_combat: DEFAULT_AVAILABLE_TIME_COMBAT,
  available_time_spirit: DEFAULT_AVAILABLE_TIME_SPIRIT,
  frequency_iron: DEFAULT_FREQUENCY_IRON,
  frequency_combat: DEFAULT_FREQUENCY_COMBAT,
  frequency_spirit: DEFAULT_FREQUENCY_SPIRIT,
  mesocycle_week: 1,
  cns_fatigue_score: 0,
  clinical_exit_interview: null,
  current_body_fat_estimate: null,
  target_archetype: null,
};

export function clampMesocycleWeekProfile(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value)) return 1;
  return Math.min(4, Math.max(1, Math.round(value)));
}

export function clampCnsFatigueProfile(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value * 10) / 10));
}

export function clampPillarTimeMinutes(
  value: number | null | undefined,
  min: number,
  max: number,
  fallback: number,
): number {
  if (value == null || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function clampTrainingDaysPerWeek(value: number): number {
  return Math.min(TRAINING_DAYS_MAX, Math.max(TRAINING_DAYS_MIN, Math.round(value)));
}

export function clampPillarFrequency(
  value: number | null | undefined,
  fallback: number = DEFAULT_FREQUENCY_IRON,
): number {
  if (value == null || !Number.isFinite(value)) return fallback;
  return Math.min(PILLAR_FREQUENCY_MAX, Math.max(PILLAR_FREQUENCY_MIN, Math.round(value)));
}

/** Legacy `training_days_per_week` sync — active days = max pillar frequency. */
export function deriveTrainingDaysFromFrequencies(profile: Pick<
  BiologicalProfile,
  'frequency_iron' | 'frequency_combat' | 'frequency_spirit'
>): number {
  const maxFreq = Math.max(
    clampPillarFrequency(profile.frequency_iron, 0),
    clampPillarFrequency(profile.frequency_combat, 0),
    clampPillarFrequency(profile.frequency_spirit, 0),
  );
  return maxFreq > 0 ? clampTrainingDaysPerWeek(maxFreq) : TRAINING_DAYS_MIN;
}

export function inferTimeBudgetPresetId(profile: BiologicalProfile): TimeBudgetPresetId {
  const iron = profile.available_time_iron ?? DEFAULT_AVAILABLE_TIME_IRON;
  const match = TIME_BUDGET_PRESETS.find((preset) => preset.iron === iron);
  return match?.id ?? '45';
}

export function timeBudgetFromPresetId(presetId: TimeBudgetPresetId): Pick<
  BiologicalProfile,
  'available_time_iron' | 'available_time_combat' | 'available_time_spirit'
> {
  const preset = TIME_BUDGET_PRESETS.find((entry) => entry.id === presetId) ?? TIME_BUDGET_PRESETS[0];
  return {
    available_time_iron: preset.iron,
    available_time_combat: preset.combat,
    available_time_spirit: preset.spirit,
  };
}

export function formatTrainingDaysPerWeek(days: number | null): string {
  if (days == null) return '—';
  return days === 1 ? '1 day / week' : `${days} days / week`;
}

export function isBiologicalProfileComplete(profile: BiologicalProfile): boolean {
  return (
    Boolean(profile.date_of_birth) &&
    profile.weight_kg != null &&
    profile.weight_kg > 0 &&
    profile.height_cm != null &&
    profile.height_cm > 0 &&
    profile.baseline_stress_level != null &&
    profile.baseline_stress_level >= 1 &&
    profile.baseline_stress_level <= 10 &&
    profile.training_days_per_week != null &&
    profile.training_days_per_week >= TRAINING_DAYS_MIN &&
    profile.training_days_per_week <= TRAINING_DAYS_MAX
  );
}

/** Age in full years from ISO date string (YYYY-MM-DD) */
export function ageFromDateOfBirth(dateOfBirth: string | null): number | null {
  if (!dateOfBirth || !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) return null;

  const born = new Date(`${dateOfBirth}T12:00:00`);
  if (Number.isNaN(born.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - born.getFullYear();
  const monthDelta = today.getMonth() - born.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < born.getDate())) {
    age -= 1;
  }

  return age >= 0 && age < 130 ? age : null;
}
