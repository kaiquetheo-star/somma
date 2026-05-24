// CLINICAL ENGINE: DETERMINISTIC ONLY. NO RANDOMNESS ALLOWED. IF INPUTS ARE CONSTANT, OUTPUT MUST BE CONSTANT.
import {
  normalizeCatalogSlug,
  PRECISION_BLUEPRINT,
  slugMatchesGold,
  type IronDayBlueprintKey,
  type PrecisionBlueprintSlot,
} from './goldStandardBlueprint.ts';

/** Edge catalog row — mirrors library_exercises */
export interface BlueprintLibraryExercise {
  id: string;
  slug: string;
  name: string;
  movement_pattern: string | null;
  primary_muscle: string | null;
  synergist_muscles?: string[];
  cns_fatigue_cost?: number | null;
  joint_stress_profile?: string | null;
  equipment_required: string[];
  default_sets?: number;
  default_reps?: number;
}

type LibraryExercise = BlueprintLibraryExercise;

function equipmentMatches(exercise: BlueprintLibraryExercise, availableEquipment: string[]): boolean {
  if (availableEquipment.length === 0) return false;
  if (exercise.equipment_required.length === 0) return true;
  return exercise.equipment_required.some((tag) => availableEquipment.includes(tag));
}

export function inferIronDayBlueprintKey(focusLabel: string): IronDayBlueprintKey {
  const lower = focusLabel.toLowerCase();
  if (lower.includes('push')) return 'push';
  if (lower.includes('pull')) return 'pull';
  if (lower.includes('leg')) return 'legs';
  if (lower.includes('upper')) return 'upper';
  if (lower.includes('lower')) return 'lower';
  return 'full';
}

function isEligible(
  row: LibraryExercise,
  equipment: string[],
  blockedJointProfiles: string[],
): boolean {
  return (
    equipmentMatches(row, equipment) &&
    (!row.joint_stress_profile || !blockedJointProfiles.includes(row.joint_stress_profile))
  );
}

function resolveGoldStandardExercise(
  slot: PrecisionBlueprintSlot,
  catalog: LibraryExercise[],
  equipment: string[],
  blockedJointProfiles: string[],
  usedIds: Set<string>,
): LibraryExercise | undefined {
  for (const goldSlug of slot.goldSlugs) {
    const match = catalog.find(
      (row) =>
        !usedIds.has(row.id) &&
        slugMatchesGold(row.slug, goldSlug) &&
        isEligible(row, equipment, blockedJointProfiles),
    );
    if (match) return match;
  }
  return undefined;
}

export function selectExercisesByIronBlueprint(
  focusLabel: string,
  catalog: LibraryExercise[],
  equipment: string[],
  targetCount: number,
  blockedJointProfiles: string[],
): string[] {
  const key = inferIronDayBlueprintKey(focusLabel);
  const blueprint = PRECISION_BLUEPRINT[key] ?? PRECISION_BLUEPRINT.full;
  const slots = blueprint.slice(0, Math.max(1, targetCount));

  const usedIds = new Set<string>();
  const selected: string[] = [];

  for (const slot of slots) {
    const row = resolveGoldStandardExercise(slot, catalog, equipment, blockedJointProfiles, usedIds);
    if (!row) continue;
    selected.push(row.id);
    usedIds.add(row.id);
  }

  return selected.slice(0, targetCount);
}

export function isTricepsMuscle(row: LibraryExercise): boolean {
  const blob = `${row.primary_muscle ?? ''} ${row.name} ${row.slug}`.toLowerCase();
  return /tricep|pushdown/.test(blob);
}

export function isBicepsMuscle(row: LibraryExercise): boolean {
  const blob = `${row.primary_muscle ?? ''} ${row.name} ${row.slug}`.toLowerCase();
  return /bicep|curl|brachialis/.test(blob) && !/leg curl|tricep/.test(blob);
}

export function normalizeSlugForCatalog(slug: string): string {
  return normalizeCatalogSlug(slug);
}
