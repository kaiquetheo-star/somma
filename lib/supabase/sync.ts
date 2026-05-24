import { isSupabaseConfigured } from '@/lib/config';
import { applyCnsFatigueFromQueue } from '@/lib/supabase/cnsFatigue';
import { clampCnsFatigueProfile } from '@/types/biological';
import {
  fetchDailyGameplan,
  type GameplanSource,
} from '@/lib/gameplan/fetchDailyGameplan';
import { isGameplanFetchError } from '@/lib/gameplan/gameplanErrors';
import { getSupabase } from '@/lib/supabase/client';
import type { DailyGameplan } from '@/types/gameplan';
import type { FocusPreference, EquipmentTag, UserStats } from '@/store/useSommaStore';
import type { BiologicalProfile } from '@/types/biological';
import type { PerformanceLogEntry } from '@/types/performance';
import type { IronSetLog, PerformanceQueueItem } from '@/types/performance';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface SyncPerformanceResult {
  insertedCount: number;
  gameplan: DailyGameplan | null;
  source: GameplanSource | null;
  cns_fatigue_score: number | null;
}

function toNullableUuid(value: string | null | undefined): string | null {
  if (!value || !UUID_RE.test(value)) return null;
  return value;
}

function mapIronSetQueueItemToRow(userId: string, item: PerformanceQueueItem) {
  const set = item.iron_set;
  const input = item.input;
  if (!set) return null;

  return {
    user_id: userId,
    pillar: 'iron' as const,
    exercise_id: toNullableUuid(input.exercise_id),
    block_id: input.block_id,
    weight_used: set.weight_kg,
    reps_completed: set.reps,
    rpe_score: null,
    actual_rest_seconds: set.rest_seconds_used,
    volume: set.weight_kg > 0 ? set.weight_kg * set.reps : set.reps,
    payload: {
      sync_kind: 'iron_set',
      target_rir: input.target_rir ?? null,
      iron: {
        exercise_id: input.exercise_id,
        sets: [set],
      },
    },
    timestamp: set.logged_at,
  };
}

function mapQueueItemToRow(userId: string, item: PerformanceQueueItem) {
  if (item.kind === 'iron_set') {
    return mapIronSetQueueItemToRow(userId, item);
  }

  const session = item.session;
  const input = item.input;

  let exercise_id: string | null = input.exercise_id ?? null;
  let weight_used: number | null = input.weight_used ?? null;
  let reps_completed: number | null = input.reps_completed ?? null;
  let rpe_score: number | null = input.rpe_score ?? null;
  let actual_rest_seconds: number | null = input.actual_rest_seconds ?? null;
  let volume: number | null = input.volume ?? null;

  if (session?.iron) {
    exercise_id = session.iron.exercise_id;
    const lastSet = session.iron.sets[session.iron.sets.length - 1];
    if (lastSet) {
      weight_used = lastSet.weight_kg;
      reps_completed = lastSet.reps;
      actual_rest_seconds = lastSet.rest_seconds_used;
    }
    volume = session.iron.sets.reduce(
      (sum, set) => sum + (set.weight_kg > 0 ? set.weight_kg * set.reps : set.reps),
      0,
    );
  }

  if (session?.combat) {
    rpe_score = session.combat.rpe_score ?? rpe_score;
    volume = session.combat.rounds.reduce((sum, round) => sum + round.work_seconds, 0);
  }

  if (session?.spirit) {
    volume = session.spirit.total_seconds;
    rpe_score = rpe_score ?? 6;
  }

  return {
    user_id: userId,
    pillar: input.pillar,
    exercise_id: toNullableUuid(exercise_id),
    block_id: input.block_id,
    weight_used,
    reps_completed,
    rpe_score,
    actual_rest_seconds,
    volume,
    payload: session ?? { input, sync_kind: 'block_complete' },
    timestamp: item.created_at,
  };
}

