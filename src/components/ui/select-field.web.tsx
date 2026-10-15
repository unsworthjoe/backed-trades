import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Fonts, Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';

import type { SelectFieldProps } from './select-field';

/** Down arrow drawn in the field's text colour, since `appearance: none` removes the browser's. */
function chevron(color: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="8" viewBox="0 0 12 8"><path d="M1 1l5 5 5-5" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/** The website's dropdown: the browser's own <select>, so it works with keyboards and phones. */
export function SelectField<T extends string | number>({
  label,
  hint,
  placeholder,
  options,
  value,
  onChange,
}: SelectFieldProps<T>) {
  const theme = useTheme();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const [focused, setFocused] = useState(false);
  const index = options.findIndex((option) => option.value === value);

  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
      <select
        aria-label={label}
        value={index === -1 ? '' : String(index)}
        onChange={(event) => {
          const option = options[Number(event.target.value)];
          if (option) onChange(option.value);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          appearance: 'none',
          WebkitAppearance: 'none',
          minHeight: TouchTarget,
          width: '100%',
          boxSizing: 'border-box',
          borderWidth: 1.5,
          borderStyle: 'solid',
          borderRadius: Radius.medium,
          borderColor: focused ? theme.primary : theme.border,
          outline: 'none',
          paddingLeft: Spacing.three - 4,
          paddingRight: Spacing.five,
          fontFamily: Fonts.body,
          fontSize: 16,
          color: index === -1 ? theme.textSecondary : theme.text,
          backgroundColor: theme.surface,
          backgroundImage: chevron(theme.textSecondary),
          backgroundRepeat: 'no-repeat',
          backgroundPosition: `right ${Spacing.three}px center`,
          colorScheme: scheme,
          cursor: 'pointer',
        }}>
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((option, i) => (
          <option key={option.value} value={String(i)} style={{ color: theme.text }}>
            {option.label}
          </option>
        ))}
      </select>
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
  hint: {
    fontFamily: Fonts.body,
    fontSize: 13,
  },
});
