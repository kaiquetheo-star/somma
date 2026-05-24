import { calculateE1RM, estimateBestE1RMFromLogs } from '@/lib/physics/rmCalculator';
import { getMicrocycleDay } from '@/lib/gameplan/microcycleWeek';
import type { LibraryCombatCombo, LibraryExercise } from '@/lib/catalog/library';
import type { MicrocycleDay } from '@/types/gameplan';
import type {
  E1rmUnlock,
  PerformanceLogEntry,
  WorkoutSessionSummary,
} from '@/types/performance';

function todayDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function isTodayTimestamp(timestamp: string): boolean {
  return timestamp.slice(0, 10) === todayDateKey();
}

function blockIdsForDay(day: MicrocycleDay | null): Set<string> {
  if (!day) return new Set();
  return new Set(day.blocks.map((block) => block.id));
}

function logsForDay(
  logs: PerformanceLogEntry[],
  day: MicrocycleDay | null,
): PerformanceLogEntry[] {
  const ids = blockIdsForDay(day);
  if (ids.size === 0) return logs.filter((log) => isTodayTimestamp(log.timestamp));
  return logs.filter((log) => ids.has(log.block_id) || isTodayTimestamp(log.timestamp));
}

export function computeTotalVolumeKg(logs: PerformanceLogEntry[]): number {
  let total = 0;

  for (const log of logs) {
    if (log.pillar === 'iron' && log.iron?.sets?.length) {
      for (const set of log.iron.sets) {
        if (set.weight_kg > 0 && set.reps > 0) {
          total += set.weight_kg * set.reps;
        }
      }
    }
  }

  return Math.round(total * 10) / 10;
}

export function computeCnsFatigueTotal(
  logs: PerformanceLogEntry[],
  exerciseCatalog: LibraryExercise[],
  combatCatalog: LibraryCombatCombo[],
): number {
  let total = 0;

  for (const log of logs) {
    if (log.pillar === 'iron' && log.iron) {
      const meta = exerciseCatalog.find((row) => row.id === log.iron!.exercise_id);
      const cns = meta?.cns_fatigue_cost ?? 3;
      total += cns * log.iron.sets.length;
      continue;
    }

    if (log.pillar === 'combat' && log.combat) {
      for (const round of log.combat.rounds) {
        const combo = combatCatalog.find(
          (row) => row.combo_name === round.combo_name || row.slug === round.combo_name,
        );
        total += combo?.complexity_level ?? 3;
      }
    }
  }

  return total;
}

function historicalLogsBeforeToday(
  logs: PerformanceLogEntry[],
  exerciseId: string,
): PerformanceLogEntry[] {
  return logs.filter(
    (log) =>
      log.timestamp.slice(0, 10) < todayDateKey() &&
      (log.iron?.exercise_id === exerciseId || log.pillar === 'iron'),
  );
}

export function detectE1rmUnlocks(
  dayLogs: PerformanceLogEntry[],
  allLogs: PerformanceLogEntry[],
): E1rmUnlock[] {
  const unlocks: E1rmUnlock[] = [];
  const seen = new Set<string>();

  for (const log of dayLogs) {
    if (!log.iron?.exercise_id || !log.iron.sets.length) continue;
    const exerciseId = log.iron.exercise_id;
    if (seen.has(exerciseId)) continue;
    seen.add(exerciseId);

    let bestToday = 0;
    for (const set of log.iron.sets) {
      const candidate = calculateE1RM(set.weight_kg, set.reps);
      if (candidate > bestToday) bestToday = candidate;
    }
    if (bestToday <= 0) continue;

    const priorBest =
      estimateBestE1RMFromLogs(
        historicalLogsBeforeToday(allLogs, exerciseId).flatMap((entry) => {
          if (!entry.iron) return [];
          return [
            {
              exercise_id: entry.iron.exercise_id,
              weight_used: null,
              reps_completed: null,
              timestamp: entry.timestamp,
              payload: { iron: { exercise_id: entry.iron.exercise_id, sets: entry.iron.sets } },
            },
          ];
        }),
        exerciseId,
      ) ?? null;

    if (priorBest == null || bestToday > priorBest + 0.05) {
      unlocks.push({
        exercise_id: exerciseId,
        exercise_name: log.iron.exercise_name,
        e1rm_kg: Math.round(bestToday * 10) / 10,
        previous_best_kg: priorBest != null ? Math.round(priorBest * 10) / 10 : null,
      });
    }
  }

  return unlocks;
}

export function buildWorkoutSessionSummary(input: {
  dayIndex: number;
  weeklyMicrocycle: MicrocycleDay[] | null;
  performanceLogs: PerformanceLogEntry[];
  exerciseCatalog: LibraryExercise[];
  combatCatalog: LibraryCombatCombo[];
}): WorkoutSessionSummary {
  const day = getMicrocycleDay(input.weeklyMicrocycle, input.dayIndex);
  const dayLogs = logsForDay(input.performanceLogs, day);

  return {
    day_index: input.dayIndex,
    focus_label: day?.focus_label ?? 'Training Day',
    total_volume_kg: computeTotalVolumeKg(dayLogs),
    cns_fatigue_total: computeCnsFatigueTotal(
      dayLogs,
      input.exerciseCatalog,
      input.combatCatalog,
    ),
    e1rm_unlocks: detectE1rmUnlocks(dayLogs, input.performanceLogs),
    completed_at: new Date().toISOString(),
  };
}
