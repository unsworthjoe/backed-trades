import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { ReportProblem } from '@/components/report-problem';
import { LoadingScreen, Screen } from '@/components/screen';
import { StarInput, Stars } from '@/components/stars';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { ChoiceChip } from '@/components/ui/choice-chip';
import { Notice } from '@/components/ui/notice';
import { TextField } from '@/components/ui/text-field';
import { Radius, Spacing } from '@/constants/theme';
import { useNow } from '@/hooks/use-now';
import { useAuth } from '@/lib/auth';
import { formatTimeOfDay } from '@/lib/dates';
import { friendlyError } from '@/lib/errors';
import { BUDGET_NAMES, CUSTOMER_RATING_TAGS, TIMING_NAMES } from '@/lib/labels';
import { formatUkPhone, telLink } from '@/lib/phone';
import { supabase } from '@/lib/supabase';
import { signedUrl } from '@/lib/upload';

/** Days after completion that both sides can still rate (app_settings.review_window_days). */
const REVIEW_WINDOW_DAYS = 14;

async function loadMatch(id: string, userId: string) {
  const match = await supabase
    .from('job_matches')
    .select('*, jobs(*, trade_categories(name), towns(name))')
    .eq('id', id)
    .single();
  if (match.error) throw match.error;
  const job = match.data.jobs!;

  const [contact, photos, unread, myRating, review] = await Promise.all([
    supabase.rpc('get_match_contact', { p_match_id: id }),
    supabase.from('job_photos').select('storage_path').eq('job_id', job.id).order('created_at'),
    supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('match_id', id)
      .neq('sender_id', userId)
      .is('read_at', null),
    supabase.from('customer_ratings').select('id').eq('match_id', id).maybeSingle(),
    // Only readable once it's been released (both rated, or the window ended).
    supabase.from('reviews').select('overall, comment').eq('match_id', id).maybeSingle(),
  ]);
  const failed = [contact, photos, unread, myRating, review].find((r) => r.error);
  if (failed) throw failed.error;

  const photoUrls = await Promise.all(
    (photos.data ?? []).map((p) => signedUrl('job-photos', p.storage_path).catch(() => null)),
  );

  return {
    match: match.data,
    job,
    // Only returned while the match is live.
    contact: contact.data?.[0] ?? null,
    unread: unread.count ?? 0,
    rated: !!myRating.data,
    review: review.data,
    photoUrls: photoUrls.filter(Boolean) as string[],
  };
}

type Loaded = Awaited<ReturnType<typeof loadMatch>>;

