import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { PickedFile } from '@/lib/upload';

type FilePickerFieldProps = {
  label: string;
  hint?: string;
  file: PickedFile | null;
  onTakePhoto: () => void;
  /** "Choose a photo" or "Choose a file", depending on what's allowed. */
  chooseLabel: string;
  onChoose: () => void;
};

/** A labelled slot for one photo or document, with a preview once chosen. */
export function FilePickerField({ label, hint, file, onTakePhoto, chooseLabel, onChoose }: FilePickerFieldProps) {
  const theme = useTheme();
  const isImage = file?.mimeType.startsWith('image/');

  return (
    <View style={styles.field}>
      <ThemedText type="smallBold">{label}</ThemedText>
      {hint && (
        <ThemedText type="small" themeColor="textSecondary">
          {hint}
        </ThemedText>
      )}
      {file && (
        <View style={[styles.preview, { borderColor: theme.border, backgroundColor: theme.surface }]}>
          {isImage ? (
            <Image source={{ uri: file.uri }} style={styles.image} contentFit="contain" accessibilityLabel={`${label} preview`} />
          ) : (
            <ThemedText type="small">📄 {file.name}</ThemedText>
          )}
        </View>
      )}
      <View style={styles.buttons}>
        <Button label={file ? 'Retake' : 'Take a photo'} variant="outline" onPress={onTakePhoto} style={styles.button} />
        <Button label={chooseLabel} variant="outline" onPress={onChoose} style={styles.button} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: Spacing.two,
  },
  preview: {
    borderWidth: 1,
    borderRadius: Radius.medium,
    padding: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 64,
  },
  image: {
    width: '100%',
    height: 200,
  },
  buttons: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  button: {
    flex: 1,
    paddingHorizontal: Spacing.two,
  },
});
