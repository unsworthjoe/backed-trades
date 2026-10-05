import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AdminHeader } from '@/components/admin-header';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { ChoiceChip } from '@/components/ui/choice-chip';
import { Notice } from '@/components/ui/notice';
import { Spacing, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDate } from '@/lib/dates';
import { friendlyError } from '@/lib/errors';
import { BUSINESS_TYPE_NAMES } from '@/lib/labels';
import { supabase } from '@/lib/supabase';

type Filter = 'waiting' | 'in_progress' | 'approved' | 'rejected';

const FILTERS: { key: Filter; label: string; empty: string }[] = [
  { key: 'waiting', label: 'Waiting for review', empty: 'No applications waiting. Nice work.' },
  { key: 'in_progress', label: 'Still filling in', empty: 'Nobody is part-way through an application.' },
  { key: 'approved', label: 'Approved', empty: 'No approved trades yet.' },
  { key: 'rejected', label: 'Sent back', empty: 'No applications have been sent back.' },
];

const SELECT = 'id, business_name, business_type, status, submitted_at, approved_at, created_at, profiles(full_name, email)';

async function loadApplications(filter: Filter) {
  let query = supabase.from('trades').select(SELECT);
  if (filter === 'waiting') {
    query = query.eq('status', 'applied').not('submitted_at', 'is', null).order('submitted_at');
  } else if (filter === 'in_progress') {
    query = query.eq('status', 'applied').is('submitted_at', null).order('created_at', { ascending: false });
  } else if (filter === 'approved') {
    query = query.eq('status', 'approved').order('approved_at', { ascending: false });
  } else {
    query = query.eq('status', 'rejected').order('updated_at', { ascending: false });
  }
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

type Row = Awaited<ReturnType<typeof loadApplications>>[number];

export default function AdminApplicationsScreen() {
  const theme = useTheme();
  const [filter, setFilter] = useState<Filter>('waiting');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setRows(null);
      loadApplications(filter)
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
      <ThemedText type="subtitle">Trade applications</ThemedText>
      <View style={styles.filters}>
        {FILTERS.map((f) => (
          <ChoiceChip key={f.key} label={f.label} selected={filter === f.key} onPress={() => setFilter(f.key)} />
        ))}
      </View>

      {error && <Notice message={error} />}
      {rows && rows.length === 0 && <ThemedText themeColor="textSecondary">{current.empty}</ThemedText>}
      {rows && rows.length > 0 && (
        <Card style={styles.list}>
          {rows.map((row, index) => (
            <Pressable
              key={row.id}
              accessibilityRole="link"
              onPress={() => router.push({ pathname: '/admin/trades/[id]', params: { id: row.id } })}
              style={({ pressed }) => [
                styles.row,
                index > 0 && { borderTopWidth: 1, borderTopColor: theme.border },
                pressed && styles.pressed,
              ]}>
              <View style={styles.rowText}>
                <ThemedText type="smallBold" style={styles.name}>
                  {row.business_name}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {[row.profiles?.full_name, row.profiles?.email, BUSINESS_TYPE_NAMES[row.business_type]]
                    .filter(Boolean)
                    .join(' · ')}
                </ThemedText>
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                {filter === 'waiting' && row.submitted_at
                  ? `Sent ${formatDate(row.submitted_at)}`
                  : filter === 'approved' && row.approved_at
                    ? `Approved ${formatDate(row.approved_at)}`
                    : `Started ${formatDate(row.created_at)}`}
              </ThemedText>
            </Pressable>
          ))}
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
  row: {
    minHeight: TouchTarget + 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two + 2,
  },
  pressed: {
    opacity: 0.6,
  },
  rowText: {
    flex: 1,
    gap: Spacing.half,
  },
  name: {
    fontSize: 16,
  },
});
