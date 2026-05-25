import { useEffect, useState } from 'react';

import { useSommaStore } from '@/store/useSommaStore';

/** True after AsyncStorage persist has finished rehydrating the offline store */
export function useStoreHydrated(): boolean {
  const [hydrated, setHydrated] = useState(() => useSommaStore.persist.hasHydrated());

  useEffect(() => {
    if (useSommaStore.persist.hasHydrated()) {
      setHydrated(true);
      return;
    }

    return useSommaStore.persist.onFinishHydration(() => {
      setHydrated(true);
    });
  }, []);

  return hydrated;
}
