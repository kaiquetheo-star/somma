import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  COMBAT_COMBOS,
  COMBAT_DEFAULTS,
  comboCalloutFull,
  comboCalloutDelayMs,
  isWorkBurnoutPhase,
  pickRandomComboCallout,
  type CombatCombo,
} from '@/constants/combat';
import { playRoundBell, playTenSecondWarning } from '@/lib/audio/combatAudio';
import { hapticPhaseChange, hapticRoundEnd } from '@/lib/haptics';
import type { CombatTacticalFocus } from '@/types/gameplan';
import type { CombatRoundLog } from '@/types/performance';

export type CombatPhase = 'idle' | 'work' | 'rest' | 'finished';

export interface CombatRoundConfig {
  combo: CombatCombo;
  workSeconds: number;
  restSeconds: number;
  tacticalFocus?: CombatTacticalFocus;
}

interface UseCombatIntervalOptions {
  rounds?: CombatRoundConfig[];
  workSeconds?: number;
  restSeconds?: number;
  totalRounds?: number;
}

function comboFromLibrary(combo: {
  id: string;
  combo_name: string;
  sequence: string[];
}): CombatCombo {
  return {
    id: combo.id,
    name: combo.combo_name,
    sequence: combo.sequence,
  };
}

export function useCombatInterval({
  rounds,
  workSeconds = COMBAT_DEFAULTS.workSeconds,
  restSeconds = COMBAT_DEFAULTS.restSeconds,
  totalRounds = COMBAT_DEFAULTS.totalRounds,
}: UseCombatIntervalOptions = {}) {
  const schedule = useMemo((): CombatRoundConfig[] => {
    if (rounds?.length) return rounds;
    return Array.from({ length: totalRounds }, (_, index) => ({
      combo: COMBAT_COMBOS[index % COMBAT_COMBOS.length]!,
      workSeconds,
      restSeconds,
    }));
  }, [rounds, totalRounds, workSeconds, restSeconds]);

  const [phase, setPhase] = useState<CombatPhase>('idle');
  const [currentRound, setCurrentRound] = useState(1);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [phaseEndsAtMs, setPhaseEndsAtMs] = useState<number | null>(null);
  const [roundLogs, setRoundLogs] = useState<CombatRoundLog[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [comboCallout, setComboCallout] = useState('');
  const [isBurnoutCadence, setIsBurnoutCadence] = useState(false);

  const comboCalloutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transitionLockRef = useRef(false);
  const tenSecondCueFiredRef = useRef(false);
  const workRoundKeyRef = useRef('');
  const phaseRef = useRef(phase);
  const isRunningRef = useRef(isRunning);
  const phaseEndsAtMsRef = useRef(phaseEndsAtMs);

  phaseRef.current = phase;
  isRunningRef.current = isRunning;
  phaseEndsAtMsRef.current = phaseEndsAtMs;

  const totalScheduledRounds = schedule.length;
  const activeRound =
    schedule[Math.min(currentRound - 1, schedule.length - 1)] ?? schedule[0];
  const currentCombo = activeRound?.combo ?? COMBAT_COMBOS[0]!;
  const activeWorkSeconds = activeRound?.workSeconds ?? workSeconds;
  const activeRestSeconds = activeRound?.restSeconds ?? restSeconds;
  const isResting = phase === 'rest';

  const clearComboCalloutTimer = useCallback(() => {
    if (comboCalloutTimerRef.current) {
      clearTimeout(comboCalloutTimerRef.current);
      comboCalloutTimerRef.current = null;
    }
  }, []);

  const armPhaseDeadline = useCallback((seconds: number) => {
    setTimeRemaining(seconds);
    setPhaseEndsAtMs(Date.now() + seconds * 1000);
  }, []);

  const transitionFromZero = useCallback(() => {
    if (transitionLockRef.current) return;
    if (phase === 'idle' || phase === 'finished') return;

    transitionLockRef.current = true;

    if (phase === 'work') {
      void playRoundBell();

      setRoundLogs((logs) => [
        ...logs,
        {
          round: currentRound,
          combo_name: currentCombo.name,
          work_seconds: activeWorkSeconds,
          rest_seconds: activeRestSeconds,
        },
      ]);

      if (currentRound >= totalScheduledRounds) {
        setPhase('finished');
        setIsRunning(false);
        setTimeRemaining(0);
        setPhaseEndsAtMs(null);
        setComboCallout('');
        setIsBurnoutCadence(false);
        clearComboCalloutTimer();
        hapticRoundEnd();
        transitionLockRef.current = false;
        return;
      }

      setPhase('rest');
      armPhaseDeadline(activeRestSeconds);
      hapticPhaseChange();
      transitionLockRef.current = false;
      return;
    }

    if (phase === 'rest') {
      const nextRound = schedule[currentRound];
      setCurrentRound((r) => r + 1);
      setPhase('work');
      armPhaseDeadline(nextRound?.workSeconds ?? workSeconds);
      hapticPhaseChange();
      void playRoundBell();
      transitionLockRef.current = false;
    }
  }, [
    phase,
    currentRound,
    currentCombo.name,
    activeWorkSeconds,
    activeRestSeconds,
    totalScheduledRounds,
    schedule,
    workSeconds,
    armPhaseDeadline,
    clearComboCalloutTimer,
  ]);

  useEffect(() => {
    if (!isRunning || phaseEndsAtMs == null || phase === 'idle' || phase === 'finished') {
      return;
    }

    const tick = () => {
      const left = Math.max(0, Math.ceil((phaseEndsAtMs - Date.now()) / 1000));
      setTimeRemaining(left);

      if (phase === 'work') {
        setIsBurnoutCadence(isWorkBurnoutPhase(left));
        if (left === 10 && !tenSecondCueFiredRef.current) {
          tenSecondCueFiredRef.current = true;
          void playTenSecondWarning();
        }
      }

      if (left <= 0) {
        transitionFromZero();
      }
    };

    tick();
    const interval = setInterval(tick, 200);
    return () => clearInterval(interval);
  }, [isRunning, phaseEndsAtMs, phase, transitionFromZero]);

  const scheduleComboCallout = useCallback(() => {
    clearComboCalloutTimer();
    if (phaseRef.current !== 'work' || !isRunningRef.current || phaseEndsAtMsRef.current == null) {
      return;
    }

    const scheduleNext = () => {
      if (
        phaseRef.current !== 'work' ||
        !isRunningRef.current ||
        phaseEndsAtMsRef.current == null
      ) {
        return;
      }

      const left = Math.max(0, Math.ceil((phaseEndsAtMsRef.current - Date.now()) / 1000));
      setComboCallout(pickRandomComboCallout(currentCombo.sequence));
      setIsBurnoutCadence(isWorkBurnoutPhase(left));

      if (left <= 0) return;

      const delay = comboCalloutDelayMs(left, activeWorkSeconds);
      comboCalloutTimerRef.current = setTimeout(scheduleNext, delay);
    };

    const endsAt = phaseEndsAtMsRef.current;
    setComboCallout(pickRandomComboCallout(currentCombo.sequence));
    const initialLeft = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
    setIsBurnoutCadence(isWorkBurnoutPhase(initialLeft));
    comboCalloutTimerRef.current = setTimeout(
      scheduleNext,
      comboCalloutDelayMs(initialLeft, activeWorkSeconds),
    );
  }, [currentCombo, activeWorkSeconds, clearComboCalloutTimer]);

  useEffect(() => {
    const roundKey = `${phase}-${currentRound}`;
    if (roundKey !== workRoundKeyRef.current) {
      workRoundKeyRef.current = roundKey;
      tenSecondCueFiredRef.current = false;
    }
  }, [phase, currentRound]);

  useEffect(() => {
    if (phase === 'work' && isRunning) {
      scheduleComboCallout();
      return () => clearComboCalloutTimer();
    }

    clearComboCalloutTimer();
    if (phase === 'work' && !isRunning) {
      return;
    }
    if (phase === 'idle' || phase === 'finished') {
      setComboCallout('');
      setIsBurnoutCadence(false);
      return;
    }
    setComboCallout(comboCalloutFull(currentCombo));
    setIsBurnoutCadence(false);
  }, [
    phase,
    isRunning,
    currentRound,
    currentCombo.id,
    scheduleComboCallout,
    clearComboCalloutTimer,
    currentCombo,
  ]);

  const start = useCallback(() => {
    transitionLockRef.current = false;
    tenSecondCueFiredRef.current = false;
    setCurrentRound(1);
    setRoundLogs([]);
    setPhase('work');
    setIsRunning(true);
    armPhaseDeadline(schedule[0]?.workSeconds ?? workSeconds);
    hapticPhaseChange();
    void playRoundBell();
  }, [schedule, workSeconds, armPhaseDeadline]);

  const pause = useCallback(() => {
    if (!isRunning || phaseEndsAtMs == null) {
      setIsRunning(false);
      return;
    }
    const left = Math.max(0, Math.ceil((phaseEndsAtMs - Date.now()) / 1000));
    setTimeRemaining(left);
    setPhaseEndsAtMs(null);
    setIsRunning(false);
    clearComboCalloutTimer();
  }, [isRunning, phaseEndsAtMs, clearComboCalloutTimer]);

  const resume = useCallback(() => {
    if (phase === 'idle' || phase === 'finished') return;
    setPhaseEndsAtMs(Date.now() + timeRemaining * 1000);
    setIsRunning(true);
    if (phase === 'work') {
      scheduleComboCallout();
    }
  }, [phase, timeRemaining, scheduleComboCallout]);

  const reset = useCallback(() => {
    transitionLockRef.current = false;
    tenSecondCueFiredRef.current = false;
    clearComboCalloutTimer();
    setIsRunning(false);
    setPhase('idle');
    setCurrentRound(1);
    setTimeRemaining(0);
    setPhaseEndsAtMs(null);
    setRoundLogs([]);
    setComboCallout('');
    setIsBurnoutCadence(false);
  }, [clearComboCalloutTimer]);

  const endSession = useCallback(() => {
    clearComboCalloutTimer();
    setIsRunning(false);
    setPhaseEndsAtMs(null);
    setPhase('finished');
    setTimeRemaining(0);
    setComboCallout('');
    setIsBurnoutCadence(false);
    void playRoundBell();
  }, [clearComboCalloutTimer]);

  return {
    phase,
    schedule,
    /** @deprecated use currentRound */
    round: currentRound,
    currentRound,
    totalRounds: totalScheduledRounds,
    /** @deprecated use timeRemaining */
    secondsLeft: timeRemaining,
    timeRemaining,
    phaseEndsAtMs,
    isResting,
    isBurnoutCadence,
    currentCombo,
    comboCallout,
    roundLogs,
    isRunning,
    start,
    pause,
    resume,
    reset,
    endSession,
    workSeconds: activeWorkSeconds,
    restSeconds: activeRestSeconds,
  };
}

export { comboFromLibrary };
