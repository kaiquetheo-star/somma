import { getSupabase } from '@/lib/supabase/client';

/** Iron prescription goal — maps from profiles.goal_iron */
export type IronGoalType = 'hypertrophy' | 'strength' | 'default';

export interface PerformanceLogSample {
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

const THREE_WEEKS_MS = 21 * 24 * 60 * 60 * 1000;

/** Epley estimated 1-rep max: 1RM = weight × (1 + reps / 30) */
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

/** Hypertrophy 70–80% · Strength 85%+ · default mid-hypertrophy */
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

/** Adjust intensity for RIR — lower RIR → slightly higher load */
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

  // Slight rep-scaling: higher rep targets bias toward lower %1RM
  const repFactor = targetReps > 8 ? 0.97 : targetReps <= 5 ? 1.02 : 1;
  return roundWeightKg(e1rmKg * percent * repFactor);
}

function logMatchesExercise(log: PerformanceLogSample, exerciseId: string): boolean {
  const payloadExerciseId = log.payload?.iron?.exercise_id ?? null;
  return log.exercise_id === exerciseId || payloadExerciseId === exerciseId;
}

function collectSetSamples(log: PerformanceLogSample): { weightKg: number; reps: number }[] {
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

/** Best E1RM from in-memory performance samples (last 3 weeks window assumed by caller). */
export function estimateBestE1RMFromLogs(
  logs: PerformanceLogSample[],
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

/**
 * Queries performance_logs for the last 3 weeks, estimates E1RM (Epley),
 * and returns goal-aware target weight for the prescribed reps / RIR.
 */
export async function getTargetWeight(
  userId: string,
  exerciseId: string,
  targetReps: number,
  targetRIR: number,
  goalType: string | null,
): Promise<number | null> {
  const supabase = getSupabase();
  if (!supabase || !userId || !exerciseId) return null;

  const cutoff = new Date(Date.now() - THREE_WEEKS_MS).toISOString();

  const { data, error } = await supabase
    .from('performance_logs')
    .select('exercise_id, weight_used, reps_completed, timestamp, payload')
    .eq('user_id', userId)
    .eq('pillar', 'iron')
    .eq('exercise_id', exerciseId)
    .gte('timestamp', cutoff)
    .order('timestamp', { ascending: false })
    .limit(120);

  if (error || !data?.length) return null;

  const logs: PerformanceLogSample[] = data.map((row) => ({
    exercise_id: row.exercise_id,
    weight_used: row.weight_used,
    reps_completed: row.reps_completed,
    timestamp: row.timestamp,
    payload: row.payload as PerformanceLogSample['payload'],
  }));

  const e1rm = estimateBestE1RMFromLogs(logs, exerciseId);
  if (e1rm == null) return null;

  return targetWeightFromE1RM(e1rm, goalType, targetReps, targetRIR);
}
