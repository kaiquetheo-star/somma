/**
 * Zero-Cost Clinical Engine — shared deterministic laws for Edge Head Coach.
 * Mirrors lib/gameplan/engine/clinicalLaws.ts + clinicalMatrix.ts (keep in sync).
 */

// CLINICAL ENGINE: DETERMINISTIC ONLY. NO RANDOMNESS ALLOWED. IF INPUTS ARE CONSTANT, OUTPUT MUST BE CONSTANT.

export const CNS_DELTA_IRON_SET = 2;
export const CNS_DELTA_COMBAT_ROUND = 3;
export const CNS_DELTA_SPIRIT_FLOW = -1;
export const CNS_FATIGUE_AUTOREG_THRESHOLD = 70;

export const DELOAD_MESOCYCLE_WEEK = 4;
export const DELOAD_IRON_EXERCISE_CAP = 4;
export const DELOAD_LOAD_FACTOR = 0.6;
export const DELOAD_SPIRIT_TIME_MULTIPLIER = 2;

/** Law III — Effective Hypertrophy Zone upper bound (weekly working sets per muscle) */
export const HYPERTROPHY_WEEKLY_SERIES_MAX = 20;

export const BIOMECH_SLUG_MALASANA = 'squat_malasana';
export const BIOMECH_SLUG_CHEST_OPENER = 'sphinx';

export type ClinicalPhase = 1 | 2 | 3 | 4 | 5;

export interface ClinicalExerciseMeta {
  id?: string;
  slug?: string;
  name?: string;
  primary_muscle?: string | null;
  movement_pattern?: string | null;
  cns_fatigue_cost?: number | null;
}

function blob(meta: ClinicalExerciseMeta | undefined): string {
  if (!meta) return '';
  return `${meta.primary_muscle ?? ''} ${meta.name ?? ''} ${meta.slug ?? ''}`.toLowerCase();
}

function normalizeSlug(slug: string): string {
  return slug.toLowerCase().replace(/-/g, '_');
}

function isCoreFinisher(meta: ClinicalExerciseMeta | undefined): boolean {
  if (!meta) return false;
  const primary = (meta.primary_muscle ?? '').toLowerCase();
  if (primary === 'abs' || primary === 'core' || primary === 'abdominals') return true;
  return /crunch|plank|russian twist|abdominal|oblique|dead bug|hollow hold|\bcore\b/.test(blob(meta));
}

function isIsolation(meta: ClinicalExerciseMeta | undefined): boolean {
  if (!meta || isCoreFinisher(meta)) return false;
  if (meta.movement_pattern === 'isolation') return true;
  return /\bcurl\b|pushdown|push-down|lateral raise|front raise|\bfly\b|flye|kickback|pullover|extension/.test(
    blob(meta),
  );
}

function isHeavyCompound(meta: ClinicalExerciseMeta | undefined): boolean {
  if (!meta || isCoreFinisher(meta) || isIsolation(meta)) return false;
  const cns = meta.cns_fatigue_cost ?? 3;
  const name = blob(meta);
  if (cns >= 4) return true;
  if (
    /\bdeadlift\b|\bbench press\b|\bbarbell bench\b/.test(name) ||
    (/\bsquat\b/.test(name) && !/goblet|jump|split|pistol|sissy|wall/.test(name)) ||
    /\boverhead press\b|\bmilitary press\b|\bohp\b/.test(name) ||
    /\bpull[- ]?up\b|\bchin[- ]?up\b/.test(name) ||
    /\bbarbell row\b|\bbent[- ]over row\b/.test(name)
  ) {
    return true;
  }
  return false;
}

function isSecondaryCompound(meta: ClinicalExerciseMeta | undefined): boolean {
  if (!meta || isCoreFinisher(meta) || isIsolation(meta) || isHeavyCompound(meta)) return false;
  const pattern = meta.movement_pattern;
  if (pattern && ['squat', 'hinge', 'push', 'pull', 'lunge'].includes(pattern)) return true;
  return (meta.cns_fatigue_cost ?? 2) >= 2;
}

/** Phase 1: biomechanical prerequisites ONLY — no generic warmups */
export function classifyClinicalPhase(
  meta: ClinicalExerciseMeta | undefined,
  prerequisiteSlugs: string[] = [],
): ClinicalPhase {
  const slug = normalizeSlug(meta?.slug ?? '');
  const prereqSet = new Set(prerequisiteSlugs.map(normalizeSlug));
  if (slug && prereqSet.has(slug)) return 1;
  if (isCoreFinisher(meta)) return 5;
  if (isIsolation(meta)) return 4;
  if (isHeavyCompound(meta)) return 2;
  if (isSecondaryCompound(meta)) return 3;
  return 3;
}

