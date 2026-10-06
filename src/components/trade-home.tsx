import { router } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native';

import { OfferCountdown } from '@/components/offer-countdown';
import { LoadingScreen, Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Notice } from '@/components/ui/notice';
import { ToggleRow } from '@/components/ui/toggle-row';
import { Wordmark } from '@/components/wordmark';
import { Spacing } from '@/constants/theme';
import { useNow } from '@/hooks/use-now';
import { useAuth } from '@/lib/auth';
import { formatTimeOfDay, ordinal } from '@/lib/dates';
import { friendlyError } from '@/lib/errors';
import { pushPermission, registerForPush, type PushPermission } from '@/lib/push';
import { supabase } from '@/lib/supabase';
import { useTradeHome, type TradeHome } from '@/lib/use-trade-home';

/** Home for approved trades: offers waiting for a reply, jobs won, queue places and pausing. */
export function ApprovedTradeHome() {
  const { home, error, reload } = useTradeHome();
  const { profile, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const now = useNow(60_000);

  if (!home) {
    return error ? (
      <Screen>
        <Notice message={friendlyError(error)} />
        <Button label="Try again" onPress={reload} />
      </Screen>
    ) : (
      <LoadingScreen />
    );
  }

  const { trade, offers, matches } = home;
  const firstName = profile?.full_name.split(' ')[0];
  const paused = !!trade.paused_at;

  async function act(run: () => PromiseLike<{ error: unknown }>) {
    setBusy(true);
    setActionError(null);
    const { error } = await run();
    if (error) setActionError(friendlyError(error));
    await reload();
    setBusy(false);
  }

  return (
    <Screen onRefresh={reload}>
      <Wordmark size={32} />
      <ThemedText type="subtitle">{firstName ? `Hi, ${firstName}` : 'Hi'}</ThemedText>

      <Blockers home={home} />
      <NotificationsPrompt />
      {actionError && <Notice message={actionError} />}

      <Section title={offers.length ? `New offers (${offers.length})` : 'New offers'}>
        {offers.length ? (
          offers.map((offer) => (
            <PressableCard
              key={offer.id}
              label={`Offer: ${offer.jobs?.title}`}
              onPress={() => router.push({ pathname: '/offers/[id]', params: { id: offer.id } })}>
              <View style={styles.chips}>
                <OfferCountdown expiresAt={offer.expires_at} />
                {offer.jobs?.is_callout && <Chip label="Emergency" tone="danger" />}
                {offer.jobs?.size === 'large' && <Chip label="Bigger project" tone="info" />}
              </View>
              <ThemedText type="heading">{offer.jobs?.title}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {[offer.jobs?.trade_categories?.name, `${offer.jobs?.towns?.name} (${offer.jobs?.district})`]
                  .filter(Boolean)
                  .join(' · ')}
              </ThemedText>
            </PressableCard>
          ))
        ) : (
          <Card>
            <ThemedText themeColor="textSecondary">
              {paused
                ? 'Offers are paused. Switch them back on below when you’re ready.'
                : 'No offers right now. When a job comes up and you’re near the front of the queue, it’ll appear here.'}
            </ThemedText>
          </Card>
        )}
      </Section>

      {matches.length > 0 && (
        <Section title="Your jobs">
          {matches.map((match) => (
            <PressableCard
              key={match.id}
              label={`Job: ${match.jobs.title}`}
              onPress={() => router.push({ pathname: '/jobs/[id]', params: { id: match.id } })}>
              <View style={styles.chips}>
                {match.jobs.status === 'completed' ? (
                  <Chip label="Completed: rate the customer" tone="brand" />
                ) : match.jobs.status === 'done' ? (
                  <Chip label="Waiting for sign-off" tone="neutral" />
                ) : match.contacted_at ? (
                  <Chip label="Customer contacted" tone="success" />
                ) : (
                  <Chip label={`Contact by ${formatTimeOfDay(match.contact_due_at, now)}`} tone="warning" />
                )}
                {match.unread > 0 && (
                  <Chip label={`${match.unread} new message${match.unread === 1 ? '' : 's'}`} tone="info" />
                )}
              </View>
              <ThemedText type="heading">{match.jobs.title}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {[match.jobs.trade_categories?.name, `${match.jobs.towns?.name} (${match.jobs.district})`]
                  .filter(Boolean)
                  .join(' · ')}
              </ThemedText>
            </PressableCard>
          ))}
        </Section>
      )}

      <Section title="Queues and reviews">
        <PressableCard label="Your queues" onPress={() => router.push('/queues')}>
          <QueueSummary queues={home.queues} />
        </PressableCard>
        <PressableCard label="Your reviews" onPress={() => router.push('/reviews')}>
          <ThemedText type="heading">Your reviews</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Your rating, reviews and the checks customers see · tap to open
          </ThemedText>
        </PressableCard>
      </Section>

      <Section title="Settings">
        <Card>
          {trade.paused_reason === 'admin' ? (
            <Notice
              tone="warning"
              title="Offers paused by Backed."
              message="Please get in touch with us to switch them back on."
            />
          ) : (
            <ToggleRow
              label="Taking new offers"
              hint={
                trade.paused_reason === 'missed_offers'
                  ? 'Paused because 3 offers in a row ran out without a reply. Switch back on when you’re ready.'
                  : paused
                    ? 'Paused. You keep your place in every queue.'
                    : 'Pause any time, for a holiday or a full diary. You keep your place.'
              }
              value={!paused}
              onValueChange={(on) =>
                !busy && act(() => supabase.rpc(on ? 'resume_offers' : 'pause_offers'))
              }
            />
          )}
          <ToggleRow
            label="Emergency call-outs"
            hint="Urgent jobs, any time of day. You get 30 minutes to reply."
            value={trade.accepts_callouts}
            onValueChange={(on) =>
              !busy && act(() => supabase.from('trades').update({ accepts_callouts: on }).eq('id', trade.id))
            }
          />
        </Card>
      </Section>

      <Button label="Sign out" variant="outline" onPress={signOut} />
    </Screen>
  );
}

/** Why offers can't reach this trade right now, if anything. */
function Blockers({ home }: { home: TradeHome }) {
  const { trade } = home;
  if (trade.status === 'suspended') {
    return (
      <Notice
        title="Your account is suspended"
        message="You keep your queue places, but won’t get offers until this is sorted. Please get in touch with us."
      />
    );
  }
  return (
    <>
      {!home.subscribed &&
        // In the app this stays neutral: Apple's rules don't allow pointing people to paying
        // outside the App Store. The membership email links to the website instead.
        (Platform.OS === 'web' ? (
          <View style={styles.blocker}>
            <Notice
              tone="info"
              title="Your membership isn’t active yet"
              message="Offers start as soon as it is. You’re already in your queues."
            />
            <Button label="Set up my membership" onPress={() => router.push('/membership')} />
          </View>
        ) : (
          <Notice
            tone="info"
            title="Your membership isn’t active yet"
            message="Offers start as soon as it is. We’ve emailed you how to set it up. You’re already in your queues."
          />
        ))}
      {!home.insured && (
        <View style={styles.blocker}>
          <Notice
            tone="warning"
            title="Your insurance has run out"
            message="Offers are on hold until we’ve approved an in-date public liability certificate."
          />
          <Button label="Upload a new certificate" variant="outline" onPress={() => router.push('/apply/insurance')} />
        </View>
      )}
    </>
  );
}

function QueueSummary({ queues }: { queues: TradeHome['queues'] }) {
  const active = queues.filter((q) => q.status === 'active' && !q.tuned_out);
  const best = active.reduce<(typeof active)[number] | null>((a, q) => (!a || q.place < a.place ? q : a), null);
  const waiting = queues.filter((q) => q.status === 'waiting').length;
  const tunedOut = queues.filter((q) => q.tuned_out).length;

  return (
    <>
      {best ? (
        <ThemedText type="heading">
          {ordinal(best.place)} of {best.list_size} for {best.category_name} jobs in {best.town_name}
        </ThemedText>
      ) : (
        <ThemedText type="heading">{queues.length ? 'Not in line for offers yet' : 'You’re not in any queues'}</ThemedText>
      )}
      <ThemedText type="small" themeColor="textSecondary">
        {[
          `${queues.length} queue${queues.length === 1 ? '' : 's'}`,
          waiting > 0 && `${waiting} on a waiting list`,
          tunedOut > 0 && `${tunedOut} switched off`,
          'tap to see them all',
        ]
          .filter(Boolean)
          .join(' · ')}
      </ThemedText>
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <ThemedText type="label" themeColor="textSecondary">
        {title}
      </ThemedText>
      {children}
    </View>
  );
}

function PressableCard({ label, onPress, children }: { label: string; onPress: () => void; children: ReactNode }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}>
      {({ pressed }) => <Card style={pressed && styles.pressed}>{children}</Card>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.two,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  blocker: {
    gap: Spacing.two,
  },
  inline: {
    alignSelf: 'flex-start',
  },
  pressed: {
    opacity: 0.7,
  },
});

