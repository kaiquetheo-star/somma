// CLINICAL ENGINE: DETERMINISTIC ONLY. NO RANDOMNESS ALLOWED. IF INPUTS ARE CONSTANT, OUTPUT MUST BE CONSTANT.
import {
  normalizeCatalogSlug,
  PRECISION_BLUEPRINT,
  slugMatchesGold,
  type IronDayBlueprintKey,
  type PrecisionBlueprintSlot,
} from '@/lib/gameplan/engine/goldStandardBlueprint';
import type { LibraryExercise } from '@/types/catalog';
import type { EquipmentTag } from '@/store/useSommaStore';

/** Split key inferred from Head Coach focus_label — re-export for blueprint consumers */
export type { IronDayBlueprintKey } from '@/lib/gameplan/engine/goldStandardBlueprint';

function equipmentMatches(exercise: LibraryExercise, availableEquipment: EquipmentTag[]): boolean {
  if (availableEquipment.length === 0) return false;
  if (exercise.equipment_required.length === 0) return true;
  return exercise.equipment_required.some((tag) => availableEquipment.includes(tag as EquipmentTag));
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
  equipment: EquipmentTag[],
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
  equipment: EquipmentTag[],
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

function trimBlueprintToTarget(
  slots: readonly PrecisionBlueprintSlot[],
  targetCount: number,
): PrecisionBlueprintSlot[] {
  return slots.slice(0, Math.max(1, targetCount));
}

/**
 * Precision Blueprint — hard-locked GOLD_STANDARD_SLUG per slot.
 * No warmups, no greedy fill, no randomization.
 */
export function selectExercisesByIronBlueprint(
  focusLabel: string,
  catalog: LibraryExercise[],
  equipment: EquipmentTag[],
  targetCount: number,
  blockedJointProfiles: string[],
): string[] {
  const key = inferIronDayBlueprintKey(focusLabel);
  const blueprint = PRECISION_BLUEPRINT[key] ?? PRECISION_BLUEPRINT.full;
  const slots = trimBlueprintToTarget(blueprint, targetCount);

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

/** @deprecated Precision Blueprint uses slug lock — matchers retained for Edge sync only */
export function isTricepsMuscle(row: LibraryExercise): boolean {
  const blob = `${row.primary_muscle ?? ''} ${row.name} ${row.slug}`.toLowerCase();
  return /tricep|pushdown/.test(blob);
}

/** @deprecated Precision Blueprint uses slug lock */
export function isBicepsMuscle(row: LibraryExercise): boolean {
  const blob = `${row.primary_muscle ?? ''} ${row.name} ${row.slug}`.toLowerCase();
  return /bicep|curl|brachialis/.test(blob) && !/leg curl|tricep/.test(blob);
}

export function slotsForBlueprint(_key: IronDayBlueprintKey): { id: string; count: number }[] {
  const blueprint = PRECISION_BLUEPRINT[_key] ?? PRECISION_BLUEPRINT.full;
  return blueprint.map((slot) => ({ id: slot.slotId, count: 1 }));
}

export function normalizeSlugForCatalog(slug: string): string {
  return normalizeCatalogSlug(slug);
}
