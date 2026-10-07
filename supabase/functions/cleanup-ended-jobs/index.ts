// Deletes jobs 2 years after they ended (completed or cancelled), as the
// privacy policy promises. Woken each night by the database (see the
// ended_job_cleanup migration) with the same x-sender-secret header as
// send-notifications. Each job's photo folder goes first, then the job, which
// takes its address, offers, matches, messages, alerts and reports with it.
// Reviews and customer ratings stay.

import { adminClient, json } from '../_shared/http.ts';
import { removeFolder } from '../_shared/storage.ts';
import { cleanSecret } from '../_shared/twilio.ts';

const db = adminClient();

Deno.serve(async (req) => {
  const expected = cleanSecret(Deno.env.get('NOTIFICATION_SENDER_SECRET'));
  if (!expected || req.headers.get('x-sender-secret') !== expected) return json(401, { error: 'Not allowed' });

  let jobs = 0;
  // Batches of 50, up to 500 jobs a night; anything left goes the next night.
  for (let round = 0; round < 10; round++) {
    const { data, error } = await db.rpc('ended_jobs_due_for_cleanup', { p_limit: 50 });
    if (error) {
      console.error('ended_jobs_due_for_cleanup failed', error);
      return json(500, { error: error.message });
    }
    const ids = ((data ?? []) as { id: string }[]).map((row) => row.id);
    if (!ids.length) break;

    try {
      // Job photos live under {job id}/ (src/lib/upload.ts).
      for (const id of ids) await removeFolder(db, 'job-photos', id);
    } catch (e) {
      console.error('removing job photos failed', e);
      return json(500, { error: e instanceof Error ? e.message : String(e) });
    }

    const { data: deleted, error: deleteError } = await db.rpc('delete_ended_jobs', { p_ids: ids });
    if (deleteError) {
      console.error('delete_ended_jobs failed', deleteError);
      return json(500, { error: deleteError.message });
    }
    jobs += (deleted as number) ?? 0;
    if (ids.length < 50) break;
  }

  console.log(`Deleted ${jobs} jobs that ended over 2 years ago`);
  return json(200, { jobs });
});
