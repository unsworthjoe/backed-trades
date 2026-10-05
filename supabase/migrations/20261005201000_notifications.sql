-- Backed. database, step 11: notifications.
--
-- The engine never sends anything itself. It writes to notification_outbox,
-- and an Edge Function (built later) sends what's due by push, text or email.
-- The channel is a column, so WhatsApp can be added later with a text
-- fallback without touching the engine.

create type public.notification_channel as enum ('push', 'sms', 'email', 'whatsapp');

create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade default auth.uid(),
  token text not null unique,
  platform text not null check (platform in ('ios', 'android', 'web')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index on public.push_tokens (user_id);

create table public.notification_outbox (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles on delete cascade,
  channel public.notification_channel not null,
  -- e.g. new_offer, offer_reminder, job_matched, signoff_reminder.
  template text not null,
  data jsonb not null default '{}',
  -- Call-outs use a louder sound and badge.
  urgent boolean not null default false,
  scheduled_for timestamptz not null default now(),
  sent_at timestamptz,
  -- Set when it's no longer needed (e.g. the customer signed off before a
  -- reminder was due).
  cancelled_at timestamptz,
  failed_at timestamptz,
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now()
);

create index notification_outbox_due
  on public.notification_outbox (scheduled_for)
  where sent_at is null and cancelled_at is null and failed_at is null;
create index on public.notification_outbox using gin (data);
