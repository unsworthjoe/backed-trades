import { Pressable, StyleSheet, Text } from 'react-native';

import { Fonts, Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ChoiceChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
};

/** A tappable option in a group, e.g. a trade category or a town. */
export function ChoiceChip({ label, selected, onPress, disabled }: ChoiceChipProps) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected, disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? theme.primaryTint : theme.surface,
          borderColor: selected ? theme.primary : theme.border,
        },
        (pressed || disabled) && styles.dimmed,
      ]}>
      <Text style={[styles.label, { color: selected ? theme.primaryText : theme.text }]}>
        {selected ? '✓  ' : ''}
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: TouchTarget - 4,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
    justifyContent: 'center',
  },
  dimmed: {
    opacity: 0.7,
  },
  label: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 15,
  },
});
