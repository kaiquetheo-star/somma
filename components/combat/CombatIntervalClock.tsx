import { useEffect } from 'react';
import { Platform, TextInput, type TextStyle } from 'react-native';
import Animated, {
  useAnimatedProps,
  useFrameCallback,
  useSharedValue,
} from 'react-native-reanimated';

import { formatTimer } from '@/constants/combat';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

function formatTimerWorklet(seconds: number): string {
  'worklet';
  const clamped = Math.max(0, Math.floor(seconds));
  const m = Math.floor(clamped / 60);
  const s = clamped % 60;
  const pad = s < 10 ? '0' : '';
  return `${m}:${pad}${s}`;
}

interface CombatIntervalClockProps {
  endsAtMs: number | null;
  isRunning: boolean;
  frozenSeconds: number;
  style?: TextStyle;
}

export function CombatIntervalClock({
  endsAtMs,
  isRunning,
  frozenSeconds,
  style,
}: CombatIntervalClockProps) {
  const deadline = useSharedValue(0);
  const ticking = useSharedValue(false);
  const displaySeconds = useSharedValue(frozenSeconds);

  useEffect(() => {
    deadline.value = endsAtMs ?? 0;
    ticking.value = isRunning && endsAtMs != null;
    if (!isRunning || endsAtMs == null) {
      displaySeconds.value = frozenSeconds;
    }
  }, [endsAtMs, isRunning, frozenSeconds, deadline, ticking, displaySeconds]);

  useFrameCallback(() => {
    'worklet';
    if (!ticking.value || deadline.value <= 0) return;
    displaySeconds.value = Math.max(0, Math.ceil((deadline.value - Date.now()) / 1000));
  });

  const animatedProps = useAnimatedProps(() => ({
    text: ticking.value
      ? formatTimerWorklet(displaySeconds.value)
      : formatTimerWorklet(frozenSeconds),
    defaultValue: formatTimerWorklet(frozenSeconds),
  }));

  const mono = Platform.select({
    ios: 'Menlo',
    android: 'monospace',
    default: 'monospace',
  });

  return (
    <AnimatedTextInput
      editable={false}
      underlineColorAndroid="transparent"
      pointerEvents="none"
      animatedProps={animatedProps}
      style={[
        {
          fontFamily: mono,
          fontSize: 72,
          lineHeight: 80,
          fontWeight: '600',
          color: '#E8E4DC',
          textAlign: 'center',
          padding: 0,
          margin: 0,
          width: '100%',
          letterSpacing: 2,
        },
        style,
      ]}
    />
  );
}

/** Static preview timer (idle) — avoids mounting Reanimated input before session */
export function CombatTimerPreview({ seconds, style }: { seconds: number; style?: TextStyle }) {
  const mono = Platform.select({
    ios: 'Menlo',
    android: 'monospace',
    default: 'monospace',
  });

  return (
    <TextInput
      editable={false}
      underlineColorAndroid="transparent"
      pointerEvents="none"
      value={formatTimer(seconds)}
      style={[
        {
          fontFamily: mono,
          fontSize: 72,
          lineHeight: 80,
          fontWeight: '600',
          color: '#E8E4DC',
          textAlign: 'center',
          padding: 0,
          margin: 0,
          width: '100%',
          letterSpacing: 2,
        },
        style,
      ]}
    />
  );
}
