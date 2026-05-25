// CLINICAL ENGINE: DETERMINISTIC ONLY. NO RANDOMNESS ALLOWED. IF INPUTS ARE CONSTANT, OUTPUT MUST BE CONSTANT.
import {
  estimateBestE1RMFromLogs,
  targetWeightFromE1RM,
  type PerformanceLogSample,
} from '@/lib/physics/rmCalculator';
import {
  HEALER_WINDOW_HOURS,
  HIGH_CNS_SWAP_THRESHOLD,
  HYPERTROPHY_MEV_SETS,
  HYPERTROPHY_MRV_HARD,
  HYPERTROPHY_MRV_SOFT,
  LOW_CNS_SWAP_MAX,
  SPIRIT_TEMPO_CATALOG,
} from '@/lib/gameplan/engine/constants';
import {
  applyDeloadToIronExercise,
  beautifyCatalogName,
  capIronExercisesForDeload,
  CNS_FATIGUE_AUTOREG_THRESHOLD,
  findFlowBySlug,
  isDeloadMesocycleWeek,
  resolveBiomechanicalPrerequisiteSlugs,
  scaleSpiritMinutesForDeload,
  sortCombatPrescription,
  sortIronExercises,
  sortSpiritAsanas,
} from '@/lib/gameplan/engine/clinicalLaws';
import {
  applyHypertrophyVolumeGuardrail,
  archetypeExerciseCountDelta,
  archetypeRirDelta,
  archetypeVolumeCapAdjustment,
  buildWeeklyVolumeMap,
  equipmentMatches,
  injectPrerequisiteIronExercises,
  selectExercisesForSplit,
  targetCombatRoundCount,
  targetIronExerciseCount,
} from '@/lib/gameplan/engine/periodization';
import { adjustTargetWeightForMonth2 } from '@/lib/gameplan/engine/progression';
import type { ClinicalExitInterview } from '@/types/clinical';
import type { TargetArchetype } from '@/types/biological';
import { glycogenMrvClampFactor } from '@/lib/physics/nutritionMath';
import type { EnginePerformanceRow } from '@/lib/gameplan/engine/performanceLogs';
import type { LibraryCombatCombo, LibraryExercise, LibraryFlowSpiritSession } from '@/types/catalog';
import type {
  CombatBlockPrescription,
  CombatRoundPrescription,
  CombatRoundStructureEntry,
  CombatTacticalFocus,
  FlowAsanaPrescription,
  GameplanBlock,
  IronExercisePrescription,
  IronExecutionTechnique,
} from '@/types/gameplan';
import type { BiologicalProfile } from '@/types/biological';
import type { EquipmentTag } from '@/store/useSommaStore';

export interface PillarTimeBudget {
  available_time_iron: number;
  available_time_combat: number;
  available_time_spirit: number;
}

export interface IronAutoregulationState {
  high_stress_mode: boolean;
  poor_recovery: boolean;
  blocked_joint_profiles: string[];
  swaps_applied: { from_exercise_id: string; to_exercise_id: string; reason: string }[];
}

export interface MesocycleExerciseSummary {
  exercise_id: string;
  progression_recommendation: 'maintain' | 'load' | 'volume' | 'deload';
  notes: string;
}

export interface WeeklyMuscleVolumeRow {
  primary_muscle: string;
  working_sets_7d: number;
  status: 'below_mev' | 'optimal' | 'approaching_mrv' | 'at_mrv';
}

export interface HealerRecoveryState {
  required_recovery_zones: string[];
  prescribed_reason: string;
  max_complexity_tier: number;
}

function parseBlockedJointProfiles(injuries: string | null): string[] {
  if (!injuries?.trim()) return [];
  const text = injuries.toLowerCase();
  const blocked: string[] = [];
  if (/knee|patella|acl|meniscus/.test(text)) blocked.push('high_knee_shear', 'moderate_knee_stress');
  if (/shoulder|rotator|impingement|labrum/.test(text)) blocked.push('rotator_cuff_heavy', 'shoulder_impingement_risk');
  if (/lumbar|lower back|disc|spine|back/.test(text)) blocked.push('lumbar_shear', 'spinal_axial_load');
  if (/wrist|elbow/.test(text)) blocked.push('wrist_stress');
  if (/neck|cervical/.test(text)) blocked.push('cervical_load');
  return [...new Set(blocked)];
}

