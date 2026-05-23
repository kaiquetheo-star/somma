import AsyncStorage from '@react-native-async-storage/async-storage';

import { isSupabaseConfigured } from '@/lib/config';
import { getSupabase } from '@/lib/supabase/client';
import { findSpiritSessionByTempoId } from '@/lib/breathwork/fromCatalog';
import { COMBAT_TACTICAL_FOCUS_LABELS, type GameplanBlock } from '@/types/gameplan';
import {
  parseLibraryVisualAsset,
  type LibraryCombatCombo,
  type LibraryExercise,
  type LibraryFlowSpiritSession,
} from '@/types/catalog';

export type {
  IronExerciseBiomechanics,
  JointStressProfile,
  LibraryCombatCombo,
  LibraryExercise,
  LibraryFlowSpiritSession,
  LibraryVisualAsset,
  MovementPattern,
  VisualAssetType,
} from '@/types/catalog';
export { formatCnsFatigueCost, formatJointStress, parseLibraryVisualAsset } from '@/types/catalog';

const CACHE_KEYS = {
  exercises: 'somma-cache-library-exercises-v2',
  combat: 'somma-cache-library-combat-v2',
  flowSpirit: 'somma-cache-library-flow-spirit-v2',
} as const;

const CACHE_TTL_MS = 1000 * 60 * 60 * 12;

import type { CombatTacticalFocus } from '@/types/gameplan';

interface CacheEnvelope<T> {
  fetched_at: string;
  rows: T[];
}

let memoryExercises: LibraryExercise[] | null = null;
let memoryCombat: LibraryCombatCombo[] | null = null;
let memoryFlowSpirit: LibraryFlowSpiritSession[] | null = null;

function isFresh(fetchedAt: string): boolean {
  const ts = Date.parse(fetchedAt);
  if (Number.isNaN(ts)) return false;
  return Date.now() - ts < CACHE_TTL_MS;
}

async function readCache<T>(key: string): Promise<T[] | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const envelope = JSON.parse(raw) as CacheEnvelope<T>;
    if (!envelope?.rows?.length || !isFresh(envelope.fetched_at)) return null;
    return envelope.rows;
  } catch {
    return null;
  }
}

async function writeCache<T>(key: string, rows: T[]): Promise<void> {
  try {
    const envelope: CacheEnvelope<T> = {
      fetched_at: new Date().toISOString(),
      rows,
    };
    await AsyncStorage.setItem(key, JSON.stringify(envelope));
  } catch {
    // Offline storage may be unavailable on web private mode
  }
}

function mapExerciseRow(row: Record<string, unknown>): LibraryExercise {
  const cues =
    row.biomechanical_instructions && typeof row.biomechanical_instructions === 'object'
      ? (row.biomechanical_instructions as Record<string, string>)
      : {};

  const cnsRaw = row.cns_fatigue_cost;
  const cns =
    typeof cnsRaw === 'number'
      ? cnsRaw
      : cnsRaw != null
        ? Number(cnsRaw)
        : null;

  return {
    ...parseLibraryVisualAsset(row),
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    biomechanical_instructions: cues,
    equipment_required: Array.isArray(row.equipment_required)
      ? row.equipment_required.map(String)
      : [],
    default_sets: typeof row.default_sets === 'number' ? row.default_sets : 4,
    default_reps: typeof row.default_reps === 'number' ? row.default_reps : 8,
    movement_pattern:
      typeof row.movement_pattern === 'string' ? row.movement_pattern : null,
    primary_muscle:
      typeof row.primary_muscle === 'string' ? row.primary_muscle : null,
    synergist_muscles: Array.isArray(row.synergist_muscles)
      ? row.synergist_muscles.map(String)
      : [],
    cns_fatigue_cost:
      cns != null && Number.isFinite(cns) && cns >= 1 && cns <= 5 ? cns : null,
    joint_stress_profile:
      typeof row.joint_stress_profile === 'string' ? row.joint_stress_profile : null,
    stretch_mediated_hypertrophy: row.stretch_mediated_hypertrophy === true,
  };
}

