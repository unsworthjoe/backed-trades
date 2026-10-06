import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { PhoneSignIn } from '@/components/phone-sign-in';
import { ReportProblem } from '@/components/report-problem';
import { LoadingScreen, Screen } from '@/components/screen';
import { SiteHeader } from '@/components/site-header';
import { StarInput } from '@/components/stars';
import { ThemedText } from '@/components/themed-text';
import { RatingSummary, ReviewList, TradeChecks } from '@/components/trade-profile-view';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Notice } from '@/components/ui/notice';
import { TextField } from '@/components/ui/text-field';
import { Radius, Spacing } from '@/constants/theme';
import { useNow } from '@/hooks/use-now';
import { useAuth } from '@/lib/auth';
import { formatDate } from '@/lib/dates';
import { friendlyError } from '@/lib/errors';
import { BUDGET_NAMES, JOB_STATUS, TIMING_NAMES } from '@/lib/labels';
import { formatUkPhone, telLink } from '@/lib/phone';
import { supabase } from '@/lib/supabase';
import { loadTradeProfile } from '@/lib/trade-profile';
import { signedUrl } from '@/lib/upload';

/** Days after completion that the customer can still leave a review (app_settings.review_window_days). */
const REVIEW_WINDOW_DAYS = 14;

async function loadJob(id: string, userId: string) {
  const [job, address, photos, match] = await Promise.all([
    supabase.from('jobs').select('*, trade_categories(name), towns(name)').eq('id', id).single(),
    supabase.from('job_addresses').select('*').eq('job_id', id).maybeSingle(),
    supabase.from('job_photos').select('storage_path').eq('job_id', id).order('created_at'),
    supabase
      .from('job_matches')
      .select('id, trade_id, signed_off_at, auto_closed_at')
      .eq('job_id', id)
      .is('ended_at', null)
      .maybeSingle(),
  ]);
  const failed = [job, address, photos, match].find((r) => r.error);
  if (failed) throw failed.error;

  const m = match.data;
  const [contact, profile, unread, review] = m
    ? await Promise.all([
        supabase.rpc('get_match_contact', { p_match_id: m.id }).then((r) => r.data?.[0] ?? null),
        loadTradeProfile(m.trade_id).catch(() => null),
        supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('match_id', m.id)
          .neq('sender_id', userId)
          .is('read_at', null)
          .then((r) => r.count ?? 0),
        supabase
          .from('reviews')
          .select('overall, released_at')
          .eq('match_id', m.id)
          .maybeSingle()
          .then((r) => r.data),
      ])
    : [null, null, 0, null];
  const photoUrls = await Promise.all(
    (photos.data ?? []).map((p) => signedUrl('job-photos', p.storage_path).catch(() => null)),
  );

  return {
    job: job.data!,
    address: address.data,
    match: m,
    contact,
    profile,
    unread,
    review,
    photoUrls: photoUrls.filter(Boolean) as string[],
  };
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
  return <JobDetails userId={session.user.id} />;
}

