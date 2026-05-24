/**
 * Canonical Head Coach entry — 7-day microcycle generation.
 * Zero-Cost Clinical Engine: delegates to deterministic handler in generate_daily_protocol ($0 API).
 *
 * Deploy: supabase functions deploy generate_weekly_microcycle
 */
// CLINICAL ENGINE: DETERMINISTIC ONLY. NO RANDOMNESS ALLOWED. IF INPUTS ARE CONSTANT, OUTPUT MUST BE CONSTANT.
import { corsHeaders } from '../_shared/cors.ts';
import { handleHeadCoachRequest } from '../generate_daily_protocol/index.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const method = req.method;
  console.log('[generate_weekly_microcycle] Request received', { method });
  try {
    const response = await handleHeadCoachRequest(req);
    console.log('[generate_weekly_microcycle] Handler completed', {
      status: response.status,
    });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[generate_weekly_microcycle] Unhandled error:', message);
    return new Response(JSON.stringify({ error: 'GENERATION_FAILED', message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
