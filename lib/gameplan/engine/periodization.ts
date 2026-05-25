// CLINICAL ENGINE: DETERMINISTIC ONLY. NO RANDOMNESS ALLOWED. IF INPUTS ARE CONSTANT, OUTPUT MUST BE CONSTANT.
import { spreadTrainingDayIndices } from '@/lib/gameplan/microcycleWeek';
import type { EnginePerformanceRow } from '@/lib/gameplan/engine/performanceLogs';
import {
  clampPillarFrequency,
  clampTrainingDaysPerWeek,
  deriveTrainingDaysFromFrequencies,
  type BiologicalProfile,
  type TargetArchetype,
} from '@/types/biological';
import type { LibraryExercise } from '@/types/catalog';
import type { EquipmentTag } from '@/store/useSommaStore';

import { MICROCYCLE_FOCUS_ROTATIONS } from '@/lib/gameplan/engine/constants';
import { selectExercisesByIronBlueprint } from '@/lib/gameplan/engine/ironBlueprints';
import {
  BIOMECH_SLUG_CHEST_OPENER,
  BIOMECH_SLUG_MALASANA,
} from '@/lib/gameplan/engine/clinicalLaws';

export interface PillarFrequency {
  frequency_iron: number;
  frequency_combat: number;
  frequency_spirit: number;
}

/** Law III — Effective Hypertrophy Zone upper bound (weekly working sets per muscle) */
export const HYPERTROPHY_WEEKLY_SERIES_MAX = 20;

export function resolvePillarFrequencies(biological: BiologicalProfile): PillarFrequency {
  const legacy = clampTrainingDaysPerWeek(biological.training_days_per_week ?? 4);
  return {
    frequency_iron: clampPillarFrequency(biological.frequency_iron, legacy),
    frequency_combat: clampPillarFrequency(biological.frequency_combat, legacy),
    frequency_spirit: clampPillarFrequency(biological.frequency_spirit, legacy),
  };
}

export function spreadPillarDayIndices(count: number): number[] {
  return spreadTrainingDayIndices(count);
}

export function focusLabelForIronSlot(trainingDaysPerWeek: number, slot: number): string {
  const rotation =
    MICROCYCLE_FOCUS_ROTATIONS[clampTrainingDaysPerWeek(trainingDaysPerWeek)] ??
    MICROCYCLE_FOCUS_ROTATIONS[4]!;
  return rotation[slot % rotation.length]!;
}

export function deriveActiveTrainingDays(pillarFreq: PillarFrequency): number {
  return deriveTrainingDaysFromFrequencies({
    frequency_iron: pillarFreq.frequency_iron,
    frequency_combat: pillarFreq.frequency_combat,
    frequency_spirit: pillarFreq.frequency_spirit,
  });
}

export function isHypertrophyGoal(goalIron: string | null): boolean {
  const normalized = (goalIron ?? '').trim().toLowerCase();
  return (
    normalized.includes('hypertrophy') ||
    normalized.includes('powerbuilding') ||
    normalized.includes('volume')
  );
}

export function targetIronExerciseCount(minutes: number, goalIron: string | null = null): number {
  if (isHypertrophyGoal(goalIron)) {
    if (minutes <= 50) return 6;
    if (minutes <= 65) return 7;
    if (minutes <= 80) return 8;
    return 8;
  }
  if (minutes <= 35) return 3;
  if (minutes <= 50) return 4;
  if (minutes <= 65) return 5;
  if (minutes <= 80) return 6;
  return 8;
}

export function targetCombatRoundCount(minutes: number): number {
  if (minutes <= 20) return 2;
  if (minutes <= 35) return 3;
  if (minutes <= 50) return 4;
  return 5;
}

export function equipmentMatches(exercise: LibraryExercise, availableEquipment: EquipmentTag[]): boolean {
  if (availableEquipment.length === 0) return false;
  if (exercise.equipment_required.length === 0) return true;
  return exercise.equipment_required.some((tag) => availableEquipment.includes(tag as EquipmentTag));
}

function setsFromLog(log: EnginePerformanceRow): number {
  const fromPayload = log.payload?.iron?.sets?.length;
  if (fromPayload != null && fromPayload > 0) return fromPayload;
  return 1;
}

/** Law III — rolling 7-day working set count for a muscle group */
export function calculateWeeklyVolume(
  muscleGroup: string,
  ironLogs7d: EnginePerformanceRow[],
  catalog: LibraryExercise[],
  pendingSessionSets = 0,
): number {
  const normalized = muscleGroup.toLowerCase();
  let total = pendingSessionSets;

  for (const log of ironLogs7d) {
    const exerciseId = log.payload?.iron?.exercise_id ?? log.exercise_id;
    if (!exerciseId) continue;
    const meta = catalog.find((row) => row.id === exerciseId);
    const primary = (meta?.primary_muscle ?? '').toLowerCase();
    if (primary !== normalized) continue;
    total += setsFromLog(log);
  }

  return total;
}

export function buildWeeklyVolumeMap(
  ironLogs7d: EnginePerformanceRow[],
  catalog: LibraryExercise[],
): Map<string, number> {
  const muscles = new Set(
    catalog.map((row) => row.primary_muscle).filter(Boolean) as string[],
  );

  const map = new Map<string, number>();
  for (const muscle of muscles) {
    map.set(muscle, calculateWeeklyVolume(muscle, ironLogs7d, catalog));
  }
  return map;
}

