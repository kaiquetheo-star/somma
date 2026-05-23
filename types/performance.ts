export type WorkoutPillarLog = 'iron' | 'combat' | 'flow' | 'spirit';

export interface IronSetLog {
  set_index: number;
  weight_kg: number;
  reps: number;
  target_reps: number;
  /** Reps in reserve at set completion (0–4) */
  rir?: number | null;
  rest_seconds_used: number;
  logged_at: string;
}

export interface IronSessionLog {
  block_id: string;
  exercise_name: string;
  exercise_id: string;
  sets: IronSetLog[];
  completed_at: string;
}

export interface CombatRoundLog {
  round: number;
  combo_name: string;
  work_seconds: number;
  rest_seconds: number;
}

export interface CombatSessionLog {
  block_id: string;
  rounds: CombatRoundLog[];
  rpe_score: number | null;
  completed_at: string;
}

export interface SpiritSessionLog {
  block_id: string;
  tempo_id: string;
  tempo_name: string;
  cycles_completed: number;
  total_seconds: number;
  completed_at: string;
}

export interface PerformanceLogEntry {
  id: string;
  pillar: WorkoutPillarLog;
  block_id: string;
  iron?: IronSessionLog;
  combat?: CombatSessionLog;
  spirit?: SpiritSessionLog;
  timestamp: string;
}

export interface WorkoutCompletionInput {
  block_id: string;
  pillar: WorkoutPillarLog;
  rpe_score?: number | null;
  volume?: number | null;
  exercise_id?: string | null;
  weight_used?: number | null;
  reps_completed?: number | null;
  actual_rest_seconds?: number | null;
  /** Iron set sync metadata */
  target_rir?: number | null;
}

export type PerformanceSyncKind = 'block_complete' | 'iron_set';

export interface PerformanceQueueItem {
  id: string;
  kind?: PerformanceSyncKind;
  input: WorkoutCompletionInput;
  session: PerformanceLogEntry | null;
  /** Present when kind is iron_set — one row per logged set */
  iron_set?: IronSetLog;
  created_at: string;
}

export interface E1rmUnlock {
  exercise_id: string;
  exercise_name: string;
  e1rm_kg: number;
  previous_best_kg: number | null;
}

/** Premium post-workout summary — shown when a microcycle day is fully complete */
export interface WorkoutSessionSummary {
  day_index: number;
  focus_label: string;
  total_volume_kg: number;
  cns_fatigue_total: number;
  e1rm_unlocks: E1rmUnlock[];
  completed_at: string;
}

export interface LogIronSetInput {
  block_id: string;
  exercise_id: string;
  exercise_name: string;
  set: IronSetLog;
  target_rir?: number | null;
}
