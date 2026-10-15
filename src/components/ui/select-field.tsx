import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Fonts, Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type SelectOption<T extends string | number> = { value: T; label: string };

export type SelectFieldProps<T extends string | number> = {
  label: string;
  hint?: string;
  /** Shown until something is picked. */
  placeholder: string;
  options: SelectOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
};

/**
 * A dropdown: pick one option from a list. In the apps it opens the list as a sheet; the
 * website uses the browser's own dropdown (select-field.web.tsx).
 */
export function SelectField<T extends string | number>({
  label,
  hint,
  placeholder,
  options,
  value,
  onChange,
}: SelectFieldProps<T>) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selected?.label ?? placeholder}`}
        accessibilityHint="Opens a list to choose from"
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.input,
          { backgroundColor: theme.surface, borderColor: open ? theme.primary : theme.border },
          pressed && styles.pressed,
        ]}>
        <Text style={[styles.value, { color: selected ? theme.text : theme.textSecondary }]} numberOfLines={1}>
          {selected?.label ?? placeholder}
        </Text>
        <Text style={[styles.chevron, { color: theme.textSecondary }]}>▾</Text>
      </Pressable>
      {hint && <Text style={[styles.hint, { color: theme.textSecondary }]}>{hint}</Text>}

      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={[styles.sheet, { backgroundColor: theme.background }]} edges={['bottom']}>
          <View style={[styles.sheetHeader, { borderColor: theme.border }]}>
            <Text style={[styles.sheetTitle, { color: theme.text }]}>{label}</Text>
            <Pressable accessibilityRole="button" onPress={() => setOpen(false)} hitSlop={12}>
              <Text style={[styles.close, { color: theme.primaryText }]}>Close</Text>
            </Pressable>
          </View>
          <ScrollView>
            {options.map((option) => {
              const isSelected = option.value === value;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isSelected }}
                  onPress={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  style={({ pressed }) => [
                    styles.option,
                    { borderColor: theme.border, backgroundColor: isSelected ? theme.primaryTint : theme.surface },
                    pressed && styles.pressed,
                  ]}>
                  <Text style={[styles.optionLabel, { color: isSelected ? theme.primaryText : theme.text }]}>
                    {option.label}
                  </Text>
                  {isSelected && <Text style={[styles.optionLabel, { color: theme.primaryText }]}>✓</Text>}
                </Pressable>
              );
            })}
          </ScrollView>
        </SafeAreaView>
      </Modal>
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  value: {
    flex: 1,
    fontFamily: Fonts.body,
    fontSize: 16,
  },
  chevron: {
    fontSize: 16,
  },
  hint: {
    fontFamily: Fonts.body,
    fontSize: 13,
  },
  pressed: {
    opacity: 0.7,
  },
  sheet: {
    flex: 1,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.three,
    borderBottomWidth: 1,
  },
  sheetTitle: {
    fontFamily: Fonts.bodyBold,
    fontSize: 17,
  },
  close: {
    fontFamily: Fonts.bodyBold,
    fontSize: 16,
  },
  option: {
    minHeight: TouchTarget + 8,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  optionLabel: {
    fontFamily: Fonts.body,
    fontSize: 17,
  },
});
