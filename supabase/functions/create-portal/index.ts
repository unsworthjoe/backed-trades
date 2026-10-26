// Opens Stripe's customer portal, where a member changes their card or plan,
// sees invoices, or cancels. Called from the website's membership page.

import { callerId } from '../_shared/auth.ts';
import { adminClient, corsHeaders, json, serveWithCors } from '../_shared/http.ts';
import { stripe, stripeConfigured } from '../_shared/stripe.ts';

const SITE_URL = (Deno.env.get('SITE_URL') ?? 'https://backedtrades.co.uk').replace(/\/$/, '');

serveWithCors(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const userId = await callerId(req);
  if (!userId) return json(401, { error: 'SIGN_IN_REQUIRED' });
  if (!stripeConfigured()) return json(503, { error: 'PAYMENTS_NOT_SET_UP' });

  const { data: subscription } = await adminClient()
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('trade_id', userId)
    .maybeSingle();
  if (!subscription) return json(404, { error: 'NO_MEMBERSHIP' });

  try {
    const session = await stripe<{ url: string }>('POST', '/v1/billing_portal/sessions', {
      customer: subscription.stripe_customer_id,
      return_url: `${SITE_URL}/membership`,
    });
    return json(200, { url: session.url });
  } catch (e) {
    console.error('create-portal failed', e);
    return json(502, { error: 'PORTAL_FAILED' });
  }
});
