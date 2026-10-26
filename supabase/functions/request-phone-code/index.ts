// Step 1 of customer sign-in: checks the Turnstile token and the limits, and
// records that this number may be sent a code. The website then asks Supabase
// Auth for the code, and the send-sms hook only sends it if this step passed.
//
// Body: { phone: string, captchaToken: string }
// Returns 200 { phone: "+447700900123" } or 4xx { error: CODE }.

import { adminClient, corsHeaders, json, serveWithCors } from '../_shared/http.ts';
import { normaliseUkMobile } from '../_shared/phone.ts';

serveWithCors(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'METHOD_NOT_ALLOWED' });

  let body: { phone?: string; captchaToken?: string };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'BAD_REQUEST' });
  }

  const phone = normaliseUkMobile(body.phone ?? '');
  if (!phone) return json(400, { error: 'UK_MOBILES_ONLY' });
  if (!body.captchaToken) return json(400, { error: 'CAPTCHA_FAILED' });

  const ip = req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? null;

  const form = new FormData();
  form.append('secret', Deno.env.get('TURNSTILE_SECRET_KEY') ?? '');
  form.append('response', body.captchaToken);
  if (ip) form.append('remoteip', ip);
  const check = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
  const outcome = (await check.json()) as { success?: boolean };
  if (!outcome.success) return json(400, { error: 'CAPTCHA_FAILED' });

  const { data, error } = await adminClient().rpc('allow_sms_code', { p_phone: phone, p_ip: ip });
  if (error) {
    console.error('allow_sms_code failed', error);
    return json(500, { error: 'SERVER_ERROR' });
  }
  if (data !== 'ok') return json(429, { error: data });

  return json(200, { phone: `+${phone}` });
});
