-- A job after it's matched: asking for another trade, the 24-hour contact
-- rule, marking done, reminders, sign-off, auto-close and the review window.

begin;
select plan(20);

create temp table v (k text primary key, id uuid);
create function pg_temp.v(p_key text) returns uuid language sql as $$ select id from v where k = p_key $$;

insert into v values
  ('customer', tests.customer()),
  ('a', tests.trade('Plumber A')),
  ('b', tests.trade('Plumber B')),
  ('c', tests.trade('Plumber C')),
  ('d', tests.trade('Plumber D'));

-- ---------------------------------------------------------------------------
-- Asking for another trade
-- ---------------------------------------------------------------------------

insert into v values ('job', tests.post(pg_temp.v('customer'), 'plumber'));
insert into v values ('match1',
  private.accept_offer(pg_temp.v('a'), tests.offer_id(pg_temp.v('job'), pg_temp.v('a')), tests.t0()));

select throws_ok(
  format('select private.request_another_trade(%L, %L, tests.t0())', pg_temp.v('b'), pg_temp.v('job')),
  'JOB_NOT_FOUND', 'only the customer can ask for another trade');

select private.request_another_trade(pg_temp.v('customer'), pg_temp.v('job'), tests.t0() + interval '1 hour');

select is((select end_reason::text from public.job_matches where id = pg_temp.v('match1')),
  'customer_requested_another', 'the first match ends');
select is((select status::text from public.jobs where id = pg_temp.v('job')), 'offering', 'the job is offered again');
select is(tests.offered(pg_temp.v('job')),
  array[pg_temp.v('b'), pg_temp.v('c'), pg_temp.v('d')],
  'trades whose offers were withdrawn get another chance; the first trade is not offered it again');
select is((select count(*)::integer from public.notification_outbox
           where user_id = pg_temp.v('a') and template = 'match_ended'), 1, 'the first trade is told');

-- ---------------------------------------------------------------------------
-- Contact within 24 hours
-- ---------------------------------------------------------------------------

insert into v values ('match2',
  private.accept_offer(pg_temp.v('b'), tests.offer_id(pg_temp.v('job'), pg_temp.v('b')), tests.t0() + interval '2 hours'));

select is((select contact_due_at from public.job_matches where id = pg_temp.v('match2')),
  tests.t0() + interval '26 hours', 'contact is due 24 hours after accepting');
select private.check_no_contact(tests.t0() + interval '25 hours 59 minutes');
select is((select no_contact_flagged_at from public.job_matches where id = pg_temp.v('match2')), null,
  'no flag before 24 hours');
select private.check_no_contact(tests.t0() + interval '26 hours');
select is((select count(*)::integer from public.admin_alerts
           where kind = 'no_contact' and job_id = pg_temp.v('job')), 1,
  'no contact in 24 hours: the founders are alerted');
select is((select count(*)::integer from public.notification_outbox
           where user_id = pg_temp.v('customer') and template = 'no_contact_check'), 1,
  '...and the customer is asked if they want another trade');

-- ---------------------------------------------------------------------------
-- Done, reminders and auto-close
-- ---------------------------------------------------------------------------

select throws_ok(
  format('select private.leave_review(%L, %L, 5::smallint, 5::smallint, 5::smallint, 5::smallint, '''', tests.t0())',
    pg_temp.v('customer'), pg_temp.v('match2')),
  'JOB_NOT_COMPLETED', 'no review before the job is completed');

select private.mark_done(pg_temp.v('b'), pg_temp.v('match2'), tests.t0() + interval '3 days');
select is((select status::text from public.jobs where id = pg_temp.v('job')), 'done', 'the trade marks the job done');
select is((select array_agg(scheduled_for - (tests.t0() + interval '3 days') order by scheduled_for)
           from public.notification_outbox
           where template = 'signoff_reminder' and data ->> 'job_id' = pg_temp.v('job')::text),
  array[interval '6 hours', interval '12 hours', interval '24 hours'],
  'sign-off reminders at 6, 12 and 24 hours');

select private.auto_close(tests.t0() + interval '3 days 47 hours 59 minutes');
select is((select status::text from public.jobs where id = pg_temp.v('job')), 'done', 'not closed before 48 hours');
select private.auto_close(tests.t0() + interval '3 days 48 hours');
select is((select status::text from public.jobs where id = pg_temp.v('job')), 'completed', 'auto-closed at 48 hours');
select is((select count(*)::integer from public.notification_outbox
           where user_id = pg_temp.v('customer') and template = 'job_auto_closed'), 1,
  'the customer gets the 48-hour message: closed, but they can still review');

-- Review window: 14 days after auto-close.
select throws_ok(
  format('select private.leave_review(%L, %L, 5::smallint, 5::smallint, 5::smallint, 5::smallint, '''', %L)',
    pg_temp.v('customer'), pg_temp.v('match2'), tests.t0() + interval '5 days' + interval '14 days 1 minute'),
  'REVIEW_WINDOW_CLOSED', 'no review more than 14 days after auto-close');
select lives_ok(
  format('select private.leave_review(%L, %L, 5::smallint, 4::smallint, 5::smallint, 4::smallint, ''Great'', %L)',
    pg_temp.v('customer'), pg_temp.v('match2'), tests.t0() + interval '5 days' + interval '14 days'),
  'a review is still possible 14 days after auto-close');
select is((select overall from public.reviews where match_id = pg_temp.v('match2')), 4.50::numeric(3, 2),
  'overall is the average of the four scores');

-- ---------------------------------------------------------------------------
-- Signing off cancels the remaining reminders
-- ---------------------------------------------------------------------------

insert into v values ('job2', tests.post(pg_temp.v('customer'), 'plumber'));
insert into v values ('match3',
  private.accept_offer(pg_temp.v('c'), tests.offer_id(pg_temp.v('job2'), pg_temp.v('c')), tests.t0()));
select private.mark_done(pg_temp.v('c'), pg_temp.v('match3'), tests.t0() + interval '1 day');
select private.sign_off(pg_temp.v('customer'), pg_temp.v('job2'), tests.t0() + interval '1 day 7 hours');

select is((select status::text from public.jobs where id = pg_temp.v('job2')), 'completed', 'the customer signs off');
select is((select count(*)::integer from public.notification_outbox
           where template = 'signoff_reminder' and data ->> 'job_id' = pg_temp.v('job2')::text
             and cancelled_at is null and sent_at is null),
  0, 'reminders not yet sent are cancelled');

select * from finish();
rollback;