/** Insert performance rows — one row per queue item (set-level or block completion). */
export async function insertPerformanceQueueRows(
  queue: PerformanceQueueItem[],
): Promise<{ insertedCount: number; userId: string | null }> {
  if (!isSupabaseConfigured || queue.length === 0) {
    return { insertedCount: 0, userId: null };
  }

  const supabase = getSupabase();
  if (!supabase) return { insertedCount: 0, userId: null };

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session?.user?.id) {
    console.warn('[SOMMA] Performance sync skipped — no session');
    return { insertedCount: 0, userId: null };
  }

  const userId = session.user.id;
  const rows = queue
    .map((item) => mapQueueItemToRow(userId, item))
    .filter((row): row is NonNullable<typeof row> => row != null);

  if (rows.length === 0) return { insertedCount: 0, userId };

  const { error: insertError } = await supabase.from('performance_logs').insert(rows);

  if (insertError) {
    console.warn('[SOMMA] performance_logs insert failed:', insertError.message);
    return { insertedCount: 0, userId };
  }

  return { insertedCount: rows.length, userId };
}

/** Fire-and-forget single set sync — powers the E1RM engine between block completions. */
export async function syncIronSetRow(item: PerformanceQueueItem): Promise<boolean> {
  const { insertedCount } = await insertPerformanceQueueRows([item]);
  return insertedCount > 0;
}

/** Insert queued performance rows, then refresh the Head Coach microcycle via shared fetch path. */
export async function syncPerformanceQueueAndRecalibrate(
  queue: PerformanceQueueItem[],
  context: {
    focus: FocusPreference;
    equipment: EquipmentTag[];
    biological: BiologicalProfile;
    userStats: UserStats;
    performanceLogs: PerformanceLogEntry[];
    /** When false, only inserts rows (used for per-set streaming sync). */
    recalibrate?: boolean;
  },
): Promise<SyncPerformanceResult> {
  try {
    if (queue.length === 0) {
      return { insertedCount: 0, gameplan: null, source: null, cns_fatigue_score: null };
    }

    const { insertedCount, userId } = await insertPerformanceQueueRows(queue);
    if (insertedCount === 0) {
      return { insertedCount: 0, gameplan: null, source: null, cns_fatigue_score: null };
    }

    let cnsFatigueScore: number | null = null;
    if (userId) {
      const current = clampCnsFatigueProfile(context.biological.cns_fatigue_score);
      cnsFatigueScore = await applyCnsFatigueFromQueue(userId, queue, current);
    }

    if (context.recalibrate === false) {
      return { insertedCount, gameplan: null, source: null, cns_fatigue_score: cnsFatigueScore };
    }

    if (!isSupabaseConfigured || !userId) {
      return { insertedCount, gameplan: null, source: null, cns_fatigue_score: cnsFatigueScore };
    }

    const biologicalForRecalibrate =
      cnsFatigueScore != null
        ? { ...context.biological, cns_fatigue_score: cnsFatigueScore }
        : context.biological;

    try {
      const result = await fetchDailyGameplan({
        focus: context.focus,
        equipment: context.equipment,
        userId,
        forceRefresh: true,
        biological: biologicalForRecalibrate,
        userStats: context.userStats,
        performanceLogs: context.performanceLogs,
      });

      return {
        insertedCount,
        gameplan: result.gameplan,
        source: result.source,
        cns_fatigue_score: cnsFatigueScore,
      };
    } catch (error) {
      const message = isGameplanFetchError(error)
        ? error.message
        : error instanceof Error
          ? error.message
          : 'Recalibration failed';
      console.warn('[SOMMA] Head Coach recalibration failed:', message);
      return {
        insertedCount,
        gameplan: null,
        source: 'fallback',
        cns_fatigue_score: cnsFatigueScore,
      };
    }
  } catch (err) {
    console.warn(
      '[SOMMA] Performance sync error:',
      err instanceof Error ? err.message : err,
    );
    return { insertedCount: 0, gameplan: null, source: null, cns_fatigue_score: null };
  }
}

export type { IronSetLog };
