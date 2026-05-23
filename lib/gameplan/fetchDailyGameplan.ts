import { isSupabaseConfigured } from '@/lib/config';
import { GameplanFetchError } from '@/lib/gameplan/gameplanErrors';
import { generateStubGameplan } from '@/lib/gameplan/generateStubGameplan';
import { assessMicrocycleHealth } from '@/lib/gameplan/microcycleValidation';
import { parseDailyGameplanPayload } from '@/lib/gameplan/parseGameplan';
import { getSupabase } from '@/lib/supabase/client';
import { invokeEdgeFunctionPost } from '@/lib/supabase/invokeEdgeFunction';
import type { DailyGameplan } from '@/types/gameplan';
import type { FocusPreference, EquipmentTag } from '@/store/useSommaStore';

/** Matches Edge `daily_protocols.source` and handler `source` field */
export type GameplanSource = 'ai' | 'deterministic' | 'fallback' | 'stub';

export function parseGameplanSource(value: unknown): GameplanSource | null {
  if (value === 'ai' || value === 'deterministic' || value === 'fallback' || value === 'stub') {
    return value;
  }
  return null;
}

function todayDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function logEdgePayload(
  functionName: string,
  data: unknown,
  error: Error | null,
  status?: number,
): void {
  const record =
    data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
  console.log(`[SOMMA] Edge ${functionName} response`, {
    status,
    hasError: Boolean(error),
    errorMessage: error?.message,
    payloadKeys: record ? Object.keys(record) : [],
    source: record?.source,
    training_days_per_week: record?.training_days_per_week,
    microcycleLength: Array.isArray(record?.microcycle) ? record.microcycle.length : 0,
    edgeError: record?.error,
    edgeMessage: record?.message,
  });
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

  const source = parseGameplanSource(data.source) ?? 'ai';
  return { gameplan, source };
}

const HEAD_COACH_EDGE_FUNCTION = 'generate_weekly_microcycle';
const LEGACY_EDGE_FUNCTION = 'generate_daily_protocol';

async function invokeGenerateEdgeFunction(
  focus: FocusPreference,
  equipment: EquipmentTag[],
  expectedTrainingDays?: number,
): Promise<{ gameplan: DailyGameplan; source: GameplanSource }> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new GameplanFetchError('Supabase client unavailable', { code: 'NO_CLIENT' });
  }

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session?.access_token) {
    throw new GameplanFetchError('Missing auth session for Head Coach', {
      code: 'NO_SESSION',
      cause: sessionError,
    });
  }

  const cacheBust = Date.now();
  const body = {
    focus_preference: focus,
    available_equipment: equipment,
    _t: cacheBust,
  };

  let lastError: GameplanFetchError | null = null;

  for (const functionName of [HEAD_COACH_EDGE_FUNCTION, LEGACY_EDGE_FUNCTION]) {
    const { data, error, status } = await invokeEdgeFunctionPost(
      functionName,
      body,
      session.access_token,
    );

    logEdgePayload(functionName, data, error, status);

    if (error) {
      console.error(`[SOMMA] Edge function ${functionName} transport error:`, error.message);
      lastError = new GameplanFetchError(error.message, {
        code: status === 401 ? 'EDGE_UNAUTHORIZED' : 'EDGE_TRANSPORT_ERROR',
        status,
        cause: error,
      });
      continue;
    }

    const record =
      data && typeof data === 'object' ? (data as Record<string, unknown>) : null;

    if (record?.error) {
      const code = String(record.error);
      const message =
        typeof record.message === 'string'
          ? record.message
          : `Head Coach returned ${code}`;
      console.error(`[SOMMA] Edge function ${functionName} application error:`, {
        code,
        message,
        catalog_counts: record.catalog_counts,
      });
      lastError = new GameplanFetchError(message, {
        code,
        catalogCounts:
          record.catalog_counts && typeof record.catalog_counts === 'object'
            ? (record.catalog_counts as Record<string, unknown>)
            : undefined,
      });
      continue;
    }

    const gameplan = parseDailyGameplanPayload({
      ...record,
      training_days_per_week:
        expectedTrainingDays ??
        (typeof record?.training_days_per_week === 'number'
          ? record.training_days_per_week
          : undefined),
    });

    if (gameplan) {
      const health = assessMicrocycleHealth(gameplan.microcycle, expectedTrainingDays);
      const source = parseGameplanSource(record?.source) ?? 'deterministic';
      console.log(`[SOMMA] Edge function ${functionName} accepted microcycle`, { health, source });
      return { gameplan, source };
    }

    console.error(`[SOMMA] Edge function ${functionName} returned unparseable or degenerate payload`);
    lastError = new GameplanFetchError(
      'Head Coach returned an invalid or all-rest microcycle',
      { code: 'DEGENERATE_MICROCYCLE' },
    );
  }

  throw (
    lastError ??
    new GameplanFetchError('Head Coach generation failed for all endpoints', {
      code: 'EDGE_ALL_FAILED',
    })
  );
}

export interface FetchDailyGameplanInput {
  focus: FocusPreference;
  equipment: EquipmentTag[];
  userId?: string | null;
  forceRefresh?: boolean;
  /** From Biological Passport — used to reject all-rest weeks */
  trainingDaysPerWeek?: number;
}

export interface FetchDailyGameplanResult {
  gameplan: DailyGameplan;
  source: GameplanSource;
  fromCache: boolean;
}

/**
 * AI Edge Function → Postgres cache → local stub (offline only).
 * Throws GameplanFetchError when Supabase is configured but generation fails.
 */
export async function fetchDailyGameplan({
  focus,
  equipment,
  userId,
  forceRefresh = false,
  trainingDaysPerWeek,
}: FetchDailyGameplanInput): Promise<FetchDailyGameplanResult> {
  if (isSupabaseConfigured && userId) {
    if (!forceRefresh) {
      const cached = await fetchProtocolFromTable(userId, trainingDaysPerWeek);
      if (cached) {
        return { gameplan: cached.gameplan, source: cached.source, fromCache: true };
      }
    }

    const generated = await invokeGenerateEdgeFunction(
      focus,
      equipment,
      trainingDaysPerWeek,
    );
    return { gameplan: generated.gameplan, source: generated.source, fromCache: false };
  }

  console.log('[SOMMA] fetchDailyGameplan: offline stub path (Supabase not configured)');
  return {
    gameplan: generateStubGameplan(focus, equipment, trainingDaysPerWeek),
    source: 'stub',
    fromCache: false,
  };
}
