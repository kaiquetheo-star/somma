// CLINICAL ENGINE: DETERMINISTIC ONLY. NO RANDOMNESS ALLOWED. IF INPUTS ARE CONSTANT, OUTPUT MUST BE CONSTANT.
import {
  dateForDayIndex,
  getDayIndexForDate,
  getWeekStartMonday,
} from '@/lib/gameplan/microcycleWeek';
import {
  deriveActiveTrainingDays,
  equipmentMatches,
  focusLabelForIronSlot,
  resolvePillarFrequencies,
  spreadPillarDayIndices,
} from '@/lib/gameplan/engine/periodization';
import {
  analyzeHealerRecovery48h,
  applyIronRoutineAutoregulation,
  buildCombatBlock,
  buildIronBlock,
  buildSpiritBlock,
  detectIronAutoregulation,
  type PillarTimeBudget,
} from '@/lib/gameplan/engine/prescription';
import {
  filterIronLogsLastDays,
  flattenPerformanceLogs,
  type EnginePerformanceRow,
} from '@/lib/gameplan/engine/performanceLogs';
import {
  computeTrainingLoadSnapshot,
  telemetrySuggestsPoorRecovery,
  yesterdayEffectiveRpe,
} from '@/lib/physics/loadTelemetry';
import {
  applyNeuroMechanicalOrderingToMicrocycle,
  ironExerciseNamesFromBlock,
  resolveBiomechanicalPrerequisiteSlugs,
} from '@/lib/gameplan/engine/clinicalLaws';
import { MESOCYCLE_DAYS, WEEKLY_VOLUME_DAYS } from '@/lib/gameplan/engine/constants';
import { clampMesocycleWeekProfile } from '@/types/biological';
import { buildClinicalReviewTrigger } from '@/lib/gameplan/engine/progression';
import {
  fetchLibraryCombat,
  fetchLibraryExercises,
  fetchLibraryFlowSpirit,
} from '@/lib/catalog/library';
import type { BiologicalProfile } from '@/types/biological';
import type { DailyGameplan, GameplanBlock, MicrocycleDay } from '@/types/gameplan';
import type { PerformanceLogEntry } from '@/types/performance';
import type { EquipmentTag, FocusPreference, UserStats } from '@/store/useSommaStore';

export interface GenerateDeterministicGameplanInput {
  focus: FocusPreference;
  equipment: EquipmentTag[];
  biological: BiologicalProfile;
  userStats: UserStats;
  performanceLogs: PerformanceLogEntry[];
  /** Optional override for today's date (tests) */
  protocolDate?: string;
  /** Metabolic Steering: true when 2+ consecutive deficit days detected */
  glycogenDepleted?: boolean;
}

function todayDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function resolveBaseRoutineIds(
  catalog: Awaited<ReturnType<typeof fetchLibraryExercises>>,
  equipment: EquipmentTag[],
): string[] {
  const eligible = catalog.filter((row) => equipmentMatches(row, equipment));
  const push = eligible.find((row) => row.movement_pattern === 'push');
  const hinge = eligible.find((row) => row.movement_pattern === 'hinge');
  const pull = eligible.find((row) => row.movement_pattern === 'pull');
  const routine: string[] = [];
  if (push) routine.push(push.id);
  if (hinge) routine.push(hinge.id);
  if (pull) routine.push(pull.id);
  if (routine.length === 0) return eligible.slice(0, 3).map((row) => row.id);
  return routine;
}

function countPillarBlocks(microcycle: MicrocycleDay[], pillar: 'iron' | 'combat' | 'spirit'): number {
  return microcycle.reduce(
    (sum, day) => sum + day.blocks.filter((block) => block.pillar === pillar).length,
    0,
  );
}

/**
 * Local Head Coach — $0 API. Builds a 7-day microcycle from catalog + passport + logs.
 */
