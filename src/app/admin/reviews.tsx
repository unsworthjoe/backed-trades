import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AdminHeader } from '@/components/admin-header';
import { Screen } from '@/components/screen';
import { Stars } from '@/components/stars';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { ChoiceChip } from '@/components/ui/choice-chip';
import { Notice } from '@/components/ui/notice';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { formatDate } from '@/lib/dates';
import { friendlyError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

type Filter = 'recent' | 'low' | 'hidden' | 'unreleased';

const FILTERS: { key: Filter; label: string; empty: string }[] = [
  { key: 'recent', label: 'Published', empty: 'No published reviews yet.' },
  { key: 'low', label: '2.5 stars or less', empty: 'No low reviews.' },
  { key: 'hidden', label: 'Hidden', empty: 'No hidden reviews.' },
  { key: 'unreleased', label: 'Not published yet', empty: 'Every review has been published.' },
];

/** Allowed reasons for hiding. Being negative is never one of them. */
const HIDE_REASONS = [
  'Offensive or abusive language',
  'Shares personal details',
  'Not about this job',
  'Spam or fake',
  'Something else',
];

const SELECT =
  'id, overall, quality, reliability, tidiness, value, comment, created_at, released_at, hidden_at, hidden_reason, trade_id, trades(business_name), customer:profiles!reviews_customer_id_fkey(full_name)';

async function loadReviews(filter: Filter) {
  let query = supabase.from('reviews').select(SELECT);
  if (filter === 'hidden') {
    query = query.not('hidden_at', 'is', null).order('hidden_at', { ascending: false });
  } else if (filter === 'unreleased') {
    query = query.is('released_at', null).order('created_at', { ascending: false });
  } else {
    query = query.not('released_at', 'is', null).is('hidden_at', null).order('released_at', { ascending: false });
    if (filter === 'low') query = query.lte('overall', 2.5);
  }
  const { data, error } = await query.limit(200);
  if (error) throw error;
  return data;
}

type Review = Awaited<ReturnType<typeof loadReviews>>[number];

/** Customers' reviews of trades. Founders can hide ones that break the rules. */
export default function AdminReviewsScreen() {
  const [filter, setFilter] = useState<Filter>('recent');
  const [rows, setRows] = useState<Review[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setRows(await loadReviews(filter));
    } catch (e) {
      setError(friendlyError(e));
    }
  }, [filter]);

  useFocusEffect(
    useCallback(() => {
      setRows(null);
      setError(null);
      reload();
    }, [reload]),
  );

  const current = FILTERS.find((f) => f.key === filter)!;

  return (
    <Screen>
      <AdminHeader />
      <ThemedText type="subtitle">Reviews</ThemedText>
      <Notice
        tone="info"
        title="Only hide reviews that break the rules"
        message="UK law (the DMCC Act) doesn’t allow hiding genuine reviews because they’re negative. Hide one only if it’s abusive, shares personal details, isn’t about the job, or is spam or fake. The reason is recorded."
      />
      <View style={styles.filters}>
        {FILTERS.map((f) => (
          <ChoiceChip key={f.key} label={f.label} selected={filter === f.key} onPress={() => setFilter(f.key)} />
        ))}
      </View>
      {filter === 'unreleased' && (
        <ThemedText type="small" themeColor="textSecondary">
          Reviews are blind: they’re published once both sides have rated, or 14 days after the job is completed.
          The trade can’t see these yet.
        </ThemedText>
      )}

      {error && <Notice message={error} />}
      {rows && rows.length === 0 && <ThemedText themeColor="textSecondary">{current.empty}</ThemedText>}
      {rows?.map((review) => (
        <ReviewCard key={review.id} review={review} onChanged={reload} />
      ))}
    </Screen>
  );
}

function ReviewCard({ review, onChanged }: { review: Review; onChanged: () => Promise<void> }) {
  const [hiding, setHiding] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstName = review.customer?.full_name?.split(' ')[0] || 'A customer';
  const needsNote = reason === 'Something else';

  async function setHidden(hidden: boolean) {
    setBusy(true);
    setError(null);
    const fullReason = hidden ? [needsNote ? null : reason, note.trim()].filter(Boolean).join(': ') : undefined;
    const { error } = await supabase.rpc('set_review_hidden', {
      p_review_id: review.id,
      p_hidden: hidden,
      p_reason: fullReason,
    });
    setBusy(false);
    if (error) {
      setError(friendlyError(error));
      return;
    }
    setHiding(false);
    setReason(null);
    setNote('');
    await onChanged();
  }

  return (
    <Card>
      <View style={styles.cardTop}>
        <View style={styles.cardTitle}>
          <ThemedText type="heading">{review.trades?.business_name ?? 'Deleted trade'}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {firstName} · written {formatDate(review.created_at)}
            {review.released_at ? ` · published ${formatDate(review.released_at)}` : ''}
          </ThemedText>
        </View>
        {review.hidden_at ? <Chip label="Hidden" tone="danger" /> : !review.released_at ? <Chip label="Not published yet" /> : null}
      </View>
      <Stars value={Number(review.overall)} />
      <ThemedText type="small" themeColor="textSecondary">
        Quality {review.quality} · Reliability {review.reliability} · Tidiness {review.tidiness} · Value {review.value}
      </ThemedText>
      {review.comment ? <ThemedText selectable>“{review.comment}”</ThemedText> : null}

      {review.hidden_at ? (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            Hidden {formatDate(review.hidden_at)}: {review.hidden_reason}
          </ThemedText>
          <Button label="Show it again" variant="outline" style={styles.inline} disabled={busy} onPress={() => setHidden(false)} />
        </>
      ) : hiding ? (
        <>
          <ThemedText type="smallBold">Why are you hiding it?</ThemedText>
          <View style={styles.filters}>
            {HIDE_REASONS.map((r) => (
              <ChoiceChip key={r} label={r} selected={reason === r} onPress={() => setReason(r)} />
            ))}
          </View>
          <TextField
            label={needsNote ? 'What’s wrong with it?' : 'Note (optional)'}
            value={note}
            onChangeText={setNote}
            multiline
          />
          <View style={styles.buttons}>
            <Button
              label={busy ? 'Hiding…' : 'Hide review'}
              disabled={busy || !reason || (needsNote && !note.trim())}
              onPress={() => setHidden(true)}
            />
            <Button label="Cancel" variant="outline" onPress={() => setHiding(false)} />
          </View>
        </>
      ) : (
        <View style={styles.buttons}>
          <Button
            label="Open trade page"
            variant="outline"
            onPress={() => router.push({ pathname: '/admin/trades/[id]', params: { id: review.trade_id } })}
          />
          <Button label="Hide…" variant="outline" onPress={() => setHiding(true)} />
        </View>
      )}
      {error && <Notice message={error} />}
    </Card>
  );
}

const styles = StyleSheet.create({
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  cardTop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  cardTitle: {
    flex: 1,
    minWidth: 200,
    gap: Spacing.half,
  },
  inline: {
    alignSelf: 'flex-start',
  },
  buttons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
