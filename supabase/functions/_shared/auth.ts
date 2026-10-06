import { adminClient } from './http.ts';

/** The signed-in user who called the function (from the Authorization header), or null. */
export async function callerId(req: Request): Promise<string | null> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data, error } = await adminClient().auth.getUser(token);
  return error ? null : (data.user?.id ?? null);
}
