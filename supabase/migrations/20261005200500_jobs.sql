-- Backed. database, step 6: jobs posted by customers.
--
-- The full postcode and address sit in job_addresses, which offered trades
-- can't read. They only see the postcode district (e.g. "WA7") until they
-- accept.

create type public.job_size as enum ('small', 'large');
create type public.job_timing as enum ('asap', 'within_a_week', 'within_a_month', 'flexible');
create type public.job_budget as enum (
  'under_250', '250_to_1000', '1000_to_5000', '5000_to_15000', 'over_15000', 'not_sure'
);
-- offering: offers are out; matched: a trade accepted; done: the trade marked
-- it done; completed: signed off by the customer or auto-closed.
create type public.job_status as enum ('offering', 'matched', 'done', 'completed', 'cancelled');

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles on delete cascade,
  category_id smallint not null references public.trade_categories,
  town_id smallint not null references public.towns,
  district text not null,
  size public.job_size not null default 'small',
  is_callout boolean not null default false,
  title text not null check (length(trim(title)) > 0),
  description text not null default '',
  timing public.job_timing not null default 'flexible',
  budget public.job_budget not null default 'not_sure',
  status public.job_status not null default 'offering',
  -- Call-outs send a new wave every few minutes until someone accepts.
  current_wave integer not null default 0,
  last_wave_at timestamptz,
  -- Set once the home town's queue ran out and neighbouring towns were added.
  expanded_at timestamptz,
  -- Set once admins were alerted that nobody had taken the job.
  unmatched_alerted_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on public.jobs (customer_id);
create index on public.jobs (status);

create trigger jobs_updated_at before update on public.jobs
  for each row execute function public.set_updated_at();

create table public.job_addresses (
  job_id uuid primary key references public.jobs on delete cascade,
  postcode text not null,
  address_line text not null default ''
);

-- Files live in the private "job-photos" bucket under {job_id}/.
create table public.job_photos (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs on delete cascade,
  storage_path text not null unique,
  created_at timestamptz not null default now()
);

create index on public.job_photos (job_id);