const VALID_TACTICAL_FOCUS = new Set<CombatTacticalFocus>([
  'footwork_range',
  'power_inside',
  'defense_counter',
  'burnout',
]);

function mapCombatRow(row: Record<string, unknown>): LibraryCombatCombo {
  const sequence = Array.isArray(row.sequence)
    ? row.sequence.map(String)
    : [];
  const focusRaw = row.tactical_focus;
  const tactical_focus =
    typeof focusRaw === 'string' && VALID_TACTICAL_FOCUS.has(focusRaw as CombatTacticalFocus)
      ? (focusRaw as CombatTacticalFocus)
      : 'footwork_range';

  return {
    ...parseLibraryVisualAsset(row),
    id: String(row.id),
    slug: String(row.slug),
    combo_name: String(row.combo_name),
    sequence,
    complexity_level:
      typeof row.complexity_level === 'number' ? row.complexity_level : 5,
    tactical_focus,
  };
}

function mapFlowSpiritRow(row: Record<string, unknown>): LibraryFlowSpiritSession {
  const tierRaw = row.complexity_tier ?? row.complexity_level;
  const tier =
    typeof tierRaw === 'number'
      ? Math.min(3, Math.max(1, Math.round(tierRaw > 3 ? Math.ceil(tierRaw / 3) : tierRaw)))
      : 2;

  return {
    ...parseLibraryVisualAsset(row),
    id: String(row.id),
    slug: String(row.slug),
    pillar: row.pillar === 'flow' ? 'flow' : 'spirit',
    session_name: String(row.session_name),
    description: typeof row.description === 'string' ? row.description : null,
    duration_minutes:
      typeof row.duration_minutes === 'number' ? row.duration_minutes : 15,
    tempo_profile:
      row.tempo_profile && typeof row.tempo_profile === 'object'
        ? (row.tempo_profile as Record<string, unknown>)
        : {},
    complexity_level:
      typeof row.complexity_level === 'number' ? row.complexity_level : 3,
    target_recovery_zones: Array.isArray(row.target_recovery_zones)
      ? row.target_recovery_zones.map(String)
      : [],
    complexity_tier: tier,
    is_dynamic_flow: row.is_dynamic_flow === true,
    default_hold_seconds:
      typeof row.default_hold_seconds === 'number' ? row.default_hold_seconds : 45,
  };
}

async function fetchTable<T>(
  table: 'library_exercises' | 'library_combat' | 'library_flow_spirit',
  cacheKey: string,
  mapper: (row: Record<string, unknown>) => T,
  memoryRef: { current: T[] | null },
): Promise<T[]> {
  if (memoryRef.current?.length) return memoryRef.current;

  const cached = await readCache<T>(cacheKey);
  if (cached?.length) {
    memoryRef.current = cached;
    return cached;
  }

  if (!isSupabaseConfigured) return [];

  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase.from(table).select('*');
  if (error || !data?.length) {
    return memoryRef.current ?? [];
  }

  const rows = data.map((row) => mapper(row as Record<string, unknown>));
  memoryRef.current = rows;
  await writeCache(cacheKey, rows);
  return rows;
}

export async function fetchLibraryExercises(): Promise<LibraryExercise[]> {
  return fetchTable(
    'library_exercises',
    CACHE_KEYS.exercises,
    mapExerciseRow,
    { current: memoryExercises },
  ).then((rows) => {
    memoryExercises = rows;
    return rows;
  });
}

export async function fetchLibraryCombat(): Promise<LibraryCombatCombo[]> {
  return fetchTable(
    'library_combat',
    CACHE_KEYS.combat,
    mapCombatRow,
    { current: memoryCombat },
  ).then((rows) => {
    memoryCombat = rows;
    return rows;
  });
}

