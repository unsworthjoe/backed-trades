-- Backed. database, step 9: reviews, customer ratings and reports.
--
-- Reviews and customer ratings are blind: neither side's is released until
-- both have rated, or 14 days after the job was completed.

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null unique references public.job_matches on delete cascade,
  trade_id uuid not null references public.trades on delete cascade,
  customer_id uuid not null references public.profiles on delete cascade,
  quality smallint not null check (quality between 1 and 5),
  reliability smallint not null check (reliability between 1 and 5),
  tidiness smallint not null check (tidiness between 1 and 5),
  value smallint not null check (value between 1 and 5),
  overall numeric(3, 2) generated always as ((quality + reliability + tidiness + value) / 4.0) stored,
  comment text not null default '',
  created_at timestamptz not null default now(),
  released_at timestamptz,
  -- Admin moderation.
  hidden_at timestamptz,
  hidden_reason text
);

create index on public.reviews (trade_id) where released_at is not null and hidden_at is null;

-- Trades rate customers. Never shown to customers or the public; shown on
-- offers as an average once a customer has 3 released ratings.
create table public.customer_ratings (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null unique references public.job_matches on delete cascade,
  customer_id uuid not null references public.profiles on delete cascade,
  trade_id uuid not null references public.trades on delete cascade,
  stars smallint not null check (stars between 1 and 5),
  -- Tick-boxes, e.g. clear_brief, easy_to_reach, paid_promptly, good_access.
  tags text[] not null default '{}',
  comment text not null default '',
  created_at timestamptz not null default now(),
  released_at timestamptz
);

create index on public.customer_ratings (customer_id) where released_at is not null;

create type public.report_status as enum ('open', 'resolved', 'dismissed');

-- Complaints from either side, about a job, a trade or a customer.
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles on delete cascade default auth.uid(),
  job_id uuid references public.jobs on delete set null,
  about_user_id uuid references public.profiles on delete set null,
  reason text not null,
  details text not null default '',
  status public.report_status not null default 'open',
  resolved_by uuid references auth.users on delete set null,
  resolved_at timestamptz,
  resolution_note text,
  created_at timestamptz not null default now()
);
