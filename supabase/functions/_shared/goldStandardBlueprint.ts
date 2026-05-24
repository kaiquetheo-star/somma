// CLINICAL ENGINE: DETERMINISTIC ONLY. NO RANDOMNESS ALLOWED. IF INPUTS ARE CONSTANT, OUTPUT MUST BE CONSTANT.

export type IronDayBlueprintKey = 'push' | 'pull' | 'legs' | 'upper' | 'lower' | 'full';

export interface PrecisionBlueprintSlot {
  slotId: string;
  goldSlugs: readonly string[];
}

export const PRECISION_BLUEPRINT: Record<IronDayBlueprintKey, readonly PrecisionBlueprintSlot[]> = {
  push: [
    { slotId: 'chest_compound_a', goldSlugs: ['barbell_bench_press', 'bench_press'] },
    { slotId: 'chest_compound_b', goldSlugs: ['barbell_incline_bench_press'] },
    { slotId: 'chest_iso', goldSlugs: ['cable_fly'] },
    { slotId: 'shoulder_compound', goldSlugs: ['overhead_press', 'barbell_overhead_press'] },
    { slotId: 'triceps_iso_a', goldSlugs: ['cable_pushdown', 'triceps-pushdown'] },
    { slotId: 'triceps_iso_b', goldSlugs: ['cable_pushdown_with_rope_attachment'] },
    { slotId: 'core', goldSlugs: ['abdominal_crunch', '3008_abdominal_crunch'] },
  ],
  pull: [
    { slotId: 'back_vertical', goldSlugs: ['cable_bar_lateral_pulldown', 'lat_pulldown'] },
    { slotId: 'back_horizontal', goldSlugs: ['barbell_bent_over_row'] },
    { slotId: 'rear_delt', goldSlugs: ['reverse_dumbbell_fly', 'dumbbell_reverse_fly'] },
    { slotId: 'biceps_iso_a', goldSlugs: ['barbell_curl'] },
    { slotId: 'biceps_iso_b', goldSlugs: ['hammer_curl', 'dumbbell_hammer_curl'] },
    { slotId: 'core', goldSlugs: ['abdominal_crunch'] },
  ],
  legs: [
    { slotId: 'quad_a', goldSlugs: ['barbell_squat'] },
    { slotId: 'quad_b', goldSlugs: ['leg_press'] },
    { slotId: 'hinge_a', goldSlugs: ['romanian_deadlift'] },
    { slotId: 'hinge_b', goldSlugs: ['leg_curl'] },
    { slotId: 'calves', goldSlugs: ['barbell_seated_calf_raise', 'standing_calf_raise'] },
    { slotId: 'core', goldSlugs: ['abdominal_crunch'] },
  ],
  upper: [
    { slotId: 'chest_compound', goldSlugs: ['barbell_bench_press'] },
    { slotId: 'back_compound', goldSlugs: ['barbell_bent_over_row'] },
    { slotId: 'shoulder', goldSlugs: ['overhead_press'] },
    { slotId: 'biceps_iso', goldSlugs: ['barbell_curl'] },
    { slotId: 'triceps_iso', goldSlugs: ['cable_pushdown'] },
    { slotId: 'core', goldSlugs: ['abdominal_crunch'] },
  ],
  lower: [
    { slotId: 'quad_a', goldSlugs: ['barbell_squat'] },
    { slotId: 'quad_b', goldSlugs: ['leg_press'] },
    { slotId: 'hinge_a', goldSlugs: ['romanian_deadlift'] },
    { slotId: 'hinge_b', goldSlugs: ['leg_curl'] },
    { slotId: 'calves', goldSlugs: ['barbell_seated_calf_raise'] },
    { slotId: 'core', goldSlugs: ['abdominal_crunch'] },
  ],
  full: [
    { slotId: 'push_compound', goldSlugs: ['barbell_bench_press'] },
    { slotId: 'pull_compound', goldSlugs: ['barbell_bent_over_row'] },
    { slotId: 'leg_compound', goldSlugs: ['barbell_squat'] },
    { slotId: 'hinge', goldSlugs: ['romanian_deadlift'] },
    { slotId: 'triceps_iso', goldSlugs: ['cable_pushdown'] },
    { slotId: 'core', goldSlugs: ['abdominal_crunch'] },
  ],
};

export function normalizeCatalogSlug(slug: string): string {
  return slug.toLowerCase().replace(/-/g, '_');
}

export function slugMatchesGold(candidate: string, gold: string): boolean {
  const c = normalizeCatalogSlug(candidate);
  const g = normalizeCatalogSlug(gold);
  return c === g || c.includes(g) || g.includes(c);
}
