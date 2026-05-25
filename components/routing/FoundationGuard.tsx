import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';

import { useStoreHydrated } from '@/hooks/useStoreHydrated';
import { hasCompletedFoundationScan, useSommaStore } from '@/store/useSommaStore';

/**
 * Redirects to the Foundation onboarding screen when the user has not
 * completed their passport. Waits for hydration so we never redirect
 * based on the transient empty state before AsyncStorage loads.
 */
export function FoundationGuard() {
  const router = useRouter();
  const hydrated = useStoreHydrated();
  const redirectedRef = useRef(false);

  const userFoundation = useSommaStore((state) => state.user_foundation);
  const userEnvironment = useSommaStore((state) => state.user_environment);
  const userBiological = useSommaStore((state) => state.user_biological);

  const foundationComplete = hasCompletedFoundationScan({
    user_foundation: userFoundation,
    user_environment: userEnvironment,
    user_biological: userBiological,
  });

  useEffect(() => {
    if (!hydrated || redirectedRef.current) return;
    if (foundationComplete) return;

    redirectedRef.current = true;
    router.replace('/(auth)/foundation');
  }, [hydrated, foundationComplete, router]);

  return null;
}
