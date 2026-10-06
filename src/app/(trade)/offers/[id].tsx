import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { OfferCountdown } from '@/components/offer-countdown';
import { LoadingScreen, Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { ChoiceChip } from '@/components/ui/choice-chip';
import { Notice } from '@/components/ui/notice';
import { TextField } from '@/components/ui/text-field';
import { Radius, Spacing } from '@/constants/theme';
import { useNow } from '@/hooks/use-now';
import { formatTimeOfDay } from '@/lib/dates';
import { friendlyError } from '@/lib/errors';
import { BUDGET_NAMES, DECLINE_REASONS, TIMING_NAMES } from '@/lib/labels';
import { supabase } from '@/lib/supabase';
import { signedUrl } from '@/lib/upload';

type DeclineReason = (typeof DECLINE_REASONS)[number]['value'];

async function loadOffer(id: string) {
  const offer = await supabase
    .from('job_offers')
    .select('*, jobs(*, trade_categories(name), towns(name))')
    .eq('id', id)
    .single();
  if (offer.error) throw offer.error;
  const job = offer.data.jobs!;

  const [photos, rating, match] = await Promise.all([
    supabase.from('job_photos').select('storage_path').eq('job_id', job.id).order('created_at'),
    supabase.rpc('job_customer_rating', { p_job_id: job.id }),
    // Only visible if this trade won it.
    supabase.from('job_matches').select('id').eq('offer_id', id).is('ended_at', null).maybeSingle(),
  ]);
  const failed = [photos, rating, match].find((r) => r.error);
  if (failed) throw failed.error;

  const photoUrls = await Promise.all(
    (photos.data ?? []).map((p) => signedUrl('job-photos', p.storage_path).catch(() => null)),
  );

  return {
    offer: offer.data,
    job,
    rating: rating.data?.[0] ?? null,
    matchId: match.data?.id ?? null,
    photoUrls: photoUrls.filter(Boolean) as string[],
  };
}

type Loaded = Awaited<ReturnType<typeof loadOffer>>;

export default function OfferScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState<DeclineReason | null>(null);
  const [note, setNote] = useState('');
  const now = useNow();

  const reload = useCallback(async () => {
    try {
      setData(await loadOffer(id));
    } catch (e) {
      setError(friendlyError(e));
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  if (!data) {
    return error ? (
      <Screen edges={['left', 'right']}>
        <Notice message={error} />
      </Screen>
    ) : (
      <LoadingScreen />
    );
  }

  const { offer, job, rating } = data;
  const live = offer.status === 'pending' && new Date(offer.expires_at).getTime() > now;
  const category = job.trade_categories?.name;

  async function accept() {
    setBusy(true);
    setError(null);
    const { data: matchId, error } = await supabase.rpc('accept_offer', { p_offer_id: id });
    setBusy(false);
    if (error) {
      setError(friendlyError(error));
      await reload();
      return;
    }
    router.replace({ pathname: '/jobs/[id]', params: { id: matchId, won: '1' } });
  }

  async function decline() {
    if (!reason) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.rpc('decline_offer', {
      p_offer_id: id,
      p_reason: reason,
      p_note: note.trim() || undefined,
    });
    setBusy(false);
    if (error) {
      setError(friendlyError(error));
      await reload();
      return;
    }
    router.back();
  }

  return (
    <Screen
      edges={['left', 'right']}
      footer={
        live ? (
          declining ? (
            <>
              <Button
                label={busy ? 'Declining…' : 'Decline this job'}
                size="large"
                disabled={!reason || busy}
                onPress={decline}
              />
              <Button label="Back" variant="outline" onPress={() => setDeclining(false)} />
            </>
          ) : (
            <>
              <Button label={busy ? 'Accepting…' : 'Accept this job'} size="large" disabled={busy} onPress={accept} />
              <Button label="Decline" variant="outline" disabled={busy} onPress={() => setDeclining(true)} />
            </>
          )
        ) : undefined
      }>
      <View style={styles.title}>
        <View style={styles.chips}>
          {live && <OfferCountdown expiresAt={offer.expires_at} />}
          {job.is_callout && <Chip label="Emergency" tone="danger" />}
          {job.size === 'large' && <Chip label="Bigger project" tone="info" />}
        </View>
        <ThemedText type="subtitle">{job.title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {[category, `${job.towns?.name} (${job.district})`, `sent ${formatTimeOfDay(offer.offered_at, now)}`]
            .filter(Boolean)
            .join(' · ')}
        </ThemedText>
      </View>

      {error && <Notice message={error} />}
      <OfferOutcome status={offer.status} jobStatus={job.status} matchId={data.matchId} live={live} />

      {live && !declining && (
        <Notice
          tone="info"
          message={`You’re one of a few trades offered this job. The first to accept gets it, along with the customer’s address and phone number.${
            offer.expires_at && new Date(offer.expires_at).getTime() - now > 2 * 60 * 60_000
              ? ' The reply clock stops between 8pm and 7am.'
              : ''
          }`}
        />
      )}

      {declining ? (
        <Card>
          <ThemedText type="heading">Why are you declining?</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            The customer won’t see this. It helps us send you the right jobs.
          </ThemedText>
          <View style={styles.chips}>
            {DECLINE_REASONS.map((r) => (
              <ChoiceChip key={r.value} label={r.label} selected={reason === r.value} onPress={() => setReason(r.value)} />
            ))}
          </View>
          {reason === 'not_my_kind_of_work' && (
            <ThemedText type="small" themeColor="textSecondary">
              If you pick this 3 times for {category?.toLowerCase() ?? 'these'} jobs in {job.towns?.name}, we’ll stop
              sending you them. You keep your place, and can switch them back on from Your queues.
            </ThemedText>
          )}
          <TextField
            label="Anything to add? (optional)"
            value={note}
            onChangeText={setNote}
            multiline
            maxLength={500}
          />
          <ThemedText type="small" themeColor="textSecondary">
            Declining 5 offers in a row in a queue moves you to the back of it.
          </ThemedText>
        </Card>
      ) : (
        <>
          <Card>
            <ThemedText type="heading">The job</ThemedText>
            {job.description ? <ThemedText>{job.description}</ThemedText> : null}
            <Detail label="When" value={job.is_callout ? 'Emergency: as soon as possible' : TIMING_NAMES[job.timing]} />
            <Detail label="Budget" value={BUDGET_NAMES[job.budget]} />
            <Detail label="Where" value={`${job.towns?.name}, ${job.district}. Full address once you accept.`} />
            {data.photoUrls.length > 0 && (
              <View style={styles.photos}>
                {data.photoUrls.map((url) => (
                  <Image key={url} source={{ uri: url }} style={styles.photo} contentFit="cover" accessibilityLabel="Job photo" />
                ))}
              </View>
            )}
          </Card>

          <Card>
            <ThemedText type="heading">The customer</ThemedText>
            <ThemedText themeColor="textSecondary">
              {!rating || rating.is_new_customer
                ? 'New to Backed.'
                : `Rated ${rating.average_stars} out of 5 by ${rating.rating_count} trades`}
            </ThemedText>
          </Card>
        </>
      )}
    </Screen>
  );
}

/** What happened to an offer that can't be answered any more. */
function OfferOutcome({
  status,
  jobStatus,
  matchId,
  live,
}: {
  status: string;
  jobStatus: string;
  matchId: string | null;
  live: boolean;
}) {
  if (live) return null;
  if (status === 'accepted' && matchId) {
    return (
      <View style={styles.outcome}>
        <Notice tone="success" title="You accepted this job" message="The customer’s details are on the job." />
        <Button
          label="Open the job"
          onPress={() => router.replace({ pathname: '/jobs/[id]', params: { id: matchId } })}
        />
      </View>
    );
  }
  if (status === 'accepted') return <Notice tone="info" message="You accepted this job, but it has since ended." />;
  if (status === 'declined') return <Notice tone="info" message="You declined this job." />;
  if (status === 'withdrawn') {
    return (
      <Notice
        tone="info"
        message={jobStatus === 'cancelled' ? 'The customer cancelled this job.' : 'Another trade accepted this job first.'}
      />
    );
  }
  return (
    <Notice
      tone="warning"
      title="This offer ran out"
      message="No reply counts as a decline. 3 missed offers in a row pauses your offers."
    />
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detail}>
      <ThemedText type="smallBold" style={styles.detailLabel}>
        {label}
      </ThemedText>
      <ThemedText type="small" style={styles.detailValue}>
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    gap: Spacing.two,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  outcome: {
    gap: Spacing.two,
  },
  detail: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  detailLabel: {
    width: 64,
  },
  detailValue: {
    flex: 1,
  },
  photos: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  photo: {
    width: 104,
    height: 104,
    borderRadius: Radius.small,
  },
});
