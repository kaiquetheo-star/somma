import type { BiologicalProfile, TrainingExperienceLevel } from '@/types/biological';
import type { MovementPattern } from '@/types/catalog';
import type { PerformanceLogEntry } from '@/types/performance';

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

function roundDownToPlateIncrement(value: number): number {
  return Math.max(0, Math.floor(value / 2.5) * 2.5);
}

type ColdStartLiftCategory = 'bench' | 'squat' | 'deadlift' | 'compound' | 'isolation' | 'bodyweight';

interface PassportLoadExerciseMeta {
  id?: string;
  slug?: string;
  name?: string;
  movement_pattern?: MovementPattern | null;
  equipment_required?: string[];
}

const BODYWEIGHT_MULTIPLIERS: Record<
  TrainingExperienceLevel,
  Record<ColdStartLiftCategory, number>
> = {
  beginner: {
    bench: 0.4,
    squat: 0.55,
    deadlift: 0.7,
    compound: 0.35,
    isolation: 0.15,
    bodyweight: 0,
  },
  intermediate: {
    bench: 0.55,
    squat: 0.75,
    deadlift: 0.95,
    compound: 0.45,
    isolation: 0.2,
    bodyweight: 0,
  },
  advanced: {
    bench: 0.7,
    squat: 0.95,
    deadlift: 1.1,
    compound: 0.55,
    isolation: 0.25,
    bodyweight: 0,
  },
};

function resolveExperienceLevel(
  value: TrainingExperienceLevel | string | null | undefined,
): TrainingExperienceLevel {
  return value === 'intermediate' || value === 'advanced' ? value : 'beginner';
}

function classifyColdStartLift(exercise: PassportLoadExerciseMeta): ColdStartLiftCategory {
  const text = [exercise.id, exercise.slug, exercise.name].filter(Boolean).join(' ').toLowerCase();
  const equipment = exercise.equipment_required ?? [];
  if (equipment.length > 0 && equipment.every((tag) => tag === 'bodyweight')) return 'bodyweight';
  if (/\b(bench|supino)\b/.test(text)) return 'bench';
  if (/\b(deadlift|terra)\b/.test(text)) return 'deadlift';
  if (/\b(squat|agachamento)\b/.test(text) || exercise.movement_pattern === 'squat') return 'squat';
  if (exercise.movement_pattern === 'hinge') return 'deadlift';
  if (exercise.movement_pattern === 'push' || exercise.movement_pattern === 'pull') return 'compound';
  return exercise.movement_pattern === 'isolation' ? 'isolation' : 'compound';
}

/**
 * Passport-only cold start: used only before an exercise has logged sets.
 * Logged E1RM must always supersede this bodyweight baseline.
 */
export function targetWeightFromPassport(
  biological: Pick<BiologicalProfile, 'weight_kg' | 'experience_level'>,
  exercise: PassportLoadExerciseMeta,
): number | null {
  const bodyweightKg = biological.weight_kg;
  if (bodyweightKg == null || !Number.isFinite(bodyweightKg) || bodyweightKg <= 0) return null;

  const experience = resolveExperienceLevel(biological.experience_level);
  const category = classifyColdStartLift(exercise);
  const multiplier = BODYWEIGHT_MULTIPLIERS[experience][category];
  if (multiplier <= 0) return null;

  return roundDownToPlateIncrement(bodyweightKg * multiplier);
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

/** True when the athlete has logged at least one working set for this movement. */
export function hasIronHistoryForExercise(
  logs: PerformanceLogSample[],
  exerciseId: string,
): boolean {
  return estimateBestE1RMFromLogs(logs, exerciseId) != null;
}

function performanceEntriesToSamples(entries: PerformanceLogEntry[]): PerformanceLogSample[] {
  const cutoff = Date.now() - THREE_WEEKS_MS;
  const samples: PerformanceLogSample[] = [];

  for (const entry of entries) {
    if (entry.pillar !== 'iron' || !entry.iron?.sets.length) continue;
    if (Date.parse(entry.timestamp) < cutoff) continue;

    samples.push({
      exercise_id: entry.iron.exercise_id,
      weight_used: entry.iron.sets[entry.iron.sets.length - 1]?.weight_kg ?? null,
      reps_completed: entry.iron.sets[entry.iron.sets.length - 1]?.reps ?? null,
      timestamp: entry.timestamp,
      payload: {
        iron: {
          exercise_id: entry.iron.exercise_id,
          sets: entry.iron.sets.map((set) => ({
            weight_kg: set.weight_kg,
            reps: set.reps,
          })),
        },
      },
    });
  }

  return samples;
}

/**
 * Local performance_logs (Zustand) → E1RM → goal-aware target weight.
 */
export function getTargetWeightFromLogs(
  entries: PerformanceLogEntry[],
  exerciseId: string,
  targetReps: number,
  targetRIR: number,
  goalType: string | null,
): number | null {
  if (!exerciseId) return null;
  const logs = performanceEntriesToSamples(entries);
  const e1rm = estimateBestE1RMFromLogs(logs, exerciseId);
  if (e1rm == null) return null;
  return targetWeightFromE1RM(e1rm, goalType, targetReps, targetRIR);
}

/** @deprecated Use getTargetWeightFromLogs — local-first only */
export async function getTargetWeight(
  _userId: string,
  exerciseId: string,
  targetReps: number,
  targetRIR: number,
  goalType: string | null,
  performanceLogs: PerformanceLogEntry[] = [],
): Promise<number | null> {
  return getTargetWeightFromLogs(performanceLogs, exerciseId, targetReps, targetRIR, goalType);
}
