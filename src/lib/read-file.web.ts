import type { PickedFile } from '@/lib/upload';

/** Reads a file picked in the browser into memory for uploading. */
export async function readPickedFile(picked: PickedFile): Promise<ArrayBuffer> {
  if (picked.webFile) return picked.webFile.arrayBuffer();
  const response = await fetch(picked.uri);
  return response.arrayBuffer();
}
