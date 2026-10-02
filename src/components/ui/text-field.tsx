import { useState } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { Fonts, Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type TextFieldProps = TextInputProps & {
  label: string;
  hint?: string;
};

export function TextField({ label, hint, style, multiline, onFocus, onBlur, ...rest }: TextFieldProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={theme.textSecondary}
        multiline={multiline}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          styles.input,
          multiline && styles.multiline,
          {
            color: theme.text,
            backgroundColor: theme.surface,
            borderColor: focused ? theme.primary : theme.border,
          },
          style,
        ]}
        {...rest}
      />
      {hint && <Text style={[styles.hint, { color: theme.textSecondary }]}>{hint}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: Spacing.two,
  },
  label: {
    fontFamily: Fonts.bodyBold,
    fontSize: 14,
  },
  input: {
    minHeight: TouchTarget,
    borderWidth: 1.5,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three - 4,
    fontFamily: Fonts.body,
    fontSize: 16,
  },
  multiline: {
    minHeight: 96,
    paddingTop: Spacing.three - 4,
    textAlignVertical: 'top',
  },
  hint: {
    fontFamily: Fonts.body,
    fontSize: 13,
  },
});