export function detectIronAutoregulation(
  biological: BiologicalProfile,
  yesterdayMainRpe: number | null,
  loadTelemetryOverload = false,
): IronAutoregulationState {
  const stress = biological.baseline_stress_level;
  const cnsFatigue = biological.cns_fatigue_score ?? 0;
  const highCnsFatigue = cnsFatigue >= CNS_FATIGUE_AUTOREG_THRESHOLD;
  const highStress = stress != null && stress > 7;
  const poorRecovery =
    highCnsFatigue ||
    highStress ||
    loadTelemetryOverload ||
    (yesterdayMainRpe != null && yesterdayMainRpe >= 8) ||
    (stress != null && stress >= 7 && yesterdayMainRpe != null && yesterdayMainRpe >= 7);

  return {
    high_stress_mode: highStress,
    poor_recovery: poorRecovery,
    blocked_joint_profiles: parseBlockedJointProfiles(biological.current_injuries),
    swaps_applied: [],
  };
}

function isExerciseBlocked(exercise: LibraryExercise, blocked: string[]): boolean {
  if (!exercise.joint_stress_profile) return false;
  return blocked.includes(exercise.joint_stress_profile);
}

function computeRestSecondsFromCns(cns: number | null): number {
  const cost = cns ?? 3;
  if (cost >= 5) return 180;
  if (cost >= 4) return 150;
  if (cost >= 3) return 105;
  if (cost >= 2) return 75;
  return 60;
}

function toPerformanceSamples(logs: EnginePerformanceRow[]): PerformanceLogSample[] {
  return logs.map((log) => ({
    exercise_id: log.exercise_id,
    weight_used: log.weight_used,
    reps_completed: log.reps_completed,
    timestamp: log.timestamp,
    payload: log.payload as PerformanceLogSample['payload'],
  }));
}

function buildMesocycleSummaries(
  routineIds: string[],
  catalog: LibraryExercise[],
  ironLogs3w: EnginePerformanceRow[],
): MesocycleExerciseSummary[] {
  return routineIds.map((exerciseId) => {
    const meta = catalog.find((row) => row.id === exerciseId);
    const logs = ironLogs3w.filter((log) => log.exercise_id === exerciseId);
    const last = logs[0];
    let progression: MesocycleExerciseSummary['progression_recommendation'] = 'maintain';
    let notes = 'No iron logs in 21-day mesocycle — establish baseline @ 2 RIR';

    if (last) {
      const hitReps =
        last.reps_completed != null && meta != null && last.reps_completed >= meta.default_reps - 1;
      if (last.rpe_score != null && last.rpe_score >= 9) {
        progression = 'deload';
        notes = `Last RPE ${last.rpe_score} — deload load ~5% or add 1 RIR`;
      } else if (last.rpe_score != null && last.rpe_score <= 8 && hitReps) {
        progression = 'load';
        notes = `Hit reps at RPE ${last.rpe_score} — progress load ~2.5%`;
      } else if (last.rpe_score != null && last.rpe_score <= 8) {
        progression = 'volume';
        notes = `RPE ${last.rpe_score} but rep target missed — add reps before load`;
      }
    }

    return { exercise_id: exerciseId, progression_recommendation: progression, notes };
  });
}

function buildWeeklyVolumeByMuscle(
  catalog: LibraryExercise[],
  ironLogs7d: EnginePerformanceRow[],
): WeeklyMuscleVolumeRow[] {
  const totals = new Map<string, number>();
  for (const log of ironLogs7d) {
    const exerciseId = log.payload?.iron?.exercise_id ?? log.exercise_id;
    if (!exerciseId) continue;
    const meta = catalog.find((row) => row.id === exerciseId);
    const muscle = meta?.primary_muscle;
    if (!muscle) continue;
    const setCount = log.payload?.iron?.sets?.length ?? 1;
    totals.set(muscle, (totals.get(muscle) ?? 0) + Math.max(1, setCount));
  }

  const muscles = new Set(catalog.map((row) => row.primary_muscle).filter(Boolean) as string[]);
  for (const muscle of totals.keys()) muscles.add(muscle);

  return [...muscles].map((primary_muscle) => {
    const working_sets_7d = totals.get(primary_muscle) ?? 0;
    let status: WeeklyMuscleVolumeRow['status'] = 'optimal';
    if (working_sets_7d >= HYPERTROPHY_MRV_HARD) status = 'at_mrv';
    else if (working_sets_7d >= HYPERTROPHY_MRV_SOFT) status = 'approaching_mrv';
    else if (working_sets_7d < HYPERTROPHY_MEV_SETS) status = 'below_mev';
    return { primary_muscle, working_sets_7d, status };
  });
}

