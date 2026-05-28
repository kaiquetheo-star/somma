import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { SPIRIT_SANCTUARY } from '@/constants/spirit';

const SCALE_INHALE = 1.22;
const SCALE_EXHALE = 0.76;

export type SanctuaryBreathPhase = 'inhale' | 'exhale';

interface SanctuaryBreathOrbProps {
  inhaleSeconds: number;
  exhaleSeconds: number;
  isActive: boolean;
}

export function SanctuaryBreathOrb({
  inhaleSeconds,
  exhaleSeconds,
  isActive,
}: SanctuaryBreathOrbProps) {
  const [phase, setPhase] = useState<SanctuaryBreathPhase>('inhale');
  const scale = useSharedValue(SCALE_EXHALE);
  const glow = useSharedValue(0.08);
  const coreOpacity = useSharedValue(0.5);

  useEffect(() => {
    if (!isActive) {
      scale.value = withTiming(SCALE_EXHALE, { duration: 1200, easing: Easing.inOut(Easing.sin) });
      glow.value = withTiming(0.06, { duration: 1200 });
      coreOpacity.value = withTiming(0.35, { duration: 1200 });
      return;
    }

    let mounted = true;
    let timeout: ReturnType<typeof setTimeout>;

    const runPhase = (next: SanctuaryBreathPhase) => {
      if (!mounted) return;
      setPhase(next);
      const durationMs = (next === 'inhale' ? inhaleSeconds : exhaleSeconds) * 1000;

      if (next === 'inhale') {
        scale.value = withTiming(SCALE_INHALE, {
          duration: durationMs,
          easing: Easing.inOut(Easing.sin),
        });
        glow.value = withTiming(0.32, { duration: durationMs });
        coreOpacity.value = withTiming(0.95, { duration: durationMs });
      } else {
        scale.value = withTiming(SCALE_EXHALE, {
          duration: durationMs,
          easing: Easing.inOut(Easing.sin),
        });
        glow.value = withTiming(0.07, { duration: durationMs });
        coreOpacity.value = withTiming(0.4, { duration: durationMs });
      }

      timeout = setTimeout(
        () => runPhase(next === 'inhale' ? 'exhale' : 'inhale'),
        durationMs,
      );
    };

    runPhase('inhale');

    return () => {
      mounted = false;
      clearTimeout(timeout);
    };
  }, [isActive, inhaleSeconds, exhaleSeconds, scale, glow, coreOpacity]);

  const outerHaloStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value * 1.35 }],
    opacity: glow.value * 0.55,
  }));

  const midHaloStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value * 1.12 }],
    opacity: glow.value * 0.85,
  }));

  const coreStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: coreOpacity.value,
  }));

  return (
    <View style={styles.container} pointerEvents="none">
      <Animated.View style={[styles.outerHalo, outerHaloStyle]} />
      <Animated.View style={[styles.midHalo, midHaloStyle]} />
      <Animated.View style={[styles.core, coreStyle]} />
      <Animated.View style={[styles.innerGlow, midHaloStyle]} />
      <View style={styles.ring} />
    </View>
  );
}

const ORB_SIZE = 160;

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    width: ORB_SIZE * 1.6,
    height: ORB_SIZE * 1.6,
  },
  outerHalo: {
    position: 'absolute',
    width: ORB_SIZE * 1.5,
    height: ORB_SIZE * 1.5,
    borderRadius: ORB_SIZE * 0.75,
    backgroundColor: SPIRIT_SANCTUARY.orbHalo,
  },
  midHalo: {
    position: 'absolute',
    width: ORB_SIZE * 1.2,
    height: ORB_SIZE * 1.2,
    borderRadius: ORB_SIZE * 0.6,
    backgroundColor: SPIRIT_SANCTUARY.orbGlow,
  },
  core: {
    width: ORB_SIZE,
    height: ORB_SIZE,
    borderRadius: ORB_SIZE / 2,
    backgroundColor: SPIRIT_SANCTUARY.orbCore,
    borderWidth: 1,
    borderColor: 'rgba(191, 160, 106, 0.25)',
  },
  innerGlow: {
    position: 'absolute',
    width: ORB_SIZE * 0.55,
    height: ORB_SIZE * 0.55,
    borderRadius: ORB_SIZE * 0.275,
    backgroundColor: 'rgba(191, 160, 106, 0.18)',
  },
  ring: {
    position: 'absolute',
    width: ORB_SIZE * 1.28,
    height: ORB_SIZE * 1.28,
    borderRadius: ORB_SIZE * 0.64,
    borderWidth: 1,
    borderColor: 'rgba(74, 93, 68, 0.12)',
  },
});
