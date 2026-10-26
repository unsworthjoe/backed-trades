import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';

import type { PickedFile } from '@/lib/upload';

/**
 * Opens the camera or photo library and returns the chosen photo, or null if cancelled. In the
 * browser this must run straight from a button press, or the browser blocks it.
 */
export async function pickPhoto(source: 'camera' | 'library', options?: { selfie?: boolean }): Promise<PickedFile | null> {
  const settings: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    quality: 0.7,
    cameraType: options?.selfie ? ImagePicker.CameraType.front : ImagePicker.CameraType.back,
  };

  let result: ImagePicker.ImagePickerResult;
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new Error('CAMERA_PERMISSION_DENIED');
    result = await ImagePicker.launchCameraAsync(settings);
  } else {
    result = await ImagePicker.launchImageLibraryAsync(settings);
  }

  const asset = result.assets?.[0];
  if (result.canceled || !asset) return null;
  return {
    uri: asset.uri,
    name: asset.fileName ?? 'photo.jpg',
    mimeType: asset.mimeType ?? 'image/jpeg',
    webFile: asset.file ?? undefined,
  };
}

/** Lets the trade choose a PDF or image from their files, e.g. an insurance certificate. */
export async function pickDocument(): Promise<PickedFile | null> {
  const result = await DocumentPicker.getDocumentAsync({
    // The kinds of file the upload buckets accept (see the upload_limits migration).
    type: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  const asset = result.assets?.[0];
  if (result.canceled || !asset) return null;
  return {
    uri: asset.uri,
    name: asset.name,
    mimeType: asset.mimeType ?? 'application/octet-stream',
    webFile: asset.file,
  };
}
