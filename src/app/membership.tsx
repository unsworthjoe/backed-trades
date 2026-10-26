import { Redirect, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { SignInForm } from '@/components/auth-forms';
import { LoadingScreen, Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Notice } from '@/components/ui/notice';
import { Wordmark } from '@/components/wordmark';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { formatDate } from '@/lib/dates';
import { friendlyError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/types/database';

/**
 * Trades set up and manage their membership here, on the website only: Apple's rules don't
 * allow the app to take payment outside the App Store or point people to it.
 */
export default function MembershipScreen() {
  const { session, role, loading } = useAuth();

  if (Platform.OS !== 'web') return <Redirect href="/" />;
  if (loading) return <LoadingScreen />;

  return (
    <Screen>
      <Wordmark size={32} />
      {!session ? (
        <>
          <ThemedText type="subtitle">Your Backed. membership</ThemedText>
          <ThemedText themeColor="textSecondary">Sign in with the email and password you use in the Backed. app.</ThemedText>
          <SignInForm
            onNeedsCode={(email) => router.push({ pathname: '/verify', params: { email } })}
            onCreateAccount={() => router.push('/sign-up')}
            onForgotPassword={(email) => router.push({ pathname: '/reset-password', params: { email } })}
          />
        </>
      ) : role !== 'trade' ? (
        <Notice tone="info" message="Memberships are for Backed. trades. You’re signed in with a customer account." />
      ) : (
        <Membership tradeId={session.user.id} />
      )}
    </Screen>
  );
}

type Price = { plan: 'monthly' | 'yearly'; is_founding: boolean; price_pence: number };

async function loadMembership(tradeId: string) {
  const [trade, subscription, prices, offer] = await Promise.all([
    supabase.from('trades').select('status, business_name').eq('id', tradeId).maybeSingle(),
    supabase.from('subscriptions').select('*').eq('trade_id', tradeId).maybeSingle(),
    supabase.rpc('membership_prices'),
    supabase.rpc('membership_offer'),
  ]);
  const failed = [trade, subscription, prices, offer].find((r) => r.error);
  if (failed) throw failed.error;
  return {
    trade: trade.data,
    subscription: subscription.data as Tables<'subscriptions'> | null,
    prices: (prices.data ?? []) as Price[],
    founding: !!offer.data?.[0]?.founding,
    // Set while the launch offer's "covered until" period applies: the first £14.99 covers the
    // member until this date, and their plan starts then.
    introUntil: offer.data?.[0]?.intro_until ?? null,
  };
}

type Loaded = Awaited<ReturnType<typeof loadMembership>>;

const pounds = (pence: number) => `£${(pence / 100).toFixed(2)}`;

/** What the launch offer charges today: the founding monthly price. */
const introPence = (data: Loaded) =>
  data.prices.find((p) => p.plan === 'monthly' && p.is_founding)?.price_pence ?? 1499;

/** The function's error code (e.g. ALREADY_MEMBER), from a supabase.functions.invoke error. */
async function functionError(error: unknown) {
  const context = (error as { context?: Response }).context;
  const body = context ? await context.json().catch(() => null) : null;
  return (body as { error?: string } | null)?.error ?? 'UNKNOWN';
}

const FUNCTION_ERRORS: Record<string, string> = {
  PAYMENTS_NOT_SET_UP: 'Memberships aren’t open yet. We’ll email you as soon as they are.',
  APPROVED_TRADES_ONLY: 'Your application needs to be approved before you can become a member.',
  ALREADY_MEMBER: 'You’re already a member.',
  NO_MEMBERSHIP: 'You don’t have a membership yet.',
};

function Membership({ tradeId }: { tradeId: string }) {
  const { checkout } = useLocalSearchParams<{ checkout?: string }>();
  const { signOut } = useAuth();
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    try {
      setData(await loadMembership(tradeId));
    } catch (e) {
      setError(friendlyError(e));
    }
  }, [tradeId]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const active = data?.subscription && ['active', 'trialing'].includes(data.subscription.status);

  // Back from Stripe: the payment is confirmed to us a few seconds later.
  useEffect(() => {
    if (checkout !== 'done' || active) return;
    const id = setInterval(reload, 3000);
    const stop = setTimeout(() => clearInterval(id), 60_000);
    return () => {
      clearInterval(id);
      clearTimeout(stop);
    };
  }, [checkout, active, reload]);

  async function go(fn: 'create-checkout' | 'create-portal', body?: object) {
    setBusy(true);
    setError(null);
    const { data: result, error } = await supabase.functions.invoke<{ url: string }>(fn, { body });
    if (error || !result?.url) {
      const code = error ? await functionError(error) : 'UNKNOWN';
      setError(FUNCTION_ERRORS[code] ?? 'Something went wrong. Please try again.');
      setBusy(false);
      return;
    }
    // Same tab: Stripe brings them back here afterwards.
    window.location.assign(result.url);
  }

  if (!data) return error ? <Notice message={error} /> : <LoadingScreen />;

  const { trade, subscription } = data;
  if (trade?.status !== 'approved') {
    return (
      <Notice
        tone="info"
        title="Not approved yet"
        message="Once your application is approved, you can set up your membership here. We’ll email you when it is."
      />
    );
  }

  return (
    <>
      <ThemedText type="subtitle">{trade.business_name}’s membership</ThemedText>
      {error && <Notice message={error} />}

      {active && subscription ? (
        <Card>
          <View style={styles.row}>
            <Chip label="Active" tone="success" />
            {subscription.is_founding && <Chip label="Founding member" tone="brand" />}
          </View>
          <ThemedText type="heading">
            {pounds(subscription.price_pence)} a {subscription.plan === 'monthly' ? 'month' : 'year'}
          </ThemedText>
          {subscription.current_period_end && (
            <ThemedText themeColor="textSecondary">
              {subscription.cancel_at_period_end
                ? `Ends on ${formatDate(subscription.current_period_end)}. You’ll get offers until then.`
                : `Renews on ${formatDate(subscription.current_period_end)}.`}
            </ThemedText>
          )}
          <ThemedText themeColor="textSecondary">
            You’re getting job offers in the Backed. app. Change your card or plan, see invoices, or cancel below.
          </ThemedText>
          <Button
            label={busy ? 'Opening…' : 'Manage membership'}
            variant="outline"
            disabled={busy}
            onPress={() => go('create-portal')}
            style={styles.inline}
          />
        </Card>
      ) : subscription?.status === 'past_due' ? (
        <Card>
          <Notice
            tone="warning"
            title="Your last payment didn’t go through"
            message="Offers are paused until it’s paid. Update your card and we’ll try again straight away."
          />
          <Button label={busy ? 'Opening…' : 'Update my card'} disabled={busy} onPress={() => go('create-portal')} style={styles.inline} />
        </Card>
      ) : checkout === 'done' ? (
        <Notice tone="info" title="Payment received" message="Setting up your membership. This only takes a few seconds…" />
      ) : (
        <>
          <ThemedText themeColor="textSecondary">
            Your membership turns on job offers in every queue you’re in. One price, every trade and town you cover.
          </ThemedText>
          {data.founding && data.introUntil && (
            <Notice
              tone="success"
              title={`Launch offer: pay ${pounds(introPence(data))} today and you’re covered until ${formatDate(data.introUntil)}`}
              message={`Your chosen plan then starts at the founding price, and you keep that price for as long as you stay a member. Cancel any time.`}
            />
          )}
          {data.founding && !data.introUntil && (
            <Notice
              tone="success"
              title="Founding member price"
              message="Join now and keep this price for as long as you stay a member."
            />
          )}
          <View style={styles.plans}>
            {(['monthly', 'yearly'] as const).map((plan) => {
              const price = data.prices.find((p) => p.plan === plan && p.is_founding === data.founding)!;
              return (
                <Card key={plan} style={styles.plan}>
                  <ThemedText type="label" themeColor="textSecondary">
                    {plan === 'monthly' ? 'Monthly' : 'Yearly'}
                  </ThemedText>
                  <ThemedText type="title">{pounds(price.price_pence)}</ThemedText>
                  <ThemedText themeColor="textSecondary">
                    {plan === 'monthly' ? 'a month' : 'a year'}
                    {data.introUntil ? `, from ${formatDate(data.introUntil)}` : ''}.{' '}
                    {plan === 'monthly' ? 'Cancel any time.' : 'Two months free.'}
                  </ThemedText>
                  {data.introUntil && (
                    <ThemedText type="smallBold">Pay {pounds(introPence(data))} today to join</ThemedText>
                  )}
                  <Button
                    label={busy ? 'Opening…' : `Choose ${plan}`}
                    variant={plan === 'yearly' ? 'primary' : 'outline'}
                    disabled={busy}
                    onPress={() => go('create-checkout', { plan })}
                  />
                </Card>
              );
            })}
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            Payments are handled securely by Stripe. Backed. never sees your card details.
          </ThemedText>
        </>
      )}

      <Button label="Sign out" variant="outline" onPress={signOut} style={styles.inline} />
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  inline: {
    alignSelf: 'flex-start',
  },
  plans: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  plan: {
    flexGrow: 1,
    flexBasis: 260,
  },
});
