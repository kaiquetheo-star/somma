export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  /** Required for browser POST after OPTIONS preflight */
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
