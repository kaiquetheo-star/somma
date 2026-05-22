import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  CombatIntervalClock,
  CombatTimerPreview,
} from '@/components/combat/CombatIntervalClock';
import { RpeSelector } from '@/components/combat/RpeSelector';
import { COMBAT_ARENA, COMBAT_DEFAULTS, formatTimer } from '@/constants/combat';
import { useActiveGameplanBlock } from '@/hooks/useActiveGameplanBlock';
import {
  comboFromLibrary,
  useCombatInterval,
  type CombatRoundConfig,
} from '@/hooks/useCombatInterval';
import { useWorkoutNavigation } from '@/hooks/useWorkoutNavigation';
import {
  prepareCombatAudio,
  releaseCombatAudio,
} from '@/lib/audio/combatAudio';
import {
  COMBAT_TACTICAL_FOCUS_DISPLAY,
  COMBAT_TACTICAL_FOCUS_LABELS,
} from '@/types/gameplan';
import {
  fetchLibraryCombat,
  filterCombatByMastery,
  filterCombatByTacticalFocus,
  getCombatComboById,
  type LibraryCombatCombo,
} from '@/lib/catalog/library';
import { useSommaStore } from '@/store/useSommaStore';

const DEFAULT_END_RPE = 7;

export default function CombatModeScreen() {
  const router = useRouter();
  const { blockId, title } = useLocalSearchParams<{ blockId?: string; title?: string }>();
  const activeBlock = useActiveGameplanBlock(blockId);
  const combatMastery = useSommaStore((state) => state.user_stats.combat_mastery);
  const { finishBlock } = useWorkoutNavigation();
  const appendCombatSession = useSommaStore((state) => state.appendCombatSession);

  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalog, setCatalog] = useState<LibraryCombatCombo[]>([]);
  const [rpe, setRpe] = useState<number | null>(null);
  const [showRpeGate, setShowRpeGate] = useState(false);

  const resolvedBlockId = blockId ?? 'block-main-combat';
  const arenaTint = useSharedValue(0);

  useEffect(() => {
    let mounted = true;
    void fetchLibraryCombat()
      .then((rows) => {
        if (mounted) setCatalog(rows);
      })
      .finally(() => {
        if (mounted) setCatalogLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const roundSchedule = useMemo((): CombatRoundConfig[] | undefined => {
    const rounds = activeBlock?.combat?.rounds;
    if (!rounds?.length || catalog.length === 0) return undefined;

    const eligible = filterCombatByMastery(catalog, combatMastery);

    return rounds.flatMap((round) => {
      const focusPool = filterCombatByTacticalFocus(eligible, round.tactical_focus);
      // Fall back to the full eligible pool when no combos match the tactical focus,
      // then to the full catalog, so every round in the prescription gets a combo
      // rather than being silently dropped.
      const pool = focusPool.length > 0 ? focusPool : eligible.length > 0 ? eligible : catalog;
      const combo =
        getCombatComboById(catalog, round.combo_id) ??
        (pool.length > 0 ? pool[round.round_index % pool.length] : null);
      if (!combo) return [];
      return [
        {
          combo: comboFromLibrary(combo),
          workSeconds: round.work_seconds,
          restSeconds: round.rest_seconds,
          tacticalFocus: round.tactical_focus,
        },
      ];
    });
  }, [activeBlock?.combat?.rounds, catalog, combatMastery]);

  const {
    phase,
    currentRound,
    totalRounds,
    timeRemaining,
    phaseEndsAtMs,
    isResting,
    currentCombo,
    comboCallout,
    roundLogs,
    isRunning,
    start,
    endSession,
    workSeconds,
    restSeconds,
  } = useCombatInterval({ rounds: roundSchedule });

  useEffect(() => {
    void prepareCombatAudio();
    return () => {
      releaseCombatAudio();
    };
  }, []);

  useEffect(() => {
    const target = phase === 'work' ? 1 : 0;
    arenaTint.value = withTiming(target, {
      duration: 900,
      easing: Easing.inOut(Easing.cubic),
    });
  }, [phase, arenaTint]);

  const arenaStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      arenaTint.value,
      [0, 1],
      [COMBAT_ARENA.obsidian, COMBAT_ARENA.workCopper],
    ),
  }));

  const activeTacticalFocus = useMemo(() => {
    // round_index is 0-based in the prescription; currentRound is 1-based in the hook.
    const round = activeBlock?.combat?.rounds?.find((r) => r.round_index === currentRound - 1);
    return round?.tactical_focus ?? roundSchedule?.[currentRound - 1]?.tacticalFocus;
  }, [activeBlock?.combat?.rounds, currentRound, roundSchedule]);

  const activeCoachIntent = useMemo(() => {
    const structure = activeBlock?.combat?.rounds_structure;
    if (!structure?.length) return null;
    return (
      structure.find(
        (segment) =>
          currentRound >= segment.round_start && currentRound <= segment.round_end,
      )?.coach_intent ?? null
    );
  }, [activeBlock?.combat?.rounds_structure, currentRound]);

  const displayCombo =
    phase === 'work' && comboCallout
      ? comboCallout
      : phase === 'rest'
        ? 'REST'
        : comboCallout || currentCombo.sequence.map((s) => s.toUpperCase()).join(' - ');

  const sessionActive = phase === 'work' || phase === 'rest';
  const canSync = phase === 'finished' && roundLogs.length > 0;

  useEffect(() => {
    if (phase === 'finished') setShowRpeGate(true);
  }, [phase]);

  const handleEndSession = () => {
    if (sessionActive) {
      endSession();
      return;
    }
    if (!canSync) return;
    syncAndAscend(rpe ?? DEFAULT_END_RPE);
  };

  const syncAndAscend = (rpeScore: number) => {
    const volume = roundLogs.reduce((sum, entry) => sum + entry.work_seconds, 0);
    appendCombatSession({
      block_id: resolvedBlockId,
      rounds: roundLogs,
      rpe_score: rpeScore,
      completed_at: new Date().toISOString(),
    });
    finishBlock(resolvedBlockId, {
      pillar: 'combat',
      rpe_score: rpeScore,
      volume,
    });
  };

  if (catalogLoading && activeBlock?.combat?.rounds?.length) {
    return (
      <View className="flex-1 items-center justify-center bg-obsidian">
        <StatusBar style="light" />
        <ActivityIndicator color="#BFA06A" />
        <Text className="mt-4 font-body text-sm text-[#8A9488]">Loading combo encyclopedia…</Text>
      </View>
    );
  }

  return (
    <Animated.View style={[{ flex: 1 }, arenaStyle]}>
      <StatusBar style="light" />
      <SafeAreaView className="flex-1 px-5 pb-6 pt-2">
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Exit combat"
          className="self-start py-2 active:opacity-60"
        >
          <Text className="font-body text-[10px] uppercase tracking-[0.35em] text-[#6B7568]">
            Exit
          </Text>
        </Pressable>

        <View className="mt-2 flex-row items-center justify-between">
          <Text className="font-body text-[10px] uppercase tracking-[0.4em] text-matte-gold/80">
            Blood & Bone
          </Text>
          {sessionActive || phase === 'finished' ? (
            <Text className="font-body text-[10px] uppercase tracking-[0.3em] text-[#8A9488]">
              {phase === 'finished'
                ? 'Complete'
                : isResting
                  ? `Rest · ${currentRound}/${totalRounds}`
                  : `Round ${currentRound}/${totalRounds}`}
            </Text>
          ) : null}
        </View>

        <View className="flex-1 justify-between pt-6">
          <View className="items-center">
            {phase === 'idle' ? (
              <CombatTimerPreview seconds={workSeconds} />
            ) : (
              <CombatIntervalClock
                endsAtMs={phaseEndsAtMs}
                isRunning={isRunning}
                frozenSeconds={timeRemaining}
              />
            )}
            {sessionActive ? (
              <Text className="mt-3 font-body text-xs uppercase tracking-[0.45em] text-[#8A9488]">
                {isResting ? 'Recovery' : isRunning ? 'Work' : 'Paused'}
              </Text>
            ) : phase === 'idle' ? (
              <Text className="mt-3 font-body text-xs uppercase tracking-[0.35em] text-[#6B7568]">
                {totalRounds} rounds · {formatTimer(workSeconds)} work /{' '}
                {formatTimer(restSeconds)} rest
              </Text>
            ) : null}
          </View>

          <View className="min-h-[140px] flex-1 items-center justify-center px-2">
            {sessionActive && activeTacticalFocus && phase === 'work' ? (
              <Text
                className="mb-5 text-center font-body text-[11px] uppercase tracking-[0.32em] text-[#8A9488]"
                style={{ letterSpacing: 3.2 }}
              >
                {COMBAT_TACTICAL_FOCUS_DISPLAY[activeTacticalFocus]}
              </Text>
            ) : null}
            <Text
              className="text-center font-body-medium uppercase leading-[1.12] text-[#E8E4DC]"
              style={{
                fontSize: phase === 'work' ? 32 : 26,
                fontFamily: 'Inter_500Medium',
                letterSpacing: phase === 'work' ? 1.5 : 1,
              }}
              numberOfLines={4}
              adjustsFontSizeToFit
            >
              {displayCombo}
            </Text>
            {activeCoachIntent && sessionActive ? (
              <Text className="mt-4 px-4 text-center font-body text-sm leading-5 text-[#8A9488]">
                {activeCoachIntent}
              </Text>
            ) : null}
            {phase === 'idle' && activeBlock?.combat?.rounds_structure?.length ? (
              <Text className="mt-4 font-body text-[10px] uppercase tracking-[0.4em] text-matte-gold/60">
                {activeBlock.combat.rounds_structure
                  .map((segment) => {
                    const range =
                      segment.round_start === segment.round_end
                        ? `R${segment.round_start}`
                        : `R${segment.round_start}–${segment.round_end}`;
                    return `${range} ${COMBAT_TACTICAL_FOCUS_LABELS[segment.tactical_focus]}`;
                  })
                  .join(' · ')}
              </Text>
            ) : null}
            {phase === 'idle' ? (
              <Text className="mt-2 text-center font-body text-sm text-[#6B7568]">
                {title ?? 'Blood & Bone'}
              </Text>
            ) : null}
          </View>

          <View className="gap-3 pb-2">
            {showRpeGate && phase === 'finished' ? (
              <View className="mb-2 rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                <RpeSelector value={rpe} onChange={setRpe} />
              </View>
            ) : null}

            {phase === 'idle' ? (
              <Pressable
                onPress={start}
                disabled={catalogLoading}
                className="rounded-2xl border border-matte-gold/35 bg-matte-gold/10 px-6 py-5 active:opacity-80"
              >
                <Text className="text-center font-body-medium text-sm uppercase tracking-[0.35em] text-matte-gold">
                  Begin Rounds
                </Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={handleEndSession}
                disabled={phase === 'finished' && !canSync}
                className={`rounded-2xl border px-6 py-5 active:opacity-85 ${
                  phase === 'finished' && !canSync
                    ? 'border-white/5 bg-white/[0.02] opacity-40'
                    : 'border-matte-gold/40 bg-matte-gold/12'
                }`}
              >
                <Text className="text-center font-body-medium text-sm uppercase tracking-[0.3em] text-matte-gold">
                  End Session & Sync
                </Text>
              </Pressable>
            )}

            {phase === 'finished' && canSync ? (
              <Pressable
                onPress={() => syncAndAscend(rpe ?? DEFAULT_END_RPE)}
                className="active:opacity-70"
              >
                <Text className="text-center font-body text-[10px] uppercase tracking-[0.3em] text-[#6B7568]">
                  Skip RPE · sync at {DEFAULT_END_RPE}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </SafeAreaView>
    </Animated.View>
  );
}
