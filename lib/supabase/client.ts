import 'react-native-url-polyfill/auto';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from '@/lib/config';

const SECURE_STORE_CHUNK_SIZE = 1800;

/** Web: Supabase auth session via localStorage (SecureStore is native-only) */
const webStorageAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      if (typeof window === 'undefined') return null;
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, value);
      }
    } catch {
      // Quota or private mode — auth may fall back to in-memory session
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(key);
      }
    } catch {
      // Ignore storage errors on sign-out cleanup
    }
  },
};

/** Native: chunk large values to respect SecureStore size limits */
async function secureGetItem(key: string): Promise<string | null> {
  const chunkCount = await SecureStore.getItemAsync(`${key}_chunks`);
  if (!chunkCount) {
    return SecureStore.getItemAsync(key);
  }

  const count = Number.parseInt(chunkCount, 10);
  const chunks: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const chunk = await SecureStore.getItemAsync(`${key}_chunk_${i}`);
    if (chunk) chunks.push(chunk);
  }
  return chunks.join('');
}

async function secureSetItem(key: string, value: string): Promise<void> {
  await SecureStore.deleteItemAsync(key);
  const chunkKey = `${key}_chunks`;
  const existingChunks = await SecureStore.getItemAsync(chunkKey);
  if (existingChunks) {
    const count = Number.parseInt(existingChunks, 10);
    for (let i = 0; i < count; i += 1) {
      await SecureStore.deleteItemAsync(`${key}_chunk_${i}`);
    }
    await SecureStore.deleteItemAsync(chunkKey);
  }

  if (value.length <= SECURE_STORE_CHUNK_SIZE) {
    await SecureStore.setItemAsync(key, value);
    return;
  }

  const chunkCount = Math.ceil(value.length / SECURE_STORE_CHUNK_SIZE);
  await SecureStore.setItemAsync(chunkKey, String(chunkCount));
  for (let i = 0; i < chunkCount; i += 1) {
    const start = i * SECURE_STORE_CHUNK_SIZE;
    const chunk = value.slice(start, start + SECURE_STORE_CHUNK_SIZE);
    await SecureStore.setItemAsync(`${key}_chunk_${i}`, chunk);
  }
}

async function secureRemoveItem(key: string): Promise<void> {
  await SecureStore.deleteItemAsync(key);
  const chunkKey = `${key}_chunks`;
  const chunkCount = await SecureStore.getItemAsync(chunkKey);
  if (chunkCount) {
    const count = Number.parseInt(chunkCount, 10);
    for (let i = 0; i < count; i += 1) {
      await SecureStore.deleteItemAsync(`${key}_chunk_${i}`);
    }
    await SecureStore.deleteItemAsync(chunkKey);
  }
}

const nativeStorageAdapter = {
  getItem: secureGetItem,
  setItem: secureSetItem,
  removeItem: secureRemoveItem,
};

const authStorage = Platform.OS === 'web' ? webStorageAdapter : nativeStorageAdapter;

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
