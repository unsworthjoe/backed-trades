import { useEffect, useState } from 'react';

/** The current time in milliseconds, updated every `intervalMs`. For countdowns. */
export function useNow(intervalMs = 10_000) {
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
