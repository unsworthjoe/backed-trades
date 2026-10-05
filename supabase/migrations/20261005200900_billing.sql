-- Backed. database, step 10: subscriptions, mirrored from Stripe.
--
-- Trades subscribe on the website (Apple's rules), only after approval. One
-- subscription covers every town and category. Only the Stripe webhook (with
-- the secret key) writes here.

create type public.subscription_plan as enum ('monthly', 'yearly');
create type public.subscription_status as enum (
  'incomplete', 'trialing', 'active', 'past_due', 'canceled', 'unpaid'
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid not null unique references public.trades on delete cascade,
  stripe_customer_id text not null,
  stripe_subscription_id text unique,
  plan public.subscription_plan not null,
  -- Founding members keep their price for as long as they stay subscribed.
  is_founding boolean not null default false,
  price_pence integer not null check (price_pence >= 0),
  status public.subscription_status not null,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger subscriptions_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();
