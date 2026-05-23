/** Shared 1RM physics — imported by Edge Functions (Deno). Mirrors lib/physics/rmCalculator.ts */

export type IronGoalType = 'hypertrophy' | 'strength' | 'default';

export interface EdgePerformanceLogSample {
  exercise_id: string | null;
  weight_used: number | null;
  reps_completed: number | null;
  timestamp: string;
  payload?: {
    iron?: {
      exercise_id?: string;
      sets?: { weight_kg?: number; reps?: number }[];
    };
  } | null;
}

export function calculateE1RM(weightKg: number, reps: number): number {
  if (!Number.isFinite(weightKg) || !Number.isFinite(reps) || weightKg <= 0 || reps <= 0) {
    return 0;
  }
  if (reps === 1) return weightKg;
  return weightKg * (1 + reps / 30);
}

export function resolveIronGoalType(goalType: string | null | undefined): IronGoalType {
  const normalized = (goalType ?? '').trim().toLowerCase();
  if (normalized.includes('strength')) return 'strength';
  if (normalized.includes('hypertrophy') || normalized.includes('powerbuilding')) {
    return 'hypertrophy';
  }
  return 'default';
}

export function intensityPercentForGoal(goal: IronGoalType): number {
  switch (goal) {
    case 'strength':
      return 0.875;
    case 'hypertrophy':
      return 0.75;
    default:
      return 0.72;
  }
}

function roundWeightKg(value: number): number {
  return Math.round(value * 10) / 10;
}

export function adjustIntensityForRir(basePercent: number, targetRir: number): number {
  const clampedRir = Math.min(4, Math.max(0, Math.round(targetRir)));
  const delta = (2 - clampedRir) * 0.025;
  return Math.min(0.95, Math.max(0.5, basePercent + delta));
}

export function targetWeightFromE1RM(
  e1rmKg: number,
  goalType: string | null | undefined,
  targetReps: number,
  targetRir: number,
): number | null {
  if (!Number.isFinite(e1rmKg) || e1rmKg <= 0) return null;

  const goal = resolveIronGoalType(goalType);
  const basePercent = intensityPercentForGoal(goal);
  const percent = adjustIntensityForRir(basePercent, targetRir);
  const repFactor = targetReps > 8 ? 0.97 : targetReps <= 5 ? 1.02 : 1;
  return roundWeightKg(e1rmKg * percent * repFactor);
}

function logMatchesExercise(log: EdgePerformanceLogSample, exerciseId: string): boolean {
  const payloadExerciseId = log.payload?.iron?.exercise_id ?? null;
  return log.exercise_id === exerciseId || payloadExerciseId === exerciseId;
}

function collectSetSamples(log: EdgePerformanceLogSample): { weightKg: number; reps: number }[] {
  const sets = log.payload?.iron?.sets;
  if (Array.isArray(sets) && sets.length > 0) {
    return sets.flatMap((set) => {
      const weightKg = set.weight_kg;
      const reps = set.reps;
      if (weightKg == null || reps == null || weightKg <= 0 || reps <= 0) return [];
      return [{ weightKg, reps }];
    });
  }

  if (log.weight_used != null && log.reps_completed != null && log.weight_used > 0 && log.reps_completed > 0) {
    return [{ weightKg: log.weight_used, reps: log.reps_completed }];
  }

  return [];
}

export function estimateBestE1RMFromLogs(
  logs: EdgePerformanceLogSample[],
  exerciseId: string,
): number | null {
  let best = 0;

  for (const log of logs) {
    if (!logMatchesExercise(log, exerciseId)) continue;

    for (const sample of collectSetSamples(log)) {
      const candidate = calculateE1RM(sample.weightKg, sample.reps);
      if (candidate > best) best = candidate;
    }
  }

  return best > 0 ? roundWeightKg(best) : null;
}
