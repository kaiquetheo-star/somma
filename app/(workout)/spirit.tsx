import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FlowGestureZones } from '@/components/spirit/FlowGestureZones';
import { SanctuaryBreathOrb } from '@/components/spirit/SanctuaryBreathOrb';
import {
  FLOW_BREATH_DYNAMIC,
  FLOW_BREATH_STATIC,
  formatSpiritTimer,
  SPIRIT_SANCTUARY,
} from '@/constants/spirit';
import { useActiveGameplanBlock } from '@/hooks/useActiveGameplanBlock';
import { useBreathworkEngine } from '@/hooks/useBreathworkEngine';
import { useFlowAsanaSession } from '@/hooks/useFlowAsanaSession';
import { useSpiritBreathCatalog } from '@/hooks/useSpiritBreathCatalog';
import { useWorkoutNavigation } from '@/hooks/useWorkoutNavigation';
import { cyclesForDuration } from '@/lib/breathwork/tempoMap';
import { useSommaStore } from '@/store/useSommaStore';
import type { FlowAsanaPrescription } from '@/types/gameplan';

const DEFAULT_FLOW_ASANAS: FlowAsanaPrescription[] = [
  {
    asana_id: 'fallback-child',
    slug: 'childs_pose',
    name: "Child's Pose",
    order: 1,
    hold_seconds: 60,
    target_recovery_zones: ['lower_back', 'hips'],
    is_dynamic_flow: false,
  },
  {
    asana_id: 'fallback-pigeon',
    slug: 'pigeon_pose',
    name: 'Pigeon Pose',
    order: 2,
    hold_seconds: 90,
    target_recovery_zones: ['hips', 'glutes'],
    is_dynamic_flow: false,
  },
];

