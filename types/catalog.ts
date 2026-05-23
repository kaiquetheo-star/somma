/**
 * SOMMA Encyclopedia catalog types — `library_exercises`, `library_combat`, `library_flow_spirit`
 * Visual assets: CDN / Supabase Storage loops (MP4 · WebP · GIF)
 */

import type { CombatTacticalFocus } from '@/types/gameplan';

/** Movement demo renderer — maps to `visual_asset_type` column */
export type VisualAssetType = 'mp4' | 'webm' | 'gif' | 'webp';

/** Legacy DB values — not rendered by ModularMovementPlayer */
export type LegacyVisualAssetType = 'lottie' | 'svg';

/** Shared visual fields on all library catalog rows */
export interface LibraryVisualAsset {
  /** Public CDN or Supabase Storage URL for a short movement loop */
  visual_asset_url: string | null;
  visual_asset_type: VisualAssetType | null;
}

const MODULAR_VISUAL_TYPES = new Set<string>(['mp4', 'webm', 'gif', 'webp']);

export function parseLibraryVisualAsset(row: Record<string, unknown>): LibraryVisualAsset {
  const visual_asset_url =
    typeof row.visual_asset_url === 'string' && row.visual_asset_url.trim()
      ? row.visual_asset_url.trim()
      : null;

  const typeRaw = row.visual_asset_type;
  const visual_asset_type: VisualAssetType | null =
    typeof typeRaw === 'string' && MODULAR_VISUAL_TYPES.has(typeRaw)
      ? (typeRaw as VisualAssetType)
      : null;

  return { visual_asset_url, visual_asset_type };
}

/** Known joint stress tags — DB allows any text; extend as catalog grows */
export type JointStressProfile =
  | 'low_impact'
  | 'moderate_knee_stress'
  | 'high_knee_shear'
  | 'lumbar_shear'
  | 'spinal_axial_load'
  | 'rotator_cuff_heavy'
  | 'shoulder_impingement_risk'
  | 'hip_flexion_intense'
  | 'wrist_stress'
  | 'cervical_load'
  | (string & {});

export type MovementPattern =
  | 'push'
  | 'pull'
  | 'hinge'
  | 'squat'
  | 'lunge'
  | 'carry'
  | 'isolation'
  | (string & {});

/** Biomechanical metadata for Elite Hypertrophy coaching / AI Experts */
export interface IronExerciseBiomechanics {
  primary_muscle: string | null;
  synergist_muscles: string[];
  /** 1 = minimal CNS cost · 5 = heavy axial / compound fatigue */
  cns_fatigue_cost: number | null;
  joint_stress_profile: JointStressProfile | null;
  /** Peak tension biased toward lengthened position (stretch-mediated hypertrophy) */
  stretch_mediated_hypertrophy: boolean;
}

export interface LibraryExerciseBase extends LibraryVisualAsset {
  id: string;
  slug: string;
  name: string;
  biomechanical_instructions: Record<string, string>;
  equipment_required: string[];
  default_sets: number;
  default_reps: number;
  movement_pattern: MovementPattern | null;
}

export type LibraryExercise = LibraryExerciseBase & IronExerciseBiomechanics;

/** Blood & Bone combo — maps to `library_combat` */
export interface LibraryCombatCombo extends LibraryVisualAsset {
  id: string;
  slug: string;
  combo_name: string;
  sequence: string[];
  complexity_level: number;
  tactical_focus: CombatTacticalFocus;
}

/** Flow / Spirit session — maps to `library_flow_spirit` */
export interface LibraryFlowSpiritSession extends LibraryVisualAsset {
  id: string;
  slug: string;
  pillar: 'flow' | 'spirit';
  session_name: string;
  description: string | null;
  duration_minutes: number;
  tempo_profile: Record<string, unknown>;
  complexity_level: number;
  target_recovery_zones: string[];
  complexity_tier: number;
  is_dynamic_flow: boolean;
  default_hold_seconds: number;
}

export function formatCnsFatigueCost(cost: number | null): string {
  if (cost == null) return '—';
  const labels: Record<number, string> = {
    1: 'Minimal',
    2: 'Low',
    3: 'Moderate',
    4: 'High',
    5: 'Severe',
  };
  return `${cost} · ${labels[cost] ?? 'Unknown'}`;
}

export function formatJointStress(profile: string | null): string {
  if (!profile) return '—';
  return profile.replace(/_/g, ' ');
}

/** Dynamic rest from catalog CNS fatigue cost (Elite hypertrophy) */
export function computeRestSecondsFromCns(cnsFatigueCost: number | null): number {
  const cost = cnsFatigueCost ?? 3;
  if (cost >= 5) return 180;
  if (cost >= 4) return 150;
  if (cost >= 3) return 105;
  if (cost >= 2) return 75;
  return 60;
}

export const HYPERTROPHY_MEV_SETS = 10;
export const HYPERTROPHY_MRV_SOFT = 18;
export const HYPERTROPHY_MRV_HARD = 20;
