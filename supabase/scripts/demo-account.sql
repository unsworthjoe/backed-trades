-- Gets the live demo trade ready for App Store and Google Play review.
-- Run it yourself (Claude can't write to live):
--   npx supabase db query --linked -f supabase/scripts/demo-account.sql
--
-- Safe to run again: it only adds the finished job once.
--   * The demo trade becomes "Demo Plumbing" with a free membership that never
--     ends, so it gets offers (Stripe isn't involved).
--   * The test customer (07700 900456, code 123456) is named "Sam Taylor".
--   * One finished job between them, 10 days ago: messages, signed off, and
--     a released review both ways, so every screen in the app has something.
-- Nothing is sent: the notifications this creates are deleted before it ends.
-- The last query shows the result.

do $$
declare
  v_trade uuid := 'b136c934-1685-403f-a46b-a7d5f7941bff';
  v_customer uuid := 'c090bb05-ab08-4cb5-9729-12ee05dca211';
  v_start timestamptz := now() - interval '10 days';
  v_job uuid;
  v_offer uuid;
  v_match uuid;
begin
  if not exists (select 1 from public.trades where id = v_trade and status = 'approved') then
    raise exception 'The demo trade % is missing or not approved', v_trade;
  end if;
  if not exists (select 1 from public.profiles where id = v_customer) then
    raise exception 'The test customer % is missing', v_customer;
  end if;

  update public.trades
    set business_name = 'Demo Plumbing',
        bio = 'Friendly local plumber covering Runcorn and Widnes. Leaks, taps, toilets, radiators and bathroom repairs.',
        paused_at = null, paused_reason = null
    where id = v_trade;
  update public.profiles set full_name = 'Sam Taylor' where id = v_customer;

  insert into public.subscriptions
      (trade_id, stripe_customer_id, stripe_subscription_id, plan, is_founding, price_pence, status,
       current_period_end, cancel_at_period_end)
    values (v_trade, 'demo_free', null, 'monthly', true, 0, 'active', null, false)
    on conflict (trade_id) do update
      set stripe_subscription_id = null, status = 'active', current_period_end = null,
          cancel_at_period_end = false, price_pence = 0;

  if not exists (select 1 from public.jobs where customer_id = v_customer and title = 'Leaking kitchen tap') then
    v_job := private.post_job(v_customer, (select id from public.trade_categories where slug = 'plumber'),
      'WA7 1DD', '12 Demo Street', 'Leaking kitchen tap',
      'The kitchen mixer tap drips constantly and there''s water under the sink.',
      'small', false, 'within_a_week', 'under_250', v_start);

    select id into v_offer from public.job_offers
      where job_id = v_job and trade_id = v_trade and status = 'pending';
    if v_offer is null then
      raise exception 'The demo trade wasn''t offered the job. Is it in the Runcorn plumber queue and insured?';
    end if;

    v_match := private.accept_offer(v_trade, v_offer, v_start + interval '20 minutes');
    perform private.mark_contacted(v_trade, v_match, v_start + interval '40 minutes');

    insert into public.messages (match_id, sender_id, body, created_at, read_at) values
      (v_match, v_trade, 'Hi Sam, it''s Demo Plumbing. I can come Thursday morning to sort the tap. Does 9am suit?',
        v_start + interval '35 minutes', v_start + interval '1 hour'),
      (v_match, v_customer, 'Thursday at 9 is perfect, thanks. It''s the house with the blue door.',
        v_start + interval '1 hour', v_start + interval '2 hours'),
      (v_match, v_trade, 'Great, see you then.',
        v_start + interval '2 hours', v_start + interval '3 hours');

    perform private.mark_done(v_trade, v_match, v_start + interval '2 days');
    perform private.sign_off(v_customer, v_job, v_start + interval '2 days 3 hours');
    perform private.leave_review(v_customer, v_match, 5::smallint, 5::smallint, 5::smallint, 4::smallint,
      'Turned up on time, fixed the leak quickly and left everything clean. Would use again.',
      v_start + interval '2 days 4 hours');
    perform private.rate_customer(v_trade, v_match, 5::smallint, array['clear_brief', 'easy_to_reach'], '',
      v_start + interval '2 days 5 hours');
  end if;

  -- Don't send any of the texts, pushes or emails the steps above queued.
  delete from public.notification_outbox where created_at = now() and sent_at is null;
end;
$$;

select
  t.business_name,
  private.has_active_subscription(t.id, now()) as membership_active,
  private.is_insured(t.id, (now() at time zone 'Europe/London')::date) as insured,
  (select string_agg(tw.name || ' ' || c.name || ': ' || qm.status || ', place ' || (
       select count(*) + 1 from public.queue_members o
       where o.queue_id = qm.queue_id and o.status = qm.status and o.position < qm.position
     ), ', ')
     from public.queue_members qm
     join public.queues q on q.id = qm.queue_id
     join public.towns tw on tw.id = q.town_id
     join public.trade_categories c on c.id = q.category_id
     where qm.trade_id = t.id) as queues,
  public.trade_profile(t.id) -> 'rating' ->> 'count' as reviews,
  public.trade_profile(t.id) ->> 'jobs_completed' as jobs_completed
from public.trades t
where t.id = 'b136c934-1685-403f-a46b-a7d5f7941bff';
