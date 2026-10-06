// The wording of every message the engine queues, by template.

export type Context = {
  /** The job's title, trade and town, when the message is about a job. */
  job?: { id: string; title: string; category: string; town: string };
  /** The matched trade's business name (customer messages). */
  businessName?: string;
  /** The queue's trade and town (queue messages). */
  queue?: { category: string; town: string };
  /** Where a tap on the push notification opens in the trade app. */
  appPath?: string;
  /** The customer's job page on the website. */
  jobLink?: string;
  /** The customer's messages with their trade, on the website. */
  messagesLink?: string;
  /** The founders' admin website. */
  adminLink: string;
  /** Where trades set up and manage their membership (website). */
  membershipLink: string;
};

export type Message = {
  /** Push title and email subject. */
  title: string;
  body: string;
};

const UK = 'Europe/London';

function time(iso: string) {
  return new Date(iso)
    .toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: UK })
    .replace(/\s/g, '')
    .toLowerCase();
}

function date(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: UK });
}

/** "8:30am" if it's today in the UK, otherwise "8:30am tomorrow" or "8:30am on 9 October". */
function replyBy(iso: string) {
  const day = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: UK });
  const at = new Date(iso);
  const now = new Date();
  if (day(at) === day(now)) return time(iso);
  if (day(at) === day(new Date(now.getTime() + 86_400_000))) return `${time(iso)} tomorrow`;
  return `${time(iso)} on ${date(iso)}`;
}

const ALERT_NAMES: Record<string, string> = {
  job_unmatched: 'A job hasn’t been taken after 24 hours',
  no_contact: 'A trade hasn’t contacted their customer within 24 hours',
  low_customer_rating: 'A customer has a low rating from trades',
  trade_paused: 'A trade was paused for missing offers',
  insurance_expiring: 'A trade’s insurance is about to expire',
};

