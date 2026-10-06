// Deletes the caller's account for good, from the trade app or the customer website.
//
// In order, stopping at the first failure so the person can simply try again:
//   1. a trade's Stripe membership is cancelled straight away, so nobody is charged for an
//      account that no longer exists;
//   2. their uploaded files go: a trade's documents, ID photos and profile photos, and a
//      customer's job photos;
//   3. the account itself, which takes everything else in the database with it.
// Stripe keeps its own payment records (tax law), so the Stripe customer isn't deleted.

import { callerId } from '../_shared/auth.ts';
import { adminClient, corsHeaders, json } from '../_shared/http.ts';
import { stripe, StripeError, stripeConfigured } from '../_shared/stripe.ts';

type Db = ReturnType<typeof adminClient>;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const userId = await callerId(req);
  if (!userId) return json(401, { error: 'SIGN_IN_REQUIRED' });

  const db = adminClient();
  const { data: profile } = await db.from('profiles').select('role').eq('id', userId).maybeSingle();
  // Founders' accounts are removed by another founder, so the admin site is never left without one.
  if (profile?.role === 'admin') return json(403, { error: 'ADMIN_ACCOUNT' });

  try {
    await cancelMembership(db, userId);
  } catch (e) {
    console.error('delete-account: cancelling the membership failed', userId, e);
    return json(502, { error: 'MEMBERSHIP_NOT_CANCELLED' });
  }

  try {
    await deleteFiles(db, userId);
  } catch (e) {
    console.error('delete-account: deleting files failed', userId, e);
    return json(500, { error: 'NOT_DELETED' });
  }

  const { error } = await db.auth.admin.deleteUser(userId);
  if (error) {
    console.error('delete-account: deleting the user failed', userId, error);
    return json(500, { error: 'NOT_DELETED' });
  }
  console.log('delete-account: deleted', userId, profile?.role);
  return json(200, { deleted: true });
});

async function cancelMembership(db: Db, userId: string) {
  const { data: subscription, error } = await db
    .from('subscriptions')
    .select('stripe_subscription_id, status')
    .eq('trade_id', userId)
    .maybeSingle();
  if (error) throw error;
  const id = subscription?.stripe_subscription_id;
  if (!id || subscription.status === 'canceled') return;
  if (!stripeConfigured()) throw new Error('STRIPE_SECRET_KEY not set');

  try {
    await stripe('DELETE', `/v1/subscriptions/${id}`);
  } catch (e) {
    // Already gone or already cancelled on Stripe's side (our copy can lag behind): fine.
    if (e instanceof StripeError && e.status === 404) return;
    const current = await stripe<{ status: string }>('GET', `/v1/subscriptions/${id}`);
    if (current.status !== 'canceled') throw e;
  }
}

async function deleteFiles(db: Db, userId: string) {
  const { data: jobs, error } = await db.from('jobs').select('id').eq('customer_id', userId);
  if (error) throw error;

  // Uploads live under {trade id}/ or {job id}/ (src/lib/upload.ts).
  const folders: [string, string][] = [
    ['trade-documents', userId],
    ['id-checks', userId],
    ['trade-photos', userId],
    ...(jobs ?? []).map((job): [string, string] => ['job-photos', job.id]),
  ];

  for (const [bucket, folder] of folders) {
    const storage = db.storage.from(bucket);
    // Removing a page of files shifts the next ones up, so keep reading the first page. Entries
    // without an id are sub-folders, which we never create; they can't be removed this way.
    for (let page = 0; page < 20; page++) {
      const { data: entries, error: listError } = await storage.list(folder, { limit: 1000 });
      if (listError) throw listError;
      const files = (entries ?? []).filter((entry) => entry.id);
      if (!files.length) break;
      const { error: removeError } = await storage.remove(files.map((file) => `${folder}/${file.name}`));
      if (removeError) throw removeError;
    }
  }
}
