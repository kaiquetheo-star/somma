import { useEffect, useRef } from 'react';

import { useStoreHydrated } from '@/hooks/useStoreHydrated';
import { hasCompletedFoundationScan, useSommaStore } from '@/store/useSommaStore';

/**
 * Post-hydration bootstrap: triggers protocol generation only when
 * foundation has been legitimately completed (via onboarding or restore).
 * Does NOT inject any mock/default profile data.
 */
export function LocalBootstrap() {
  const hydrated = useStoreHydrated();
  const triggeredRef = useRef(false);

  const userFoundation = useSommaStore((state) => state.user_foundation);
  const userEnvironment = useSommaStore((state) => state.user_environment);
  const userBiological = useSommaStore((state) => state.user_biological);
  const fetchDailyGameplanAsync = useSommaStore((state) => state.fetchDailyGameplanAsync);

  const foundationComplete = hasCompletedFoundationScan({
    user_foundation: userFoundation,
    user_environment: userEnvironment,
    user_biological: userBiological,
  });

  useEffect(() => {
    if (!hydrated || triggeredRef.current) return;
    triggeredRef.current = true;

    if (foundationComplete) {
      void fetchDailyGameplanAsync();
    }
  }, [hydrated, foundationComplete, fetchDailyGameplanAsync]);

  return null;
}
