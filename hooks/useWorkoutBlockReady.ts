import { useActiveGameplanBlock } from '@/hooks/useActiveGameplanBlock';
import { useStoreHydrated } from '@/hooks/useStoreHydrated';
import { useSommaStore } from '@/store/useSommaStore';

/** Gate workout screens until persist hydration and optional block resolution finish */
export function useWorkoutBlockReady(blockId: string | undefined) {
  const hydrated = useStoreHydrated();
  const gameplanLoading = useSommaStore((state) => state.gameplan_loading);
  const activeBlock = useActiveGameplanBlock(blockId);

  const waitingForBlock =
    Boolean(blockId) && !activeBlock && (!hydrated || gameplanLoading);

  return {
    hydrated,
    activeBlock,
    isReady: hydrated && !waitingForBlock,
    waitingForBlock,
  };
}
