// Sends what's due in notification_outbox. Woken by the database (see the
// notification_sender migration) with the x-sender-secret header.
//
// Channels: trades get push notifications (email if they have no device
// registered), customers get texts, founders get email. Without Twilio or
// Resend settings (on your PC), texts and emails are written to the log.

import { hasSenderSecret } from '../_shared/auth.ts';
import { adminClient, json } from '../_shared/http.ts';
import { normaliseUkMobile } from '../_shared/phone.ts';
import { cleanSecret, sendText } from '../_shared/twilio.ts';
import { render, type Context, type Message } from './messages.ts';

type Claimed = {
  id: number;
  user_id: string;
  channel: 'push' | 'sms' | 'email' | 'whatsapp';
  template: string;
  data: Record<string, unknown>;
  urgent: boolean;
  attempts: number;
  role: 'customer' | 'trade' | 'admin';
  full_name: string;
  email: string | null;
  phone: string | null;
  push_tokens: string[];
};

type Outcome = { outcome: 'sent' | 'skipped' | 'retry' | 'failed'; error?: string };

const db = adminClient();
const SITE_URL = (Deno.env.get('SITE_URL') ?? 'https://backedtrades.co.uk').replace(/\/$/, '');

/** Offer messages are pointless once the reply window has closed. */
const EXPIRING = new Set(['new_offer', 'new_callout', 'offer_reminder']);

Deno.serve(async (req) => {
  if (!hasSenderSecret(req)) return json(401, { error: 'Not allowed' });

  let sent = 0;
  let other = 0;
  // A few rounds, so a burst (e.g. a call-out to many trades) goes out in one wake-up.
  for (let round = 0; round < 5; round++) {
    const { data, error } = await db.rpc('claim_notifications', { p_limit: 50 });
    if (error) {
      console.error('claim_notifications failed', error);
      return json(500, { error: error.message });
    }
    const rows = (data ?? []) as Claimed[];
    if (!rows.length) break;

    await Promise.all(
      rows.map(async (row) => {
        let result: Outcome;
        try {
          result = await deliver(row);
        } catch (e) {
          result = { outcome: 'retry', error: String(e) };
        }
        if (result.outcome === 'sent') sent++;
        else other++;
        if (result.error) console.error(`[outbox ${row.id} ${row.template}] ${result.outcome}: ${result.error}`);
        const { error } = await db.rpc('finish_notification', {
          p_id: row.id,
          p_outcome: result.outcome,
          p_error: result.error ?? null,
        });
        if (error) console.error('finish_notification failed', error);
      }),
    );
  }

  return json(200, { sent, other });
});

async function deliver(row: Claimed): Promise<Outcome> {
  if (EXPIRING.has(row.template) && typeof row.data.expires_at === 'string' && new Date(row.data.expires_at) <= new Date()) {
    return { outcome: 'skipped', error: 'the offer had already run out' };
  }

  const ctx = await loadContext(row);
  const message = render(row.template, { ...row.data, for_trade: row.role === 'trade' }, ctx);
  if (!message) return { outcome: 'failed', error: `no wording for template "${row.template}"` };

  if (row.channel === 'push') {
    if (row.push_tokens.length) return sendPush(row, message, ctx);
    // No device registered (notifications not allowed yet): email instead.
    return row.email
      ? sendEmail(row.email, message.title, tradeEmailBody(message, ctx))
      : { outcome: 'failed', error: 'no device or email address' };
  }
  if (row.channel === 'sms' || row.channel === 'whatsapp') {
    const phone = row.phone && normaliseUkMobile(row.phone);
    // Past the daily ceiling, fall through to email like a customer with no mobile number.
    if (phone && (await underDailyTextCap())) return text(phone, message.body);
    return row.email
      ? sendEmail(row.email, message.title, message.body.replace(/^Backed\.: /, ''))
      : { outcome: 'failed', error: 'no mobile number or email address' };
  }
  return row.email ? sendEmail(row.email, message.title, message.body) : { outcome: 'failed', error: 'no email address' };
}

/** A trade’s message as an email: the wording, then a link to the right page on the website. */
function tradeEmailBody(message: Message, ctx: Context) {
  return `${message.body}\n\nOpen it on Backed.: ${SITE_URL}${ctx.appPath ?? '/'}`;
}

/** Looks up the names and links a message needs. */
async function loadContext(row: Claimed): Promise<Context> {
  const ctx: Context = { adminLink: `${SITE_URL}/admin`, membershipLink: `${SITE_URL}/membership` };
  const jobId = typeof row.data.job_id === 'string' ? row.data.job_id : null;
  const queueId = typeof row.data.queue_id === 'string' ? row.data.queue_id : null;
  const matchId = typeof row.data.match_id === 'string' ? row.data.match_id : null;

  if (jobId) {
    const { data: job } = await db
      .from('jobs')
      .select('id, title, trade_categories(name), towns(name)')
      .eq('id', jobId)
      .maybeSingle();
    if (job) {
      ctx.job = {
        id: job.id,
        title: job.title,
        category: (job.trade_categories as unknown as { name: string } | null)?.name ?? 'Job',
        town: (job.towns as unknown as { name: string } | null)?.name ?? '',
      };
    }
    ctx.jobLink = `${SITE_URL}/my-jobs/${jobId}`;
    ctx.messagesLink = `${SITE_URL}/my-jobs/${jobId}/messages`;
  }

  if (matchId && row.role === 'customer') {
    const { data: match } = await db.from('job_matches').select('trades(business_name)').eq('id', matchId).maybeSingle();
    ctx.businessName = (match?.trades as unknown as { business_name: string } | null)?.business_name;
  }

  if (queueId) {
    const { data: queue } = await db
      .from('queues')
      .select('trade_categories(name), towns(name)')
      .eq('id', queueId)
      .maybeSingle();
    if (queue) {
      ctx.queue = {
        category: (queue.trade_categories as unknown as { name: string } | null)?.name ?? '',
        town: (queue.towns as unknown as { name: string } | null)?.name ?? '',
      };
    }
  }

  if (row.role === 'trade') ctx.appPath = await tradeAppPath(row, jobId, matchId);
  return ctx;
}

