import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** "★★★★☆" for a rating out of 5 (rounded to the nearest whole star), with the number. */
export function Stars({ value, count }: { value: number; count?: number }) {
  const theme = useTheme();
  const whole = Math.round(value);
  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={`${value.toFixed(1)} out of 5${count !== undefined ? ` from ${count} review${count === 1 ? '' : 's'}` : ''}`}>
      <Text style={[styles.stars, { color: theme.primary }]}>
        {'★'.repeat(whole)}
        <Text style={{ color: theme.border }}>{'★'.repeat(5 - whole)}</Text>
      </Text>
      <ThemedText type="smallBold">{value.toFixed(1)}</ThemedText>
      {count !== undefined && (
        <ThemedText type="small" themeColor="textSecondary">
          ({count})
        </ThemedText>
      )}
    </View>
  );
}

/** Tap a star to rate from 1 to 5. */
export function StarInput({ label, value, onChange }: { label: string; value: number; onChange: (stars: number) => void }) {
  const theme = useTheme();
  return (
    <View style={styles.input}>
      <ThemedText type="smallBold" style={styles.label}>
        {label}
      </ThemedText>
      <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {[1, 2, 3, 4, 5].map((stars) => (
          <Pressable
            key={stars}
            accessibilityRole="radio"
            accessibilityLabel={`${stars} star${stars === 1 ? '' : 's'}`}
            accessibilityState={{ checked: value === stars }}
            onPress={() => onChange(stars)}
            hitSlop={4}
            style={styles.tap}>
            <Text style={[styles.big, { color: stars <= value ? theme.primary : theme.border }]}>★</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  stars: {
    fontSize: 16,
    letterSpacing: 1,
  },
  input: {
    gap: Spacing.half,
  },
  label: {
    fontSize: 15,
  },
  tap: {
    minWidth: TouchTarget - 8,
    minHeight: TouchTarget - 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  big: {
    fontSize: 32,
    lineHeight: 38,
  },
});