function applyWeeklyVolumeSetCap(
  sets: number,
  primaryMuscle: string | null,
  weeklyVolumeMap: Map<string, number>,
): { sets: number; volumeNote: string } {
  return applyHypertrophyVolumeGuardrail(sets, primaryMuscle, weeklyVolumeMap, sets);
}

function findAlternativeExerciseId(
  exerciseId: string,
  catalog: LibraryExercise[],
  blocked: string[],
  equipment: EquipmentTag[],
): string | null {
  const current = catalog.find((row) => row.id === exerciseId);
  if (!current?.primary_muscle) return null;
  const alt = catalog.find(
    (row) =>
      row.id !== exerciseId &&
      row.primary_muscle === current.primary_muscle &&
      (row.cns_fatigue_cost ?? 5) <= (current.cns_fatigue_cost ?? 5) &&
      !isExerciseBlocked(row, blocked) &&
      equipmentMatches(row, equipment),
  );
  return alt?.id ?? null;
}

function prescribeIronExercise(
  exerciseId: string,
  catalog: LibraryExercise[],
  mesocycle: MesocycleExerciseSummary | undefined,
  autoreg: IronAutoregulationState,
  ironLogs3w: EnginePerformanceRow[],
  weeklyVolumeMap: Map<string, number>,
  equipment: EquipmentTag[],
  goalIron: string | null,
  clinicalReview: ClinicalExitInterview | null = null,
  targetArchetype: TargetArchetype | null = null,
): IronExercisePrescription {
  const meta = catalog.find((row) => row.id === exerciseId);
  const last = ironLogs3w.find((log) => log.exercise_id === exerciseId);
  const progression = mesocycle?.progression_recommendation ?? 'maintain';
  const samples = toPerformanceSamples(ironLogs3w);

  const rirDelta = archetypeRirDelta(targetArchetype);
  let targetRir = autoreg.poor_recovery ? 3 : Math.max(1, 2 + rirDelta);
  if (progression === 'deload') targetRir = 4;
  let targetReps = meta?.default_reps ?? 10;
  let targetWeight: number | null = null;
  let note = mesocycle?.notes ?? 'Baseline prescription';

  const e1rm = estimateBestE1RMFromLogs(samples, exerciseId);
  if (e1rm != null) {
    targetWeight = targetWeightFromE1RM(e1rm, goalIron, targetReps, targetRir);
    note = `E1RM ${e1rm} kg (Epley, 21d)`;
  } else if (last?.weight_used != null && last.weight_used > 0) {
    targetWeight = Math.round(last.weight_used * 10) / 10;
    note = `Last logged ${targetWeight} kg — calibrate @ ${targetRir} RIR`;
  } else {
    targetWeight = null;
    note = 'Calibrate first set @ prescribed RIR';
  }

  if (last?.weight_used != null && last.rpe_score != null) {
    if (progression === 'deload' || last.rpe_score >= 9) {
      targetWeight = Math.round(last.weight_used * 0.95 * 10) / 10;
      targetRir = 4;
    } else if (progression === 'load' && last.rpe_score <= 8) {
      targetWeight = Math.round(last.weight_used * 1.025 * 10) / 10;
      targetReps = Math.min(15, (last.reps_completed ?? targetReps) + 1);
    } else if (progression === 'volume') {
      targetReps = Math.min(15, targetReps + 1);
    }
  }

  const hi = meta?.default_reps ?? 10;
  const lo = Math.max(6, hi - 2);
  let sets = meta?.default_sets ?? 4;
  const archetypeBonus = archetypeVolumeCapAdjustment(targetArchetype, meta?.primary_muscle ?? null);
  if (archetypeBonus > 0) {
    sets = Math.min(sets + 1, 6);
  }
  if (autoreg.poor_recovery && (meta?.cns_fatigue_cost ?? 0) >= HIGH_CNS_SWAP_THRESHOLD) {
    sets = Math.max(2, sets - 1);
  }
  const boostedVolumeMap = new Map(weeklyVolumeMap);
  if (archetypeBonus > 0 && meta?.primary_muscle) {
    const current = boostedVolumeMap.get(meta.primary_muscle) ?? 0;
    boostedVolumeMap.set(meta.primary_muscle, Math.max(0, current - archetypeBonus));
  }
  const volumeCap = applyWeeklyVolumeSetCap(sets, meta?.primary_muscle ?? null, boostedVolumeMap);
  sets = volumeCap.sets;

  if (clinicalReview && targetWeight != null) {
    targetWeight = adjustTargetWeightForMonth2(targetWeight, clinicalReview, targetReps, targetRir);
    note = [note, 'Month 2 — calibrated from Exit Interview'].filter(Boolean).join(' · ');
  }

  let technique: IronExecutionTechnique = 'Standard';
  const cns = meta?.cns_fatigue_cost ?? 3;
  if (autoreg.poor_recovery || progression === 'deload') {
    technique = meta?.stretch_mediated_hypertrophy ? 'Slow Eccentric (4s)' : 'Standard';
  } else if (progression === 'load' && cns <= 2 && !autoreg.high_stress_mode) {
    technique = 'Myo-Reps';
  }

  return {
    exercise_id: exerciseId,
    target_sets: sets,
    target_reps: targetReps,
    target_rep_range: `${lo}-${hi} @ ${targetRir} RIR`,
    target_rir: targetRir,
    target_weight_kg: targetWeight,
    rest_seconds: computeRestSecondsFromCns(meta?.cns_fatigue_cost ?? null),
    alternative_exercise_id: findAlternativeExerciseId(exerciseId, catalog, autoreg.blocked_joint_profiles, equipment),
    progression_note: [note, volumeCap.volumeNote].filter(Boolean).join(' · '),
    execution_technique: technique,
  };
}

