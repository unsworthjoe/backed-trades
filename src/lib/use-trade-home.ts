import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { useAuth } from '@/lib/auth';
import { todayInUk } from '@/lib/dates';
import { supabase } from '@/lib/supabase';

/** Days after completion that a trade can still rate the customer (app_settings.review_window_days). */
const REVIEW_WINDOW_DAYS = 14;

/** How often the home screen checks for new offers while it's open, in case a push notification is missed. */
const REFRESH_MS = 30_000;

async function loadTradeHome(userId: string) {
  const [trade, subscription, insurance, offers, matches, queues, unread] = await Promise.all([
    supabase.from('trades').select('*').eq('id', userId).single(),
    supabase.from('subscriptions').select('status, current_period_end').eq('trade_id', userId).maybeSingle(),
    supabase
      .from('trade_documents')
      .select('expires_on')
      .eq('trade_id', userId)
      .eq('doc_type', 'public_liability_insurance')
      .eq('status', 'approved')
      .order('expires_on', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('job_offers')
      .select('id, expires_at, jobs(id, title, district, is_callout, size, trade_categories(name), towns(name))')
      .eq('trade_id', userId)
      .eq('status', 'pending')
      // The server expires offers once a minute; hide any that have run out in between.
      .gt('expires_at', new Date().toISOString())
      .order('expires_at'),
    supabase
      .from('job_matches')
      .select(
        'id, contact_due_at, contacted_at, done_at, signed_off_at, auto_closed_at, customer_ratings(id), jobs!inner(id, title, district, status, trade_categories(name), towns(name))',
      )
      .eq('trade_id', userId)
      .is('ended_at', null)
      .in('jobs.status', ['matched', 'done', 'completed'])
      .order('matched_at', { ascending: false })
      .limit(50),
    supabase.rpc('my_queue_places'),
    supabase.from('messages').select('match_id').neq('sender_id', userId).is('read_at', null),
  ]);
  const failed = [trade, subscription, insurance, offers, matches, queues, unread].find((r) => r.error);
  if (failed) throw failed.error;

  const unreadByMatch = new Map<string, number>();
  for (const m of unread.data ?? []) unreadByMatch.set(m.match_id, (unreadByMatch.get(m.match_id) ?? 0) + 1);

  // Finished jobs stay on the home screen while the customer still needs rating.
  const ratingWindowStart = Date.now() - REVIEW_WINDOW_DAYS * 24 * 60 * 60_000;
  const jobs = (matches.data ?? [])
    .filter((m) => {
      if (m.jobs.status !== 'completed') return true;
      const completedAt = m.signed_off_at ?? m.auto_closed_at;
      return !m.customer_ratings && !!completedAt && new Date(completedAt).getTime() > ratingWindowStart;
    })
    .map((m) => ({ ...m, unread: unreadByMatch.get(m.id) ?? 0 }));

  const sub = subscription.data;
  const subscribed =
    !!sub &&
    (sub.status === 'active' || sub.status === 'trialing') &&
    (!sub.current_period_end || new Date(sub.current_period_end) > new Date());
  const insured = !!insurance.data?.expires_on && insurance.data.expires_on >= todayInUk();

  return {
    trade: trade.data!,
    subscribed,
    insured,
    offers: offers.data ?? [],
    matches: jobs,
    queues: queues.data ?? [],
  };
}

export type TradeHome = Awaited<ReturnType<typeof loadTradeHome>>;

/** Everything on an approved trade's home screen. Reloads on focus and every 30 seconds while open. */
export function useTradeHome() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [home, setHome] = useState<TradeHome | null>(null);
  const [error, setError] = useState<unknown>(null);

  const reload = useCallback(async () => {
    if (!userId) return;
    try {
      setHome(await loadTradeHome(userId));
      setError(null);
    } catch (e) {
      setError(e);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      reload();
      const id = setInterval(reload, REFRESH_MS);
      return () => clearInterval(id);
    }, [reload]),
  );

  return { home, error, reload };
}
