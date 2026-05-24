import { useRouter, type Href } from 'expo-router';
import { useEffect } from 'react';

import type { GameplanBlock } from '@/types/gameplan';
import { useSommaStore } from '@/store/useSommaStore';

/** Clinical Law II — block deep-links that bypass Home navigation */
export function useRequireDailyScan(params: {
  blockId?: string;
  title?: string;
  pillar?: string;
}) {
  const router = useRouter();
  const needsScan = useSommaStore((state) => state.needsDailyReadinessScan());

  useEffect(() => {
    if (!needsScan || !params.blockId || !params.pillar) return;

    const pillar = params.pillar as GameplanBlock['pillar'];
    if (!['iron', 'combat', 'spirit'].includes(pillar)) return;

    router.replace({
      pathname: '/(workout)/daily_scan',
      params: {
        blockId: params.blockId,
        title: params.title ?? '',
        pillar,
      },
    } as unknown as Href);
  }, [needsScan, params.blockId, params.pillar, params.title, router]);
}