export function buildIronBlock(
  blockId: string,
  title: string,
  focusLabel: string,
  order: number,
  catalog: LibraryExercise[],
  equipment: EquipmentTag[],
  exerciseIds: string[],
  ironLogs3w: EnginePerformanceRow[],
  ironLogs7d: EnginePerformanceRow[],
  autoreg: IronAutoregulationState,
  goalIron: string | null,
  pillarTime: PillarTimeBudget,
  mesocycleWeek = 1,
  clinicalReview: ClinicalExitInterview | null = null,
  targetArchetype: TargetArchetype | null = null,
  glycogenDepleted = false,
): GameplanBlock {
  const isDeload = isDeloadMesocycleWeek(mesocycleWeek);
  let targetCount = targetIronExerciseCount(pillarTime.available_time_iron, goalIron) + archetypeExerciseCountDelta(targetArchetype);
  targetCount = Math.max(2, targetCount);
  if (isDeload) targetCount = Math.min(targetCount, 4);
  const mrvClamp = glycogenMrvClampFactor(glycogenDepleted);

  let routineIds = selectExercisesForSplit(
    focusLabel,
    catalog,
    equipment,
    targetCount,
    autoreg.blocked_joint_profiles,
  );
  if (routineIds.length === 0) {
    routineIds = exerciseIds.slice(0, targetCount);
  }

  const provisionalNames = routineIds
    .map((id) => catalog.find((row) => row.id === id)?.name)
    .filter((name): name is string => Boolean(name));
  const prerequisiteSlugs = resolveBiomechanicalPrerequisiteSlugs(provisionalNames);
  routineIds = injectPrerequisiteIronExercises(
    routineIds,
    catalog,
    prerequisiteSlugs,
    equipment,
    autoreg.blocked_joint_profiles,
  );

  routineIds = capIronExercisesForDeload(routineIds, isDeload);

  const mesocycle = buildMesocycleSummaries(routineIds, catalog, ironLogs3w);
  const mesoById = new Map(mesocycle.map((row) => [row.exercise_id, row]));
  const weeklyVolumeMap = buildWeeklyVolumeMap(ironLogs7d, catalog);

  let exercises = routineIds.map((id) =>
    prescribeIronExercise(
      id,
      catalog,
      mesoById.get(id),
      autoreg,
      ironLogs3w,
      weeklyVolumeMap,
      equipment,
      goalIron,
      clinicalReview,
      targetArchetype,
    ),
  );
  if (isDeload) {
    exercises = exercises.map((row) => applyDeloadToIronExercise(row));
  }

  if (mrvClamp < 1) {
    exercises = exercises.map((row) => ({
      ...row,
      target_sets: Math.max(2, Math.round(row.target_sets * mrvClamp)),
    }));
  }

  exercises = sortIronExercises(exercises, catalog, prerequisiteSlugs);

  const names = exercises
    .map((row) => row.display_name)
    .filter(Boolean)
    .join(' · ');

  return {
    id: blockId,
    pillar: 'iron',
    title,
    subtitle: names || focusLabel,
    duration_minutes: pillarTime.available_time_iron,
    order,
    status: 'pending',
    iron: { routine_id: `iron_${blockId}`, exercises },
  };
}

