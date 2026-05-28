import { effectiveRpeFromSet } from '@/lib/physics/loadTelemetry';
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
      sets?: {
        weight_kg?: number;
        reps?: number;
        reported_rir?: number | null;
        target_rir?: number | null;
        rir?: number | null;
      }[];
    };
    volume?: number;
  } | null;
}

export function flattenPerformanceLogs(entries: PerformanceLogEntry[]): EnginePerformanceRow[] {
  if (!Array.isArray(entries)) return [];

  const rows: EnginePerformanceRow[] = [];

  for (const entry of entries) {
    try {
      if (!entry || typeof entry.pillar !== 'string' || typeof entry.timestamp !== 'string') {
        continue;
      }

      if (entry.pillar === 'iron' && entry.iron?.sets?.length) {
        const lastSet = entry.iron.sets[entry.iron.sets.length - 1];
        const lastRpe = lastSet ? effectiveRpeFromSet(lastSet) : null;
        rows.push({
          pillar: 'iron',
          exercise_id: entry.iron.exercise_id,
          weight_used: lastSet?.weight_kg ?? null,
          reps_completed: lastSet?.reps ?? null,
          rpe_score: lastRpe,
          timestamp: entry.timestamp,
          payload: {
            iron: {
              exercise_id: entry.iron.exercise_id,
              sets: entry.iron.sets.map((set) => ({
                weight_kg: set.weight_kg,
                reps: set.reps,
                reported_rir: set.reported_rir ?? set.rir ?? null,
                target_rir: set.target_rir ?? null,
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
    } catch {
      continue;
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
