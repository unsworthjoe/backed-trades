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
  const [trade, profile, existing, offerResult] = await Promise.all([
    db.from('trades').select('status, business_name').eq('id', userId).maybeSingle(),
    db.from('profiles').select('email, full_name').eq('id', userId).single(),
    db.from('subscriptions').select('*').eq('trade_id', userId).maybeSingle(),
    db.rpc('membership_offer'),
  ]);
  if (trade.data?.status !== 'approved') return json(403, { error: 'APPROVED_TRADES_ONLY' });
  if (existing.data && ['active', 'trialing', 'past_due'].includes(existing.data.status)) {
    return json(409, { error: 'ALREADY_MEMBER' });
  }

  // Launch offer: before the end date the first £14.99 covers the member until then (a one-off
  // charge now, with the subscription starting on the end date); the founding price follows.
  const offer = (offerResult.data as { founding: boolean; intro_until: string | null }[] | null)?.[0];
  if (!offer) {
    console.error('membership_offer failed', offerResult.error);
    return json(500, { error: 'CHECKOUT_FAILED' });
  }
  const founding = offer.founding;
  const introUntil = offer.intro_until ? new Date(offer.intro_until) : null;
  const { data: prices } = await db.rpc('membership_prices');
  const priceList = prices as { plan: string; is_founding: boolean; price_pence: number; lookup_key: string }[];
  const price = priceList.find((p) => p.plan === plan && p.is_founding === founding)!;
  const introPence = priceList.find((p) => p.plan === 'monthly' && p.is_founding)!.price_pence;

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
      line_items: [
        { price: stripePrice.id, quantity: 1 },
        ...(introUntil
          ? [
              {
                price_data: {
                  currency: 'gbp',
                  unit_amount: introPence,
                  product_data: {
                    name: `Backed. founding membership, covered until ${introUntil.toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      timeZone: 'Europe/London',
                    })}`,
                  },
                },
                quantity: 1,
              },
            ]
          : []),
      ],
      subscription_data: {
        metadata: { trade_id: userId },
        ...(introUntil ? { trial_end: Math.floor(introUntil.getTime() / 1000) } : {}),
      },
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
