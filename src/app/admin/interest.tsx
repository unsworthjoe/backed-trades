import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { AdminHeader } from '@/components/admin-header';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { ChoiceChip } from '@/components/ui/choice-chip';
import { Notice } from '@/components/ui/notice';
import { Spacing } from '@/constants/theme';
import { formatDate } from '@/lib/dates';
import { friendlyError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

type Filter = 'all' | 'customer' | 'trade';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Everyone' },
  { key: 'customer', label: 'Customers' },
  { key: 'trade', label: 'Trades' },
];

async function loadSignups() {
  const { data, error } = await supabase
    .from('interest_signups')
    .select('id, email, kind, source, signed_up_at, trade_categories(name), towns(name)')
    .order('signed_up_at', { ascending: false });
  if (error) throw error;
  return data;
}

type Signup = Awaited<ReturnType<typeof loadSignups>>[number];

/** Counts like "Runcorn 12 · Widnes 4", biggest first. */
function tally(rows: Signup[], key: (row: Signup) => string) {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(key(row), (counts.get(key(row)) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => `${name} ${count}`)
    .join(' · ');
}

/** People who registered their interest on the coming-soon page, to email when we launch. */
export default function AdminInterestScreen() {
  const [rows, setRows] = useState<Signup[] | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const reload = useCallback(async () => {
    try {
      setRows(await loadSignups());
    } catch (e) {
      setError(friendlyError(e));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setError(null);
      reload();
    }, [reload]),
  );

  const shown = rows?.filter((row) => filter === 'all' || row.kind === filter) ?? [];
  const trades = rows?.filter((row) => row.kind === 'trade') ?? [];

  async function copyEmails() {
    await navigator.clipboard.writeText(shown.map((row) => row.email).join(', '));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Screen>
      <AdminHeader />
      <ThemedText type="subtitle">Registered interest</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        From the coming-soon page. We’ve promised to only email them to say we’re live, and each address is deleted
        automatically 12 months after it was added. If someone asks to be removed, remove them here.
      </ThemedText>

      {error && <Notice message={error} />}
      {rows && rows.length > 0 && (
        <Card style={styles.summary}>
          <ThemedText type="smallBold">
            {rows.length} in total: {rows.length - trades.length} customers, {trades.length} trades
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            By town: {tally(rows, (row) => row.towns?.name ?? 'Somewhere else')}
          </ThemedText>
          {rows.some((row) => row.source) && (
            <ThemedText type="small" themeColor="textSecondary">
              By source: {tally(rows, (row) => row.source ?? 'No tag')}
            </ThemedText>
          )}
          {trades.length > 0 && (
            <ThemedText type="small" themeColor="textSecondary">
              Trades: {tally(trades, (row) => row.trade_categories?.name ?? 'Not given')}
            </ThemedText>
          )}
        </Card>
      )}

      <View style={styles.filters}>
        {FILTERS.map((f) => (
          <ChoiceChip key={f.key} label={f.label} selected={filter === f.key} onPress={() => setFilter(f.key)} />
        ))}
        {Platform.OS === 'web' && shown.length > 0 && (
          <Button
            label={copied ? 'Copied' : `Copy ${shown.length} email${shown.length === 1 ? '' : 's'}`}
            variant="outline"
            onPress={copyEmails}
          />
        )}
      </View>

      {rows && shown.length === 0 && <ThemedText themeColor="textSecondary">Nobody yet.</ThemedText>}
      {shown.map((row) => (
        <SignupRow key={row.id} row={row} onRemoved={reload} />
      ))}
    </Screen>
  );
}

function SignupRow({ row, onRemoved }: { row: Signup; onRemoved: () => Promise<void> }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    const { error } = await supabase.from('interest_signups').delete().eq('id', row.id);
    if (error) return setError(friendlyError(error));
    await onRemoved();
  }

  return (
    <Card style={styles.row}>
      <View style={styles.rowTop}>
        <ThemedText type="smallBold" selectable>
          {row.email}
        </ThemedText>
        <Chip label={row.kind === 'trade' ? 'Trade' : 'Customer'} tone={row.kind === 'trade' ? 'brand' : 'neutral'} />
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {[row.trade_categories?.name, row.towns?.name ?? 'Somewhere else', row.source && `from ${row.source}`, `added ${formatDate(row.signed_up_at)}`]
          .filter(Boolean)
          .join(' · ')}
      </ThemedText>
      {error && <Notice message={error} />}
      <View style={styles.actions}>
        {confirming ? (
          <>
            <Button label="Yes, remove" onPress={remove} />
            <Button label="Keep" variant="outline" onPress={() => setConfirming(false)} />
          </>
        ) : (
          <Button label="Remove" variant="outline" onPress={() => setConfirming(true)} />
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  summary: {
    gap: Spacing.one,
  },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.two,
  },
  row: {
    gap: Spacing.two,
  },
  rowTop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
});
