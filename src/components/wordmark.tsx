import { StyleSheet, Text, View } from 'react-native';

import { Fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type WordmarkProps = {
  /** Font size of "Backed" in points. */
  size?: number;
  /** Show the tick inside the full stop. Leave off below ~40pt, where it gets too small to read. */
  tick?: boolean;
  /** Use on dark or brand-coloured backgrounds when the screen itself is light. */
  inverse?: boolean;
};

/** The Backed. logo, drawn live so it follows the theme. Master files are in assets/brand. */
export function Wordmark({ size = 28, tick = size >= 40, inverse = false }: WordmarkProps) {
  const theme = useTheme();
  const dot = size * (tick ? 0.29 : 0.24);

  return (
    <View style={styles.row} accessible accessibilityRole="header" accessibilityLabel="Backed.">
      <Text
        style={{
          fontFamily: Fonts.display,
          fontSize: size,
          lineHeight: size * 1.1,
          letterSpacing: -0.036 * size,
          color: inverse ? theme.textOnInverse : theme.text,
        }}>
        Backed
      </Text>
      <View
        style={{
          width: dot,
          height: dot,
          borderRadius: dot / 2,
          marginLeft: size * 0.05,
          marginBottom: size * 0.2,
          backgroundColor: inverse ? theme.primaryOnInverse : theme.primary,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        {tick && (
          <View
            style={{
              width: dot * 0.26,
              height: dot * 0.48,
              borderColor: inverse ? theme.surfaceInverse : theme.onPrimary,
              borderRightWidth: dot * 0.1,
              borderBottomWidth: dot * 0.1,
              transform: [{ rotate: '45deg' }],
              marginTop: -dot * 0.1,
            }}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
});
