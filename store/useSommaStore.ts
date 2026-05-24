import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { isSupabaseConfigured } from '@/lib/config';
import { fetchDailyGameplan } from '@/lib/gameplan/fetchDailyGameplan';
import { isGameplanFetchError } from '@/lib/gameplan/gameplanErrors';
import {
  generateStubGameplan,
  isProtocolDateStale,
} from '@/lib/gameplan/generateStubGameplan';
import { isDegenerateMicrocycle } from '@/lib/gameplan/microcycleValidation';
import { getMicrocycleDay, getTodayDayIndex } from '@/lib/gameplan/microcycleWeek';
import { applyReadinessAutoregulationToMicrocycle } from '@/lib/gameplan/engine/clinicalLaws';
import {
  buildClinicalReviewTrigger,
  nextMesocycleWeekAfterReview,
} from '@/lib/gameplan/engine/progression';
import type { ClinicalExitInterview } from '@/types/clinical';
import { syncPerformanceQueueAndRecalibrate } from '@/lib/supabase/sync';
import { fetchLibraryCombat, fetchLibraryExercises } from '@/lib/catalog/library';
import { buildWorkoutSessionSummary } from '@/lib/workout/buildSessionSummary';
import { getSupabase } from '@/lib/supabase/client';
import type { BiologicalProfile } from '@/types/biological';
import {
  DEFAULT_TRAINING_DAYS_PER_WEEK,
  initialBiologicalProfile,
  isBiologicalProfileComplete,
} from '@/types/biological';
import type {
  DailyGameplan,
  GameplanBlock,
  GameplanBlockStatus,
  MicrocycleDay,
} from '@/types/gameplan';
import type {
  CombatSessionLog,
  IronSessionLog,
  PerformanceLogEntry,
  PerformanceQueueItem,
  SpiritSessionLog,
  LogIronSetInput,
  WorkoutCompletionInput,
  WorkoutSessionSummary,
} from '@/types/performance';

export type { WorkoutCompletionInput, PerformanceQueueItem, LogIronSetInput } from '@/types/performance';

/** Equipment tags aligned with SRS REQ-1.3 / `user_environment` schema */
export type EquipmentTag =
  | 'bodyweight'
  | 'dumbbells'
  | 'heavy_bag'
  | 'barbell'
  | 'kettlebell'
  | 'pull_up_bar'
  | 'full_gym';

export type PillarId = 'iron' | 'combat' | 'flow' | 'spirit' | 'balanced';

/** Pillar ratio distribution (percentages, sum = 100) — maps to `profiles.focus_preference` */
export interface FocusPreference {
  iron: number;
  combat: number;
  flow: number;
  spirit: number;
}

export interface UserEnvironment {
  available_equipment: EquipmentTag[];
  updated_at: string | null;
}

export interface UserStats {
  body_essence: number;
  mind_essence: number;
  spirit_essence: number;
  combat_mastery: number;
}

export interface UserFoundation {
  focus_preference: FocusPreference | null;
  foundation_completed_at: string | null;
}

function applyGameplanToState(gameplan: DailyGameplan, source: SommaState['gameplan_source']) {
  return {
    weeklyMicrocycle: gameplan.microcycle,
    protocolDate: gameplan.date,
    weekStartDate: gameplan.week_start_date ?? null,
    protocolGeneratedAt: gameplan.generated_at,
    selectedDayIndex: getTodayDayIndex(gameplan.week_start_date),
    gameplan_source: source,
  };
}

function mergeBlockStatuses(
  microcycle: MicrocycleDay[],
  previous: MicrocycleDay[] | null,
): MicrocycleDay[] {
  if (!previous) return microcycle;

  return microcycle.map((day) => {
    const previousDay = previous.find((entry) => entry.day_index === day.day_index);
    return {
      ...day,
      is_completed: previousDay?.is_completed ?? day.is_completed,
      blocks: day.blocks.map((block) => {
        const wasCompleted = previous
          .flatMap((prevDay) => prevDay.blocks)
          .find((prev) => prev.id === block.id)?.status;
        return wasCompleted === 'completed' ? { ...block, status: 'completed' as const } : block;
      }),
    };
  });
}

