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
}

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
};

export function clampTrainingDaysPerWeek(value: number): number {
  return Math.min(TRAINING_DAYS_MAX, Math.max(TRAINING_DAYS_MIN, Math.round(value)));
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
