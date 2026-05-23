export type WorkoutPillar = 'iron' | 'combat' | 'spirit';

export type GameplanBlockStatus = 'pending' | 'active' | 'completed';

export type IronExecutionTechnique =
  | 'Standard'
  | 'Myo-Reps'
  | 'Rest-Pause'
  | 'Slow Eccentric (4s)'
  | 'Drop Set'
  | 'Cluster Sets'
  | (string & {});

export interface IronExercisePrescription {
  exercise_id: string;
  target_sets: number;
  /** Upper bound of rep range (logging compatibility) */
  target_reps: number;
  target_weight_kg: number | null;
  /** e.g. "8-10 @ 2 RIR" */
  target_rep_range?: string;
  /** Reps in reserve (0–4) */
  target_rir?: number;
  /** Inter-set rest from CNS cost — compounds 120–180s, isolation 60–90s */
  rest_seconds?: number;
  /** Pre-mapped Adapt swap — same primary_muscle, ≤ CNS cost */
  alternative_exercise_id?: string | null;
  progression_note?: string;
  execution_technique?: IronExecutionTechnique;
}

export interface IronBlockPrescription {
  routine_id?: string;
  exercises: IronExercisePrescription[];
}

/** Tactical intent for Blood & Bone rounds (mirrors library_combat.tactical_focus) */
export type CombatTacticalFocus =
  | 'footwork_range'
  | 'power_inside'
  | 'defense_counter'
  | 'burnout';

/** AI narrative arc — which rounds train which tactical lane */
export interface CombatRoundStructureEntry {
  /** First round in segment (1-based, inclusive) */
  round_start: number;
  /** Last round in segment (1-based, inclusive) */
  round_end: number;
  tactical_focus: CombatTacticalFocus;
  /** Coach-facing intent for the segment, e.g. "Establish range with teeps" */
  coach_intent?: string;
}

export interface CombatRoundPrescription {
  round_index: number;
  combo_id: string;
  work_seconds: number;
  rest_seconds: number;
  /** Per-round tactical lane — must align with rounds_structure segment */
  tactical_focus: CombatTacticalFocus;
}

export interface CombatBlockPrescription {
  /** Prescribed session narrative (e.g. R1 footwork_range, R2–3 power_inside) */
  rounds_structure: CombatRoundStructureEntry[];
  rounds: CombatRoundPrescription[];
}

export const COMBAT_TACTICAL_FOCUS_LABELS: Record<CombatTacticalFocus, string> = {
  footwork_range: 'Footwork & Range',
  power_inside: 'Power Inside',
  defense_counter: 'Defense & Counter',
  burnout: 'Burnout Finisher',
};

/** Arena display — uppercase Quiet Luxury lane label */
export const COMBAT_TACTICAL_FOCUS_DISPLAY: Record<CombatTacticalFocus, string> = {
  footwork_range: 'FOCUS: FOOTWORK & RANGE',
  power_inside: 'FOCUS: POWER INSIDE',
  defense_counter: 'FOCUS: DEFENSE & COUNTER',
  burnout: 'FOCUS: BURNOUT FINISHER',
};

/** Recovery zones mirrored from library_flow_spirit.target_recovery_zones */
export type RecoveryZone =
  | 'lower_back'
  | 'hips'
  | 'glutes'
  | 'hamstrings'
  | 'shoulders'
  | 'thoracic_spine'
  | 'neck'
  | 'ankles'
  | 'wrists'
  | (string & {});

/** Single prescribed asana / mobility hold in a Flow block */
export interface FlowAsanaPrescription {
  asana_id: string;
  slug: string;
  name: string;
  order: number;
  hold_seconds: number;
  target_recovery_zones: RecoveryZone[];
  is_dynamic_flow: boolean;
}

export interface SpiritBlockPrescription {
  mode: 'flow' | 'breathwork';
  /** Breathwork tempo catalog id — omit when mode is flow */
  tempo_id?: string;
  duration_minutes: number;
  prescribed_reason?: string;
  /** Aggregate zones the healer targeted from 48h Iron + Combat load */
  recovery_focus_zones?: RecoveryZone[];
  /** Ordered asana sequence when mode is flow */
  asanas?: FlowAsanaPrescription[];
  /** AI alias for `asanas` — same ordered flow sequence */
  sequence?: FlowAsanaPrescription[];
}

export interface GameplanBlock {
  id: string;
  pillar: WorkoutPillar;
  title: string;
  subtitle: string;
  duration_minutes: number;
  order: number;
  status: GameplanBlockStatus;
  iron?: IronBlockPrescription;
  combat?: CombatBlockPrescription;
  spirit?: SpiritBlockPrescription;
}

/** One day in the 7-day Head Coach microcycle (day_index 1 = Monday … 7 = Sunday) */
export interface MicrocycleDay {
  day_index: number;
  is_rest_day: boolean;
  focus_label: string;
  /** All training blocks completed for this calendar day */
  is_completed?: boolean;
  /** Calendar date (YYYY-MM-DD) when week_start_date is known */
  date?: string;
  blocks: GameplanBlock[];
}

export interface DailyGameplan {
  /** ISO date key (YYYY-MM-DD) — "today" for the command surface */
  date: string;
  /** Monday anchoring the microcycle week */
  week_start_date?: string;
  training_days_per_week?: number;
  /** Full 7-day plan from the AI clinic */
  microcycle: MicrocycleDay[];
  /** Today's ritual blocks (derived from microcycle or legacy single-day payload) */
  blocks: GameplanBlock[];
  generated_at: string;
}