export { getMicrocycleDay } from '@/lib/gameplan/microcycleWeek';

/** Today's blocks for attunement / ritual progress HUD */
export function getTodayBlocksFromStore(state: {
  weeklyMicrocycle: MicrocycleDay[] | null;
  weekStartDate: string | null;
}): GameplanBlock[] {
  const todayIndex = getTodayDayIndex(state.weekStartDate);
  return getMicrocycleDay(state.weeklyMicrocycle, todayIndex)?.blocks ?? [];
}

/** True when every training block on the selected strip day is completed */
export function isSelectedDayProtocolComplete(state: {
  weeklyMicrocycle: MicrocycleDay[] | null;
  selectedDayIndex: number;
}): boolean {
  const day = getMicrocycleDay(state.weeklyMicrocycle, state.selectedDayIndex);
  if (!day || day.is_rest_day || day.blocks.length === 0) return false;
  return day.blocks.every((block) => block.status === 'completed');
}

function markDayCompletedIfReady(
  microcycle: MicrocycleDay[] | null,
  dayIndex: number,
): MicrocycleDay[] | null {
  if (!microcycle) return microcycle;

  return microcycle.map((day) => {
    if (day.day_index !== dayIndex || day.is_rest_day) return day;
    const allBlocksDone =
      day.blocks.length > 0 && day.blocks.every((block) => block.status === 'completed');
    return allBlocksDone ? { ...day, is_completed: true } : day;
  });
}

function upsertIronSetLog(
  logs: PerformanceLogEntry[],
  input: LogIronSetInput,
): PerformanceLogEntry[] {
  const logId = `iron-${input.block_id}-${input.exercise_id}`;
  const existing = logs.find((entry) => entry.id === logId);

  const ironSession: IronSessionLog = existing?.iron
    ? {
        ...existing.iron,
        sets: [...existing.iron.sets.filter((set) => set.set_index !== input.set.set_index), input.set].sort(
          (a, b) => a.set_index - b.set_index,
        ),
      }
    : {
        block_id: input.block_id,
        exercise_id: input.exercise_id,
        exercise_name: input.exercise_name,
        sets: [input.set],
        completed_at: input.set.logged_at,
      };

  const entry: PerformanceLogEntry = {
    id: logId,
    pillar: 'iron',
    block_id: input.block_id,
    iron: ironSession,
    timestamp: input.set.logged_at,
  };

  if (existing) {
    return logs.map((row) => (row.id === logId ? entry : row));
  }

  return [entry, ...logs];
}