export default function TradeJobScreen() {
  const { id, won } = useLocalSearchParams<{ id: string; won?: string }>();
  const { session } = useAuth();
  const userId = session!.user.id;
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDone, setConfirmDone] = useState(false);
  const now = useNow(60_000);

  const reload = useCallback(async () => {
    try {
      setData(await loadMatch(id, userId));
    } catch (e) {
      setError(friendlyError(e));
    }
  }, [id, userId]);

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
  const live = !match.ended_at;
  const completedAt = match.signed_off_at ?? match.auto_closed_at;
  const windowOpen =
    !completedAt || now < new Date(completedAt).getTime() + REVIEW_WINDOW_DAYS * 24 * 60 * 60_000;
  const canRate = live && !!match.done_at && !data.rated && windowOpen;

  async function act(run: () => PromiseLike<{ error: unknown }>) {
    setBusy(true);
    setError(null);
    const { error } = await run();
    if (error) setError(friendlyError(error));
    setConfirmDone(false);
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
        <Notice
          tone="success"
          title="Job completed"
          message={match.signed_off_at ? `${firstName} signed the job off. Nice work.` : 'Closed as completed.'}
        />
      ) : job.status === 'done' ? (
        <Notice
          tone="info"
          title="Waiting for sign-off"
          message={`We’ve asked ${firstName} to sign the job off. If they don’t within 2 days, it closes as completed.`}
        />
      ) : null}

      {contact && (
        <Card>
          <View style={styles.cardHeader}>
            <ThemedText type="heading">{contact.customer_name || 'The customer'}</ThemedText>
            {match.contacted_at && job.status === 'matched' && <Chip label="Contacted" tone="success" />}
          </View>
          {address ? <ThemedText>{address}</ThemedText> : null}
          {contact.customer_phone && (
            <ThemedText themeColor="textSecondary">{formatUkPhone(contact.customer_phone)}</ThemedText>
          )}
          <View style={styles.buttons}>
            <Button
              label={data.unread ? `Messages (${data.unread} new)` : 'Messages'}
              onPress={() => router.push({ pathname: '/jobs/[id]/messages', params: { id } })}
            />
            {contact.customer_phone && (
              <Button
                label={`Call ${firstName}`}
                variant="outline"
                onPress={() => Linking.openURL(telLink(contact.customer_phone!))}
              />
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
                message={`Call, text or message ${firstName} within 24 hours of accepting to arrange things. If they don’t hear from you, they may be offered another trade.`}
              />
              <Button
                label={busy ? 'Saving…' : `I’ve been in touch with ${firstName}`}
                variant="secondary"
                disabled={busy}
                onPress={() => act(() => supabase.rpc('mark_contacted', { p_match_id: id }))}
              />
            </>
          )}
        </Card>
      )}

      {live && job.status === 'matched' && (
        <Card>
          <ThemedText type="heading">Finished the work?</ThemedText>
          {confirmDone ? (
            <>
              <ThemedText themeColor="textSecondary">
                We’ll ask {firstName} to sign the job off. Only do this once the work is finished.
              </ThemedText>
              <View style={styles.buttons}>
                <Button
                  label={busy ? 'Saving…' : 'Yes, it’s done'}
                  disabled={busy}
                  onPress={() => act(() => supabase.rpc('mark_done', { p_match_id: id }))}
                />
                <Button label="Not yet" variant="outline" onPress={() => setConfirmDone(false)} />
              </View>
            </>
          ) : (
            <>
              <ThemedText themeColor="textSecondary">
                Mark the job as done and we’ll ask {firstName} to sign it off and leave a review.
              </ThemedText>
              <Button label="Mark as done" variant="secondary" onPress={() => setConfirmDone(true)} style={styles.inline} />
            </>
          )}
        </Card>
      )}

      {canRate && <RateCustomer matchId={id} firstName={firstName} onRated={reload} />}
      {data.rated && !data.review && live && match.done_at && (
        <Notice
          tone="info"
          message={`Thanks for rating ${firstName}. You’ll see their review of you once they’ve left one, or ${REVIEW_WINDOW_DAYS} days after the job is completed.`}
        />
      )}

      {data.review && (
        <Card>
          <ThemedText type="heading">{firstName}’s review</ThemedText>
          <Stars value={Number(data.review.overall)} />
          {data.review.comment ? <ThemedText>“{data.review.comment}”</ThemedText> : null}
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

      {live && <ReportProblem jobId={job.id} aboutUserId={job.customer_id} from="trade" />}
    </Screen>
  );
}

/** The trade rates the customer. Never shown to the customer; other trades see an average on offers. */
function RateCustomer({ matchId, firstName, onRated }: { matchId: string; firstName: string; onRated: () => void }) {
  const [stars, setStars] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setBusy(true);
    setError(null);
    const { error } = await supabase.rpc('rate_customer', {
      p_match_id: matchId,
      p_stars: stars,
      p_tags: tags,
      p_comment: comment.trim(),
    });
    setBusy(false);
    if (error) {
      setError(friendlyError(error));
      return;
    }
    onRated();
  }

  return (
    <Card>
      <ThemedText type="heading">How was {firstName} to work for?</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {firstName} won’t see this. Other trades see an average once a customer has a few ratings.
      </ThemedText>
      <StarInput label="Overall" value={stars} onChange={setStars} />
      <View style={styles.buttons}>
        {CUSTOMER_RATING_TAGS.map((tag) => (
          <ChoiceChip
            key={tag.value}
            label={tag.label}
            selected={tags.includes(tag.value)}
            onPress={() =>
              setTags((current) =>
                current.includes(tag.value) ? current.filter((t) => t !== tag.value) : [...current, tag.value],
              )
            }
          />
        ))}
      </View>
      <TextField label="Anything to add? (optional)" value={comment} onChangeText={setComment} multiline maxLength={1000} />
      {error && <Notice message={error} />}
      <Button label={busy ? 'Saving…' : 'Save rating'} disabled={!stars || busy} onPress={send} style={styles.inline} />
    </Card>
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
  inline: {
    alignSelf: 'flex-start',
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