export function applyFivePhaseClinicalMatrix<T extends { exercise_id: string }>(
  exercises: T[],
  catalog: Array<ClinicalExerciseMeta & { id: string }>,
  prerequisiteSlugs: string[] = [],
): T[] {
  const metaFor = (exerciseId: string) => catalog.find((row) => row.id === exerciseId);
  const ranked = exercises.map((exercise, index) => ({
    exercise,
    phase: classifyClinicalPhase(metaFor(exercise.exercise_id), prerequisiteSlugs),
    index,
  }));
  ranked.sort((a, b) => a.phase - b.phase || a.index - b.index);
  return ranked.map((row) => row.exercise);
}

export function clampMesocycleWeek(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value)) return 1;
  return Math.min(4, Math.max(1, Math.round(value)));
}

export function isDeloadMesocycleWeek(mesocycleWeek: number): boolean {
  return clampMesocycleWeek(mesocycleWeek) === DELOAD_MESOCYCLE_WEEK;
}

function normalizeName(name: string): string {
  return name.toLowerCase();
}

export function ironBlockNeedsHipPrimer(exerciseNames: string[]): boolean {
  return exerciseNames.some((name) => {
    const n = normalizeName(name);
    return (
      /\bsquat\b/.test(n) ||
      n.includes('leg press') ||
      n.includes('hack squat') ||
      n.includes('goblet squat')
    );
  });
}

export function ironBlockNeedsChestPrimer(exerciseNames: string[]): boolean {
  return exerciseNames.some((name) => {
    const n = normalizeName(name);
    return /\bbench\b/.test(n) || n.includes('bench press') || n.includes('chest press');
  });
}

export function resolveBiomechanicalPrerequisiteSlugs(exerciseNames: string[]): string[] {
  const slugs: string[] = [];
  if (ironBlockNeedsHipPrimer(exerciseNames)) slugs.push(BIOMECH_SLUG_MALASANA);
  if (ironBlockNeedsChestPrimer(exerciseNames)) slugs.push(BIOMECH_SLUG_CHEST_OPENER);
  return [...new Set(slugs)];
}

export interface IronExercisePrescriptionLike {
  target_weight_kg: number | null;
  target_rir?: number | null;
  progression_note?: string | null;
}

export function applyDeloadToIronExercise<T extends IronExercisePrescriptionLike>(exercise: T): T {
  const scaledWeight =
    exercise.target_weight_kg != null
      ? Math.round(exercise.target_weight_kg * DELOAD_LOAD_FACTOR * 10) / 10
      : null;
  return {
    ...exercise,
    target_weight_kg: scaledWeight,
    target_rir: Math.max(exercise.target_rir ?? 2, 3),
    progression_note: [exercise.progression_note, 'Deload week (−40% load)']
      .filter(Boolean)
      .join(' · '),
  };
}

export function capIronExercisesForDeload<T>(exercises: T[], isDeload: boolean): T[] {
  if (!isDeload) return exercises;
  return exercises.slice(0, DELOAD_IRON_EXERCISE_CAP);
}

export function scaleSpiritMinutesForDeload(minutes: number, isDeload: boolean): number {
  if (!isDeload) return minutes;
  return Math.min(90, Math.round(minutes * DELOAD_SPIRIT_TIME_MULTIPLIER));
}

export interface FlowSpiritRowLike {
  id: string;
  slug: string;
  pillar: string;
  session_name: string;
  default_hold_seconds: number;
  target_recovery_zones: string[];
  is_dynamic_flow: boolean;
}

export interface FlowAsanaLike {
  asana_id: string;
  slug: string;
  name: string;
  order: number;
  hold_seconds: number;
  target_recovery_zones: string[];
  is_dynamic_flow: boolean;
}

export function prependBiomechanicalAsanas(
  asanas: FlowAsanaLike[],
  flowCatalog: FlowSpiritRowLike[],
  prerequisiteSlugs: string[],
): FlowAsanaLike[] {
  const prepended: FlowAsanaLike[] = [];
  let order = 0;
  for (const slug of prerequisiteSlugs) {
    const row = flowCatalog.find((entry) => entry.slug === slug && entry.pillar === 'flow');
    if (!row) continue;
    if (asanas.some((a) => a.slug === slug)) continue;
    prepended.push({
      asana_id: row.id,
      slug: row.slug,
      name: row.session_name,
      order: order++,
      hold_seconds: row.default_hold_seconds || 45,
      target_recovery_zones: row.target_recovery_zones,
      is_dynamic_flow: row.is_dynamic_flow,
    });
  }
  const rest = asanas
    .filter((a) => !prerequisiteSlugs.includes(a.slug))
    .map((a, index) => ({ ...a, order: prepended.length + index }));
  return [...prepended, ...rest];
}
