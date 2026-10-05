import { readPickedFile } from '@/lib/read-file';
import { supabase } from '@/lib/supabase';

/** A photo or document chosen with expo-image-picker or expo-document-picker. */
export type PickedFile = {
  uri: string;
  name: string;
  mimeType: string;
  /** Only set in the browser (expo-document-picker gives the original File). */
  webFile?: Blob;
};

export type Bucket = 'trade-documents' | 'id-checks' | 'trade-photos' | 'job-photos';

const EXTENSIONS: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/heic': 'heic',
  'image/webp': 'webp',
};

/**
 * Uploads a picked file to `{folder}/{label}-{time}.{ext}` and returns the storage path. The
 * folder must be the trade's (or job's) id: storage rules only allow uploads into your own folder.
 */
export async function uploadPickedFile(bucket: Bucket, folder: string, label: string, picked: PickedFile) {
  const extension = EXTENSIONS[picked.mimeType] ?? picked.name.split('.').pop() ?? 'bin';
  const path = `${folder}/${label}-${Date.now()}.${extension}`;
  const body = await readPickedFile(picked);
  const { error } = await supabase.storage.from(bucket).upload(path, body, { contentType: picked.mimeType });
  if (error) throw error;
  return path;
}

/** A link to a private file that works for an hour. */
export async function signedUrl(bucket: Bucket, path: string) {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}