export default function SpiritModeScreen() {
  const router = useRouter();
  const { blockId } = useLocalSearchParams<{ blockId?: string; title?: string }>();
  const activeBlock = useActiveGameplanBlock(blockId);
  const { finishBlock } = useWorkoutNavigation();
  const appendSpiritSession = useSommaStore((state) => state.appendSpiritSession);

  const resolvedBlockId = blockId ?? 'block-morning-flow';
  const ascendedRef = useRef(false);

  const isFlowMode =
    activeBlock?.spirit?.mode === 'flow' &&
    (activeBlock.spirit.asanas?.length ?? 0) > 0;

  const flowAsanas = useMemo(
    () =>
      isFlowMode && activeBlock?.spirit?.asanas?.length
        ? activeBlock.spirit.asanas
        : DEFAULT_FLOW_ASANAS,
    [activeBlock?.spirit?.asanas, isFlowMode],
  );

  const { tempos: breathCatalog, resolve: resolveBreath } = useSpiritBreathCatalog();
  const { tempo: prescribedTempo, session: spiritSession } = useMemo(
    () => resolveBreath(activeBlock?.spirit?.tempo_id),
    [resolveBreath, activeBlock?.spirit?.tempo_id],
  );

  const syncAscension = useCallback(
    (totalSeconds: number, posesCompleted: number) => {
      if (ascendedRef.current) return;
      ascendedRef.current = true;

      appendSpiritSession({
        block_id: resolvedBlockId,
        tempo_id: isFlowMode
          ? 'flow-healer'
          : (spiritSession?.slug ??
            activeBlock?.spirit?.tempo_id ??
            prescribedTempo.id),
        tempo_name: isFlowMode
          ? activeBlock?.spirit?.recovery_focus_zones?.slice(0, 2).join(' · ') ||
            'Flow Recovery'
          : (spiritSession?.session_name ?? prescribedTempo.name),
        cycles_completed: posesCompleted,
        total_seconds: totalSeconds,
        completed_at: new Date().toISOString(),
      });

      finishBlock(resolvedBlockId, {
        pillar: 'spirit',
        volume: totalSeconds,
        rpe_score: 6,
      });
    },
    [
      activeBlock?.spirit?.recovery_focus_zones,
      activeBlock?.spirit?.tempo_id,
      appendSpiritSession,
      finishBlock,
      isFlowMode,
      prescribedTempo.id,
      prescribedTempo.name,
      resolvedBlockId,
      spiritSession?.session_name,
      spiritSession?.slug,
    ],
  );

  const flowSession = useFlowAsanaSession({ asanas: flowAsanas });

  const targetCycles = useMemo(() => {
    const minutes = activeBlock?.spirit?.duration_minutes;
    if (!minutes || isFlowMode) return undefined;
    return cyclesForDuration(prescribedTempo, minutes);
  }, [activeBlock?.spirit?.duration_minutes, isFlowMode, prescribedTempo]);

  const breathEngine = useBreathworkEngine({
    initialTempoId: prescribedTempo.id,
    targetCycles: isFlowMode ? undefined : targetCycles,
    tempos: breathCatalog,
  });

  useEffect(() => {
    if (
      isFlowMode &&
      flowSession.status === 'complete' &&
      !ascendedRef.current
    ) {
      syncAscension(flowSession.totalElapsed, flowSession.sortedAsanas.length);
    }
  }, [
    flowSession.status,
    flowSession.totalElapsed,
    flowSession.sortedAsanas.length,
    isFlowMode,
    syncAscension,
  ]);

  useEffect(() => {
    if (!isFlowMode && breathEngine.status === 'complete' && !ascendedRef.current) {
      syncAscension(breathEngine.totalElapsed, Math.max(1, breathEngine.cycleIndex));
    }
  }, [
    breathEngine.status,
    breathEngine.totalElapsed,
    breathEngine.cycleIndex,
    isFlowMode,
    syncAscension,
  ]);

  const breathCadence = useMemo(() => {
    if (!flowSession.currentAsana) return FLOW_BREATH_STATIC;
    return flowSession.currentAsana.is_dynamic_flow
      ? FLOW_BREATH_DYNAMIC
      : FLOW_BREATH_STATIC;
  }, [flowSession.currentAsana]);

  const showFlowActive = isFlowMode && flowSession.status === 'active';
  const showFlowIdle = isFlowMode && flowSession.status === 'idle';
  const showBreathActive =
    !isFlowMode && (breathEngine.status === 'running' || breathEngine.status === 'paused');

  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar style="light" />
      <View style={styles.canvas}>
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          <Pressable
            onPress={() => router.back()}
            style={styles.exitHit}
            accessibilityLabel="Exit sanctuary"
          >
            <Text style={styles.exitText}>Exit</Text>
          </Pressable>

          <FlowGestureZones
            enabled={showFlowActive}
            canGoPrev={flowSession.canGoPrev}
            onPrev={flowSession.goPrev}
            onNext={flowSession.goNext}
          >
            <View style={styles.orbStage}>
              {isFlowMode ? (
                <SanctuaryBreathOrb
                  inhaleSeconds={breathCadence.inhaleSeconds}
                  exhaleSeconds={breathCadence.exhaleSeconds}
                  isActive={showFlowActive}
                />
              ) : (
                <SanctuaryBreathOrb
                  inhaleSeconds={prescribedTempo.inhale}
                  exhaleSeconds={prescribedTempo.exhale}
                  isActive={breathEngine.status === 'running'}
                />
              )}
            </View>
          </FlowGestureZones>

          {showFlowIdle ? (
            <Pressable onPress={flowSession.start} style={styles.enterSanctuary}>
              <Text style={styles.enterLabel}>Enter Sanctuary</Text>
              {activeBlock?.spirit?.prescribed_reason ? (
                <Text style={styles.enterHint}>{activeBlock.spirit.prescribed_reason}</Text>
              ) : null}
              <Text style={styles.poseMeta}>
                {flowAsanas.length} poses · ~
                {activeBlock?.spirit?.duration_minutes ?? 15} min
              </Text>
            </Pressable>
          ) : null}

          {/*
            Idle state: map over the full asanas sequence so the user can preview
            every pose before entering the sanctuary. A horizontal scroll strip
            shows name and hold duration for each step in the routine.
          */}
          {showFlowIdle ? (
            <View style={styles.idleSequence}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.idleSequenceContent}
              >
                {flowAsanas.map((pose, idx) => (
                  <View key={pose.asana_id} style={styles.posePill}>
                    <Text style={styles.posePillNum}>{idx + 1}</Text>
                    <Text style={styles.posePillName} numberOfLines={2}>
                      {pose.name}
                    </Text>
                    <Text style={styles.posePillHold}>{pose.hold_seconds}s</Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          ) : null}

          {!isFlowMode && breathEngine.status === 'idle' ? (
            <Pressable onPress={breathEngine.start} style={styles.enterSanctuary}>
              <Text style={styles.enterLabel}>
                {spiritSession?.session_name ?? prescribedTempo.name}
              </Text>
              <Text style={styles.poseMeta}>
                {prescribedTempo.inhale}·{prescribedTempo.hold}·{prescribedTempo.exhale}
                {prescribedTempo.holdEmpty > 0 ? `·${prescribedTempo.holdEmpty}` : ''} · ~
                {activeBlock?.spirit?.duration_minutes ?? spiritSession?.duration_minutes ?? 15}{' '}
                min
              </Text>
              {activeBlock?.spirit?.prescribed_reason ? (
                <Text style={styles.enterHint}>{activeBlock.spirit.prescribed_reason}</Text>
              ) : spiritSession?.description ? (
                <Text style={styles.enterHint}>{spiritSession.description}</Text>
              ) : (
                <Text style={styles.enterHint}>{prescribedTempo.subtitle}</Text>
              )}
            </Pressable>
          ) : null}

          {(showFlowActive || showBreathActive) && (
            <View style={styles.footer} pointerEvents="none">
              {isFlowMode && flowSession.currentAsana ? (
                <>
                  <Text style={styles.asanaName}>{flowSession.currentAsana.name}</Text>
                  <Text style={styles.holdTimer}>
                    {formatSpiritTimer(flowSession.secondsLeft)}
                  </Text>
                  <Text style={styles.poseIndex}>
                    {flowSession.currentIndex + 1} / {flowSession.totalPoses}
                    {flowSession.isLastPose ? ' · final pose' : ''}
                  </Text>
                  {/*
                    Progress dots — one pip per pose in the sequence so the user
                    can see exactly where they are in the full routine at a glance.
                  */}
                  <View style={styles.progressDots}>
                    {flowSession.sortedAsanas.map((_, dotIdx) => (
                      <View
                        key={dotIdx}
                        style={[
                          styles.progressDot,
                          dotIdx === flowSession.currentIndex && styles.progressDotActive,
                        ]}
                      />
                    ))}
                  </View>
                  <Text style={styles.gestureHint}>Tap left · previous · right · next</Text>
                </>
              ) : (
                <Text style={styles.poseIndex}>
                  {breathEngine.phase} · {formatSpiritTimer(breathEngine.secondsLeft)}
                </Text>
              )}
            </View>
          )}
        </SafeAreaView>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: SPIRIT_SANCTUARY.deepObsidian,
  },
  canvas: {
    flex: 1,
    backgroundColor: SPIRIT_SANCTUARY.deepObsidian,
  },
  safe: {
    flex: 1,
  },
  exitHit: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    alignSelf: 'flex-start',
    zIndex: 30,
  },
  exitText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    letterSpacing: 3.5,
    textTransform: 'uppercase',
    color: SPIRIT_SANCTUARY.textMuted,
  },
  orbStage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  enterSanctuary: {
    position: 'absolute',
    left: 32,
    right: 32,
    bottom: '28%',
    alignItems: 'center',
    zIndex: 25,
  },
  enterLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    letterSpacing: 4,
    textTransform: 'uppercase',
    color: 'rgba(191, 160, 106, 0.75)',
  },
  enterHint: {
    marginTop: 16,
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    color: SPIRIT_SANCTUARY.textMuted,
    maxWidth: 300,
  },
  poseMeta: {
    marginTop: 12,
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: SPIRIT_SANCTUARY.textMuted,
  },
  // Idle-state horizontal strip mapping the full asana sequence
  idleSequence: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 20,
    zIndex: 20,
  },
  idleSequenceContent: {
    paddingHorizontal: 20,
  },
  posePill: {
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    marginRight: 10,
    maxWidth: 110,
  },
  posePillNum: {
    fontFamily: 'Inter_400Regular',
    fontSize: 8,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: SPIRIT_SANCTUARY.textMuted,
  },
  posePillName: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    textAlign: 'center',
    color: SPIRIT_SANCTUARY.textPrimary,
    marginTop: 4,
  },
  posePillHold: {
    fontFamily: 'Inter_400Regular',
    fontSize: 9,
    letterSpacing: 1.5,
    color: SPIRIT_SANCTUARY.textMuted,
    marginTop: 3,
  },
  footer: {
    paddingHorizontal: 28,
    paddingBottom: 12,
    alignItems: 'center',
  },
  asanaName: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    letterSpacing: 1.2,
    color: SPIRIT_SANCTUARY.textPrimary,
    textAlign: 'center',
  },
  holdTimer: {
    marginTop: 10,
    fontFamily: 'Inter_500Medium',
    fontSize: 42,
    letterSpacing: 2,
    color: 'rgba(232, 228, 220, 0.55)',
  },
  poseIndex: {
    marginTop: 8,
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: SPIRIT_SANCTUARY.textMuted,
  },
  // Sequence progress dots — one per pose, active pip elongated in gold
  progressDots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  progressDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(107, 117, 104, 0.35)',
    marginHorizontal: 3,
  },
  progressDotActive: {
    width: 10,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(191, 160, 106, 0.75)',
  },
  gestureHint: {
    marginTop: 14,
    fontFamily: 'Inter_400Regular',
    fontSize: 9,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    color: 'rgba(107, 117, 104, 0.55)',
  },
});