/** When weekly series exceed the hypertrophy zone, drop 1 set per exercise in-session */
export function applyHypertrophyVolumeGuardrail(
  sets: number,
  primaryMuscle: string | null,
  weeklyVolumeMap: Map<string, number>,
  exerciseSetsInSession: number,
): { sets: number; volumeNote: string } {
  if (!primaryMuscle) return { sets, volumeNote: '' };

  const weeklySeries = (weeklyVolumeMap.get(primaryMuscle) ?? 0) + exerciseSetsInSession;
  if (weeklySeries <= HYPERTROPHY_WEEKLY_SERIES_MAX) {
    return { sets, volumeNote: '' };
  }

  const reduced = Math.max(2, sets - 1);
  return {
    sets: reduced,
    volumeNote: `Hypertrophy guard — ${primaryMuscle} ${weeklySeries} sets/7d (> ${HYPERTROPHY_WEEKLY_SERIES_MAX})`,
  };
}

/** Inject Phase-1 iron exercises ONLY for biomechanical prerequisites (never generic warmups) */
export function injectPrerequisiteIronExercises(
  exerciseIds: string[],
  catalog: LibraryExercise[],
  prerequisiteSlugs: string[],
  equipment: EquipmentTag[],
  blockedJointProfiles: string[],
): string[] {
  if (prerequisiteSlugs.length === 0) return exerciseIds;

  const allowed = new Set([BIOMECH_SLUG_MALASANA, BIOMECH_SLUG_CHEST_OPENER]);
  const prepended: string[] = [];
  const used = new Set(exerciseIds);

  for (const slug of prerequisiteSlugs) {
    if (!allowed.has(slug)) continue;
    const row = catalog.find(
      (entry) =>
        entry.slug === slug &&
        equipmentMatches(entry, equipment) &&
        (!entry.joint_stress_profile || !blockedJointProfiles.includes(entry.joint_stress_profile)),
    );
    if (!row || used.has(row.id)) continue;
    prepended.push(row.id);
    used.add(row.id);
  }

  return [...prepended, ...exerciseIds.filter((id) => !prepended.includes(id))];
}

/** Precision Blueprint only — no greedy fallback */
export function selectExercisesForSplit(
  focusLabel: string,
  catalog: LibraryExercise[],
  equipment: EquipmentTag[],
  targetCount: number,
  blockedJointProfiles: string[],
): string[] {
  return selectExercisesByIronBlueprint(
    focusLabel,
    catalog,
    equipment,
    targetCount,
    blockedJointProfiles,
  );
}

export function expandRoutineIdsForTime(
  routineIds: string[],
  catalog: LibraryExercise[],
  targetCount: number,
): string[] {
  return routineIds.slice(0, targetCount);
}

/**
 * Archetype-aware volume steering: adjusts weekly set cap per muscle group.
 * AESTHETIC_V_TAPER: +4 sets for delts/lats, standard elsewhere.
 * POWERBUILDER_BULK: +2 sets globally (higher intensity baseline).
 * LEAN_RECOMP: standard caps (no extra volume, preserve deficit recovery).
 */
export function archetypeVolumeCapAdjustment(
  archetype: TargetArchetype | null,
  primaryMuscle: string | null,
): number {
  if (!archetype || !primaryMuscle) return 0;

  const muscle = primaryMuscle.toLowerCase();

  switch (archetype) {
    case 'AESTHETIC_V_TAPER': {
      if (muscle === 'deltoids' || muscle === 'shoulders' || muscle === 'lateral deltoid') return 4;
      if (muscle === 'lats' || muscle === 'latissimus dorsi' || muscle === 'back') return 4;
      if (muscle === 'rear deltoid') return 3;
      return 0;
    }
    case 'POWERBUILDER_BULK':
      return 2;
    case 'LEAN_RECOMP':
      return 0;
    default:
      return 0;
  }
}

/**
 * Archetype-aware exercise count adjustment for iron sessions.
 * V-Taper: +1 exercise (extra isolation for delts/lats).
 * Powerbuilder: standard count, higher per-exercise intensity instead.
 * Lean Recomp: -1 exercise (shorter sessions, preserve recovery in deficit).
 */
export function archetypeExerciseCountDelta(archetype: TargetArchetype | null): number {
  if (!archetype) return 0;
  switch (archetype) {
    case 'AESTHETIC_V_TAPER': return 1;
    case 'POWERBUILDER_BULK': return 0;
    case 'LEAN_RECOMP': return -1;
    default: return 0;
  }
}

/**
 * Archetype-aware RIR adjustment baseline.
 * Powerbuilder: -1 RIR (train closer to failure for strength adaptation).
 * V-Taper: standard.
 * Lean Recomp: +1 RIR (preserve recovery under caloric deficit).
 */
export function archetypeRirDelta(archetype: TargetArchetype | null): number {
  if (!archetype) return 0;
  switch (archetype) {
    case 'POWERBUILDER_BULK': return -1;
    case 'LEAN_RECOMP': return 1;
    default: return 0;
  }
}
