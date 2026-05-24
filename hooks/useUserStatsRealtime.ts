import { useMemo } from 'react';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import { useSommaStore } from '@/store/useSommaStore';

/**
 * Optional Supabase Realtime subscription for `user_stats`.
 * Updates local Zustand when essence scores change server-side.
 * Fails silently if Realtime is unavailable (offline / not enabled).
 */
export function useUserStatsRealtime(userId: string | undefined): void {
  const config = useMemo(
    () =>
      userId
        ? {
            channelName: `user_stats:${userId}`,
            bindings: [
              {
                filter: {
                  event: 'UPDATE' as const,
                  schema: 'public',
                  table: 'user_stats',
                  filter: `user_id=eq.${userId}`,
                },
                handler: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
                  const row = payload.new as Record<string, unknown>;
                  useSommaStore.getState().setUserStats({
                    body_essence: Number(row.body_essence ?? 0),
                    mind_essence: Number(row.mind_essence ?? 0),
                    spirit_essence: Number(row.spirit_essence ?? 0),
                    combat_mastery: Number(row.combat_mastery ?? 0),
                  });
                },
              },
            ],
          }
        : null,
    [userId],
  );

  useRealtimeSync(config);
}
