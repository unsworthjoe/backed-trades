-- Stripe memberships: what the webhook records, who's told, and offers
-- following the membership.

begin;
select plan(15);

create temp table v (k text primary key, id uuid);
grant select on v to anon, authenticated;
create function pg_temp.v(p_key text) returns uuid language sql as $$ select id from v where k = p_key $$;
create function pg_temp.sync(p_status text, p_cancel boolean default false) returns void language sql as $$
  select public.sync_subscription(pg_temp.v('trade'), 'cus_123', 'sub_123', p_status, 'backed_founding_yearly',
    14990, now() + interval '1 year', p_cancel)
$$;
create function pg_temp.sent(p_template text) returns text language sql as $$
  select string_agg(channel::text, ',') from public.notification_outbox
  where user_id = pg_temp.v('trade') and template = p_template
$$;

-- Approved without a subscription: emailed how to join.
insert into v values ('trade', tests.trade('New Member Plumbing', p_subscribed => false));
select is(pg_temp.sent('membership_invite'), 'email', 'approval emails the trade how to set up their membership');
insert into v values ('member', tests.trade('Existing Member Plumbing'));
select is(
  (select count(*)::integer from public.notification_outbox where user_id = pg_temp.v('member') and template = 'membership_invite'),
  0, '...unless they already have one');

select is((select price_pence from public.membership_prices() where plan = 'yearly' and is_founding), 14990,
  'founding yearly is £149.90 (two months free)');
select is((select founding_pricing_open from public.app_settings), true, 'founding pricing starts switched on');

-- Checkout finished: active.
select pg_temp.sync('active');
select is(
  (select plan::text || ' ' || is_founding || ' ' || price_pence || ' ' || status from public.subscriptions where trade_id = pg_temp.v('trade')),
  'yearly true 14990 active', 'the webhook records the plan, founding price and status');
select ok(private.has_active_subscription(pg_temp.v('trade'), now()), 'an active membership turns offers on');
select is(pg_temp.sent('membership_active'), 'push', 'the trade is told they''re a member');

select pg_temp.sync('active', true);
select is((select cancel_at_period_end from public.subscriptions where trade_id = pg_temp.v('trade')), true,
  'cancelling at the end of the period is recorded');
select is(pg_temp.sent('membership_active'), 'push', 'repeat updates don''t notify again');

-- A failed payment.
select pg_temp.sync('past_due');
select ok(not private.has_active_subscription(pg_temp.v('trade'), now()), 'a failed payment stops offers');
select is(pg_temp.sent('payment_failed'), 'email', 'and the trade is emailed (not pushed) about it');

-- Paid after all, then cancelled.
select pg_temp.sync('active');
select is(pg_temp.sent('membership_active'), 'push,push', 'paying again turns offers back on, and says so');
select pg_temp.sync('canceled');
select is(pg_temp.sent('membership_ended'), 'email', 'ending a membership emails the trade');

-- Only Stripe's webhook (the secret key) can record memberships.
select tests.as_user(pg_temp.v('trade'));
select throws_ok($$select public.sync_subscription(auth.uid(), 'cus_x', 'sub_x', 'active', 'backed_founding_monthly', 0, now() + interval '1 year', false)$$,
  '42501', null, 'trades can''t give themselves a membership');
select is((select count(*)::integer from public.membership_prices()), 4, 'anyone signed in can see the prices');
reset role;

select * from finish();
rollback;
