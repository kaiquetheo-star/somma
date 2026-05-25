import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
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
import { ComboSequencePanel } from '@/components/combat/ComboSequencePanel';
import { RpeSelector } from '@/components/combat/RpeSelector';
import { CommandCenterShell } from '@/components/command-center/CommandCenterShell';
import { LoadingFallback } from '@/components/routing/LoadingFallback';
import { COMBAT_ARENA, comboCalloutFull, formatTimer } from '@/constants/combat';
import { useRequireDailyScan } from '@/hooks/useRequireDailyScan';
import { useWorkoutBlockReady } from '@/hooks/useWorkoutBlockReady';
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
  useRequireDailyScan({ blockId, title, pillar: 'combat' });
  const { activeBlock, isReady, waitingForBlock } = useWorkoutBlockReady(blockId);
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
    const rounds = activeBlock?.combat?.rounds ?? [];
    if (!rounds.length || catalog.length === 0) return undefined;

    const eligible = filterCombatByMastery(catalog, combatMastery);
    const sortedRounds = [...rounds].sort((a, b) => (a.round_index ?? 0) - (b.round_index ?? 0));

    return sortedRounds.flatMap((round, scheduleIndex) => {
      const focusPool = filterCombatByTacticalFocus(eligible, round.tactical_focus);
      const pool = focusPool.length > 0 ? focusPool : eligible;
      const combo =
        getCombatComboById(catalog, round.combo_id) ??
        pool[scheduleIndex % Math.max(pool.length, 1)];
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

  const hasPrescribedRounds = (activeBlock?.combat?.rounds?.length ?? 0) > 0;
  const scheduleReady = !hasPrescribedRounds || (roundSchedule?.length ?? 0) > 0;

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
    schedule: liveSchedule,
    reset,
  } = useCombatInterval({ rounds: roundSchedule });

  const roundScheduleKey = useMemo(
    () => roundSchedule?.map((entry) => `${entry.combo.id}:${entry.workSeconds}`).join('|') ?? '',
    [roundSchedule],
  );

  useEffect(() => {
    if (phase === 'idle' && roundScheduleKey) {
      reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when prescribed schedule identity changes
  }, [roundScheduleKey]);

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

  const activeTacticalFocus = useMemo(
    () => roundSchedule?.[currentRound - 1]?.tacticalFocus,
    [currentRound, roundSchedule],
  );

  const activeCoachIntent = useMemo(() => {
    const structure = activeBlock?.combat?.rounds_structure ?? [];
    if (!structure.length) return null;
    return (
      structure.find(
        (segment) =>
          currentRound >= (segment.round_start ?? 0) &&
          currentRound <= (segment.round_end ?? 0),
      )?.coach_intent ?? null
    );
  }, [activeBlock?.combat?.rounds_structure, currentRound]);

  const activeLibraryCombo = useMemo((): LibraryCombatCombo | null => {
    const fromCatalog = getCombatComboById(catalog, currentCombo.id);
    if (fromCatalog) return fromCatalog;
    return {
      id: currentCombo.id,
      slug: currentCombo.id,
      combo_name: currentCombo.name,
      sequence: currentCombo.sequence,
      complexity_level: 5,
      tactical_focus: activeTacticalFocus ?? 'footwork_range',
    };
  }, [catalog, currentCombo, activeTacticalFocus]);

  const commandCenterMeta = useMemo(() => {
    if (phase === 'finished') return 'Session complete';
    if (phase === 'rest') return `Rest · Round ${currentRound}/${totalRounds}`;
    if (phase === 'work') return `Round ${currentRound}/${totalRounds} · Work`;
    return `${totalRounds} rounds · ${formatTimer(workSeconds)} work / ${formatTimer(restSeconds)} rest`;
  }, [phase, currentRound, totalRounds, workSeconds, restSeconds]);

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

  if (!isReady || waitingForBlock) {
    return <LoadingFallback message="Loading combat protocol…" eyebrow="Blood & Bone" />;
  }

  if (catalogLoading && (activeBlock?.combat?.rounds?.length ?? 0) > 0) {
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

        {roundSchedule && roundSchedule.length > 0 ? (
          <View className="mt-4">
            <FlatList
              horizontal
              data={liveSchedule.length ? liveSchedule : roundSchedule}
              keyExtractor={(item, index) => `${item.combo.id}-round-${index}`}
              showsHorizontalScrollIndicator={false}
              contentContainerClassName="gap-2 px-1"
              renderItem={({ item, index }) => {
                const roundNumber = index + 1;
                const isCurrent =
                  (phase === 'work' || phase === 'rest') && roundNumber === currentRound;
                const isDone = phase === 'finished' || roundNumber < currentRound;
                return (
                  <View
                    className={`min-w-[132px] rounded-xl border px-3 py-2.5 ${
                      isCurrent
                        ? 'border-matte-gold/45 bg-matte-gold/10'
                        : isDone
                          ? 'border-white/5 bg-white/[0.02] opacity-50'
                          : 'border-white/10 bg-white/[0.03]'
                    }`}
                  >
                    <Text className="font-body text-[9px] uppercase tracking-[0.25em] text-[#6B7568]">
                      Round {roundNumber}
                    </Text>
                    <Text
                      className="mt-1 font-body-medium text-xs text-[#E8E4DC]"
                      numberOfLines={2}
                    >
                      {item.combo.name}
                    </Text>
                    <Text className="mt-1 font-body text-[9px] leading-4 text-[#8A9488]" numberOfLines={2}>
                      {comboCalloutFull(item.combo)}
                    </Text>
                  </View>
                );
              }}
            />
          </View>
        ) : null}

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

          <View className="min-h-[140px] flex-1 justify-center px-1">
            {phase === 'finished' ? (
              <Text className="text-center font-body-medium text-xl uppercase tracking-[0.2em] text-[#E8E4DC]">
                Session complete
              </Text>
            ) : phase === 'rest' ? (
              <View className="items-center gap-3">
                <Text className="font-body-medium text-3xl uppercase tracking-[0.35em] text-[#E8E4DC]">
                  Rest
                </Text>
                <Text className="font-body text-sm text-[#8A9488]">
                  Round {currentRound}/{totalRounds} recovery
                </Text>
              </View>
            ) : activeLibraryCombo ? (
              <CommandCenterShell
                pillarLabel="Combat · Command"
                title={activeLibraryCombo.combo_name}
                meta={commandCenterMeta}
              >
                <ComboSequencePanel
                  combo={activeLibraryCombo}
                  tacticalFocus={activeTacticalFocus}
                />
                {phase === 'work' && comboCallout ? (
                  <Text className="text-center font-body text-sm uppercase tracking-[0.2em] text-matte-gold/75">
                    Now · {comboCallout}
                  </Text>
                ) : null}
                {activeCoachIntent && sessionActive ? (
                  <Text className="font-body text-sm leading-5 text-[#8A9488]">
                    {activeCoachIntent}
                  </Text>
                ) : null}
                {phase === 'idle' && (activeBlock?.combat?.rounds_structure?.length ?? 0) > 0 ? (
                  <Text className="font-body text-[10px] uppercase tracking-[0.35em] text-matte-gold/60">
                    {(activeBlock?.combat?.rounds_structure ?? [])
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
                  <Text className="font-body text-sm text-[#6B7568]">
                    {title ?? 'Blood & Bone'}
                  </Text>
                ) : null}
              </CommandCenterShell>
            ) : (
              <Text className="text-center font-body text-sm text-[#8A9488]">
                Loading combo from catalog…
              </Text>
            )}
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
                disabled={catalogLoading || !scheduleReady}
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