function maxComboComplexityForMastery(mastery: number): number {
  if (mastery >= 20) return 10;
  if (mastery >= 12) return 8;
  if (mastery >= 6) return 5;
  return 3;
}

function buildTacticalRoundPlan(highFatigue: boolean): CombatRoundStructureEntry[] {
  if (highFatigue) {
    return [
      { round_start: 1, round_end: 1, tactical_focus: 'footwork_range', coach_intent: 'Light feet — rhythm and exits.' },
      { round_start: 2, round_end: 2, tactical_focus: 'defense_counter', coach_intent: 'Shell and counter only on clean reads.' },
      { round_start: 3, round_end: 3, tactical_focus: 'burnout', coach_intent: 'Controlled burnout finisher.' },
    ];
  }
  return [
    {
      round_start: 1,
      round_end: 1,
      tactical_focus: 'footwork_range',
      coach_intent: 'Technical primer — shadow, teeps, angles, probe jab.',
    },
    {
      round_start: 2,
      round_end: 2,
      tactical_focus: 'defense_counter',
      coach_intent: 'Shell, parry, counter — stay technical before power.',
    },
    {
      round_start: 3,
      round_end: 3,
      tactical_focus: 'power_inside',
      coach_intent: 'Heavy bag power — body shots, hooks, knees on clean entries.',
    },
    {
      round_start: 4,
      round_end: 4,
      tactical_focus: 'burnout',
      coach_intent: 'HIIT finisher — controlled burnout, hands home on exit.',
    },
  ];
}

function workRestForTacticalFocus(focus: CombatTacticalFocus): { work_seconds: number; rest_seconds: number } {
  if (focus === 'burnout') return { work_seconds: 150, rest_seconds: 45 };
  return { work_seconds: 180, rest_seconds: 60 };
}

function pickComboForRound(
  combos: LibraryCombatCombo[],
  focus: CombatTacticalFocus,
  roundIndex: number,
): LibraryCombatCombo {
  const pool = combos.filter((c) => c.tactical_focus === focus);
  const source = pool.length > 0 ? pool : combos;
  return source[(roundIndex - 1) % source.length]!;
}

export function buildCombatBlock(
  blockId: string,
  order: number,
  combos: LibraryCombatCombo[],
  combatMastery: number,
  yesterdayRpe: number | null,
  baselineStress: number | null,
  pillarTime: PillarTimeBudget,
): GameplanBlock | null {
  if (combos.length === 0) return null;

  const maxLevel = maxComboComplexityForMastery(combatMastery);
  const pool = combos.filter((c) => c.complexity_level <= maxLevel);
  const source = pool.length > 0 ? pool : combos;

  const highFatigue =
    (yesterdayRpe != null && yesterdayRpe >= 8) ||
    (baselineStress != null && baselineStress >= 7);

  let rounds_structure = buildTacticalRoundPlan(highFatigue);
  const maxRounds = targetCombatRoundCount(pillarTime.available_time_combat);
  const totalPlanned = rounds_structure.reduce(
    (sum, seg) => sum + (seg.round_end - seg.round_start + 1),
    0,
  );
  if (totalPlanned > maxRounds) {
    rounds_structure = rounds_structure.slice(0, maxRounds).map((seg, i) => ({
      ...seg,
      round_start: i + 1,
      round_end: i + 1,
    }));
  }

  const rounds: CombatRoundPrescription[] = [];
  for (const segment of rounds_structure) {
    for (let roundIndex = segment.round_start; roundIndex <= segment.round_end; roundIndex += 1) {
      const combo = pickComboForRound(source, segment.tactical_focus, roundIndex);
      const timing = workRestForTacticalFocus(segment.tactical_focus);
      rounds.push({
        round_index: roundIndex,
        combo_id: combo.id,
        tactical_focus: segment.tactical_focus,
        work_seconds: timing.work_seconds,
        rest_seconds: timing.rest_seconds,
      });
    }
  }

  const combat: CombatBlockPrescription = sortCombatPrescription({ rounds_structure, rounds });

  return {
    id: blockId,
    pillar: 'combat',
    title: 'Blood & Bone · HIIT Finisher',
    subtitle: `${rounds.length} rounds · tactical periodization`,
    duration_minutes: Math.min(pillarTime.available_time_combat, 25),
    order,
    status: 'pending',
    combat,
  };
}

