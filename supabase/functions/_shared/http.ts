import { createClient } from 'npm:@supabase/supabase-js@2';

/** Everything but the allowed website: serveWithCors adds Access-Control-Allow-Origin per request. */
export const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/** Websites allowed to call the functions from a browser. The phone apps don't send an Origin. */
const ALLOWED_ORIGINS = new Set([
  'https://backedtrades.co.uk',
  'https://www.backedtrades.co.uk',
  'https://backed.expo.app',
  'https://backed--demo.expo.app',
  'http://localhost:8081',
]);

/** Deno.serve for the functions the website calls: only the sites above get a CORS go-ahead. */
export function serveWithCors(handler: (req: Request) => Response | Promise<Response>) {
  Deno.serve(async (req) => {
    const response = await handler(req);
    const origin = req.headers.get('Origin');
    if (origin && ALLOWED_ORIGINS.has(origin)) {
      response.headers.set('Access-Control-Allow-Origin', origin);
      response.headers.append('Vary', 'Origin');
    }
    return response;
  });
}

export function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Database access with the secret key, for calling the service-only functions. */
export function adminClient() {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });
}
