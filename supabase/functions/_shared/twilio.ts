/** Secrets pasted from other apps can pick up spaces, quotes or line breaks; strip them. */
export function cleanSecret(value: string | undefined) {
  return (value ?? '').trim().replace(/^["'<]+|["'>]+$/g, '').trim();
}

export type TextResult =
  | { ok: true }
  /** `retry`: worth trying again later (Twilio busy or down). */
  | { ok: false; retry: boolean; error: string }
  /** Twilio isn't set up (on your PC): the text was written to the log instead. */
  | { ok: true; logged: true };

/** Sends a text from the "Backed" sender. `phone` is international digits without the "+". */
export async function sendText(phone: string, body: string): Promise<TextResult> {
  const accountSid = cleanSecret(Deno.env.get('TWILIO_ACCOUNT_SID'));
  const authToken = cleanSecret(Deno.env.get('TWILIO_AUTH_TOKEN'));
  const messagingServiceSid = cleanSecret(Deno.env.get('TWILIO_MESSAGING_SERVICE_SID'));

  if (!accountSid || !authToken || !messagingServiceSid) {
    console.log(`[text to +${phone}] ${body}`);
    return { ok: true, logged: true };
  }

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: `+${phone}`, MessagingServiceSid: messagingServiceSid, Body: body }),
  });
  if (response.ok) return { ok: true };

  // Twilio's own explanation, e.g. code 20003 "Primary compliance profile is not approved"
  // (the account's Trust Hub check isn't finished) or 21608 (trial account).
  const failure = (await response.json().catch(() => ({}))) as { code?: number; message?: string };
  return {
    ok: false,
    retry: response.status === 429 || response.status >= 500,
    error: `Twilio refused the text (HTTP ${response.status}, code ${failure.code}): ${failure.message}`,
  };
}