/** Which screen a tap opens in the trade app. */
async function tradeAppPath(row: Claimed, jobId: string | null, matchId: string | null): Promise<string> {
  if (['new_offer', 'new_callout', 'offer_reminder', 'offer_expired', 'job_taken'].includes(row.template) && jobId) {
    const { data: offer } = await db
      .from('job_offers')
      .select('id')
      .eq('job_id', jobId)
      .eq('trade_id', row.user_id)
      .order('offered_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (offer) return `/offers/${offer.id}`;
  }
  if (['job_cancelled', 'match_ended', 'job_signed_off', 'job_auto_closed'].includes(row.template) && jobId) {
    if (matchId) return `/jobs/${matchId}`;
    const { data: match } = await db
      .from('job_matches')
      .select('id')
      .eq('job_id', jobId)
      .eq('trade_id', row.user_id)
      .order('matched_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (match) return `/jobs/${match.id}`;
  }
  if (row.template === 'new_message' && matchId) return `/jobs/${matchId}/messages`;
  if (row.template === 'review_released') return '/reviews';
  if (['moved_to_back', 'tuned_out_of_queue', 'left_waiting_list'].includes(row.template)) return '/queues';
  if (row.template === 'insurance_expiring') return '/apply/insurance';
  return '/';
}

// ---------------------------------------------------------------------------
// Push (Expo)
// ---------------------------------------------------------------------------

async function sendPush(row: Claimed, message: Message, ctx: Context): Promise<Outcome> {
  const headers: Record<string, string> = { Accept: 'application/json', 'Content-Type': 'application/json' };
  const accessToken = cleanSecret(Deno.env.get('EXPO_ACCESS_TOKEN'));
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers,
    body: JSON.stringify(
      row.push_tokens.map((to) => ({
        to,
        title: message.title,
        body: message.body,
        data: { url: ctx.appPath ?? '/' },
        sound: 'default',
        priority: row.urgent || row.template === 'new_offer' ? 'high' : 'default',
        channelId: row.urgent || EXPIRING.has(row.template) ? 'offers' : 'default',
        interruptionLevel: row.urgent ? 'time-sensitive' : 'active',
      })),
    ),
  });
  if (!response.ok) {
    return { outcome: 'retry', error: `Expo push HTTP ${response.status}: ${await response.text()}` };
  }

  const tickets = ((await response.json()) as {
    data: { status: 'ok' | 'error'; message?: string; details?: { error?: string } }[];
  }).data;
  const gone = row.push_tokens.filter((_, i) => tickets[i]?.details?.error === 'DeviceNotRegistered');
  if (gone.length) await db.rpc('forget_push_tokens', { p_tokens: gone });

  if (tickets.some((t) => t.status === 'ok')) return { outcome: 'sent' };
  const errors = tickets.map((t) => t.details?.error ?? t.message).join(', ');
  // Every device is gone: fall back to email so the message isn't lost.
  if (gone.length === row.push_tokens.length && row.email) {
    return sendEmail(row.email, message.title, tradeEmailBody(message, ctx));
  }
  return { outcome: 'retry', error: `Expo push: ${errors}` };
}

// ---------------------------------------------------------------------------
// Text (Twilio)
// ---------------------------------------------------------------------------

/**
 * Curly quotes and apostrophes aren't in the basic text-message alphabet: one of them makes
 * Twilio send the whole text in a format that fits 70 characters per part instead of 160.
 */
function plainText(body: string) {
  return body.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/…/g, '...');
}

/** Most texts sent in any 24 hours: a ceiling on the Twilio bill if something goes wrong. */
const DAILY_TEXT_CAP = 200;

async function underDailyTextCap() {
  const { count, error } = await db
    .from('notification_outbox')
    .select('id', { count: 'exact', head: true })
    .eq('channel', 'sms')
    .gte('sent_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  if (error) console.error('counting texts sent failed', error);
  return (count ?? 0) < DAILY_TEXT_CAP;
}

async function text(phone: string, body: string): Promise<Outcome> {
  const result = await sendText(phone, plainText(body));
  if (result.ok) return { outcome: 'sent' };
  return { outcome: result.retry ? 'retry' : 'failed', error: result.error };
}

// ---------------------------------------------------------------------------
// Email (Resend)
// ---------------------------------------------------------------------------

async function sendEmail(to: string, subject: string, body: string): Promise<Outcome> {
  const apiKey = cleanSecret(Deno.env.get('RESEND_API_KEY'));
  if (!apiKey) {
    console.log(`[email to ${to}] ${subject}\n${body}`);
    return { outcome: 'sent' };
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: Deno.env.get('EMAIL_FROM') ?? 'Backed. <no-reply@backedtrades.co.uk>',
      to: [to],
      subject,
      text: body,
    }),
  });
  if (response.ok) return { outcome: 'sent' };
  return {
    outcome: response.status === 429 || response.status >= 500 ? 'retry' : 'failed',
    error: `Resend HTTP ${response.status}: ${await response.text()}`,
  };
}
