import { useRouter, type Href } from 'expo-router';

import { WORKOUT_ROUTES } from '@/constants/workout';
import type { GameplanBlock } from '@/types/gameplan';
import {
  isSelectedDayProtocolComplete,
  useSommaStore,
} from '@/store/useSommaStore';
import type { WorkoutCompletionInput, WorkoutPillarLog } from '@/types/performance';

export interface FinishBlockMeta {
  pillar: WorkoutPillarLog;
  rpe_score?: number | null;
  volume?: number | null;
  exercise_id?: string | null;
  weight_used?: number | null;
  reps_completed?: number | null;
  actual_rest_seconds?: number | null;
}

function buildAscensionParams(blockId: string, meta: FinishBlockMeta): Record<string, string> {
  const params: Record<string, string> = {
    blockId,
    pillar: meta.pillar,
  };

  if (meta.rpe_score != null) params.rpe = String(meta.rpe_score);
  if (meta.volume != null) params.volume = String(meta.volume);
  if (meta.exercise_id) params.exerciseId = meta.exercise_id;
  if (meta.weight_used != null) params.weightUsed = String(meta.weight_used);
  if (meta.reps_completed != null) params.repsCompleted = String(meta.reps_completed);
  if (meta.actual_rest_seconds != null) params.restSeconds = String(meta.actual_rest_seconds);

  return params;
}

export function useWorkoutNavigation() {
  const router = useRouter();
  const setBlockStatus = useSommaStore((state) => state.setBlockStatus);
  const completeBlock = useSommaStore((state) => state.completeBlock);

  const openBlock = (block: GameplanBlock) => {
    if (block.status === 'completed') return;

    setBlockStatus(block.id, 'active');

    const needsScan = useSommaStore.getState().needsDailyReadinessScan();
    if (needsScan) {
      router.push({
        pathname: '/(workout)/daily_scan',
        params: {
          blockId: block.id,
          title: block.title,
          pillar: block.pillar,
        },
      } as unknown as Href);
      return;
    }

    const route = WORKOUT_ROUTES[block.pillar];
    if (!route) {
      console.warn('[SOMMA] No workout route for pillar:', block.pillar);
      return;
    }
    router.push({
      pathname: route,
      params: {
        blockId: block.id,
        title: block.title ?? '',
      },
    } as Href);
  };

  const finishBlock = (blockId: string, meta: FinishBlockMeta) => {
    completeBlock(blockId);

    const params = buildAscensionParams(blockId, meta);
    const state = useSommaStore.getState();
    const dayProtocolComplete = isSelectedDayProtocolComplete(state);

    if (dayProtocolComplete) {
      router.push({
        pathname: '/(workout)/summary',
        params,
      } as unknown as Href);
      return;
    }

    router.push({
      pathname: '/(workout)/ascension',
      params,
    } as Href);
  };

  return { openBlock, finishBlock };
}

/** Build completion payload for Ascension / Summary from route params */
export function completionFromParams(params: {
  blockId?: string;
  pillar?: string;
  rpe?: string;
  volume?: string;
  exerciseId?: string;
  weightUsed?: string;
  repsCompleted?: string;
  restSeconds?: string;
}): WorkoutCompletionInput | null {
  if (!params.blockId || !params.pillar) return null;

  const pillar = params.pillar as WorkoutPillarLog;
  if (!['iron', 'combat', 'flow', 'spirit'].includes(pillar)) return null;

  return {
    block_id: params.blockId,
    pillar,
    rpe_score: params.rpe ? Number(params.rpe) : null,
    volume: params.volume ? Number(params.volume) : null,
    exercise_id: params.exerciseId ?? null,
    weight_used: params.weightUsed ? Number(params.weightUsed) : null,
    reps_completed: params.repsCompleted ? Number(params.repsCompleted) : null,
    actual_rest_seconds: params.restSeconds ? Number(params.restSeconds) : null,
  };
}