/** The message for a template, or null if the template isn't known. */
export function render(template: string, data: Record<string, unknown>, ctx: Context): Message | null {
  const job = ctx.job;
  const what = job ? `“${job.title}”` : 'your job';
  const where = job ? `${job.title} in ${job.town}` : 'A job';
  const trade = ctx.businessName ?? 'Your trade';
  const queue = ctx.queue ? `${ctx.queue.category} jobs in ${ctx.queue.town}` : 'a queue';
  const link = ctx.jobLink ? ` ${ctx.jobLink}` : '';

  switch (template) {
    // Trades (push, or email if they haven't allowed notifications)
    case 'new_offer':
      return {
        title: `New job offer${job ? `: ${job.category}` : ''}`,
        body: `${where}. Reply by ${replyBy(String(data.expires_at))}.`,
      };
    case 'new_callout':
      return {
        title: `Emergency call-out${job ? `: ${job.category}` : ''}`,
        body: `${where}. You have 30 minutes to reply.`,
      };
    case 'offer_reminder':
      return {
        title: 'One hour left to reply',
        body: `${where}. Reply by ${replyBy(String(data.expires_at))} or it counts as a decline.`,
      };
    case 'offer_expired':
      return { title: 'An offer ran out', body: `You didn’t reply to ${what} in time, so it’s gone to another trade.` };
    case 'job_taken':
      return { title: 'Job taken', body: `${where} went to another trade.` };
    case 'job_cancelled':
      return { title: 'Job cancelled', body: `The customer cancelled ${what}.` };
    case 'match_ended':
      return { title: 'Job ended', body: `The customer asked for a different trade for ${what}.` };
    case 'job_signed_off':
      return { title: 'Job signed off', body: `The customer signed off ${what}. Nice work.` };
    case 'paused_missed_offers':
      return {
        title: 'Offers paused',
        body: '3 offers in a row ran out without a reply, so we’ve paused new offers. Switch them back on in the app when you’re ready.',
      };
    case 'moved_to_back':
      return { title: 'Moved to the back of a queue', body: `You declined 5 offers in a row for ${queue}.` };
    case 'tuned_out_of_queue':
      return {
        title: `${ctx.queue?.category ?? 'Some'} jobs switched off`,
        body: `You said “not my kind of work” to 3 of these jobs in ${ctx.queue?.town ?? 'one town'}, so we’ve stopped sending them. Switch them back on in Your queues.`,
      };
    case 'left_waiting_list':
      return { title: 'You’re off the waiting list', body: `A place opened up for ${queue}. You’re now in the queue.` };
    case 'trade_approved':
      return { title: 'You’re approved', body: 'Welcome to Backed. You’ve joined your queues.' };
    case 'trade_rejected':
      return {
        title: 'Your application needs another look',
        body: `${data.reason ?? ''} Open the app to fix it and send it again.`.trim(),
      };
    case 'insurance_expiring':
      return {
        title: `Your insurance expires on ${date(String(data.expires_on))}`,
        body: 'Upload your new certificate in the app so your offers don’t stop.',
      };

    case 'new_message':
      return data.for_trade
        ? {
            title: `${String(data.sender_name || 'Your customer')}${job ? ` · ${job.title}` : ''}`,
            body: String(data.preview ?? 'Sent you a message.'),
          }
        : {
            title: `New message from ${trade}`,
            body: `Backed.: ${trade} sent you a message about ${what}. Read and reply: ${ctx.messagesLink ?? ctx.jobLink ?? ''}`.trim(),
          };
    case 'review_released':
      return {
        title: 'You have a new review',
        body: `${Number(data.overall).toFixed(1)} out of 5 for ${what}. Open the app to read it.`,
      };

    // Memberships. Anything about paying goes by email with a website link, never in the app.
    case 'membership_invite':
      return {
        title: 'Set up your Backed. membership',
        body: `You’re approved, welcome to Backed.\n\nThe last step is your membership. Once it’s active, job offers start arriving in the app.\n\nSet it up here: ${ctx.membershipLink}`,
      };
    case 'membership_active':
      return { title: 'You’re a Backed. member', body: 'Your membership is active. Job offers start now.' };
    case 'payment_failed':
      return {
        title: 'Your Backed. payment didn’t go through',
        body: `We couldn’t take your latest membership payment, so job offers are paused.\n\nUpdate your card here and we’ll try again straight away: ${ctx.membershipLink}`,
      };
    case 'membership_ended':
      return {
        title: 'Your Backed. membership has ended',
        body: `Your membership has ended, so you won’t get any more job offers. You keep your place in your queues for now.\n\nYou can rejoin any time: ${ctx.membershipLink}`,
      };

    // Customers (text)
    case 'job_matched':
      return {
        title: 'Your trade is found',
        body: `Backed.: Good news, ${trade} has accepted ${what}. They’ll be in touch within 24 hours.${link}`,
      };
    case 'job_still_listed':
      return {
        title: 'Still looking',
        body: `Backed.: We’re still looking for a trade for ${what}. It stays listed, and our team is on it.${link}`,
      };
    case 'no_contact_check':
      return {
        title: 'Has your trade been in touch?',
        body: `Backed.: Has ${trade} been in touch about ${what}? If not, you can ask for a different trade:${link}`,
      };
    case 'job_marked_done':
      return {
        title: 'Your job is done',
        body: `Backed.: ${trade} says ${what} is done. If you’re happy, please sign it off:${link}`,
      };
    case 'signoff_reminder':
      return {
        title: 'Please sign off your job',
        body: `Backed.: Reminder: please sign off ${what} if you’re happy with it:${link}`,
      };
    case 'job_auto_closed':
      return data.for_trade
        ? { title: 'Job closed', body: `${what} has been closed as completed.` }
        : {
            title: 'Job closed',
            body: `Backed.: We’ve closed ${what} as completed. Thanks for using Backed.${link}`,
          };

    // Founders (email)
    case 'admin_alert':
      return {
        title: `Backed. alert: ${ALERT_NAMES[String(data.kind)] ?? String(data.kind)}`,
        body: `${ALERT_NAMES[String(data.kind)] ?? String(data.kind)}.${job ? `\n\nJob: ${where}.` : ''}\n\nOpen the admin site to look into it: ${ctx.adminLink}`,
      };
  }
  return null;
}
