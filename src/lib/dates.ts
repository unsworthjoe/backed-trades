/** "31/12/2026" -> "2026-12-31", or null if it isn't a real date. */
export function parseUkDate(text: string): string | null {
  const match = text.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date.toISOString().slice(0, 10);
}

/** "2026-12-31" -> "31 Dec 2026". */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Today's date in the UK as "YYYY-MM-DD", for comparing with expiry dates. */
export function todayInUk(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
}
