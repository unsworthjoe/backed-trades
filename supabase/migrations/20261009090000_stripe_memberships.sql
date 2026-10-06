-- Memberships paid through Stripe on the website (build step 7).
--
-- The create-checkout Edge Function starts a Stripe Checkout; the
-- stripe-webhook function reports back through sync_subscription(), which
-- keeps public.subscriptions in step with Stripe and tells the trade.
-- Offers already require an active subscription (has_active_subscription).

-- While on, new members get the founding price and keep it for as long as
-- they stay subscribed. The founders switch it off from the admin site.
alter table public.app_settings add column founding_pricing_open boolean not null default true;

-- Before checkout the row records the Stripe customer and the chosen plan
-- (status 'incomplete'); the webhook fills in the rest.
alter table public.subscriptions alter column status set default 'incomplete';

-- ---------------------------------------------------------------------------
-- Prices (in pence). Kept here so the website and Stripe agree.
-- ---------------------------------------------------------------------------

create function public.membership_prices()
returns table (plan public.subscription_plan, is_founding boolean, price_pence integer, lookup_key text)
language sql
immutable
set search_path = ''
as $$
  values
    ('monthly'::public.subscription_plan, true, 1499, 'backed_founding_monthly'),
    ('yearly', true, 14990, 'backed_founding_yearly'),
    ('monthly', false, 1999, 'backed_standard_monthly'),
    ('yearly', false, 19990, 'backed_standard_yearly')
$$;

grant execute on function public.membership_prices() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Called by the stripe-webhook function (secret key only)
-- ---------------------------------------------------------------------------

-- p_status is Stripe's subscription status; Stripe's extra states are folded
-- into ours (incomplete_expired and paused stop offers like canceled).
create function public.sync_subscription(
  p_trade_id uuid,
  p_customer_id text,
  p_subscription_id text,
  p_status text,
  p_lookup_key text,
  p_price_pence integer,
  p_current_period_end timestamptz,
  p_cancel_at_period_end boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.subscriptions;
  v_status public.subscription_status := case p_status
    when 'incomplete_expired' then 'canceled'
    when 'paused' then 'canceled'
    else p_status
  end::public.subscription_status;
  v_price record;
  v_was_active boolean;
  v_now_active boolean;
begin
  select * into v_price from public.membership_prices() where lookup_key = p_lookup_key;
  select * into v_old from public.subscriptions where trade_id = p_trade_id for update;
  v_was_active := v_old.status in ('active', 'trialing');
  v_now_active := v_status in ('active', 'trialing');

  insert into public.subscriptions (trade_id, stripe_customer_id, stripe_subscription_id, plan, is_founding,
      price_pence, status, current_period_end, cancel_at_period_end)
    values (p_trade_id, p_customer_id, p_subscription_id, coalesce(v_price.plan, 'monthly'),
      coalesce(v_price.is_founding, false), coalesce(p_price_pence, v_price.price_pence, 0), v_status,
      p_current_period_end, coalesce(p_cancel_at_period_end, false))
    on conflict (trade_id) do update set
      stripe_customer_id = excluded.stripe_customer_id,
      stripe_subscription_id = excluded.stripe_subscription_id,
      plan = coalesce(v_price.plan, public.subscriptions.plan),
      is_founding = coalesce(v_price.is_founding, public.subscriptions.is_founding),
      price_pence = excluded.price_pence,
      status = excluded.status,
      current_period_end = excluded.current_period_end,
      cancel_at_period_end = excluded.cancel_at_period_end;

  -- Payment problems go by email, with a link to the website: the app
  -- mustn't point people to paying elsewhere (Apple's rules).
  if v_now_active and not coalesce(v_was_active, false) then
    perform private.notify(p_trade_id, 'membership_active', '{}', now());
  elsif v_status = 'past_due' and v_old.status is distinct from 'past_due' then
    insert into public.notification_outbox (user_id, channel, template, data)
      values (p_trade_id, 'email', 'payment_failed', '{}');
  elsif v_status in ('canceled', 'unpaid') and v_old.status in ('active', 'trialing', 'past_due') then
    insert into public.notification_outbox (user_id, channel, template, data)
      values (p_trade_id, 'email', 'membership_ended', '{}');
  end if;
end;
$$;

revoke execute on function
  public.sync_subscription(uuid, text, text, text, text, integer, timestamptz, boolean)
  from public, anon, authenticated;
grant execute on function
  public.sync_subscription(uuid, text, text, text, text, integer, timestamptz, boolean)
  to service_role;

-- ---------------------------------------------------------------------------
-- Approved trades are emailed how to set up their membership
-- ---------------------------------------------------------------------------

-- By email, always: the app mustn't point people to paying on the website
-- (Apple's rules), but an email can.
create function private.email_membership_invite()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_active_subscription(new.id, now()) then
    insert into public.notification_outbox (user_id, channel, template, data)
      values (new.id, 'email', 'membership_invite', '{}');
  end if;
  return null;
end;
$$;

create trigger trades_membership_invite after update of status on public.trades
  for each row when (old.status is distinct from 'approved' and new.status = 'approved')
  execute function private.email_membership_invite();
