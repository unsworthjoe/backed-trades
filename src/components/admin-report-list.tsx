import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Chip, type ChipTone } from '@/components/ui/chip';
import { Spacing, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDate } from '@/lib/dates';

/** What the admin lists need from a report, with who sent it and who it's about. */
export const REPORT_LIST_SELECT =
  'id, reason, status, created_at, reporter:profiles!reports_reporter_id_fkey(full_name, role), about:profiles!reports_about_user_id_fkey(full_name, role), jobs(title)';

type Person = { full_name: string; role: 'customer' | 'trade' | 'admin' } | null;

export type ReportRow = {
  id: string;
  reason: string;
  status: 'open' | 'resolved' | 'dismissed';
  created_at: string;
  reporter: Person;
  about: Person;
  jobs: { title: string } | null;
};

export const REPORT_STATUS: Record<ReportRow['status'], { label: string; tone: ChipTone }> = {
  open: { label: 'Open', tone: 'warning' },
  resolved: { label: 'Resolved', tone: 'success' },
  dismissed: { label: 'Dismissed', tone: 'neutral' },
};

export function personName(person: Person): string {
  if (!person) return 'Deleted account';
  return `${person.full_name || 'No name'} (${person.role})`;
}

export function ReportList({ reports }: { reports: ReportRow[] }) {
  const theme = useTheme();

  return (
    <View>
      {reports.map((report, index) => (
        <Pressable
          key={report.id}
          accessibilityRole="link"
          onPress={() => router.push({ pathname: '/admin/reports/[id]', params: { id: report.id } })}
          style={({ pressed }) => [
            styles.row,
            index > 0 && { borderTopWidth: 1, borderTopColor: theme.border },
            pressed && styles.pressed,
          ]}>
          <View style={styles.text}>
            <ThemedText type="smallBold" style={styles.reason}>
              {report.reason}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {personName(report.reporter)} about {personName(report.about)}
              {report.jobs ? ` · “${report.jobs.title}”` : ''}
            </ThemedText>
          </View>
          <View style={styles.side}>
            <Chip {...REPORT_STATUS[report.status]} />
            <ThemedText type="small" themeColor="textSecondary">
              {formatDate(report.created_at)}
            </ThemedText>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: TouchTarget + 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two + 2,
  },
  pressed: {
    opacity: 0.6,
  },
  text: {
    flex: 1,
    minWidth: 200,
    gap: Spacing.half,
  },
  reason: {
    fontSize: 16,
  },
  side: {
    alignItems: 'flex-end',
    gap: Spacing.half,
  },
});
