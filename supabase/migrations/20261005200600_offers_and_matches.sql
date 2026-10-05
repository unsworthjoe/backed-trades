-- Backed. database, step 7: offers to trades, and the match once one accepts.

-- withdrawn: another trade won the job first, or it was cancelled.
-- expired: no reply in time (counts as a decline and a miss).
create type public.offer_status as enum ('pending', 'accepted', 'declined', 'expired', 'withdrawn');
create type public.decline_reason as enum (
  'too_busy', 'too_far', 'not_my_kind_of_work', 'too_small', 'too_big', 'other'
);
create type public.match_end_reason as enum ('customer_requested_another', 'cancelled', 'admin');

create table public.job_offers (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs on delete cascade,
  trade_id uuid not null references public.trades on delete cascade,
  queue_member_id uuid references public.queue_members on delete set null,
  -- 1 for normal jobs; call-outs count up with each wave.
  wave integer not null default 1,
  offered_at timestamptz not null default now(),
  expires_at timestamptz not null,
  status public.offer_status not null default 'pending',
  responded_at timestamptz,
  decline_reason public.decline_reason,
  decline_note text,
  check (status <> 'declined' or decline_reason is not null)
);

-- A trade is offered a job at most once, unless the offer was withdrawn
-- before they answered (then they can be offered it again).
create unique index job_offers_once_per_trade
  on public.job_offers (job_id, trade_id) where status <> 'withdrawn';
create index on public.job_offers (trade_id, status);
create index on public.job_offers (status, expires_at);

create table public.job_matches (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs on delete cascade,
  trade_id uuid not null references public.trades on delete cascade,
  offer_id uuid not null unique references public.job_offers on delete cascade,
  matched_at timestamptz not null default now(),
  -- The trade must contact the customer by this time (24 hours).
  contact_due_at timestamptz not null,
  contacted_at timestamptz,
  no_contact_flagged_at timestamptz,
  done_at timestamptz,
  signed_off_at timestamptz,
  auto_closed_at timestamptz,
  -- Set when the match ends without the job being completed.
  ended_at timestamptz,
  end_reason public.match_end_reason,
  check ((ended_at is null) = (end_reason is null))
);

-- One live match per job.
create unique index job_matches_one_live_per_job
  on public.job_matches (job_id) where ended_at is null;
create index on public.job_matches (trade_id);
