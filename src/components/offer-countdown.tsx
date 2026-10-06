import { Chip } from '@/components/ui/chip';
import { useNow } from '@/hooks/use-now';
import { formatTimeOfDay, timeLeft } from '@/lib/dates';

/** The normal reply window. Longer than this means the clock is stopped overnight. */
const REPLY_WINDOW_MS = 2 * 60 * 60_000;

/** "1h 48m left to reply", or "Reply by 8:30am tomorrow" when the clock is stopped overnight. */
export function OfferCountdown({ expiresAt }: { expiresAt: string }) {
  const now = useNow();
  const left = timeLeft(expiresAt, now);
  const ms = new Date(expiresAt).getTime() - now;

  if (!left) return <Chip label="Time’s up" tone="neutral" />;
  if (ms > REPLY_WINDOW_MS) return <Chip label={`Reply by ${formatTimeOfDay(expiresAt, now)}`} tone="brand" />;
  return <Chip label={`${left} left to reply`} tone={ms < 30 * 60_000 ? 'danger' : 'warning'} />;
}
