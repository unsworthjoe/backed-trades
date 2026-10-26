import { adminClient } from './http.ts';
import { cleanSecret } from './twilio.ts';

/** The signed-in user who called the function (from the Authorization header), or null. */
export async function callerId(req: Request): Promise<string | null> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data, error } = await adminClient().auth.getUser(token);
  return error ? null : (data.user?.id ?? null);
}

/** Compares two strings in the same time wherever they differ, so the answer can't be guessed from timing. */
export function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** True if the request carries the database's shared secret (x-sender-secret header). */
export function hasSenderSecret(req: Request) {
  const expected = cleanSecret(Deno.env.get('NOTIFICATION_SENDER_SECRET'));
  return !!expected && timingSafeEqual(req.headers.get('x-sender-secret') ?? '', expected);
}
