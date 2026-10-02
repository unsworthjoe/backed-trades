import { StyleSheet, View, type ViewProps } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type CardProps = ViewProps & {
  /** Dark card on a light screen (and the reverse), used to make one card stand out. */
  inverse?: boolean;
};

export function Card({ inverse = false, style, ...rest }: CardProps) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: inverse ? theme.surfaceInverse : theme.surface }, style]} {...rest} />
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.large,
    padding: Spacing.four - 4,
    gap: Spacing.two + 2,
  },
});
