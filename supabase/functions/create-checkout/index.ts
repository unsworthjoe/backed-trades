// Starts a Stripe Checkout for an approved trade's membership and returns the
// page to send them to. Called from the website's membership page.

import { callerId } from '../_shared/auth.ts';
import { adminClient, corsHeaders, json, serveWithCors } from '../_shared/http.ts';
import { ensurePrice, stripe, stripeConfigured, StripeError } from '../_shared/stripe.ts';

const SITE_URL = (Deno.env.get('SITE_URL') ?? 'https://backedtrades.co.uk').replace(/\/$/, '');

serveWithCors(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const userId = await callerId(req);
  if (!userId) return json(401, { error: 'SIGN_IN_REQUIRED' });
  if (!stripeConfigured()) return json(503, { error: 'PAYMENTS_NOT_SET_UP' });

  const { plan } = (await req.json().catch(() => ({}))) as { plan?: string };
  if (plan !== 'monthly' && plan !== 'yearly') return json(400, { error: 'PLAN_REQUIRED' });

  const db = adminClient();
  const [trade, profile, existing, settings] = await Promise.all([
    db.from('trades').select('status, business_name').eq('id', userId).maybeSingle(),
    db.from('profiles').select('email, full_name').eq('id', userId).single(),
    db.from('subscriptions').select('*').eq('trade_id', userId).maybeSingle(),
    db.from('app_settings').select('founding_pricing_open').single(),
  ]);
  if (trade.data?.status !== 'approved') return json(403, { error: 'APPROVED_TRADES_ONLY' });
  if (existing.data && ['active', 'trialing', 'past_due'].includes(existing.data.status)) {
    return json(409, { error: 'ALREADY_MEMBER' });
  }

  const founding = !!settings.data?.founding_pricing_open;
  const { data: prices } = await db.rpc('membership_prices');
  const price = (prices as { plan: string; is_founding: boolean; price_pence: number; lookup_key: string }[]).find(
    (p) => p.plan === plan && p.is_founding === founding,
  )!;

  try {
    let customerId = existing.data?.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe<{ id: string }>('POST', '/v1/customers', {
        email: profile.data?.email ?? undefined,
        name: trade.data.business_name,
        metadata: { trade_id: userId, contact_name: profile.data?.full_name ?? '' },
      });
      customerId = customer.id;
      const { error } = await db.from('subscriptions').insert({
        trade_id: userId,
        stripe_customer_id: customerId,
        plan,
        is_founding: founding,
        price_pence: price.price_pence,
        status: 'incomplete',
      });
      if (error) throw error;
    }

    const stripePrice = await ensurePrice(
      price.lookup_key,
      price.price_pence,
      plan === 'monthly' ? 'month' : 'year',
      `Backed. ${founding ? 'founding ' : ''}membership (${plan})`,
    );

    const session = await stripe<{ url: string }>('POST', '/v1/checkout/sessions', {
      mode: 'subscription',
      customer: customerId,
      client_reference_id: userId,
      line_items: [{ price: stripePrice.id, quantity: 1 }],
      subscription_data: { metadata: { trade_id: userId } },
      // Lets the founders give free months with a promotion code.
      allow_promotion_codes: true,
      success_url: `${SITE_URL}/membership?checkout=done`,
      cancel_url: `${SITE_URL}/membership`,
    });
    return json(200, { url: session.url });
  } catch (e) {
    console.error('create-checkout failed', e);
    return json(e instanceof StripeError ? 502 : 500, { error: 'CHECKOUT_FAILED' });
  }
});
