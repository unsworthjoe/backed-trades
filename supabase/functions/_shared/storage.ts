import type { adminClient } from './http.ts';

type Db = ReturnType<typeof adminClient>;

/** Deletes every file in one folder of a bucket. A folder that's already empty is fine. */
export async function removeFolder(db: Db, bucket: string, folder: string) {
  const storage = db.storage.from(bucket);
  // Removing a page of files shifts the next ones up, so keep reading the first page. Entries
  // without an id are sub-folders, which we never create; they can't be removed this way.
  for (let page = 0; page < 20; page++) {
    const { data: entries, error: listError } = await storage.list(folder, { limit: 1000 });
    if (listError) throw listError;
    const files = (entries ?? []).filter((entry) => entry.id);
    if (!files.length) break;
    const { error: removeError } = await storage.remove(files.map((file) => `${folder}/${file.name}`));
    if (removeError) throw removeError;
  }
}
