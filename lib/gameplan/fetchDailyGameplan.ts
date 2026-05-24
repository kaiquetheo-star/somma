// CLINICAL ENGINE: DETERMINISTIC ONLY. NO RANDOMNESS ALLOWED. IF INPUTS ARE CONSTANT, OUTPUT MUST BE CONSTANT.
import { fetchLibraryExercises } from '@/lib/catalog/library';
import { isSupabaseConfigured } from '@/lib/config';
import { applyNeuroMechanicalOrderingToMicrocycle } from '@/lib/gameplan/engine/clinicalLaws';
import { generateDeterministicGameplan } from '@/lib/gameplan/engine/generateDeterministicGameplan';
import { getMicrocycleDay, getTodayDayIndex } from '@/lib/gameplan/microcycleWeek';
import { GameplanFetchError } from '@/lib/gameplan/gameplanErrors';
import { generateStubGameplan } from '@/lib/gameplan/generateStubGameplan';
import { assessMicrocycleHealth } from '@/lib/gameplan/microcycleValidation';
import { parseDailyGameplanPayload } from '@/lib/gameplan/parseGameplan';
import { getSupabase } from '@/lib/supabase/client';
import type { BiologicalProfile } from '@/types/biological';
import { deriveTrainingDaysFromFrequencies } from '@/types/biological';
import type { DailyGameplan } from '@/types/gameplan';
import type { PerformanceLogEntry } from '@/types/performance';
import type { FocusPreference, EquipmentTag, UserStats } from '@/store/useSommaStore';

/** Matches Edge `daily_protocols.source` and handler `source` field */
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

function todayDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

async function fetchProtocolFromTable(
  userId: string,
  expectedTrainingDays?: number,
): Promise<{ gameplan: DailyGameplan; source: GameplanSource } | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('daily_protocols')
    .select('blocks, microcycle, week_start_date, generated_at, protocol_date, source')
    .eq('user_id', userId)
    .eq('protocol_date', todayDateKey())
    .maybeSingle();

  if (error) {
    console.error('[SOMMA] daily_protocols cache read failed:', error.message);
    return null;
  }
  if (!data) return null;

  const gameplan = parseDailyGameplanPayload({
    date: data.protocol_date,
    blocks: data.blocks,
    microcycle: data.microcycle,
    week_start_date: data.week_start_date,
    generated_at: data.generated_at,
    training_days_per_week: expectedTrainingDays,
  });

  if (!gameplan) {
    console.warn('[SOMMA] Rejecting stale/degenerate cached protocol for', todayDateKey());
    return null;
  }

  const health = assessMicrocycleHealth(gameplan.microcycle, expectedTrainingDays);
  console.log('[SOMMA] Using cached daily_protocols', {
    source: data.source,
    health,
  });

  const source = parseGameplanSource(data.source) ?? 'deterministic';
  return { gameplan, source };
}

async function persistGameplanToSupabase(
  userId: string,
  gameplan: DailyGameplan,
  source: GameplanSource,
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  const microcycleWithStatus = gameplan.microcycle.map((day) => ({
    ...day,
    blocks: day.blocks.map((block) => ({ ...block, status: block.status ?? 'pending' })),
  }));

  const blocksWithStatus = gameplan.blocks.map((block) => ({
    ...block,
    status: block.status ?? 'pending',
  }));

  const { error } = await supabase.from('daily_protocols').upsert(
    {
      user_id: userId,
      protocol_date: gameplan.date,
      blocks: blocksWithStatus,
      microcycle: microcycleWithStatus,
      week_start_date: gameplan.week_start_date ?? null,
      source,
      generated_at: gameplan.generated_at,
    },
    { onConflict: 'user_id,protocol_date' },
  );

  if (error) {
    console.warn('[SOMMA] daily_protocols upsert failed (local plan still active):', error.message);
  }
}

/** Ensures recruitment sort + display names before Zustand (including cached protocols). */
async function finalizeGameplanOrdering(gameplan: DailyGameplan): Promise<DailyGameplan> {
  const catalog = await fetchLibraryExercises();
  const microcycle = applyNeuroMechanicalOrderingToMicrocycle(gameplan.microcycle, catalog);
  const todayIndex = getTodayDayIndex(gameplan.week_start_date);
  const blocks = getMicrocycleDay(microcycle, todayIndex)?.blocks ?? gameplan.blocks;
  return { ...gameplan, microcycle, blocks };
}

async function generateLocalGameplan(input: {
  focus: FocusPreference;
  equipment: EquipmentTag[];
  biological: BiologicalProfile;
  userStats: UserStats;
  performanceLogs: PerformanceLogEntry[];
}): Promise<DailyGameplan> {
  console.log('[SOMMA] Local deterministic Head Coach — $0 API path');
  return generateDeterministicGameplan({
    focus: input.focus,
    equipment: input.equipment,
    biological: input.biological,
    userStats: input.userStats,
    performanceLogs: input.performanceLogs,
  });
}

export interface FetchDailyGameplanInput {
  focus: FocusPreference;
  equipment: EquipmentTag[];
  userId?: string | null;
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
 * Local deterministic engine → Postgres cache → offline stub.
 * No LLM / Edge Function calls for standard generation ($0 API).
 */
export async function fetchDailyGameplan({
  focus,
  equipment,
  userId,
  forceRefresh = false,
  biological,
  userStats,
  performanceLogs,
}: FetchDailyGameplanInput): Promise<FetchDailyGameplanResult> {
  const trainingDaysPerWeek = deriveTrainingDaysFromFrequencies(biological);

  if (isSupabaseConfigured && userId) {
    if (!forceRefresh) {
      const cached = await fetchProtocolFromTable(userId, trainingDaysPerWeek);
      if (cached) {
        const gameplan = await finalizeGameplanOrdering(cached.gameplan);
        return { gameplan, source: cached.source, fromCache: true };
      }
    }

    try {
      const generated = await generateLocalGameplan({
        focus,
        equipment,
        biological,
        userStats,
        performanceLogs,
      });
      const gameplan = await finalizeGameplanOrdering(generated);

      await persistGameplanToSupabase(userId, gameplan, 'local');

      const health = assessMicrocycleHealth(gameplan.microcycle, trainingDaysPerWeek);
      console.log('[SOMMA] Local microcycle generated', { health, trainingDaysPerWeek });

      return { gameplan, source: 'local', fromCache: false };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Local generation failed';
      console.error('[SOMMA] Local Head Coach failed:', message);
      throw new GameplanFetchError(message, {
        code: message.startsWith('INSUFFICIENT_CATALOG') ? 'INSUFFICIENT_CATALOG' : 'GENERATION_FAILED',
      });
    }
  }

  console.log('[SOMMA] fetchDailyGameplan: offline stub path (Supabase not configured)');
  return {
    gameplan: generateStubGameplan(focus, equipment, trainingDaysPerWeek),
    source: 'stub',
    fromCache: false,
  };
}
