// "Register your interest" on the coming-soon page: checks the Turnstile token, then saves the
// email address (signing up again with the same address updates it and restarts the 12 months).
//
// Body: { email: string, kind: 'customer' | 'trade', categoryId?: number, townId?: number | null,
//         captchaToken: string }
// Returns 200 { ok: true } or 4xx { error: CODE }.

import { adminClient, corsHeaders, json } from '../_shared/http.ts';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'METHOD_NOT_ALLOWED' });

  let body: { email?: string; kind?: string; categoryId?: number; townId?: number | null; captchaToken?: string };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'BAD_REQUEST' });
  }

  const email = (body.email ?? '').trim().toLowerCase();
  if (!EMAIL.test(email) || email.length > 254) return json(400, { error: 'BAD_EMAIL' });
  if (body.kind !== 'customer' && body.kind !== 'trade') return json(400, { error: 'BAD_REQUEST' });
  const categoryId = body.kind === 'trade' ? body.categoryId : null;
  if (body.kind === 'trade' && !Number.isInteger(categoryId)) return json(400, { error: 'PICK_A_TRADE' });
  const townId = body.townId ?? null;
  if (townId !== null && !Number.isInteger(townId)) return json(400, { error: 'BAD_REQUEST' });
  if (!body.captchaToken) return json(400, { error: 'CAPTCHA_FAILED' });

  const ip = req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? null;

  const form = new FormData();
  form.append('secret', Deno.env.get('TURNSTILE_SECRET_KEY') ?? '');
  form.append('response', body.captchaToken);
  if (ip) form.append('remoteip', ip);
  const check = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
  const outcome = (await check.json()) as { success?: boolean };
  if (!outcome.success) return json(400, { error: 'CAPTCHA_FAILED' });

  const { error } = await adminClient()
    .from('interest_signups')
    .upsert(
      { email, kind: body.kind, category_id: categoryId, town_id: townId, signed_up_at: new Date().toISOString() },
      { onConflict: 'email' },
    );
  if (error) {
    // 23503: a trade or town id that doesn't exist.
    if (error.code === '23503') return json(400, { error: 'BAD_REQUEST' });
    console.error('interest upsert failed', error);
    return json(500, { error: 'SERVER_ERROR' });
  }

  return json(200, { ok: true });
});
