import { useMemo } from 'react';

import { useSommaStore } from '@/store/useSommaStore';
import type { GameplanBlock } from '@/types/gameplan';

/** Resolve the active ritual block from the weekly microcycle by route blockId */
export function useActiveGameplanBlock(blockId: string | undefined): GameplanBlock | null {
  const weeklyMicrocycle = useSommaStore((state) => state.weeklyMicrocycle);

  return useMemo(() => {
    if (!blockId || !weeklyMicrocycle) return null;

    for (const day of weeklyMicrocycle) {
      const block = day.blocks?.find((entry) => entry.id === blockId);
      if (block) return block;
    }

    return null;
  }, [blockId, weeklyMicrocycle]);
}
