import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type NoticeProps = {
  message: string;
  title?: string;
  tone?: 'danger' | 'warning' | 'success' | 'info';
};

/** A coloured message box, e.g. a form error or "Application under review". */
export function Notice({ message, title, tone = 'danger' }: NoticeProps) {
  const theme = useTheme();
  const [background, foreground] = {
    danger: [theme.dangerTint, theme.danger],
    warning: [theme.warningTint, theme.warning],
    success: [theme.successTint, theme.success],
    info: [theme.infoTint, theme.info],
  }[tone];

  return (
    <View
      accessibilityRole={tone === 'danger' ? 'alert' : undefined}
      style={[styles.box, { backgroundColor: background }]}>
      {title && (
        <ThemedText type="smallBold" style={{ color: foreground }}>
          {title}
        </ThemedText>
      )}
      <ThemedText type="small" style={{ color: tone === 'danger' ? foreground : theme.text }}>
        {message}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderRadius: Radius.medium,
    padding: Spacing.three,
    gap: Spacing.one,
  },
});
