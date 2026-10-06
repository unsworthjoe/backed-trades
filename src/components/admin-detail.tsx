import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Spacing } from '@/constants/theme';

/** A titled card on an admin page. */
export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <ThemedText type="heading">{title}</ThemedText>
      {children}
    </Card>
  );
}

/** One "label: value" line on an admin page. The value can be selected and copied. */
export function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detail}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.label}>
        {label}
      </ThemedText>
      <ThemedText type="small" style={styles.value} selectable>
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  detail: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  label: {
    width: 130,
  },
  value: {
    flex: 1,
    minWidth: 180,
  },
});
