import 'react-native-url-polyfill/auto';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from '@/lib/config';
import { authStorage } from '@/lib/supabase/authStorage';

let client: SupabaseClient | null = null;

/** Bust singleton after schema migrations or auth storage resets (dev / QA). */
export function resetSupabaseClient(): void {
  if (client) {
    void client.removeAllChannels();
  }
  client = null;
}

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (!client) {
    client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: authStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: Platform.OS === 'web',
      },
      db: {
        schema: 'public',
      },
      global: {
        headers: {
          'X-Client-Info': 'somma-expo-v54',
        },
      },
    });
  }
  return client;
}
