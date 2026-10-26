// Calls to Stripe's API, and checks that webhooks really came from Stripe.
// Plain fetch rather than Stripe's SDK, pinned to one API version so a
// change on Stripe's side can't alter what we get back.

import { timingSafeEqual } from './auth.ts';
import { cleanSecret } from './twilio.ts';

export const STRIPE_VERSION = '2026-09-30.endive';

/** Stripe's API, or a stand-in when testing on your PC (STRIPE_API_BASE). */
const API_BASE = (Deno.env.get('STRIPE_API_BASE') ?? 'https://api.stripe.com').replace(/\/$/, '');

export class StripeError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export function stripeConfigured() {
  return !!cleanSecret(Deno.env.get('STRIPE_SECRET_KEY'));
}

type Params = Record<string, unknown>;

/** Stripe's form encoding: { a: { b: 1 }, c: [x] } -> a[b]=1&c[0]=x */
function encode(params: Params, prefix = '', out = new URLSearchParams()) {
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    const name = prefix ? `${prefix}[${key}]` : key;
    if (Array.isArray(value)) {
      value.forEach((item, i) =>
        typeof item === 'object' ? encode(item as Params, `${name}[${i}]`, out) : out.append(`${name}[${i}]`, String(item)),
      );
    } else if (typeof value === 'object') {
      encode(value as Params, name, out);
    } else {
      out.append(name, String(value));
    }
  }
  return out;
}

export async function stripe<T = Record<string, unknown>>(
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  params: Params = {},
) {
  const key = cleanSecret(Deno.env.get('STRIPE_SECRET_KEY'));
  const body = encode(params);
  const url = method === 'GET' && body.size ? `${API_BASE}${path}?${body}` : `${API_BASE}${path}`;
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      'Stripe-Version': STRIPE_VERSION,
      ...(method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
    body: method === 'POST' ? body : undefined,
  });
  const json = await response.json();
  if (!response.ok) throw new StripeError(json?.error?.message ?? `Stripe HTTP ${response.status}`, response.status);
  return json as T;
}

export type Price = { id: string; lookup_key: string | null; unit_amount: number | null };

/**
 * The price for a membership, by lookup key. Created on first use, so a new Stripe account
 * needs no setting up by hand.
 */
export async function ensurePrice(lookupKey: string, pence: number, interval: 'month' | 'year', name: string) {
  const found = await stripe<{ data: Price[] }>('GET', '/v1/prices', { lookup_keys: [lookupKey], active: true });
  if (found.data[0]) return found.data[0];
  return stripe<Price>('POST', '/v1/prices', {
    currency: 'gbp',
    unit_amount: pence,
    recurring: { interval },
    lookup_key: lookupKey,
    transfer_lookup_key: true,
    product_data: { name },
  });
}

/** True if `header` (Stripe-Signature) is Stripe's signature of `payload`, made in the last 5 minutes. */
export async function verifyStripeSignature(payload: string, header: string | null, secret: string) {
  if (!header || !secret) return false;
  const parts = header.split(',').map((p) => p.split('=') as [string, string]);
  const timestamp = parts.find(([k]) => k === 't')?.[1];
  const signatures = parts.filter(([k]) => k === 'v1').map(([, v]) => v);
  if (!timestamp || !signatures.length) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${payload}`));
  const expected = Array.from(new Uint8Array(mac), (b) => b.toString(16).padStart(2, '0')).join('');
  return signatures.some((s) => timingSafeEqual(s, expected));
}
