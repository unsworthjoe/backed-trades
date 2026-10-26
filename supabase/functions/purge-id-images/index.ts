// Deletes trades' ID photos and selfies once they're past their keep-until
// date (30 days after the founders' decision). Woken each night by the
// database (see the id_image_purge migration) with the same x-sender-secret
// header as send-notifications. Only the files go; the ID check result stays.

import { hasSenderSecret } from '../_shared/auth.ts';
import { adminClient, json } from '../_shared/http.ts';

const db = adminClient();

Deno.serve(async (req) => {
  if (!hasSenderSecret(req)) return json(401, { error: 'Not allowed' });

  let checks = 0;
  let files = 0;
  // Batches of 100, up to 1,000 checks a night; anything left goes the next night.
  for (let round = 0; round < 10; round++) {
    const { data, error } = await db.rpc('id_images_due_for_purge', { p_limit: 100 });
    if (error) {
      console.error('id_images_due_for_purge failed', error);
      return json(500, { error: error.message });
    }
    const rows = (data ?? []) as { id: string; image_paths: string[] }[];
    if (!rows.length) break;

    const paths = rows.flatMap((row) => row.image_paths);
    if (paths.length) {
      // Files that are already gone aren't an error.
      const { data: removed, error: removeError } = await db.storage.from('id-checks').remove(paths);
      if (removeError) {
        console.error('removing ID photos failed', removeError);
        return json(500, { error: removeError.message });
      }
      files += removed?.length ?? 0;
    }

    const { data: marked, error: markError } = await db.rpc('mark_id_images_purged', {
      p_ids: rows.map((row) => row.id),
    });
    if (markError) {
      console.error('mark_id_images_purged failed', markError);
      return json(500, { error: markError.message });
    }
    checks += (marked as number) ?? 0;
    if (rows.length < 100) break;
  }

  console.log(`Deleted ${files} ID photo files from ${checks} ID checks`);
  return json(200, { checks, files });
});