interface SommaState {
  user_environment: UserEnvironment;
  user_stats: UserStats;
  user_foundation: UserFoundation;
  user_biological: BiologicalProfile;
  /** 7-day Head Coach microcycle (Mon–Sun) */
  weeklyMicrocycle: MicrocycleDay[] | null;
  /** Calendar date the protocol was generated for (staleness gate) */
  protocolDate: string | null;
  weekStartDate: string | null;
  protocolGeneratedAt: string | null;
  /** Active day in the strip (1 = Monday … 7 = Sunday) */
  selectedDayIndex: number;
  /** Daily readiness scan (Clinical Law II) — calendar date when last completed */
  readinessScanDate: string | null;
  subjectiveReadiness: number | null;
  setSelectedDayIndex: (dayIndex: number) => void;
  needsDailyReadinessScan: () => boolean;
  applySubjectiveReadiness: (score: number) => void;
  submitClinicalExitInterview: (interview: ClinicalExitInterview) => Promise<void>;
  getClinicalReviewTrigger: () => ReturnType<typeof buildClinicalReviewTrigger>;
  performance_logs: PerformanceLogEntry[];
  performanceQueue: PerformanceQueueItem[];
  performance_syncing: boolean;
  lastWorkoutSummary: WorkoutSessionSummary | null;
  setUserEnvironment: (patch: Partial<UserEnvironment>) => void;
  setUserStats: (patch: Partial<UserStats>) => void;
  setUserFoundation: (patch: Partial<UserFoundation>) => void;
  setUserBiological: (patch: Partial<BiologicalProfile>) => void;
  setWeeklyMicrocycle: (
    gameplan: DailyGameplan | null,
    source?: SommaState['gameplan_source'],
  ) => void;
  gameplan_loading: boolean;
  gameplan_source: 'ai' | 'fallback' | 'stub' | 'deterministic' | 'local' | null;
  /** Set when Head Coach / Edge generation fails — Home shows Neural Link Failed */
  gameplan_error: string | null;
  clearGameplanError: () => void;
  ensureDailyGameplan: () => void;
  fetchDailyGameplanAsync: (options?: { forceRefresh?: boolean }) => Promise<void>;
  regenerateDailyGameplan: () => Promise<void>;
  setBlockStatus: (blockId: string, status: GameplanBlockStatus) => void;
  completeBlock: (blockId: string) => void;
  logIronSet: (input: LogIronSetInput) => void;
  prepareWorkoutSummary: () => Promise<WorkoutSessionSummary | null>;
  appendIronSession: (log: IronSessionLog) => void;
  appendCombatSession: (log: CombatSessionLog) => void;
  appendSpiritSession: (log: SpiritSessionLog) => void;
  completeWorkout: (input: WorkoutCompletionInput) => Promise<void>;
  flushPerformanceQueue: () => Promise<void>;
  completeFoundationScan: (payload: {
    focus_preference: FocusPreference;
    available_equipment: EquipmentTag[];
    biological: BiologicalProfile;
  }) => void;
  /** Remote profile sync — foundation fields only; gameplan owned by Home fetch */
  hydrateFoundationFromRemote: (payload: {
    focus_preference: FocusPreference;
    available_equipment: EquipmentTag[];
    biological: BiologicalProfile;
  }) => void;
  /** Clears all local SOMMA state and persisted offline cache */
  resetStore: () => Promise<void>;
  /** @deprecated Use resetStore */
  resetSommaState: () => void;
}

const initialEnvironment: UserEnvironment = {
  available_equipment: [],
  updated_at: null,
};

const initialStats: UserStats = {
  body_essence: 0,
  mind_essence: 0,
  spirit_essence: 0,
  combat_mastery: 0,
};

const initialFoundation: UserFoundation = {
  focus_preference: null,
  foundation_completed_at: null,
};

function findSessionForBlock(
  logs: PerformanceLogEntry[],
  blockId: string,
): PerformanceLogEntry | null {
  return logs.find((entry) => entry.block_id === blockId) ?? null;
}

