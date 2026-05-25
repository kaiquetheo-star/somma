import { resolveIronGoalType, type IronGoalType } from '@/lib/physics/rmCalculator';
import type { PerformanceLogEntry, WorkoutPillarLog } from '@/types/performance';

/** Map observed RIR (0–4) to session RPE scale (1–10). */
export function rirToRpe(rir: number): number {
  const clamped = Math.min(4, Math.max(0, Math.round(rir)));
  return Math.min(10, Math.max(1, 10 - clamped));
}

/** Inverse — approximate RIR from stored RPE when legacy rows lack reported_rir. */
export function rpeToRir(rpe: number): number {
  const clamped = Math.min(10, Math.max(1, Math.round(rpe)));
  return Math.min(4, Math.max(0, 10 - clamped));
}

export function effectiveRpeFromSet(set: {
  reported_rir?: number | null;
  target_rir?: number | null;
  rir?: number | null;
}): number | null {
  const observed = set.reported_rir ?? set.rir;
  if (observed != null && Number.isFinite(observed)) {
    return rirToRpe(observed);
  }
  return null;
}

export type LoadTelemetryPillar = 'iron' | 'combat' | 'spirit';

export interface PillarLoadMetrics {
  pillar: LoadTelemetryPillar;
  sessionCount: number;
  /** Mean session RPE (1–10) in the measurement window */
  rpeMean: number | null;
  rpeStdDev: number | null;
  /** Sum of session-RPE × duration (minutes) — Foster sRPE */
  sRpe7d: number;
  /** Sum of kg×reps (iron) or work seconds (combat) in 7d */
  volume7d: number;
  /** Acute (7d) / chronic (28d weekly average) workload ratio */
  acwr: number | null;
  acwrStatus: 'under' | 'optimal' | 'elevated' | 'spike' | 'insufficient';
}

export interface AcwrThresholds {
  spike: number;
  elevated: number;
  under: number;
  /** Short label for UI — e.g. Strength bias */
  label: string;
}

