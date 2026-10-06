import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { LoadingScreen, Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Notice } from '@/components/ui/notice';
import { Radius, Spacing } from '@/constants/theme';
import { useNow } from '@/hooks/use-now';
import { formatTimeOfDay } from '@/lib/dates';
import { friendlyError } from '@/lib/errors';
import { BUDGET_NAMES, TIMING_NAMES } from '@/lib/labels';
import { formatUkPhone, telLink } from '@/lib/phone';
import { supabase } from '@/lib/supabase';
import { signedUrl } from '@/lib/upload';

async function loadMatch(id: string) {
  const match = await supabase
    .from('job_matches')
    .select('*, jobs(*, trade_categories(name), towns(name))')
    .eq('id', id)
    .single();
  if (match.error) throw match.error;
  const job = match.data.jobs!;

  const [contact, photos] = await Promise.all([
    supabase.rpc('get_match_contact', { p_match_id: id }),
    supabase.from('job_photos').select('storage_path').eq('job_id', job.id).order('created_at'),
  ]);
  const failed = [contact, photos].find((r) => r.error);
  if (failed) throw failed.error;

  const photoUrls = await Promise.all(
    (photos.data ?? []).map((p) => signedUrl('job-photos', p.storage_path).catch(() => null)),
  );

  return {
    match: match.data,
    job,
    // Only returned while the match is live.
    contact: contact.data?.[0] ?? null,
    photoUrls: photoUrls.filter(Boolean) as string[],
  };
}

type Loaded = Awaited<ReturnType<typeof loadMatch>>;

export default function TradeJobScreen() {
  const { id, won } = useLocalSearchParams<{ id: string; won?: string }>();
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const now = useNow(60_000);

  const reload = useCallback(async () => {
    try {
      setData(await loadMatch(id));
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

  const { match, job, contact } = data;
  const firstName = contact?.customer_name.split(' ')[0] || 'the customer';
  const address = contact && [contact.address_line, contact.postcode].filter(Boolean).join(', ');

  async function markContacted() {
    setBusy(true);
    setError(null);
    const { error } = await supabase.rpc('mark_contacted', { p_match_id: id });
    if (error) setError(friendlyError(error));
    await reload();
    setBusy(false);
  }

  return (
    <Screen edges={['left', 'right']} onRefresh={reload}>
      {won && contact && job.status === 'matched' && (
        <Notice tone="success" title="The job’s yours" message={`We’ve let ${firstName} know you’ll be in touch.`} />
      )}

      <View style={styles.title}>
        <ThemedText type="subtitle">{job.title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {[job.trade_categories?.name, `${job.towns?.name} (${job.district})`].filter(Boolean).join(' · ')}
        </ThemedText>
      </View>

      {error && <Notice message={error} />}

      {match.ended_at ? (
        <Notice
          tone="info"
          title="This job has ended"
          message={
            match.end_reason === 'customer_requested_another'
              ? 'The customer asked for a different trade.'
              : match.end_reason === 'cancelled'
                ? 'The customer cancelled the job.'
                : 'Backed. closed this job. Get in touch if you have questions.'
          }
        />
      ) : job.status === 'completed' ? (
        <Notice tone="success" title="Job completed" message="Signed off. Thanks for doing a great job." />
      ) : job.status === 'done' ? (
        <Notice tone="info" title="Waiting for sign-off" message={`We’ve asked ${firstName} to sign the job off.`} />
      ) : null}

      {contact && (
        <Card>
          <View style={styles.cardHeader}>
            <ThemedText type="heading">{contact.customer_name || 'The customer'}</ThemedText>
            {match.contacted_at && <Chip label="Contacted" tone="success" />}
          </View>
          {address ? <ThemedText>{address}</ThemedText> : null}
          {contact.customer_phone && (
            <ThemedText themeColor="textSecondary">{formatUkPhone(contact.customer_phone)}</ThemedText>
          )}
          <View style={styles.buttons}>
            {contact.customer_phone && (
              <Button label={`Call ${firstName}`} onPress={() => Linking.openURL(telLink(contact.customer_phone!))} />
            )}
            {address && (
              <Button
                label="Open in Maps"
                variant="outline"
                onPress={() =>
                  Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`)
                }
              />
            )}
          </View>

          {!match.contacted_at && job.status === 'matched' && (
            <>
              <Notice
                tone="warning"
                title={`Get in touch by ${formatTimeOfDay(match.contact_due_at, now)}`}
                message={`Call or text ${firstName} within 24 hours of accepting to arrange things. If they don’t hear from you, they may be offered another trade.`}
              />
              <Button
                label={busy ? 'Saving…' : `I’ve been in touch with ${firstName}`}
                variant="secondary"
                disabled={busy}
                onPress={markContacted}
              />
            </>
          )}
        </Card>
      )}

      <Card>
        <ThemedText type="heading">The job</ThemedText>
        {job.description ? <ThemedText>{job.description}</ThemedText> : null}
        <ThemedText type="small" themeColor="textSecondary">
          {[
            job.is_callout ? 'Emergency' : TIMING_NAMES[job.timing],
            `Budget: ${BUDGET_NAMES[job.budget]}`,
            job.size === 'large' && 'Bigger project',
          ]
            .filter(Boolean)
            .join(' · ')}
        </ThemedText>
        {data.photoUrls.length > 0 && (
          <View style={styles.photos}>
            {data.photoUrls.map((url) => (
              <Image key={url} source={{ uri: url }} style={styles.photo} contentFit="cover" accessibilityLabel="Job photo" />
            ))}
          </View>
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    gap: Spacing.two,
  },
  cardHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  buttons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
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
