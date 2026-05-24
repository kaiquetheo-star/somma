import type { PerformanceLogEntry } from '@/types/performance';

/** Flat row shape for mesocycle / E1RM engines */
export interface EnginePerformanceRow {
  pillar: string;
  exercise_id: string | null;
  weight_used: number | null;
  reps_completed: number | null;
  rpe_score: number | null;
  timestamp: string;
  payload?: {
    iron?: {
      exercise_id?: string;
      sets?: { weight_kg?: number; reps?: number; rpe?: number }[];
    };
    volume?: number;
  } | null;
}

export function flattenPerformanceLogs(entries: PerformanceLogEntry[]): EnginePerformanceRow[] {
  const rows: EnginePerformanceRow[] = [];

  for (const entry of entries) {
    if (entry.pillar === 'iron' && entry.iron?.sets.length) {
      const lastSet = entry.iron.sets[entry.iron.sets.length - 1];
      rows.push({
        pillar: 'iron',
        exercise_id: entry.iron.exercise_id,
        weight_used: lastSet?.weight_kg ?? null,
        reps_completed: lastSet?.reps ?? null,
        rpe_score: lastSet?.rir ?? null,
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
      continue;
    }

    if (entry.pillar === 'combat' || entry.pillar === 'spirit') {
      rows.push({
        pillar: entry.pillar,
        exercise_id: null,
        weight_used: null,
        reps_completed: null,
        rpe_score: entry.combat?.rpe_score ?? null,
        timestamp: entry.timestamp,
        payload: entry.combat
          ? { volume: (entry.combat.rounds?.length ?? 0) * 180 }
          : null,
      });
    }
  }

  return rows.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export function filterIronLogsLastDays(
  logs: EnginePerformanceRow[],
  days: number,
): EnginePerformanceRow[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffIso = cutoff.toISOString();
  return logs
    .filter((log) => log.pillar === 'iron' && log.timestamp >= cutoffIso)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export function filterLogsLastHours(logs: EnginePerformanceRow[], hours: number): EnginePerformanceRow[] {
  const cutoff = Date.now() - hours * 60 * 60 * 1000;
  return logs.filter((log) => Date.parse(log.timestamp) >= cutoff);
}
