import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { PhoneSignIn } from '@/components/phone-sign-in';
import { LoadingScreen, Screen } from '@/components/screen';
import { SiteHeader } from '@/components/site-header';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Notice } from '@/components/ui/notice';
import { Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { formatDate } from '@/lib/dates';
import { friendlyError } from '@/lib/errors';
import { BUDGET_NAMES, JOB_STATUS, TIMING_NAMES } from '@/lib/labels';
import { supabase } from '@/lib/supabase';
import { formatUkPhone, telLink } from '@/lib/phone';
import { signedUrl } from '@/lib/upload';

async function loadJob(id: string) {
  const [job, address, photos, match] = await Promise.all([
    supabase.from('jobs').select('*, trade_categories(name), towns(name)').eq('id', id).single(),
    supabase.from('job_addresses').select('*').eq('job_id', id).maybeSingle(),
    supabase.from('job_photos').select('storage_path').eq('job_id', id).order('created_at'),
    supabase.from('job_matches').select('id').eq('job_id', id).is('ended_at', null).maybeSingle(),
  ]);
  const failed = [job, address, photos, match].find((r) => r.error);
  if (failed) throw failed.error;

  const contact = match.data
    ? (await supabase.rpc('get_match_contact', { p_match_id: match.data.id })).data?.[0] ?? null
    : null;
  const photoUrls = await Promise.all(
    (photos.data ?? []).map((p) => signedUrl('job-photos', p.storage_path).catch(() => null)),
  );

  return { job: job.data!, address: address.data, contact, photoUrls: photoUrls.filter(Boolean) as string[] };
}

type Loaded = Awaited<ReturnType<typeof loadJob>>;

export default function JobScreen() {
  const { session } = useAuth();

  if (!session) {
    return (
      <Screen>
        <SiteHeader />
        <ThemedText type="subtitle">Sign in to see your job</ThemedText>
        <Card>
          <PhoneSignIn onSignedIn={() => {}} submitLabel="Sign in" />
        </Card>
      </Screen>
    );
  }
  return <JobDetails />;
}

function JobDetails() {
  const { id, posted } = useLocalSearchParams<{ id: string; posted?: string }>();
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Actions that can't be undone need a second tap (no pop-up dialogs on the web).
  const [confirming, setConfirming] = useState<'cancel' | 'another' | null>(null);

  const reload = useCallback(async () => {
    try {
      setData(await loadJob(id));
    } catch (e) {
      setError(friendlyError(e));
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  async function act(fn: 'cancel_job' | 'request_another_trade' | 'sign_off') {
    setBusy(true);
    setError(null);
    const { error } = await supabase.rpc(fn, { p_job_id: id });
    if (error) setError(friendlyError(error));
    setConfirming(null);
    await reload();
    setBusy(false);
  }

  if (!data) {
    return error ? (
      <Screen>
        <SiteHeader />
        <Notice message={error} />
      </Screen>
    ) : (
      <LoadingScreen />
    );
  }

  const { job, address, contact } = data;
  const status = JOB_STATUS[job.status];
  const category = job.trade_categories?.name?.toLowerCase() ?? 'trade';
  const canChange = job.status === 'offering' || job.status === 'matched';

  return (
    <Screen>
      <SiteHeader />

      {posted && job.status === 'offering' && (
        <Notice tone="success" title="Your job is posted" message="We’ll text you as soon as a trade accepts it." />
      )}

      <View style={styles.title}>
        <Chip label={status.label} tone={status.tone} />
        <ThemedText type="subtitle">{job.title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {[job.trade_categories?.name, job.towns?.name, `posted ${formatDate(job.created_at)}`].filter(Boolean).join(' · ')}
        </ThemedText>
      </View>

      {error && <Notice message={error} />}

      {job.status === 'offering' && (
        <Card>
          <ThemedText type="heading">{job.is_callout ? 'Finding someone now' : 'Finding your trade'}</ThemedText>
          <ThemedText themeColor="textSecondary">
            {job.is_callout
              ? `It’s an emergency, so we’ve sent it to every available ${category} nearby. You’ll get a text the moment one accepts.`
              : `Your job has gone to vetted ${category}s in ${job.towns?.name ?? 'your area'}, in turn. You’ll get a text as soon as one accepts.`}
          </ThemedText>
          {job.unmatched_alerted_at && (
            <Notice
              tone="info"
              message="It’s taking longer than usual to find someone. Your job stays listed, and the Backed. team is looking into it."
            />
          )}
        </Card>
      )}

      {contact && job.status === 'matched' && (
        <Card>
          <ThemedText type="heading">{contact.trade_business_name} has your job</ThemedText>
          <ThemedText themeColor="textSecondary">They’ll be in touch within 24 hours to arrange things.</ThemedText>
          {contact.trade_phone && (
            <Button
              label={`Call ${formatUkPhone(contact.trade_phone)}`}
              variant="outline"
              onPress={() => Linking.openURL(telLink(contact.trade_phone!))}
              style={styles.inline}
            />
          )}
          {confirming === 'another' ? (
            <View style={styles.confirm}>
              <ThemedText type="small">
                We’ll end this match and offer your job to the next trade. {contact.trade_business_name} will be told.
              </ThemedText>
              <View style={styles.buttons}>
                <Button label="Yes, find someone else" disabled={busy} onPress={() => act('request_another_trade')} />
                <Button label="Keep this trade" variant="outline" onPress={() => setConfirming(null)} />
              </View>
            </View>
          ) : (
            <Button label="Ask for a different trade" variant="secondary" onPress={() => setConfirming('another')} style={styles.inline} />
          )}
        </Card>
      )}

      {job.status === 'done' && (
        <Card>
          <ThemedText type="heading">{contact?.trade_business_name ?? 'Your trade'} says the job is done</ThemedText>
          <ThemedText themeColor="textSecondary">
            If you’re happy it’s finished, sign it off. If there’s a problem, contact the trade first.
          </ThemedText>
          <Button label="Sign the job off" disabled={busy} onPress={() => act('sign_off')} style={styles.inline} />
        </Card>
      )}

      {job.status === 'completed' && (
        <Notice tone="success" title="Job completed" message="Thanks for using Backed. Reviews are coming soon." />
      )}
      {job.status === 'cancelled' && <Notice tone="info" message="You cancelled this job." />}

      <Card>
        <ThemedText type="heading">Your job details</ThemedText>
        {job.description ? <ThemedText>{job.description}</ThemedText> : null}
        <ThemedText type="small" themeColor="textSecondary">
          {[
            address?.postcode && `${address.address_line ? `${address.address_line}, ` : ''}${address.postcode}`,
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

      {canChange &&
        (confirming === 'cancel' ? (
          <Card>
            <ThemedText type="smallBold">Cancel this job?</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Trades will stop being offered it{contact ? `, and ${contact.trade_business_name} will be told` : ''}.
            </ThemedText>
            <View style={styles.buttons}>
              <Button label="Yes, cancel it" disabled={busy} onPress={() => act('cancel_job')} />
              <Button label="Keep it" variant="outline" onPress={() => setConfirming(null)} />
            </View>
          </Card>
        ) : (
          <Button label="Cancel this job" variant="outline" onPress={() => setConfirming('cancel')} style={styles.inline} />
        ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    gap: Spacing.two,
  },
  inline: {
    alignSelf: 'flex-start',
  },
  confirm: {
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
    width: 140,
    height: 140,
    borderRadius: Radius.small,
  },
});
