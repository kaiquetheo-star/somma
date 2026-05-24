export interface CombatCombo {
  id: string;
  name: string;
  sequence: string[];
}

export const COMBAT_COMBOS: CombatCombo[] = [
  {
    id: 'fundamentals',
    name: 'Fundamentals',
    sequence: ['Jab', 'Cross', 'Hook', 'Low Kick'],
  },
  {
    id: 'pressure',
    name: 'Pressure',
    sequence: ['Jab', 'Jab', 'Cross', 'Hook'],
  },
  {
    id: 'southpaw',
    name: 'Southpaw Flow',
    sequence: ['Cross', 'Hook', 'Uppercut', 'Low Kick'],
  },
  {
    id: 'clinch-exit',
    name: 'Clinch Exit',
    sequence: ['Elbow', 'Knee', 'Cross', 'Low Kick'],
  },
];

export const COMBAT_DEFAULTS = {
  workSeconds: 180,
  restSeconds: 60,
  totalRounds: 3,
} as const;

/** Blood & Bone arena — work round vs rest (readable @ 2m) */
export const COMBAT_ARENA = {
  obsidian: '#0F1512',
  workCopper: '#4A1C15',
  textPrimary: '#E8E4DC',
  textMuted: '#6B7568',
} as const;

/** Adaptive cadence — build phase (first half of work round) */
export const COMBAT_CADENCE_BUILD_MIN_MS = 6000;
export const COMBAT_CADENCE_BUILD_MAX_MS = 8000;

/** Final 30s of work — cardiovascular burnout callouts */
export const COMBAT_CADENCE_BURNOUT_WINDOW_SEC = 30;
export const COMBAT_CADENCE_BURNOUT_MIN_MS = 3000;
export const COMBAT_CADENCE_BURNOUT_MAX_MS = 4000;

export function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function comboDisplayText(combo: CombatCombo): string {
  return combo.sequence.map((s) => s.toUpperCase()).join(' — ');
}

/** Full sequence callout (idle / rest) */
export function comboCalloutFull(combo: CombatCombo): string {
  return combo.sequence.map((s) => s.toUpperCase()).join(' - ');
}

/** Random contiguous pad-work callout from a catalog sequence (deterministic by tick index) */
export function pickDeterministicComboCallout(sequence: string[], tick = 0): string {
  if (!sequence.length) return '';
  const maxLen = Math.min(sequence.length, 4);
  const len = Math.max(2, (tick % (maxLen - 1)) + 2);
  const start = tick % sequence.length;
  const slice: string[] = [];
  for (let i = 0; i < len; i += 1) {
    slice.push(sequence[(start + i) % sequence.length]!);
  }
  return slice.map((s) => s.toUpperCase()).join(' - ');
}

/** @deprecated Use pickDeterministicComboCallout */
export function pickRandomComboCallout(sequence: string[]): string {
  return pickDeterministicComboCallout(sequence, 0);
}

/** True during the final 30 seconds of a work round */
export function isWorkBurnoutPhase(timeRemainingSec: number): boolean {
  return (
    timeRemainingSec > 0 && timeRemainingSec <= COMBAT_CADENCE_BURNOUT_WINDOW_SEC
  );
}

/** True during the first half of a work round (by time remaining) */
export function isWorkBuildPhase(timeRemainingSec: number, workSeconds: number): boolean {
  return timeRemainingSec > workSeconds / 2;
}

function midpointMs(min: number, max: number): number {
  return Math.round((min + max) / 2);
}

/**
 * Adaptive combo caller interval from seconds left in the work round.
 * Build: 6–8s · Burnout window (≤30s): 3–4s · Mid-round: 6–8s until burnout.
 */
export function comboCalloutDelayMs(
  timeRemainingSec: number,
  workSeconds: number,
): number {
  if (isWorkBurnoutPhase(timeRemainingSec)) {
    return midpointMs(COMBAT_CADENCE_BURNOUT_MIN_MS, COMBAT_CADENCE_BURNOUT_MAX_MS);
  }
  if (isWorkBuildPhase(timeRemainingSec, workSeconds)) {
    return midpointMs(COMBAT_CADENCE_BUILD_MIN_MS, COMBAT_CADENCE_BUILD_MAX_MS);
  }
  return midpointMs(COMBAT_CADENCE_BUILD_MIN_MS, COMBAT_CADENCE_BUILD_MAX_MS);
}
