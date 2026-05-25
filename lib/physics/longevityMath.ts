import { ageFromDateOfBirth, type BiologicalProfile, type TargetArchetype } from '@/types/biological';

export interface NaturalTargetTimeline {
  archetype: TargetArchetype;
  label: string;
  target_timeline_weeks: number;
  summary: string;
}

/**
 * Target body-fat thresholds per archetype (approximate clinically attainable ranges).
 * Aesthetic V-Taper: 10–12% BF — lean with visible musculature definition.
 * Powerbuilder Bulk: 15–18% BF — mass-prioritized with manageable adiposity.
 * Lean Recomp: 12–14% BF — moderate recomposition without extreme deficit.
 */
const ARCHETYPE_TARGET_BF: Record<TargetArchetype, number> = {
  AESTHETIC_V_TAPER: 11,
  POWERBUILDER_BULK: 16,
  LEAN_RECOMP: 13,
};

/**
 * McDonald/Aragon model: max monthly muscle gain (kg) by training experience.
 * Year 1: ~0.9 kg/month, Year 2: ~0.45 kg/month, Year 3+: ~0.22 kg/month.
 * We estimate experience from training_days_per_week and age heuristic.
 */
function estimateMonthlyMuscleGainKg(trainingYears: number): number {
  if (trainingYears < 1) return 0.9;
  if (trainingYears < 2) return 0.45;
  if (trainingYears < 3) return 0.22;
  return 0.11;
}

/**
 * Safe fat-loss rate: 0.5%–1.0% of body weight per week.
 * Conservative estimate: 0.7% BW/week for sustainability.
 */
const FAT_LOSS_RATE_PERCENT_BW_PER_WEEK = 0.007;

/**
 * Heuristic: estimate training experience years from age + training frequency.
 * A younger person with high frequency is likely early in their training career.
 * This is a rough proxy; better data would come from performance logs.
 */
function estimateTrainingYears(age: number | null, trainingDaysPerWeek: number | null): number {
  if (age == null) return 1;
  const freq = trainingDaysPerWeek ?? 3;
  if (age < 22) return freq >= 5 ? 1.5 : 0.5;
  if (age < 30) return freq >= 5 ? 3 : 1.5;
  if (age < 40) return freq >= 5 ? 5 : 2.5;
  return freq >= 5 ? 7 : 3;
}

/**
 * Pure deterministic calculator: how many weeks to reach the target archetype
 * given current anthropometric state and natural limits.
 *
 * Returns null if insufficient data to calculate.
 */
export function calculateNaturalTargetTimeline(
  profile: BiologicalProfile,
): NaturalTargetTimeline | null {
  const { target_archetype, current_body_fat_estimate, weight_kg, height_cm, date_of_birth, training_days_per_week } = profile;

  if (!target_archetype || weight_kg == null || weight_kg <= 0) return null;

  const currentBf = current_body_fat_estimate ?? profile.body_fat_percentage;
  if (currentBf == null || currentBf <= 0 || currentBf > 60) return null;

  const targetBf = ARCHETYPE_TARGET_BF[target_archetype];
  const age = ageFromDateOfBirth(date_of_birth);
  const trainingYears = estimateTrainingYears(age, training_days_per_week);
  const monthlyMuscleKg = estimateMonthlyMuscleGainKg(trainingYears);

  let weeks: number;

  if (target_archetype === 'POWERBUILDER_BULK') {
    // Bulking phase: gain lean mass at natural rate until target BF threshold
    // If already at or above target BF, timeline = muscle gain to hit mass potential
    const ffmi = computeFFMI(weight_kg, height_cm, currentBf);
    const targetFfmi = 24.5; // upper natural limit (non-enhanced)
    const currentLeanMass = weight_kg * (1 - currentBf / 100);
    const heightM = (height_cm ?? 175) / 100;
    const targetLeanMass = targetFfmi * heightM * heightM;
    const leanMassToGain = Math.max(0, targetLeanMass - currentLeanMass);
    const monthsToGain = leanMassToGain / monthlyMuscleKg;
    weeks = Math.max(8, Math.ceil(monthsToGain * 4.33));
  } else if (target_archetype === 'LEAN_RECOMP') {
    // Recomp: slower progress — estimate both fat loss and muscle gain in parallel
    const bfDelta = currentBf - targetBf;
    if (bfDelta <= 0) {
      // Already leaner than target — minimal muscle-building timeline
      weeks = Math.max(8, Math.ceil(3 / monthlyMuscleKg * 4.33));
    } else {
      const fatToLoseKg = weight_kg * (bfDelta / 100);
      const weeklyFatLossKg = weight_kg * FAT_LOSS_RATE_PERCENT_BW_PER_WEEK * 0.6; // slower recomp rate
      weeks = Math.max(8, Math.ceil(fatToLoseKg / weeklyFatLossKg));
    }
  } else {
    // AESTHETIC_V_TAPER: cut to low BF + build delt/lat mass
    const bfDelta = currentBf - targetBf;
    if (bfDelta <= 0) {
      // Already lean enough — muscle priority phase for V-taper development
      weeks = Math.max(12, Math.ceil(4 / monthlyMuscleKg * 4.33));
    } else {
      const fatToLoseKg = weight_kg * (bfDelta / 100);
      const weeklyFatLossKg = weight_kg * FAT_LOSS_RATE_PERCENT_BW_PER_WEEK;
      const fatLossWeeks = Math.ceil(fatToLoseKg / weeklyFatLossKg);
      // Add V-taper muscle development time (delt/lat hypertrophy needs volume over time)
      const muscleWeeks = Math.ceil(2 / monthlyMuscleKg * 4.33);
      weeks = Math.max(12, fatLossWeeks + Math.ceil(muscleWeeks * 0.5));
    }
  }

  // Clamp to realistic bounds
  weeks = Math.min(104, Math.max(8, weeks));

  const archLabels: Record<TargetArchetype, string> = {
    AESTHETIC_V_TAPER: 'Aesthetic V-Taper',
    POWERBUILDER_BULK: 'Powerbuilder Bulk',
    LEAN_RECOMP: 'Lean Recomp',
  };

  return {
    archetype: target_archetype,
    label: archLabels[target_archetype],
    target_timeline_weeks: weeks,
    summary: `Natural Target: ${archLabels[target_archetype]} · ${weeks}-Week Realistic Window`,
  };
}

/**
 * Fat-Free Mass Index — normalized lean mass indicator.
 * FFMI = lean_mass_kg / height_m^2
 * Natural ceiling ≈ 25 (non-enhanced athletes).
 */
function computeFFMI(weightKg: number, heightCm: number | null, bodyFatPercent: number): number {
  const heightM = (heightCm ?? 175) / 100;
  const leanMass = weightKg * (1 - bodyFatPercent / 100);
  return leanMass / (heightM * heightM);
}

export { computeFFMI };