/** Asks for notifications (offers are time-limited), and registers the phone once allowed. */
function NotificationsPrompt() {
  const [permission, setPermission] = useState<PushPermission | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    pushPermission()
      .then(async (status) => setPermission(status === 'granted' ? await registerForPush({ ask: false }) : status))
      .catch((e) => setError(friendlyError(e)));
  }, []);

  async function turnOn() {
    setError(null);
    try {
      setPermission(await registerForPush({ ask: true }));
    } catch (e) {
      setError(friendlyError(e));
    }
  }

  if (error) return <Notice tone="warning" title="Notifications aren’t working" message={error} />;

  if (permission === 'undetermined') {
    return (
      <Card>
        <ThemedText type="heading">Get offers the moment they arrive</ThemedText>
        <ThemedText themeColor="textSecondary">
          You have a limited time to reply to each offer. Turn on notifications so you don’t miss one.
        </ThemedText>
        <Button label="Turn on notifications" onPress={turnOn} style={styles.inline} />
      </Card>
    );
  }

  if (permission === 'denied') {
    return (
      <View style={styles.blocker}>
        <Notice
          tone="warning"
          title="Notifications are off"
          message="We’ll email you new offers instead, but you may miss the time to reply. You can turn notifications on in Settings."
        />
        <Button label="Open Settings" variant="outline" onPress={() => Linking.openSettings()} />
      </View>
    );
  }

  return null;
}
