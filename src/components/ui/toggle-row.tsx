import { StyleSheet, Switch, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ToggleRowProps = {
  label: string;
  hint?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
};

/** A yes/no setting with an explanation underneath. */
export function ToggleRow({ label, hint, value, onValueChange }: ToggleRowProps) {
  const theme = useTheme();

  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <ThemedText type="smallBold" style={styles.label}>
          {label}
        </ThemedText>
        {hint && (
          <ThemedText type="small" themeColor="textSecondary">
            {hint}
          </ThemedText>
        )}
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onValueChange}
        trackColor={{ true: theme.primary, false: theme.border }}
        thumbColor={theme.surface}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  text: {
    flex: 1,
    gap: Spacing.half,
  },
  label: {
    fontSize: 16,
  },
});
