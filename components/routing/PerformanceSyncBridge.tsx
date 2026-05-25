import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { useAuth } from '@/providers/AuthProvider';
import { useSommaStore } from '@/store/useSommaStore';

/** Drain offline performance queue when the app returns to foreground */
export function PerformanceSyncBridge() {
  const { session } = useAuth();
  const flushPerformanceQueue = useSommaStore((state) => state.flushPerformanceQueue);
  const queueLength = useSommaStore((state) => state.performanceQueue.length);

  useEffect(() => {
    if (!session?.user?.id || queueLength === 0) return;

    const handleAppState = (next: AppStateStatus) => {
      if (next === 'active') {
        void flushPerformanceQueue().catch((err) => {
          console.warn('[SOMMA] Performance queue flush failed:', err);
        });
      }
    };

    void flushPerformanceQueue().catch((err) => {
      console.warn('[SOMMA] Performance queue flush failed:', err);
    });

    const subscription = AppState.addEventListener('change', handleAppState);
    return () => subscription.remove();
  }, [session?.user?.id, queueLength, flushPerformanceQueue]);

  return null;
}