export interface TrainingLoadSnapshot {
  computedAt: string;
  pillars: Record<LoadTelemetryPillar, PillarLoadMetrics>;
  /** Volume-weighted mean RPE across iron + combat sessions (14d) */
  globalRpeMean: number | null;
  ironGoal: IronGoalType;
  ironAcwrThresholds: AcwrThresholds;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const ACUTE_DAYS = 7;
const CHRONIC_DAYS = 28;
const RPE_WINDOW_DAYS = 14;

/** Default ACWR bands (combat / spirit / legacy callers) */
export const ACWR_SPIKE = 1.5;
export const ACWR_ELEVATED = 1.3;
export const ACWR_UNDER = 0.8;

const COMBAT_ACWR_THRESHOLDS: AcwrThresholds = {
  spike: ACWR_SPIKE,
  elevated: ACWR_ELEVATED,
  under: ACWR_UNDER,
  label: 'Combat conditioning',
};

/** Goal-aware ACWR bands for iron internal load (research-informed defaults). */
export function resolveAcwrThresholds(goalIron: string | null | undefined): AcwrThresholds {
  const goal = resolveIronGoalType(goalIron);
  switch (goal) {
    case 'strength':
      return { spike: 1.35, elevated: 1.18, under: 0.85, label: 'Strength · tighter spike' };
    case 'hypertrophy':
      return { spike: 1.52, elevated: 1.32, under: 0.78, label: 'Hypertrophy · volume tolerant' };
    default:
      return { spike: 1.45, elevated: 1.25, under: 0.8, label: 'Balanced iron load' };
  }
}

export function resolveTelemetryRpeThresholds(goalIron: string | null | undefined): {
  chronicHighRpeMean: number;
  chronicLowRpeStdDev: number;
} {
  const goal = resolveIronGoalType(goalIron);
  if (goal === 'strength') {
    return { chronicHighRpeMean: 8.2, chronicLowRpeStdDev: 0.35 };
  }
  if (goal === 'hypertrophy') {
    return { chronicHighRpeMean: 8.6, chronicLowRpeStdDev: 0.45 };
  }
  return { chronicHighRpeMean: 8.5, chronicLowRpeStdDev: 0.4 };
}

interface SessionLoad {
  pillar: LoadTelemetryPillar;
  timestamp: number;
  rpe: number | null;
  durationMinutes: number;
  workload: number;
}

function dateKey(iso: string): string {
  return iso.slice(0, 10);
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function stdDev(values: number[]): number | null {
  if (values.length < 2) return null;
  const avg = mean(values);
  if (avg == null) return null;
  const variance =
    values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function acwrStatusFromRatio(
  ratio: number | null,
  thresholds: AcwrThresholds,
): PillarLoadMetrics['acwrStatus'] {
  if (ratio == null || !Number.isFinite(ratio)) return 'insufficient';
  if (ratio >= thresholds.spike) return 'spike';
  if (ratio >= thresholds.elevated) return 'elevated';
  if (ratio < thresholds.under) return 'under';
  return 'optimal';
}

function ironSessionFromEntry(entry: PerformanceLogEntry): SessionLoad | null {
  if (!entry.iron?.sets.length) return null;

  const sets = entry.iron.sets;
  const rpeSamples = sets
    .map((set) => effectiveRpeFromSet(set))
    .filter((rpe): rpe is number => rpe != null);

  const sessionRpe = mean(rpeSamples);
  const restSeconds = sets.reduce((sum, set) => sum + (set.rest_seconds_used ?? 0), 0);
  const durationMinutes = Math.max(1, (sets.length * 45 + restSeconds) / 60);
  const workload = sets.reduce(
    (sum, set) => sum + (set.weight_kg > 0 ? set.weight_kg * set.reps : set.reps),
    0,
  );

  return {
    pillar: 'iron',
    timestamp: Date.parse(entry.timestamp),
    rpe: sessionRpe,
    durationMinutes,
    workload,
  };
}

function combatSessionFromEntry(entry: PerformanceLogEntry): SessionLoad | null {
  if (!entry.combat) return null;
  const rounds = entry.combat.rounds ?? [];
  const workSeconds = rounds.reduce((sum, round) => sum + round.work_seconds, 0);
  const durationMinutes = Math.max(1, (workSeconds + rounds.length * 30) / 60);
  const rpe = entry.combat.rpe_score;

  return {
    pillar: 'combat',
    timestamp: Date.parse(entry.combat.completed_at ?? entry.timestamp),
    rpe: rpe != null && Number.isFinite(rpe) ? rpe : null,
    durationMinutes,
    workload: workSeconds > 0 ? workSeconds : rounds.length * 180,
  };
}

function spiritSessionFromEntry(entry: PerformanceLogEntry): SessionLoad | null {
  if (!entry.spirit) return null;
  const seconds = entry.spirit.total_seconds ?? 0;
  return {
    pillar: 'spirit',
    timestamp: Date.parse(entry.spirit.completed_at ?? entry.timestamp),
    rpe: 6,
    durationMinutes: Math.max(1, seconds / 60),
    workload: seconds,
  };
}

function sessionsFromLogs(entries: PerformanceLogEntry[]): SessionLoad[] {
  const sessions: SessionLoad[] = [];
  for (const entry of entries) {
    if (entry.pillar === 'iron') {
      const session = ironSessionFromEntry(entry);
      if (session) sessions.push(session);
    } else if (entry.pillar === 'combat') {
      const session = combatSessionFromEntry(entry);
      if (session) sessions.push(session);
    } else if (entry.pillar === 'spirit') {
      const session = spiritSessionFromEntry(entry);
      if (session) sessions.push(session);
    }
  }
  return sessions.sort((a, b) => b.timestamp - a.timestamp);
}

function filterSessionsByDays(sessions: SessionLoad[], days: number, now = Date.now()): SessionLoad[] {
  const cutoff = now - days * MS_PER_DAY;
  return sessions.filter((session) => session.timestamp >= cutoff);
}

function sessionSRpe(session: SessionLoad): number {
  const rpe = session.rpe ?? 7;
  return rpe * session.durationMinutes;
}

function computeAcwr(sessions: SessionLoad[], now = Date.now()): number | null {
  const acute = filterSessionsByDays(sessions, ACUTE_DAYS, now);
  const chronic = filterSessionsByDays(sessions, CHRONIC_DAYS, now);

  if (acute.length === 0) return null;

  const acuteLoad = acute.reduce((sum, session) => sum + sessionSRpe(session), 0);
  const chronicTotal = chronic.reduce((sum, session) => sum + sessionSRpe(session), 0);
  const chronicWeeklyAvg = chronicTotal / (CHRONIC_DAYS / 7);

  if (chronicWeeklyAvg <= 0) return null;
  return Math.round((acuteLoad / chronicWeeklyAvg) * 100) / 100;
}

function buildPillarMetrics(
  pillar: LoadTelemetryPillar,
  sessions: SessionLoad[],
  acwrThresholds: AcwrThresholds,
  now = Date.now(),
): PillarLoadMetrics {
  const pillarSessions = sessions.filter((session) => session.pillar === pillar);
  const windowSessions = filterSessionsByDays(pillarSessions, RPE_WINDOW_DAYS, now);
  const acuteSessions = filterSessionsByDays(pillarSessions, ACUTE_DAYS, now);

  const rpeValues = windowSessions
    .map((session) => session.rpe)
    .filter((rpe): rpe is number => rpe != null);

  const acwr = computeAcwr(pillarSessions, now);

  return {
    pillar,
    sessionCount: windowSessions.length,
    rpeMean: mean(rpeValues) != null ? Math.round(mean(rpeValues)! * 10) / 10 : null,
    rpeStdDev: stdDev(rpeValues) != null ? Math.round(stdDev(rpeValues)! * 100) / 100 : null,
    sRpe7d: Math.round(acuteSessions.reduce((sum, session) => sum + sessionSRpe(session), 0)),
    volume7d: Math.round(acuteSessions.reduce((sum, session) => sum + session.workload, 0)),
    acwr,
    acwrStatus: acwrStatusFromRatio(acwr, acwrThresholds),
  };
}

export interface ComputeTrainingLoadOptions {
  now?: number;
  goalIron?: string | null;
}

export function computeTrainingLoadSnapshot(
  entries: PerformanceLogEntry[],
  options: ComputeTrainingLoadOptions | number = {},
): TrainingLoadSnapshot {
  const now = typeof options === 'number' ? options : (options.now ?? Date.now());
  const goalIron = typeof options === 'number' ? null : options.goalIron;
  const ironGoal = resolveIronGoalType(goalIron);
  const ironAcwrThresholds = resolveAcwrThresholds(goalIron);

  const sessions = sessionsFromLogs(entries);
  const iron = buildPillarMetrics('iron', sessions, ironAcwrThresholds, now);
  const combat = buildPillarMetrics('combat', sessions, COMBAT_ACWR_THRESHOLDS, now);
  const spirit = buildPillarMetrics('spirit', sessions, COMBAT_ACWR_THRESHOLDS, now);

  const globalSamples = filterSessionsByDays(sessions, RPE_WINDOW_DAYS, now)
    .filter((session) => session.pillar === 'iron' || session.pillar === 'combat')
    .map((session) => session.rpe)
    .filter((rpe): rpe is number => rpe != null);

  return {
    computedAt: new Date(now).toISOString(),
    pillars: { iron, combat, spirit },
    globalRpeMean: mean(globalSamples) != null ? Math.round(mean(globalSamples)! * 10) / 10 : null,
    ironGoal,
    ironAcwrThresholds,
  };
}

/** Suggested average RPE for Clinical Exit Interview (iron + combat, 21d). */
export function suggestedAverageRpeForClinicalReview(entries: PerformanceLogEntry[]): number | null {
  const sessions = sessionsFromLogs(entries).filter(
    (session) =>
      (session.pillar === 'iron' || session.pillar === 'combat') &&
      session.timestamp >= Date.now() - 21 * MS_PER_DAY,
  );
  const rpeValues = sessions
    .map((session) => session.rpe)
    .filter((rpe): rpe is number => rpe != null);
  const avg = mean(rpeValues);
  return avg != null ? Math.round(avg * 10) / 10 : null;
}

function acwrStatusSuffix(status: PillarLoadMetrics['acwrStatus']): string {
  switch (status) {
    case 'spike':
      return ' · spike';
    case 'elevated':
      return ' · elevated';
    case 'under':
      return ' · underreach';
    default:
      return '';
  }
}

export function formatPillarTelemetryLine(metrics: PillarLoadMetrics): string {
  const parts: string[] = [];
  if (metrics.acwr != null) {
    parts.push(`ACWR ${metrics.acwr.toFixed(2)}${acwrStatusSuffix(metrics.acwrStatus)}`);
  }
  if (metrics.rpeStdDev != null) {
    parts.push(`RPE σ ${metrics.rpeStdDev.toFixed(2)}`);
  } else if (metrics.rpeMean != null) {
    parts.push(`RPE ${metrics.rpeMean.toFixed(1)}`);
  }
  if (parts.length === 0) return `${capitalize(metrics.pillar)} · log sessions to calibrate`;
  return `${capitalize(metrics.pillar)} · ${parts.join(' · ')}`;
}

export function formatIronAcwrThresholdCaption(thresholds: AcwrThresholds): string {
  return `${thresholds.label} · spike ≥${thresholds.spike.toFixed(2)} · elevated ≥${thresholds.elevated.toFixed(2)}`;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function formatExerciseProgressionHint(
  entries: PerformanceLogEntry[],
  exerciseId: string,
  prescribedRir: number,
): string | null {
  const entry = entries.find(
    (row) => row.pillar === 'iron' && row.iron?.exercise_id === exerciseId,
  );
  const lastSet = entry?.iron?.sets[entry.iron.sets.length - 1];
  if (!lastSet) return null;

  const reported = lastSet.reported_rir ?? lastSet.rir;
  if (reported == null) return null;

  const rpe = rirToRpe(reported);
  if (rpe >= 9) return `Last set · ${reported} RIR · deload or +1 RIR next`;
  if (rpe <= 8 && reported <= prescribedRir) {
    return `Last set · ${reported} RIR · +2.5% load eligible`;
  }
  return `Last set · ${reported} RIR · hold load`;
}

/** Highest-priority autoreg signal from load telemetry (for Head Coach). */
export function telemetrySuggestsPoorRecovery(
  snapshot: TrainingLoadSnapshot,
  goalIron?: string | null,
): boolean {
  const iron = snapshot.pillars.iron;
  const combat = snapshot.pillars.combat;
  const rpeBands = resolveTelemetryRpeThresholds(goalIron);

  if (iron.acwrStatus === 'spike' || combat.acwrStatus === 'spike') return true;
  if (
    iron.rpeMean != null &&
    iron.rpeMean >= rpeBands.chronicHighRpeMean &&
    (iron.rpeStdDev ?? 1) < rpeBands.chronicLowRpeStdDev
  ) {
    return true;
  }
  if (combat.rpeMean != null && combat.rpeMean >= 9) return true;
  return false;
}

export function yesterdayEffectiveRpe(
  entries: PerformanceLogEntry[],
  now = Date.now(),
): { rpe: number | null; pillar: WorkoutPillarLog | null } {
  const yesterdayKey = dateKey(new Date(now - MS_PER_DAY).toISOString());
  const sessions = sessionsFromLogs(entries).filter(
    (session) => dateKey(new Date(session.timestamp).toISOString()) === yesterdayKey,
  );
  const main = sessions[0];
  if (!main) return { rpe: null, pillar: null };
  return { rpe: main.rpe, pillar: main.pillar };
}