function JobDetails({ userId }: { userId: string }) {
  const { id, posted } = useLocalSearchParams<{ id: string; posted?: string }>();
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Actions that can't be undone need a second tap (no pop-up dialogs on the web).
  const [confirming, setConfirming] = useState<'cancel' | 'another' | null>(null);
  const now = useNow(60_000);

  const reload = useCallback(async () => {
    try {
      setData(await loadJob(id, userId));
    } catch (e) {
      setError(friendlyError(e));
    }
  }, [id, userId]);

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

  const { job, address, contact, match, profile } = data;
  const status = JOB_STATUS[job.status];
  const category = job.trade_categories?.name?.toLowerCase() ?? 'trade';
  const canChange = job.status === 'offering' || job.status === 'matched';
  const tradeName = contact?.trade_business_name ?? profile?.business_name ?? 'Your trade';
  const completedAt = match?.signed_off_at ?? match?.auto_closed_at ?? null;
  const canReview =
    job.status === 'completed' &&
    !!match &&
    !data.review &&
    !!completedAt &&
    now < new Date(completedAt).getTime() + REVIEW_WINDOW_DAYS * 24 * 60 * 60_000;
  const messagesButton = match && (
    <Button
      label={data.unread ? `Messages (${data.unread} new)` : `Message ${tradeName}`}
      onPress={() => router.push({ pathname: '/my-jobs/[id]/messages', params: { id } })}
      style={styles.inline}
    />
  );

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
          <ThemedText type="heading">{tradeName} has your job</ThemedText>
          <ThemedText themeColor="textSecondary">They’ll be in touch within 24 hours to arrange things.</ThemedText>
          <View style={styles.buttons}>
            {messagesButton}
            {contact.trade_phone && (
              <Button
                label={`Call ${formatUkPhone(contact.trade_phone)}`}
                variant="outline"
                onPress={() => Linking.openURL(telLink(contact.trade_phone!))}
              />
            )}
          </View>
          {confirming === 'another' ? (
            <View style={styles.confirm}>
              <ThemedText type="small">
                We’ll end this match and offer your job to the next trade. {tradeName} will be told.
              </ThemedText>
              <View style={styles.buttons}>
                <Button label="Yes, find someone else" disabled={busy} onPress={() => act('request_another_trade')} />
                <Button label="Keep this trade" variant="outline" onPress={() => setConfirming(null)} />
              </View>
            </View>
          ) : (
            <Button
              label="Ask for a different trade"
              variant="secondary"
              onPress={() => setConfirming('another')}
              style={styles.inline}
            />
          )}
        </Card>
      )}

      {job.status === 'done' && (
        <Card>
          <ThemedText type="heading">{tradeName} says the job is done</ThemedText>
          <ThemedText themeColor="textSecondary">
            If you’re happy it’s finished, sign it off. If there’s a problem, message {tradeName} first.
          </ThemedText>
          <View style={styles.buttons}>
            <Button label="Sign the job off" disabled={busy} onPress={() => act('sign_off')} />
            {messagesButton}
          </View>
        </Card>
      )}

      {job.status === 'completed' && match && (
        <>
          {canReview ? (
            <ReviewForm matchId={match.id} tradeName={tradeName} onSaved={reload} />
          ) : data.review ? (
            <Notice
              tone="success"
              title="Thanks for your review"
              message={
                data.review.released_at
                  ? `It’s now on ${tradeName}’s profile.`
                  : `It’ll appear on ${tradeName}’s profile once they’ve rated the job too, or ${REVIEW_WINDOW_DAYS} days after it was completed.`
              }
            />
          ) : (
            <Notice tone="success" title="Job completed" message="Thanks for using Backed." />
          )}
          {messagesButton}
        </>
      )}
      {job.status === 'cancelled' && <Notice tone="info" message="You cancelled this job." />}

      {profile && match && (
        <Card>
          <ThemedText type="heading">About {profile.business_name}</ThemedText>
          {profile.bio ? <ThemedText>{profile.bio}</ThemedText> : null}
          <RatingSummary profile={profile} />
          <TradeChecks profile={profile} />
          {profile.reviews.length > 0 && <ReviewList profile={profile} limit={3} />}
        </Card>
      )}

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
              Trades will stop being offered it{contact ? `, and ${tradeName} will be told` : ''}.
            </ThemedText>
            <View style={styles.buttons}>
              <Button label="Yes, cancel it" disabled={busy} onPress={() => act('cancel_job')} />
              <Button label="Keep it" variant="outline" onPress={() => setConfirming(null)} />
            </View>
          </Card>
        ) : (
          <Button label="Cancel this job" variant="outline" onPress={() => setConfirming('cancel')} style={styles.inline} />
        ))}

      {match && <ReportProblem jobId={job.id} aboutUserId={match.trade_id} from="customer" />}
    </Screen>
  );
}

/** The customer's review: four parts out of 5, and a comment. Published once both sides have rated. */
function ReviewForm({ matchId, tradeName, onSaved }: { matchId: string; tradeName: string; onSaved: () => void }) {
  const [scores, setScores] = useState({ quality: 0, reliability: 0, tidiness: 0, value: 0 });
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const complete = Object.values(scores).every((s) => s > 0);

  async function save() {
    setBusy(true);
    setError(null);
    const { error } = await supabase.rpc('leave_review', {
      p_match_id: matchId,
      p_quality: scores.quality,
      p_reliability: scores.reliability,
      p_tidiness: scores.tidiness,
      p_value: scores.value,
      p_comment: comment.trim(),
    });
    setBusy(false);
    if (error) {
      setError(friendlyError(error));
      return;
    }
    onSaved();
  }

  const parts: [keyof typeof scores, string][] = [
    ['quality', 'Quality of work'],
    ['reliability', 'Reliability and timekeeping'],
    ['tidiness', 'Tidiness'],
    ['value', 'Value for money'],
  ];

  return (
    <Card>
      <ThemedText type="heading">How did {tradeName} do?</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Your review helps other people in your area. Only customers who’ve had a job done can leave one.
      </ThemedText>
      {parts.map(([key, label]) => (
        <StarInput key={key} label={label} value={scores[key]} onChange={(n) => setScores((s) => ({ ...s, [key]: n }))} />
      ))}
      <TextField
        label="Tell others about the job (optional)"
        value={comment}
        onChangeText={setComment}
        multiline
        maxLength={2000}
      />
      {error && <Notice message={error} />}
      <Button label={busy ? 'Saving…' : 'Post my review'} disabled={!complete || busy} onPress={save} style={styles.inline} />
    </Card>
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
