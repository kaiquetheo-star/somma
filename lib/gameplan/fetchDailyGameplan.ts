// CLINICAL ENGINE: DETERMINISTIC ONLY. NO RANDOMNESS ALLOWED. IF INPUTS ARE CONSTANT, OUTPUT MUST BE CONSTANT.
import { fetchLibraryExercises } from '@/lib/catalog/library';
import { applyNeuroMechanicalOrderingToMicrocycle } from '@/lib/gameplan/engine/clinicalLaws';
import { generateDeterministicGameplan } from '@/lib/gameplan/engine/generateDeterministicGameplan';
import { getMicrocycleDay, getTodayDayIndex, getWeekStartMonday } from '@/lib/gameplan/microcycleWeek';
import { GameplanFetchError } from '@/lib/gameplan/gameplanErrors';
import { assessMicrocycleHealth } from '@/lib/gameplan/microcycleValidation';
import { deriveTrainingDaysFromFrequencies, isBiologicalProfileComplete } from '@/types/biological';
import type { BiologicalProfile } from '@/types/biological';
import type { DailyGameplan, MicrocycleDay } from '@/types/gameplan';
import type { PerformanceLogEntry } from '@/types/performance';
import type { FocusPreference, EquipmentTag, UserStats } from '@/store/useSommaStore';

export type GameplanSource = 'ai' | 'deterministic' | 'fallback' | 'stub' | 'local';

export function parseGameplanSource(value: unknown): GameplanSource | null {
  if (
    value === 'ai' ||
    value === 'deterministic' ||
    value === 'fallback' ||
    value === 'stub' ||
    value === 'local'
  ) {
    return value;
  }
  return null;
}

async function finalizeGameplanOrdering(gameplan: DailyGameplan): Promise<DailyGameplan> {
  const catalog = await fetchLibraryExercises();
  const microcycle = applyNeuroMechanicalOrderingToMicrocycle(gameplan.microcycle, catalog);
  const todayIndex = getTodayDayIndex(gameplan.week_start_date);
  const blocks = getMicrocycleDay(microcycle, todayIndex)?.blocks ?? gameplan.blocks;
  return { ...gameplan, microcycle, blocks };
}

export interface FetchDailyGameplanInput {
  focus: FocusPreference;
  equipment: EquipmentTag[];
  forceRefresh?: boolean;
  biological: BiologicalProfile;
  userStats: UserStats;
  performanceLogs: PerformanceLogEntry[];
}

export interface FetchDailyGameplanResult {
  gameplan: DailyGameplan;
  source: GameplanSource;
  fromCache: boolean;
}

/**
 * Build a safe empty-week blueprint when the engine cannot produce a real protocol.
 * This prevents the UI from freezing and gives the user a functional (if empty) state.
 */
function buildSafeFallbackGameplan(trainingDaysPerWeek: number): DailyGameplan {
  const today = new Date().toISOString().slice(0, 10);
  const weekStart = getWeekStartMonday(today);
  const microcycle: MicrocycleDay[] = Array.from({ length: 7 }, (_, i) => ({
    day_index: i + 1,
    is_rest_day: true,
    focus_label: 'Recovery — awaiting calibration',
    date: today,
    blocks: [],
  }));

  return {
    date: today,
    week_start_date: weekStart,
    training_days_per_week: trainingDaysPerWeek,
    microcycle,
    blocks: [],
    generated_at: new Date().toISOString(),
  };
}

/**
 * Local-first Head Coach — deterministic engine only ($0 API, no cloud).
 * Falls back to a safe empty blueprint if biological data is unhydrated or the engine throws.
 */
export async function fetchDailyGameplan({
  focus,
  equipment,
  biological,
  userStats,
  performanceLogs,
}: FetchDailyGameplanInput): Promise<FetchDailyGameplanResult> {
  const trainingDaysPerWeek = deriveTrainingDaysFromFrequencies(biological);

  if (!isBiologicalProfileComplete(biological)) {
    console.warn('[SOMMA] Biological profile incomplete/unhydrated — returning safe fallback');
    return { gameplan: buildSafeFallbackGameplan(trainingDaysPerWeek), source: 'fallback', fromCache: false };
  }

  try {
    console.log('[SOMMA] Local deterministic Head Coach — device-only path');
    const generated = await generateDeterministicGameplan({
      focus,
      equipment,
      biological,
      userStats,
      performanceLogs,
    });
    const gameplan = await finalizeGameplanOrdering(generated);

    const health = assessMicrocycleHealth(gameplan.microcycle, trainingDaysPerWeek);
    console.log('[SOMMA] Local microcycle generated', { health, trainingDaysPerWeek });

    return { gameplan, source: 'local', fromCache: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Local generation failed';
    console.error('[SOMMA] Local Head Coach failed:', message, '— returning safe fallback');
    return { gameplan: buildSafeFallbackGameplan(trainingDaysPerWeek), source: 'fallback', fromCache: false };
  }
}