function maxComplexityTierForSpiritEssence(essence: number): number {
  if (essence >= 15) return 3;
  if (essence >= 8) return 2;
  return 1;
}

export function analyzeHealerRecovery48h(
  logs: EnginePerformanceRow[],
  catalog: LibraryExercise[],
  spiritEssence: number,
): HealerRecoveryState {
  const cutoff = Date.now() - HEALER_WINDOW_HOURS * 60 * 60 * 1000;
  const logs48h = logs.filter((log) => Date.parse(log.timestamp) >= cutoff);
  const exerciseById = new Map(catalog.map((row) => [row.id, row]));
  const requiredZones = new Set<string>(['hips', 'thoracic_spine']);

  for (const log of logs48h) {
    if (log.pillar === 'iron') {
      const exId = log.payload?.iron?.exercise_id ?? log.exercise_id;
      const meta = exId ? exerciseById.get(exId) : undefined;
      const pattern = meta?.movement_pattern ?? '';
      if (['hinge', 'squat', 'lunge'].includes(pattern)) {
        requiredZones.add('lower_back');
        requiredZones.add('glutes');
        requiredZones.add('hamstrings');
      } else if (pattern === 'push' || pattern === 'pull') {
        requiredZones.add('shoulders');
      }
    }
    if (log.pillar === 'combat' && (log.rpe_score ?? 0) >= 6) {
      requiredZones.add('lower_back');
      requiredZones.add('ankles');
    }
  }

  return {
    required_recovery_zones: [...requiredZones],
    prescribed_reason: `Biomechanical restore — ${HEALER_WINDOW_HOURS}h load scan`,
    max_complexity_tier: maxComplexityTierForSpiritEssence(spiritEssence),
  };
}

