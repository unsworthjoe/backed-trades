// Supabase Auth's "Send SMS" hook: Auth calls this instead of texting the code
// itself. It only sends codes the website requested through
// request-phone-code, then sends them with Twilio from the "Backed" sender.
//
// Without Twilio settings (on your PC), the code is written to the function
// log instead of being texted.

import { Webhook } from 'npm:standardwebhooks@1.0.0';

import { adminClient } from '../_shared/http.ts';
import { normaliseUkMobile } from '../_shared/phone.ts';
import { sendText } from '../_shared/twilio.ts';

function hookError(status: number, message: string) {
  return new Response(JSON.stringify({ error: { http_code: status, message } }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  const payload = await req.text();
  const secret = (Deno.env.get('SEND_SMS_HOOK_SECRET') ?? '').replace('v1,whsec_', '');

  let event: { user: { phone: string }; sms: { otp: string } };
  try {
    event = new Webhook(secret).verify(payload, Object.fromEntries(req.headers)) as typeof event;
  } catch {
    return hookError(401, 'Invalid signature');
  }

  const phone = normaliseUkMobile(event.user.phone);
  if (!phone) return hookError(400, 'Backed. only sends codes to UK mobile numbers.');

  const { data: allowed, error } = await adminClient().rpc('claim_sms_code', { p_phone: phone });
  if (error) {
    console.error('claim_sms_code failed', error);
    return hookError(500, 'Could not send the code. Please try again.');
  }
  if (!allowed) return hookError(429, 'Please request your code from the Backed. website.');

  const sent = await sendText(phone, `Your Backed. code is ${event.sms.otp}. Don't share it with anyone.`);
  if (!sent.ok) {
    console.error(sent.error);
    return hookError(502, 'Could not send the text. Please check the number and try again.');
  }

  return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
});
