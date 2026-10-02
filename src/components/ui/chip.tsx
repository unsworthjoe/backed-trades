import { StyleSheet, Text, View } from 'react-native';

import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ChipTone = 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';

/** Small status label, e.g. "Reply in 1h 48m" or "Vetted". */
export function Chip({ label, tone = 'neutral' }: { label: string; tone?: ChipTone }) {
  const theme = useTheme();
  const colors = {
    brand: [theme.primaryTint, theme.primaryText],
    success: [theme.successTint, theme.success],
    warning: [theme.warningTint, theme.warning],
    danger: [theme.dangerTint, theme.danger],
    info: [theme.infoTint, theme.info],
    neutral: [theme.background, theme.textSecondary],
  }[tone];

  return (
    <View style={[styles.chip, { backgroundColor: colors[0] }]}>
      <Text style={[styles.label, { color: colors[1] }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: Spacing.one,
  },
  label: {
    fontFamily: Fonts.bodyBold,
    fontSize: 13,
    lineHeight: 18,
  },
});
