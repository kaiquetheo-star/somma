// CLINICAL ENGINE: DETERMINISTIC ONLY. NO RANDOMNESS ALLOWED. IF INPUTS ARE CONSTANT, OUTPUT MUST BE CONSTANT.

/** 5-Phase Clinical Matrix — final Iron payload order */
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

/**
 * Phase 1: biomechanical prerequisites ONLY (no generic warmups).
 * Phases 2–5: biomechanics-first — not display name heuristics alone.
 */
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

function normalizeSlug(slug: string): string {
  return slug.toLowerCase().replace(/-/g, '_');
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
