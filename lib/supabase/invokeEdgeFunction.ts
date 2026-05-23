import { supabaseAnonKey, supabaseUrl } from '@/lib/config';

/** Headers allowed by `supabase/functions/_shared/cors.ts` — do not add others from the browser. */
const EDGE_ALLOWED_HEADERS = [
  'authorization',
  'x-client-info',
  'apikey',
  'content-type',
] as const;

export interface InvokeEdgeFunctionResult {
  data: unknown;
  error: Error | null;
  status: number;
}

function functionsBaseUrl(): string {
  return `${supabaseUrl.replace(/\/$/, '')}/functions/v1`;
}

/**
 * POST to a Supabase Edge Function via native fetch.
 * Avoids supabase-js invoke quirks on web (extra headers, gateway CORS mismatches).
 */
export async function invokeEdgeFunctionPost(
  functionName: string,
  body: Record<string, unknown>,
  accessToken: string,
): Promise<InvokeEdgeFunctionResult> {
  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      data: null,
      error: new Error('Supabase URL or anon key not configured'),
      status: 0,
    };
  }

  const url = `${functionsBaseUrl()}/${functionName}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    apikey: supabaseAnonKey,
    Authorization: `Bearer ${accessToken}`,
    'x-client-info': 'somma-longevity-os',
  };

  console.log('[SOMMA] Edge fetch invoke', {
    functionName,
    url,
    headerKeys: Object.keys(headers),
    allowedHeaders: EDGE_ALLOWED_HEADERS,
  });

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const rawText = await response.text();
    let data: unknown = null;

    if (rawText) {
      try {
        data = JSON.parse(rawText) as unknown;
      } catch {
        data = {
          error: 'INVALID_JSON',
          message: rawText.slice(0, 300),
        };
      }
    }

    if (!response.ok) {
      const record =
        data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
      const message =
        typeof record?.message === 'string'
          ? record.message
          : typeof record?.error === 'string'
            ? String(record.error)
            : `Edge function HTTP ${response.status}`;

      console.error('[SOMMA] Edge fetch HTTP error', {
        functionName,
        status: response.status,
        message,
      });

      return {
        data,
        error: new Error(message),
        status: response.status,
      };
    }

    return { data, error: null, status: response.status };
  } catch (cause) {
    const message =
      cause instanceof Error ? cause.message : 'Failed to reach Edge Function';
    console.error('[SOMMA] Edge fetch network error', { functionName, message });
    return {
      data: null,
      error: new Error(message),
      status: 0,
    };
  }
}