export async function fetchLibraryFlowSpirit(): Promise<LibraryFlowSpiritSession[]> {
  return fetchTable(
    'library_flow_spirit',
    CACHE_KEYS.flowSpirit,
    mapFlowSpiritRow,
    { current: memoryFlowSpirit },
  ).then((rows) => {
    memoryFlowSpirit = rows;
    return rows;
  });
}

export async function prefetchLibraryCatalogs(): Promise<void> {
  await Promise.all([
    fetchLibraryExercises(),
    fetchLibraryCombat(),
    fetchLibraryFlowSpirit(),
  ]);
}

export function getExerciseById(
  exercises: LibraryExercise[],
  id: string,
): LibraryExercise | null {
  return exercises.find((row) => row.id === id) ?? null;
}

export function getCombatComboById(
  combos: LibraryCombatCombo[],
  id: string,
): LibraryCombatCombo | null {
  return combos.find((row) => row.id === id) ?? null;
}

export function filterCombatByMastery(
  combos: LibraryCombatCombo[],
  combatMastery: number,
): LibraryCombatCombo[] {
  const filtered = combos.filter((combo) => combo.complexity_level <= combatMastery + 2);
  return filtered.length > 0 ? filtered : combos;
}

export function filterCombatByTacticalFocus(
  combos: LibraryCombatCombo[],
  tacticalFocus: CombatTacticalFocus,
): LibraryCombatCombo[] {
  const filtered = combos.filter((combo) => combo.tactical_focus === tacticalFocus);
  return filtered.length > 0 ? filtered : combos;
}

/** Human-readable preview for Daily Command cards */
export async function resolveBlockPreviewLabel(block: GameplanBlock): Promise<string> {
  if (block.iron?.exercises?.length) {
    const catalog = await fetchLibraryExercises();
    const first = block.iron.exercises[0];
    const exercise = getExerciseById(catalog, first.exercise_id);
    const name = exercise?.name ?? 'Iron prescription';
    const count = block.iron.exercises.length;
    if (count > 1) return `${name} + ${count - 1} more`;
    const load =
      first.target_weight_kg != null && first.target_weight_kg > 0
        ? ` · ${first.target_weight_kg} kg`
        : '';
    return `${name} · ${first.target_sets}×${first.target_reps}${load}`;
  }

  if (block.combat?.rounds?.length) {
    const structure = block.combat.rounds_structure;
    if (structure?.length) {
      return structure
        .map((segment) => {
          const range =
            segment.round_start === segment.round_end
              ? `R${segment.round_start}`
              : `R${segment.round_start}–${segment.round_end}`;
          return `${range} ${COMBAT_TACTICAL_FOCUS_LABELS[segment.tactical_focus]}`;
        })
        .join(' · ');
    }
    const catalog = await fetchLibraryCombat();
    const firstRound = block.combat.rounds[0];
    const combo = getCombatComboById(catalog, firstRound.combo_id);
    const comboName = combo?.combo_name ?? 'Combat rounds';
    return `${comboName} · ${block.combat.rounds.length} rounds`;
  }

  if (block.spirit) {
    if (block.spirit.mode === 'flow' && block.spirit.asanas?.length) {
      const catalog = await fetchLibraryFlowSpirit();
      const first = block.spirit.asanas[0];
      const row = catalog.find((item) => item.id === first.asana_id);
      const name = first.name || row?.session_name || 'Flow recovery';
      const zones = block.spirit.recovery_focus_zones?.slice(0, 2).join(', ') ?? 'recovery';
      return `${name} + ${block.spirit.asanas.length - 1} · ${zones}`;
    }
    const catalog = await fetchLibraryFlowSpirit();
    const session = findSpiritSessionByTempoId(catalog, block.spirit.tempo_id);
    const label = session?.session_name ?? block.spirit.tempo_id?.replace(/^tempo_/, '') ?? 'breathwork';
    return `${label} · ${block.spirit.duration_minutes} min`;
  }

  return block.subtitle;
}
