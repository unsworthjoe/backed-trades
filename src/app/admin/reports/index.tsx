import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AdminHeader } from '@/components/admin-header';
import { REPORT_LIST_SELECT, ReportList, type ReportRow } from '@/components/admin-report-list';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { ChoiceChip } from '@/components/ui/choice-chip';
import { Notice } from '@/components/ui/notice';
import { Spacing } from '@/constants/theme';
import { friendlyError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

type Filter = ReportRow['status'];

const FILTERS: { key: Filter; label: string; empty: string }[] = [
  { key: 'open', label: 'Open', empty: 'No open reports.' },
  { key: 'resolved', label: 'Resolved', empty: 'No resolved reports yet.' },
  { key: 'dismissed', label: 'Dismissed', empty: 'No dismissed reports.' },
];

async function loadReports(filter: Filter) {
  const { data, error } = await supabase
    .from('reports')
    .select(REPORT_LIST_SELECT)
    .eq('status', filter)
    // Open: oldest first, so nothing waits too long. Closed: most recent first.
    .order('created_at', { ascending: filter === 'open' })
    .limit(200);
  if (error) throw error;
  return data as unknown as ReportRow[];
}

/** Problems reported by customers and trades, for the founders to follow up. */
export default function AdminReportsScreen() {
  const [filter, setFilter] = useState<Filter>('open');
  const [rows, setRows] = useState<ReportRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setRows(null);
      setError(null);
      loadReports(filter)
        .then((data) => !cancelled && setRows(data))
        .catch((e) => !cancelled && setError(friendlyError(e)));
      return () => {
        cancelled = true;
      };
    }, [filter]),
  );

  const current = FILTERS.find((f) => f.key === filter)!;

  return (
    <Screen>
      <AdminHeader />
      <ThemedText type="subtitle">Reports</ThemedText>
      <ThemedText themeColor="textSecondary">
        Sent from a job by the customer or the trade. The person reported isn’t told who sent it.
      </ThemedText>
      <View style={styles.filters}>
        {FILTERS.map((f) => (
          <ChoiceChip key={f.key} label={f.label} selected={filter === f.key} onPress={() => setFilter(f.key)} />
        ))}
      </View>

      {error && <Notice message={error} />}
      {rows && rows.length === 0 && <ThemedText themeColor="textSecondary">{current.empty}</ThemedText>}
      {rows && rows.length > 0 && (
        <Card style={styles.list}>
          <ReportList reports={rows} />
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  list: {
    gap: 0,
    paddingVertical: Spacing.one,
  },
});
