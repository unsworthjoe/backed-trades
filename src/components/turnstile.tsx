/**
 * Cloudflare Turnstile ("are you human?") only runs on the website, where customers sign in. See
 * turnstile.web.tsx. The phone app never shows it.
 */
export function Turnstile(_props: { onToken: (token: string | null) => void }) {
  return null;
}
