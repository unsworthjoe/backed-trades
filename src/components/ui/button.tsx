import { Pressable, StyleSheet, Text, type PressableProps } from 'react-native';

import { Fonts, Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ButtonProps = Omit<PressableProps, 'children'> & {
  label: string;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'regular' | 'large';
};

export function Button({ label, variant = 'primary', size = 'regular', style, disabled, ...rest }: ButtonProps) {
  const theme = useTheme();
  const colors = {
    primary: { bg: theme.primary, fg: theme.onPrimary, border: theme.primary },
    secondary: { bg: theme.background, fg: theme.text, border: theme.background },
    outline: { bg: 'transparent', fg: theme.text, border: theme.border },
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      style={(state) => [
        styles.base,
        size === 'large' && styles.large,
        { backgroundColor: colors.bg, borderColor: colors.border },
        (state.pressed || disabled) && styles.dimmed,
        typeof style === 'function' ? style(state) : style,
      ]}
      {...rest}>
      <Text style={[styles.label, size === 'large' && styles.largeLabel, { color: colors.fg }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: TouchTarget,
    paddingHorizontal: Spacing.four,
    borderRadius: Radius.medium,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  large: {
    minHeight: 56,
  },
  dimmed: {
    opacity: 0.7,
  },
  label: {
    fontFamily: Fonts.bodyBold,
    fontSize: 16,
  },
  largeLabel: {
    fontSize: 17,
  },
});
