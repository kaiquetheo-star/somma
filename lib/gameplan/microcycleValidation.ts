import type { MicrocycleDay } from '@/types/gameplan';

export interface MicrocycleHealth {
  trainingDayCount: number;
  trainingDaysWithBlocks: number;
  restDayCount: number;
  allRest: boolean;
  meetsTrainingQuota: boolean;
}

/** Count active vs rest days and whether the week matches expected training frequency. */
export function assessMicrocycleHealth(
  microcycle: MicrocycleDay[] | null | undefined,
  expectedTrainingDaysPerWeek?: number,
): MicrocycleHealth | null {
  if (!microcycle?.length) return null;

  const trainingDays = microcycle.filter((day) => !day.is_rest_day);
  const trainingDayCount = trainingDays.length;
  const trainingDaysWithBlocks = trainingDays.filter((day) => day.blocks.length > 0).length;
  const restDayCount = microcycle.length - trainingDayCount;
  const allRest = trainingDayCount === 0;

  const expected =
    expectedTrainingDaysPerWeek != null
      ? Math.min(7, Math.max(1, Math.round(expectedTrainingDaysPerWeek)))
      : null;

  const meetsTrainingQuota =
    expected == null ? !allRest : trainingDayCount >= expected;

  return {
    trainingDayCount,
    trainingDaysWithBlocks,
    restDayCount,
    allRest,
    meetsTrainingQuota,
  };
}

/** Reject cached or AI payloads that silently zero out the training week. */
export function isDegenerateMicrocycle(
  microcycle: MicrocycleDay[] | null | undefined,
  expectedTrainingDaysPerWeek?: number,
): boolean {
  const health = assessMicrocycleHealth(microcycle, expectedTrainingDaysPerWeek);
  if (!health) return true;
  return health.allRest || !health.meetsTrainingQuota;
}
