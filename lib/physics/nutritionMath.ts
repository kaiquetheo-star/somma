import { ageFromDateOfBirth, type BiologicalProfile, type TargetArchetype } from '@/types/biological';

export type NutritionStatus = 'DEFICIT' | 'ON_TARGET' | 'SURPLUS';

export interface MacroTargets {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fats_g: number;
  archetype: TargetArchetype;
  surplus_label: string;
}

/**
 * Katch-McArdle BMR (requires body fat %).
 * BMR = 370 + (21.6 × lean body mass in kg)
 */
function katchMcArdleBMR(weightKg: number, bodyFatPercent: number): number {
  const leanMass = weightKg * (1 - bodyFatPercent / 100);
  return 370 + 21.6 * leanMass;
}

/**
 * Mifflin-St Jeor BMR fallback when body fat is unavailable.
 * Male: 10×weight + 6.25×height − 5×age − 5 (conservative; no sex field available)
 */
function mifflinBMR(weightKg: number, heightCm: number, age: number): number {
  return 10 * weightKg + 6.25 * heightCm - 5 * age - 5;
}

/**
 * Activity multiplier from training frequency.
 * 1–2 days: 1.375 (lightly active)
 * 3–5 days: 1.55 (moderately active)
 * 6–7 days: 1.725 (very active)
 */
function activityMultiplier(trainingDaysPerWeek: number | null): number {
  const days = trainingDaysPerWeek ?? 4;
  if (days <= 2) return 1.375;
  if (days <= 5) return 1.55;
  return 1.725;
}

const ARCHETYPE_CONFIG: Record<TargetArchetype, {
  calorieModifier: number;
  proteinPerKg: number;
  fatPerKg: number;
  label: string;
}> = {
  POWERBUILDER_BULK: { calorieModifier: 1.15, proteinPerKg: 2.0, fatPerKg: 0.8, label: '+15% SURPLUS' },
  AESTHETIC_V_TAPER: { calorieModifier: 0.90, proteinPerKg: 2.3, fatPerKg: 0.7, label: '-10% DEFICIT' },
  LEAN_RECOMP: { calorieModifier: 1.0, proteinPerKg: 2.1, fatPerKg: 0.8, label: 'MAINTENANCE' },
};

/**
 * Deterministic macro calculator. $0 API, fully local.
 * Returns null if insufficient profile data.
 */
export function calculateMacroTargets(profile: BiologicalProfile): MacroTargets | null {
  const { target_archetype, weight_kg, height_cm, date_of_birth, training_days_per_week } = profile;

  if (!target_archetype || weight_kg == null || weight_kg <= 0) return null;
  if (height_cm == null || height_cm <= 0) return null;

  const bodyFat = profile.current_body_fat_estimate ?? profile.body_fat_percentage;
  const age = ageFromDateOfBirth(date_of_birth);

  let bmr: number;
  if (bodyFat != null && bodyFat > 0 && bodyFat < 60) {
    bmr = katchMcArdleBMR(weight_kg, bodyFat);
  } else if (age != null) {
    bmr = mifflinBMR(weight_kg, height_cm, age);
  } else {
    bmr = mifflinBMR(weight_kg, height_cm, 30);
  }

  const tdee = bmr * activityMultiplier(training_days_per_week);
  const config = ARCHETYPE_CONFIG[target_archetype];
  const calories = Math.round(tdee * config.calorieModifier);

  const protein_g = Math.round(weight_kg * config.proteinPerKg);
  const fats_g = Math.round(weight_kg * config.fatPerKg);
  const proteinCals = protein_g * 4;
  const fatCals = fats_g * 9;
  const carbCals = Math.max(0, calories - proteinCals - fatCals);
  const carbs_g = Math.round(carbCals / 4);

  return {
    calories,
    protein_g,
    carbs_g,
    fats_g,
    archetype: target_archetype,
    surplus_label: config.label,
  };
}

/**
 * Format macro targets as a single monochrome uppercase telemetry line.
 */
export function formatMacroLine(macros: MacroTargets): string {
  return `TARGET: ${macros.calories} KCAL · P: ${macros.protein_g}G | C: ${macros.carbs_g}G | F: ${macros.fats_g}G`;
}

/**
 * Glycogen protection rule: returns true when 2+ consecutive deficit days detected.
 */
export function isGlycogenDepleted(recentNutritionStatuses: NutritionStatus[]): boolean {
  if (recentNutritionStatuses.length < 2) return false;
  const last2 = recentNutritionStatuses.slice(-2);
  return last2.every((s) => s === 'DEFICIT');
}

/**
 * MRV clamp factor: reduces prescribed sets by 10% when glycogen is depleted.
 */
export function glycogenMrvClampFactor(depleted: boolean): number {
  return depleted ? 0.9 : 1.0;
}

/**
 * Deload acceleration: triggers deload when DEFICIT + elevated ACWR (>1.3).
 */
export function shouldAccelerateDeload(
  nutritionStatus: NutritionStatus | null,
  acwr: number | null,
): boolean {
  if (nutritionStatus !== 'DEFICIT') return false;
  if (acwr == null || !Number.isFinite(acwr)) return false;
  return acwr > 1.3;
}
