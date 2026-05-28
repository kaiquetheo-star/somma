import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

interface FlowGestureZonesProps {
  enabled: boolean;
  canGoPrev: boolean;
  onPrev: () => void;
  onNext: () => void;
  children: ReactNode;
}

export function FlowGestureZones({
  enabled,
  canGoPrev,
  onPrev,
  onNext,
  children,
}: FlowGestureZonesProps) {
  const prevGesture = Gesture.Tap()
    .enabled(enabled && canGoPrev)
    .maxDuration(400)
    .onEnd(() => {
      onPrev();
    });

  const nextGesture = Gesture.Tap()
    .enabled(enabled)
    .maxDuration(400)
    .onEnd(() => {
      onNext();
    });

  if (!enabled) {
    return <View style={styles.root}>{children}</View>;
  }

  return (
    <View style={styles.root}>
      {children}
      <GestureDetector gesture={prevGesture}>
        <View style={styles.leftZone} accessibilityLabel="Previous pose" />
      </GestureDetector>
      <GestureDetector gesture={nextGesture}>
        <View style={styles.rightZone} accessibilityLabel="Next pose" />
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'relative',
  },
  leftZone: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '50%',
    zIndex: 20,
  },
  rightZone: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: '50%',
    zIndex: 20,
  },
});
