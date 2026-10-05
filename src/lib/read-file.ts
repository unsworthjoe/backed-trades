import { File } from 'expo-file-system';

import type { PickedFile } from '@/lib/upload';

/** Reads a file picked on the phone (camera, photos or files) into memory for uploading. */
export function readPickedFile(picked: PickedFile): Promise<ArrayBuffer> {
  return new File(picked.uri).arrayBuffer();
}