export function buildSpiritBlock(
  blockId: string,
  order: number,
  title: string,
  flowCatalog: LibraryFlowSpiritSession[],
  spiritEssence: number,
  healer: HealerRecoveryState,
  yesterdayRpe: number | null,
  pillarTime: PillarTimeBudget,
  options?: {
    mesocycleWeek?: number;
    prerequisiteSlugs?: string[];
  },
): GameplanBlock {
  const isDeload = isDeloadMesocycleWeek(options?.mesocycleWeek ?? 1);
  const spiritMinutes = scaleSpiritMinutesForDeload(pillarTime.available_time_spirit, isDeload);
  const maxTier = maxComplexityTierForSpiritEssence(spiritEssence);
  const flowRows = flowCatalog.filter(
    (row) => row.pillar === 'flow' && row.complexity_tier <= maxTier,
  );

  if (flowRows.length > 0) {
    const scored = flowRows
      .map((row) => {
        const zoneHits = row.target_recovery_zones.filter((z) =>
          healer.required_recovery_zones.includes(z),
        ).length;
        return { row, score: zoneHits };
      })
      .sort((a, b) => b.score - a.score);

    const targetCount = yesterdayRpe != null && yesterdayRpe >= 8 ? 6 : 4;
    const picks: LibraryFlowSpiritSession[] = [];
    for (let i = 0; i < targetCount; i += 1) {
      picks.push(scored[i % scored.length]!.row);
    }

    const prerequisiteSlugs = options?.prerequisiteSlugs ?? [];
    const prepended: FlowAsanaPrescription[] = [];
    let asanaOrder = 0;
    for (const slug of prerequisiteSlugs) {
      const row = findFlowBySlug(flowCatalog, slug);
      if (!row || picks.some((pick) => pick.slug === slug)) continue;
      prepended.push({
        asana_id: row.id,
        slug: row.slug,
        name: beautifyCatalogName(row.session_name),
        order: asanaOrder++,
        hold_seconds: row.default_hold_seconds || 45,
        target_recovery_zones: row.target_recovery_zones,
        is_dynamic_flow: row.is_dynamic_flow,
      });
    }

    const flowAsanas: FlowAsanaPrescription[] = picks.map((row) => ({
      asana_id: row.id,
      slug: row.slug,
      name: beautifyCatalogName(row.session_name),
      order: 0,
      hold_seconds: row.default_hold_seconds || 45,
      target_recovery_zones: row.target_recovery_zones,
      is_dynamic_flow: row.is_dynamic_flow,
    }));

    const merged = [...prepended, ...flowAsanas].filter(
      (row, index, list) => list.findIndex((entry) => entry.slug === row.slug) === index,
    );
    const asanas = sortSpiritAsanas(merged);

    const durationMinutes = Math.min(
      spiritMinutes,
      Math.max(10, Math.round(asanas.reduce((s, a) => s + a.hold_seconds, 0) / 60)),
    );

    return {
      id: blockId,
      pillar: 'spirit',
      title,
      subtitle: `${asanas[0]?.name ?? 'Flow'} · active recovery`,
      duration_minutes: durationMinutes,
      order,
      status: 'pending',
      spirit: {
        mode: 'flow',
        duration_minutes: durationMinutes,
        prescribed_reason: healer.prescribed_reason,
        recovery_focus_zones: healer.required_recovery_zones,
        asanas,
        sequence: asanas,
      },
    };
  }

  let tempoId = 'tempo_box';
  let duration = Math.min(spiritMinutes, 16);
  if (yesterdayRpe != null && yesterdayRpe >= 8) {
    tempoId = 'tempo_478';
    duration = Math.min(spiritMinutes, 20);
  } else if (yesterdayRpe != null && yesterdayRpe <= 4) {
    tempoId = 'tempo_relax';
    duration = Math.min(spiritMinutes, 12);
  }

  const tempo = SPIRIT_TEMPO_CATALOG.find((row) => row.id === tempoId) ?? SPIRIT_TEMPO_CATALOG[1];

  return {
    id: blockId,
    pillar: 'spirit',
    title,
    subtitle: `${tempo.name} · ${duration} min`,
    duration_minutes: duration,
    order,
    status: 'pending',
    spirit: {
      mode: 'breathwork',
      tempo_id: tempoId,
      duration_minutes: duration,
      prescribed_reason: healer.prescribed_reason,
    },
  };
}

export function applyIronRoutineAutoregulation(
  baseRoutineIds: string[],
  catalog: LibraryExercise[],
  equipment: EquipmentTag[],
  autoreg: IronAutoregulationState,
): string[] {
  return baseRoutineIds.map((exerciseId) => {
    let resolvedId = exerciseId;
    const meta = catalog.find((row) => row.id === exerciseId);
    if (meta && isExerciseBlocked(meta, autoreg.blocked_joint_profiles)) {
      const replacement = catalog.find(
        (row) =>
          row.primary_muscle === meta.primary_muscle &&
          row.id !== exerciseId &&
          !isExerciseBlocked(row, autoreg.blocked_joint_profiles) &&
          equipmentMatches(row, equipment),
      );
      if (replacement) resolvedId = replacement.id;
    }
    if (autoreg.high_stress_mode || autoreg.poor_recovery) {
      const current = catalog.find((row) => row.id === resolvedId);
      const cns = current?.cns_fatigue_cost ?? 3;
      if (cns >= HIGH_CNS_SWAP_THRESHOLD && current?.primary_muscle) {
        const swap = catalog.find(
          (row) =>
            row.primary_muscle === current.primary_muscle &&
            row.id !== resolvedId &&
            (row.cns_fatigue_cost ?? 5) <= LOW_CNS_SWAP_MAX &&
            equipmentMatches(row, equipment),
        );
        if (swap) resolvedId = swap.id;
      }
    }
    return resolvedId;
  });
}
