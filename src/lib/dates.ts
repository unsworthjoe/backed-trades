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

const UK = 'Europe/London';
const DAY_MS = 24 * 60 * 60 * 1000;

/** "8:30am", in UK time. */
export function formatTime(iso: string): string {
  return new Date(iso)
    .toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: UK })
    .replace(/\s/g, '')
    .toLowerCase();
}

/** "8:30am", "8:30am tomorrow" or "8:30am on Friday", relative to `now` (UK days). */
export function formatTimeOfDay(iso: string, now: number): string {
  const day = (time: number) => new Date(time).toLocaleDateString('en-CA', { timeZone: UK });
  const at = new Date(iso).getTime();
  if (day(at) === day(now)) return formatTime(iso);
  if (day(at) === day(now + DAY_MS)) return `${formatTime(iso)} tomorrow`;
  return `${formatTime(iso)} on ${new Date(iso).toLocaleDateString('en-GB', { weekday: 'long', timeZone: UK })}`;
}

/** Time left until `iso`: "1h 48m", "12m" or "under a minute". Null once it has passed. */
export function timeLeft(iso: string, now: number): string | null {
  const minutes = Math.floor((new Date(iso).getTime() - now) / 60_000);
  if (minutes < 0) return null;
  if (minutes < 1) return 'under a minute';
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
}

/** 1 -> "1st", 2 -> "2nd", 11 -> "11th", 23 -> "23rd". */
export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${{ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] ?? 'th'}`;
}