export const useSommaStore = create<SommaState>()(
  persist(
    (set, get) => ({
      user_environment: initialEnvironment,
      user_stats: initialStats,
      user_foundation: initialFoundation,
      user_biological: { ...initialBiologicalProfile },
      weeklyMicrocycle: null,
      protocolDate: null,
      weekStartDate: null,
      protocolGeneratedAt: null,
      selectedDayIndex: getTodayDayIndex(),
      readinessScanDate: null,
      subjectiveReadiness: null,
      performance_logs: [],
      performanceQueue: [],
      performance_syncing: false,
      lastWorkoutSummary: null,
      gameplan_loading: false,
      gameplan_source: null,
      gameplan_error: null,

      setUserEnvironment: (patch) =>
        set((state) => ({
          user_environment: {
            ...state.user_environment,
            ...patch,
            updated_at: patch.updated_at ?? new Date().toISOString(),
          },
        })),

      setUserStats: (patch) =>
        set((state) => ({
          user_stats: { ...state.user_stats, ...patch },
        })),

      setUserFoundation: (patch) =>
        set((state) => ({
          user_foundation: { ...state.user_foundation, ...patch },
        })),

      setUserBiological: (patch) =>
        set((state) => ({
          user_biological: { ...state.user_biological, ...patch },
        })),

      setSelectedDayIndex: (dayIndex) =>
        set({
          selectedDayIndex: Math.min(7, Math.max(1, Math.round(dayIndex))),
        }),

      needsDailyReadinessScan: () => {
        const state = get();
        const today = new Date().toISOString().slice(0, 10);
        return state.readinessScanDate !== today;
      },

      applySubjectiveReadiness: (score) => {
        const clamped = Math.min(10, Math.max(1, Math.round(score)));
        const today = new Date().toISOString().slice(0, 10);
        set((state) => {
          const microcycle = state.weeklyMicrocycle
            ? applyReadinessAutoregulationToMicrocycle(
                state.weeklyMicrocycle,
                state.selectedDayIndex,
                clamped,
              )
            : null;

          return {
            subjectiveReadiness: clamped,
            readinessScanDate: today,
            weeklyMicrocycle: microcycle,
          };
        });
      },

      getClinicalReviewTrigger: () => {
        const state = get();
        return buildClinicalReviewTrigger(
          state.user_biological.mesocycle_week,
          state.user_biological.clinical_exit_interview != null,
        );
      },

      submitClinicalExitInterview: async (interview) => {
        set((state) => ({
          user_biological: {
            ...state.user_biological,
            clinical_exit_interview: interview,
            mesocycle_week: nextMesocycleWeekAfterReview(),
          },
        }));

        try {
          await get().regenerateDailyGameplan();
        } catch (err) {
          console.warn('[SOMMA] Month 2 recalibration after Exit Interview failed:', err);
        }
      },

      clearGameplanError: () => set({ gameplan_error: null }),

      setWeeklyMicrocycle: (gameplan, source) =>
        set((state) =>
          gameplan
            ? {
                ...applyGameplanToState(gameplan, source ?? state.gameplan_source),
              }
            : {
                weeklyMicrocycle: null,
                protocolDate: null,
                weekStartDate: null,
                protocolGeneratedAt: null,
                gameplan_source: source ?? state.gameplan_source,
              },
        ),

      ensureDailyGameplan: () =>
        set((state) => {
          const focus = state.user_foundation.focus_preference;
          if (!focus) return state;

          if (!isProtocolDateStale(state.protocolDate) && state.weeklyMicrocycle) {
            return state;
          }

          if (isSupabaseConfigured) {
            return state;
          }

          const gameplan = generateStubGameplan(
            focus,
            state.user_environment.available_equipment,
            state.user_biological.training_days_per_week ?? DEFAULT_TRAINING_DAYS_PER_WEEK,
          );
          return {
            ...applyGameplanToState(gameplan, 'stub'),
            gameplan_error: null,
          };
        }),

      fetchDailyGameplanAsync: async (options) => {
        const state = get();
        const focus = state.user_foundation.focus_preference;
        if (!focus) return;

        const trainingDays =
          state.user_biological.training_days_per_week ?? DEFAULT_TRAINING_DAYS_PER_WEEK;

        set({ gameplan_loading: true, gameplan_error: null });

        try {
          const userId = (await getSupabase()?.auth.getSession())?.data.session?.user?.id ?? null;
          const result = await fetchDailyGameplan({
            focus,
            equipment: state.user_environment.available_equipment,
            userId,
            forceRefresh: options?.forceRefresh ?? false,
            biological: state.user_biological,
            userStats: state.user_stats,
            performanceLogs: state.performance_logs,
          });

          set({
            ...applyGameplanToState(result.gameplan, result.source),
            gameplan_loading: false,
            gameplan_error: null,
          });
        } catch (error) {
          if (isSupabaseConfigured) {
            const message = isGameplanFetchError(error)
              ? error.message
              : error instanceof Error
                ? error.message
                : 'Neural link failed — could not reach Head Coach';
            console.error('[SOMMA] fetchDailyGameplanAsync failed:', message, error);
            set({
              gameplan_loading: false,
              gameplan_error: message,
              weeklyMicrocycle: null,
              protocolDate: null,
              weekStartDate: null,
              protocolGeneratedAt: null,
            });
            return;
          }

          const gameplan = generateStubGameplan(
            focus,
            state.user_environment.available_equipment,
            trainingDays,
          );
          set({
            ...applyGameplanToState(gameplan, 'stub'),
            gameplan_loading: false,
            gameplan_error: null,
          });
        }
      },

      regenerateDailyGameplan: async () => {
        await get().fetchDailyGameplanAsync({ forceRefresh: true });
      },

      setBlockStatus: (blockId, status) =>
        set((state) => {
          if (!state.weeklyMicrocycle) return state;

          return {
            weeklyMicrocycle: state.weeklyMicrocycle.map((day) => ({
              ...day,
              blocks: day.blocks.map((block) =>
                block.id === blockId ? { ...block, status } : block,
              ),
            })),
          };
        }),

      completeBlock: (blockId) =>
        set((state) => {
          if (!state.weeklyMicrocycle) return state;

          const withBlockComplete = state.weeklyMicrocycle.map((day) => ({
            ...day,
            blocks: day.blocks.map((block) =>
              block.id === blockId ? { ...block, status: 'completed' as const } : block,
            ),
          }));

          return {
            weeklyMicrocycle: markDayCompletedIfReady(
              withBlockComplete,
              state.selectedDayIndex,
            ),
          };
        }),

      logIronSet: (input) => {
        const state = get();
        const queueItem: PerformanceQueueItem = {
          id: `queue-set-${input.block_id}-${input.exercise_id}-${input.set.set_index}-${Date.now()}`,
          kind: 'iron_set',
          input: {
            block_id: input.block_id,
            pillar: 'iron',
            exercise_id: input.exercise_id,
            weight_used: input.set.weight_kg,
            reps_completed: input.set.reps,
            target_rir: input.target_rir ?? null,
          },
          session: null,
          iron_set: input.set,
          created_at: input.set.logged_at,
        };

        set({
          performance_logs: upsertIronSetLog(state.performance_logs, input),
          performanceQueue: [...state.performanceQueue, queueItem],
        });

        const focus = state.user_foundation.focus_preference;
        const equipment = state.user_environment.available_equipment;

        void (async () => {
          if (!focus) return;
          try {
            await syncPerformanceQueueAndRecalibrate([queueItem], {
              focus,
              equipment,
              biological: state.user_biological,
              userStats: state.user_stats,
              performanceLogs: state.performance_logs,
              recalibrate: false,
            });
            set({
              performanceQueue: get().performanceQueue.filter((item) => item.id !== queueItem.id),
            });
          } catch (err) {
            console.warn('[SOMMA] Iron set sync deferred:', err);
          }
        })();
      },

      prepareWorkoutSummary: async () => {
        const state = get();
        try {
          const [exerciseCatalog, combatCatalog] = await Promise.all([
            fetchLibraryExercises(),
            fetchLibraryCombat(),
          ]);

          const summary = buildWorkoutSessionSummary({
            dayIndex: state.selectedDayIndex,
            weeklyMicrocycle: state.weeklyMicrocycle,
            performanceLogs: state.performance_logs,
            exerciseCatalog,
            combatCatalog,
          });

          set({ lastWorkoutSummary: summary });
          return summary;
        } catch (err) {
          console.warn('[SOMMA] prepareWorkoutSummary failed:', err);
          return null;
        }
      },

      appendIronSession: (log) =>
        set((state) => ({
          performance_logs: [
            {
              id: `iron-${log.block_id}-${Date.now()}`,
              pillar: 'iron',
              block_id: log.block_id,
              iron: log,
              timestamp: log.completed_at,
            },
            ...state.performance_logs,
          ],
        })),

      appendCombatSession: (log) =>
        set((state) => ({
          performance_logs: [
            {
              id: `combat-${log.block_id}-${Date.now()}`,
              pillar: 'combat',
              block_id: log.block_id,
              combat: log,
              timestamp: log.completed_at,
            },
            ...state.performance_logs,
          ],
        })),

      appendSpiritSession: (log) =>
        set((state) => ({
          performance_logs: [
            {
              id: `spirit-${log.block_id}-${Date.now()}`,
              pillar: 'spirit',
              block_id: log.block_id,
              spirit: log,
              timestamp: log.completed_at,
            },
            ...state.performance_logs,
          ],
        })),

      flushPerformanceQueue: async () => {
        const state = get();
        if (state.performanceQueue.length === 0) return;

        const focus = state.user_foundation.focus_preference;
        if (!focus) return;

        set({ performance_syncing: true });

        try {
          const result = await syncPerformanceQueueAndRecalibrate(state.performanceQueue, {
            focus,
            equipment: state.user_environment.available_equipment,
            biological: state.user_biological,
            userStats: state.user_stats,
            performanceLogs: state.performance_logs,
          });

          if (result.insertedCount > 0) {
            const previousMicrocycle = get().weeklyMicrocycle;
            const patch: Partial<SommaState> = { performanceQueue: [] };

            if (result.cns_fatigue_score != null) {
              patch.user_biological = {
                ...get().user_biological,
                cns_fatigue_score: result.cns_fatigue_score,
              };
            }

            if (result.gameplan) {
              const mergedMicrocycle = mergeBlockStatuses(
                result.gameplan.microcycle,
                previousMicrocycle,
              );

              Object.assign(
                patch,
                applyGameplanToState(
                  { ...result.gameplan, microcycle: mergedMicrocycle },
                  result.source ?? 'ai',
                ),
              );
            }

            set(patch);
          }
        } catch (err) {
          console.warn('[SOMMA] flushPerformanceQueue failed:', err);
        } finally {
          set({ performance_syncing: false });
        }
      },

      completeWorkout: async (input) => {
        const state = get();
        const session = findSessionForBlock(state.performance_logs, input.block_id);

        const queueItem: PerformanceQueueItem = {
          id: `queue-${input.block_id}-${Date.now()}`,
          input,
          session,
          created_at: new Date().toISOString(),
        };

        set({
          performanceQueue: [...state.performanceQueue, queueItem],
          performance_syncing: true,
        });

        const focus = state.user_foundation.focus_preference;
        const equipment = state.user_environment.available_equipment;

        try {
          if (focus) {
            const result = await syncPerformanceQueueAndRecalibrate([queueItem], {
              focus,
              equipment,
              biological: get().user_biological,
              userStats: get().user_stats,
              performanceLogs: get().performance_logs,
            });

            if (result.gameplan) {
              const previousMicrocycle = get().weeklyMicrocycle;
              const mergedMicrocycle = mergeBlockStatuses(
                result.gameplan.microcycle,
                previousMicrocycle,
              );

              const patch: Partial<SommaState> = {
                ...applyGameplanToState(
                  { ...result.gameplan, microcycle: mergedMicrocycle },
                  result.source ?? 'ai',
                ),
                performanceQueue: get().performanceQueue.filter((item) => item.id !== queueItem.id),
              };
              if (result.cns_fatigue_score != null) {
                patch.user_biological = {
                  ...get().user_biological,
                  cns_fatigue_score: result.cns_fatigue_score,
                };
              }
              set(patch);
              return;
            }

            if (result.insertedCount > 0) {
              const patch: Partial<SommaState> = {
                performanceQueue: get().performanceQueue.filter((item) => item.id !== queueItem.id),
              };
              if (result.cns_fatigue_score != null) {
                patch.user_biological = {
                  ...get().user_biological,
                  cns_fatigue_score: result.cns_fatigue_score,
                };
              }
              set(patch);
            }
          }
        } catch (err) {
          console.warn('[SOMMA] Performance sync failed:', err);
        } finally {
          set({ performance_syncing: false });
        }
      },

      completeFoundationScan: ({ focus_preference, available_equipment, biological }) => {
        const gameplan = generateStubGameplan(
          focus_preference,
          available_equipment,
          biological.training_days_per_week ?? DEFAULT_TRAINING_DAYS_PER_WEEK,
        );
        set({
          user_foundation: {
            focus_preference,
            foundation_completed_at: new Date().toISOString(),
          },
          user_biological: { ...biological },
          user_environment: {
            available_equipment,
            updated_at: new Date().toISOString(),
          },
          user_stats: {
            body_essence: focus_preference.iron,
            mind_essence: focus_preference.flow,
            spirit_essence: focus_preference.spirit,
            combat_mastery: focus_preference.combat,
          },
          ...applyGameplanToState(gameplan, 'stub'),
        });
      },

      hydrateFoundationFromRemote: ({
        focus_preference,
        available_equipment,
        biological,
      }) =>
        set((state) => ({
          user_foundation: {
            focus_preference,
            foundation_completed_at:
              state.user_foundation.foundation_completed_at ?? new Date().toISOString(),
          },
          user_biological: { ...biological },
          user_environment: {
            available_equipment,
            updated_at: new Date().toISOString(),
          },
        })),

      resetStore: async () => {
        set({
          user_environment: { ...initialEnvironment },
          user_stats: { ...initialStats },
          user_foundation: { ...initialFoundation },
          user_biological: { ...initialBiologicalProfile },
          weeklyMicrocycle: null,
          protocolDate: null,
          weekStartDate: null,
          protocolGeneratedAt: null,
          selectedDayIndex: getTodayDayIndex(),
          readinessScanDate: null,
          subjectiveReadiness: null,
          performance_logs: [],
          performanceQueue: [],
          performance_syncing: false,
          lastWorkoutSummary: null,
          gameplan_loading: false,
          gameplan_source: null,
          gameplan_error: null,
        });

        try {
          await useSommaStore.persist.clearStorage();
        } catch {
          // Storage may be unavailable on some web/private modes
        }
      },

      resetSommaState: () => {
        void useSommaStore.getState().resetStore();
      },
    }),
    {
      name: 'somma-offline-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        user_environment: state.user_environment,
        user_stats: state.user_stats,
        user_foundation: state.user_foundation,
        user_biological: state.user_biological,
        weeklyMicrocycle: state.weeklyMicrocycle,
        protocolDate: state.protocolDate,
        weekStartDate: state.weekStartDate,
        protocolGeneratedAt: state.protocolGeneratedAt,
        selectedDayIndex: state.selectedDayIndex,
        readinessScanDate: state.readinessScanDate,
        subjectiveReadiness: state.subjectiveReadiness,
        performance_logs: state.performance_logs,
        performanceQueue: state.performanceQueue,
        lastWorkoutSummary: state.lastWorkoutSummary,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        if (!state.user_biological) {
          state.user_biological = { ...initialBiologicalProfile };
        } else {
          state.user_biological = {
            ...initialBiologicalProfile,
            ...state.user_biological,
            training_days_per_week:
              state.user_biological.training_days_per_week ?? DEFAULT_TRAINING_DAYS_PER_WEEK,
          };
        }
        const legacy = state as SommaState & {
          currentGameplan?: DailyGameplan | null;
          daily_gameplan?: DailyGameplan | null;
        };

        if (!state.weeklyMicrocycle) {
          const legacyPlan = legacy.currentGameplan ?? legacy.daily_gameplan;
          if (legacyPlan?.microcycle?.length) {
            state.weeklyMicrocycle = legacyPlan.microcycle;
            state.protocolDate = legacyPlan.date;
            state.weekStartDate = legacyPlan.week_start_date ?? null;
            state.protocolGeneratedAt = legacyPlan.generated_at;
          }
        }

        if (!state.selectedDayIndex) {
          state.selectedDayIndex = getTodayDayIndex(state.weekStartDate);
        } else if (isProtocolDateStale(state.protocolDate)) {
          state.selectedDayIndex = getTodayDayIndex(state.weekStartDate);
          state.readinessScanDate = null;
          state.subjectiveReadiness = null;
        }

        const today = new Date().toISOString().slice(0, 10);
        if (state.readinessScanDate && state.readinessScanDate !== today) {
          state.readinessScanDate = null;
          state.subjectiveReadiness = null;
        }

        const expectedTraining =
          state.user_biological.training_days_per_week ?? DEFAULT_TRAINING_DAYS_PER_WEEK;
        if (
          state.weeklyMicrocycle &&
          isDegenerateMicrocycle(state.weeklyMicrocycle, expectedTraining)
        ) {
          console.warn('[SOMMA] Cleared degenerate persisted microcycle on rehydrate');
          state.weeklyMicrocycle = null;
          state.protocolDate = null;
          state.weekStartDate = null;
          state.protocolGeneratedAt = null;
          state.gameplan_source = null;
        }
      },
    },
  ),
);

/** True when onboarding questionnaire has been completed (offline gate for routing). */
export function hasCompletedFoundationScan(state: {
  user_foundation: UserFoundation;
  user_environment: UserEnvironment;
  user_biological: BiologicalProfile;
}): boolean {
  return (
    state.user_foundation.foundation_completed_at !== null &&
    state.user_foundation.focus_preference !== null &&
    state.user_environment.available_equipment.length > 0 &&
    isBiologicalProfileComplete(state.user_biological)
  );
}