export async function generateDeterministicGameplan(
  input: GenerateDeterministicGameplanInput,
): Promise<DailyGameplan> {
  const [exerciseCatalog, comboCatalog, flowCatalog] = await Promise.all([
    fetchLibraryExercises(),
    fetchLibraryCombat(),
    fetchLibraryFlowSpirit(),
  ]);

  const equipmentFiltered = exerciseCatalog.filter((row) => equipmentMatches(row, input.equipment));
  const catalog = equipmentFiltered.length > 0 ? equipmentFiltered : exerciseCatalog;

  if (catalog.length === 0) {
    throw new Error('INSUFFICIENT_CATALOG: library_exercises empty or no equipment match.');
  }

  const pillarFreq = resolvePillarFrequencies(input.biological);
  const mesocycleWeek = clampMesocycleWeekProfile(input.biological.mesocycle_week);
  const trainingDaysPerWeek = deriveActiveTrainingDays(pillarFreq);
  const pillarTime: PillarTimeBudget = {
    available_time_iron: input.biological.available_time_iron ?? 45,
    available_time_combat: input.biological.available_time_combat ?? 30,
    available_time_spirit: input.biological.available_time_spirit ?? 20,
  };

  const flatLogs = flattenPerformanceLogs(input.performanceLogs);
  const ironLogs3w = filterIronLogsLastDays(flatLogs, MESOCYCLE_DAYS);
  const ironLogs7d = filterIronLogsLastDays(flatLogs, WEEKLY_VOLUME_DAYS);
  const loadSnapshot = computeTrainingLoadSnapshot(input.performanceLogs, {
    goalIron: input.biological.goal_iron,
  });
  const { rpe: yesterdayMainRpe } = yesterdayEffectiveRpe(input.performanceLogs);

  const autoreg = detectIronAutoregulation(
    input.biological,
    yesterdayMainRpe,
    telemetrySuggestsPoorRecovery(loadSnapshot, input.biological.goal_iron),
  );
  const baseRoutine = applyIronRoutineAutoregulation(
    resolveBaseRoutineIds(catalog, input.equipment),
    catalog,
    input.equipment,
    autoreg,
  );

  const healer = analyzeHealerRecovery48h(flatLogs, catalog, input.userStats.spirit_essence);

  const ironDays = new Set(spreadPillarDayIndices(pillarFreq.frequency_iron));
  const combatDays = new Set(spreadPillarDayIndices(pillarFreq.frequency_combat));
  const spiritDays = new Set(spreadPillarDayIndices(pillarFreq.frequency_spirit));

  let ironSlot = 0;
  const protocolDate = input.protocolDate ?? todayDateKey();
  const week_start_date = getWeekStartMonday(protocolDate);

  const microcycle: MicrocycleDay[] = Array.from({ length: 7 }, (_, index) => {
    const day_index = index + 1;
    const wantsIron = ironDays.has(day_index);
    const wantsCombat = combatDays.has(day_index);
    const wantsSpirit = spiritDays.has(day_index);
    const active = wantsIron || wantsCombat || wantsSpirit;

    if (!active) {
      return {
        day_index,
        is_rest_day: true,
        focus_label: 'Rest & Recovery',
        date: dateForDayIndex(week_start_date, day_index),
        blocks: [],
      };
    }

    const focusLabel = wantsIron
      ? focusLabelForIronSlot(trainingDaysPerWeek || pillarFreq.frequency_iron || 4, ironSlot++)
      : 'Hybrid: Combat + Spirit';

    const blocks: GameplanBlock[] = [];
    let order = 0;

    let ironBlockForPrereqs: GameplanBlock | null = null;

    if (wantsIron) {
      ironBlockForPrereqs = buildIronBlock(
        `block-d${day_index}-iron`,
        focusLabel,
        focusLabel,
        order,
        catalog,
        input.equipment,
        baseRoutine,
        ironLogs3w,
        ironLogs7d,
        autoreg,
        input.biological.goal_iron,
        pillarTime,
        mesocycleWeek,
        input.biological.clinical_exit_interview,
        input.biological.target_archetype,
        input.glycogenDepleted ?? false,
      );
      ironBlockForPrereqs.order = order++;
      blocks.push(ironBlockForPrereqs);
    }

    if (wantsCombat) {
      const combat = buildCombatBlock(
        `block-d${day_index}-combat`,
        order++,
        comboCatalog,
        input.userStats.combat_mastery,
        yesterdayMainRpe,
        input.biological.baseline_stress_level,
        pillarTime,
      );
      if (combat) blocks.push(combat);
    }

    if (wantsSpirit) {
      const ironNames = ironBlockForPrereqs
        ? ironExerciseNamesFromBlock(ironBlockForPrereqs, catalog)
        : [];
      const prerequisiteSlugs = resolveBiomechanicalPrerequisiteSlugs(ironNames);

      blocks.push(
        buildSpiritBlock(
          `block-d${day_index}-spirit`,
          order++,
          'Sanctuary · Active Recovery',
          flowCatalog,
          input.userStats.spirit_essence,
          healer,
          yesterdayMainRpe,
          pillarTime,
          { mesocycleWeek, prerequisiteSlugs },
        ),
      );
    }

    const pillarLabels: string[] = [];
    if (wantsIron) pillarLabels.push('Iron');
    if (wantsCombat) pillarLabels.push('Combat');
    if (wantsSpirit) pillarLabels.push('Spirit');

    return {
      day_index,
      is_rest_day: false,
      focus_label: wantsIron ? `Hybrid: ${focusLabel}` : `Hybrid: ${pillarLabels.join(' + ')}`,
      date: dateForDayIndex(week_start_date, day_index),
      blocks,
    };
  });

  const ironCount = countPillarBlocks(microcycle, 'iron');
  const combatCount = countPillarBlocks(microcycle, 'combat');
  const spiritCount = countPillarBlocks(microcycle, 'spirit');

  if (
    (pillarFreq.frequency_iron > 0 && ironCount < pillarFreq.frequency_iron) ||
    (pillarFreq.frequency_combat > 0 && combatCount < pillarFreq.frequency_combat) ||
    (pillarFreq.frequency_spirit > 0 && spiritCount < pillarFreq.frequency_spirit)
  ) {
    throw new Error(
      `DEGENERATE_MICROCYCLE: Iron ${ironCount}/${pillarFreq.frequency_iron}, Combat ${combatCount}/${pillarFreq.frequency_combat}, Spirit ${spiritCount}/${pillarFreq.frequency_spirit}`,
    );
  }

  const orderedMicrocycle = applyNeuroMechanicalOrderingToMicrocycle(microcycle, catalog);

  const todayIndex = getDayIndexForDate(protocolDate, week_start_date);
  const blocks = orderedMicrocycle.find((day) => day.day_index === todayIndex)?.blocks ?? [];

  return {
    date: protocolDate,
    week_start_date,
    training_days_per_week: trainingDaysPerWeek,
    microcycle: orderedMicrocycle,
    blocks,
    generated_at: new Date().toISOString(),
    clinical_review_trigger: buildClinicalReviewTrigger(
      input.biological.mesocycle_week,
      input.biological.clinical_exit_interview != null,
    ),
  };
}
