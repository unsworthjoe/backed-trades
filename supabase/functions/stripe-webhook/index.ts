// Stripe tells us here when a membership starts, renews, fails to renew or
// ends. Each time, the subscription is fetched fresh from Stripe (events can
// arrive out of order) and recorded with sync_subscription().

import { adminClient, json } from '../_shared/http.ts';
import { stripe, verifyStripeSignature } from '../_shared/stripe.ts';
import { cleanSecret } from '../_shared/twilio.ts';

type Subscription = {
  id: string;
  customer: string;
  status: string;
  cancel_at_period_end: boolean;
  cancel_at: number | null;
  metadata: { trade_id?: string };
  items: {
    data: { current_period_end?: number; price: { lookup_key: string | null; unit_amount: number | null } }[];
  };
};

const HANDLED = new Set([
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.paid',
  'invoice.payment_failed',
]);

Deno.serve(async (req) => {
  const payload = await req.text();
  const secret = cleanSecret(Deno.env.get('STRIPE_WEBHOOK_SECRET'));
  if (!(await verifyStripeSignature(payload, req.headers.get('Stripe-Signature'), secret))) {
    return json(400, { error: 'Invalid signature' });
  }

  const event = JSON.parse(payload) as { id: string; type: string; data: { object: Record<string, unknown> } };
  if (!HANDLED.has(event.type)) return json(200, { received: true, ignored: event.type });

  const subscriptionId = subscriptionIdOf(event.type, event.data.object);
  if (!subscriptionId) return json(200, { received: true, ignored: 'not a subscription' });

  try {
    const sub = await stripe<Subscription>('GET', `/v1/subscriptions/${subscriptionId}`);
    const db = adminClient();
    let tradeId = sub.metadata?.trade_id;
    if (!tradeId) {
      const { data } = await db.from('subscriptions').select('trade_id').eq('stripe_customer_id', sub.customer).maybeSingle();
      tradeId = data?.trade_id;
    }
    if (!tradeId) {
      console.error(`stripe-webhook: no trade for subscription ${sub.id} (customer ${sub.customer})`);
      return json(200, { received: true, ignored: 'unknown customer' });
    }

    const item = sub.items.data[0];
    const { error } = await db.rpc('sync_subscription', {
      p_trade_id: tradeId,
      p_customer_id: sub.customer,
      p_subscription_id: sub.id,
      p_status: sub.status,
      p_lookup_key: item?.price.lookup_key ?? null,
      p_price_pence: item?.price.unit_amount ?? null,
      p_current_period_end: item?.current_period_end ? new Date(item.current_period_end * 1000).toISOString() : null,
      p_cancel_at_period_end: sub.cancel_at_period_end || !!sub.cancel_at,
    });
    if (error) throw error;
    return json(200, { received: true });
  } catch (e) {
    // A 500 makes Stripe try again later.
    console.error(`stripe-webhook ${event.type} ${event.id} failed`, e);
    return json(500, { error: 'Could not record the update' });
  }
});

function subscriptionIdOf(type: string, object: Record<string, unknown>): string | null {
  if (type.startsWith('customer.subscription.')) return String(object.id);
  if (type === 'checkout.session.completed') return typeof object.subscription === 'string' ? object.subscription : null;
  // Invoices name their subscription under parent.subscription_details in current API versions.
  const parent = object.parent as { subscription_details?: { subscription?: string } } | undefined;
  const fromParent = parent?.subscription_details?.subscription;
  return fromParent ?? (typeof object.subscription === 'string' ? object.subscription : null);
}
