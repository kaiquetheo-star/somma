import { useEffect, useRef } from 'react';

import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
  SupabaseClient,
} from '@supabase/supabase-js';

import { getSupabase } from '@/lib/supabase/client';

type PostgresChangeBinding = {
  filter: {
    event: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
    schema: string;
    table: string;
    filter?: string;
  };
  handler: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void;
};

export interface RealtimeSyncConfig {
  /** Stable channel name — include user/resource id to avoid cross-user bleed */
  channelName: string;
  bindings: PostgresChangeBinding[];
}

async function removeChannelByName(
  supabase: SupabaseClient,
  channelName: string,
): Promise<void> {
  const topic = `realtime:${channelName}`;
  const stale = supabase
    .getChannels()
    .filter((existing) => existing.topic === topic || existing.topic.endsWith(`:${channelName}`));

  await Promise.all(stale.map((channel) => supabase.removeChannel(channel)));
}

/**
 * Safely manages Supabase Realtime channel lifecycle:
 * - tears down stale channels before subscribe (avoids reusing a subscribed channel)
 * - registers all postgres_changes handlers before subscribe()
 * - awaits removeChannel on unmount (React Strict Mode safe)
 */
export function useRealtimeSync(config: RealtimeSyncConfig | null): void {
  const configRef = useRef(config);
  configRef.current = config;

  useEffect(() => {
    const activeConfig = configRef.current;
    if (!activeConfig) return;

    const supabase = getSupabase();
    if (!supabase) return;

    let cancelled = false;
    let channel: RealtimeChannel | null = null;

    async function setup(): Promise<void> {
      const syncConfig = configRef.current;
      if (!syncConfig) return;

      await removeChannelByName(supabase!, syncConfig.channelName);
      if (cancelled) return;

      const nextChannel = supabase!.channel(syncConfig.channelName);

      for (const binding of syncConfig.bindings) {
        nextChannel.on(
          'postgres_changes',
          binding.filter,
          binding.handler as (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void,
        );
      }

      await new Promise<void>((resolve) => {
        nextChannel.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            resolve();
            return;
          }
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            console.warn(`[SOMMA] Realtime ${syncConfig.channelName} status: ${status}`);
            resolve();
          }
        });
      });

      if (cancelled) {
        await supabase!.removeChannel(nextChannel);
        return;
      }

      channel = nextChannel;
    }

    void setup();

    return () => {
      cancelled = true;
      if (channel) {
        void supabase.removeChannel(channel);
        channel = null;
      }
    };
  }, [config?.channelName]);
}
