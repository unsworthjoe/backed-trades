-- The queue engine: working hours, offers, accepting, declining, misses,
-- caps, larger projects, call-outs and neighbouring towns. Each block uses
-- its own category so they don't affect each other.

begin;
select plan(48);

create temp table v (k text primary key, id uuid);
create function pg_temp.v(p_key text) returns uuid language sql as $$ select id from v where k = p_key $$;

-- ---------------------------------------------------------------------------
-- The 7am-8pm clock
-- ---------------------------------------------------------------------------

select is(private.working_minutes_add('2026-10-06 10:00 Europe/London', 120),
  '2026-10-06 12:00 Europe/London'::timestamptz, 'a 10am offer expires at 12pm');
select is(private.working_minutes_add('2026-10-06 19:30 Europe/London', 120),
  '2026-10-07 08:30 Europe/London'::timestamptz, 'a 7:30pm offer expires at 8:30am the next day');
select is(private.working_minutes_add('2026-10-06 22:00 Europe/London', 120),
  '2026-10-07 09:00 Europe/London'::timestamptz, 'a 10pm offer expires at 9am the next day');
select is(private.working_minutes_add('2026-10-24 19:30 Europe/London', 120),
  '2026-10-25 08:30 Europe/London'::timestamptz, 'the clock follows the change from BST to GMT');

-- ---------------------------------------------------------------------------
-- Founding order, front 3, first to accept wins (roofer, Runcorn)
-- ---------------------------------------------------------------------------

insert into v values
  ('customer', tests.customer()),
  ('r1', tests.trade('Roofer One', p_categories => '{roofer}')),
  ('r2', tests.trade('Roofer Two', p_categories => '{roofer}')),
  ('r3', tests.trade('Roofer Three', p_categories => '{roofer}')),
  ('r4', tests.trade('Roofer Four', p_categories => '{roofer}'));

select is(tests.queue_order('runcorn', 'roofer'),
  array[pg_temp.v('r1'), pg_temp.v('r2'), pg_temp.v('r3'), pg_temp.v('r4')],
  'founding order is approval order');

insert into v values ('roof_job', tests.post(pg_temp.v('customer'), 'roofer'));

select is(tests.offered(pg_temp.v('roof_job')),
  array[pg_temp.v('r1'), pg_temp.v('r2'), pg_temp.v('r3')], 'the front 3 are offered the job');
select is((select expires_at from public.job_offers where job_id = pg_temp.v('roof_job') limit 1),
  '2026-10-06 12:00 Europe/London'::timestamptz, 'offers get the 2-hour working window');
select is((select count(*)::integer from public.notification_outbox
           where template = 'offer_reminder' and data ->> 'job_id' = pg_temp.v('roof_job')::text
             and scheduled_for = '2026-10-06 11:00 Europe/London'),
  3, 'a reminder is queued for each trade at 1 hour');

insert into v values ('r1_offer', tests.offer_id(pg_temp.v('roof_job'), pg_temp.v('r1')));
insert into v values ('roof_match',
  private.accept_offer(pg_temp.v('r2'), tests.offer_id(pg_temp.v('roof_job'), pg_temp.v('r2')), tests.t0()));

select isnt(pg_temp.v('roof_match'), null, 'the second in the queue can accept');
select throws_ok(
  format('select private.accept_offer(%L, %L, tests.t0())',
    pg_temp.v('r1'), pg_temp.v('r1_offer')),
  'JOB_TAKEN', 'a second accept loses: one winner per job');
select is((select status::text from public.jobs where id = pg_temp.v('roof_job')), 'matched', 'the job is matched');
select is((select array_agg(status::text order by status::text) from public.job_offers
           where job_id = pg_temp.v('roof_job')),
  array['accepted', 'withdrawn', 'withdrawn'], 'the other offers are withdrawn');
select is((select count(*)::integer from public.notification_outbox
           where template = 'offer_reminder' and data ->> 'job_id' = pg_temp.v('roof_job')::text
             and cancelled_at is null),
  0, 'pending reminders are cancelled');
select is(tests.queue_order('runcorn', 'roofer'),
  array[pg_temp.v('r1'), pg_temp.v('r3'), pg_temp.v('r4'), pg_temp.v('r2')],
  'the winner moves to the back');
select is((select count(*)::integer from public.notification_outbox
           where user_id = pg_temp.v('customer') and template = 'job_matched' and channel = 'sms'),
  1, 'the customer is texted');

-- ---------------------------------------------------------------------------
-- Declines (tiler, Runcorn)
-- ---------------------------------------------------------------------------

insert into v values
  ('t1', tests.trade('Tiler One', p_categories => '{tiler}')),
  ('t2', tests.trade('Tiler Two', p_categories => '{tiler}')),
  ('t3', tests.trade('Tiler Three', p_categories => '{tiler}')),
  ('t4', tests.trade('Tiler Four', p_categories => '{tiler}'));

insert into v values ('tile_job1', tests.post(pg_temp.v('customer'), 'tiler'));

select throws_ok(
  format('select private.decline_offer(%L, %L, null, null, tests.t0())',
    pg_temp.v('t1'), tests.offer_id(pg_temp.v('tile_job1'), pg_temp.v('t1'))),
  'DECLINE_REASON_REQUIRED', 'a decline needs a reason');

select private.decline_offer(pg_temp.v('t1'), tests.offer_id(pg_temp.v('tile_job1'), pg_temp.v('t1')),
  'too_busy', null, tests.t0());
select is(tests.offered(pg_temp.v('tile_job1')),
  array[pg_temp.v('t2'), pg_temp.v('t3'), pg_temp.v('t4')], 'a decline brings in the next in line');

do $$
declare
  v_job uuid;
begin
  for i in 2..4 loop
    v_job := tests.post(pg_temp.v('customer'), 'tiler');
    perform private.decline_offer(pg_temp.v('t1'), tests.offer_id(v_job, pg_temp.v('t1')), 'too_busy', null, tests.t0());
  end loop;
end;
$$;

select is(tests.queue_order('runcorn', 'tiler'),
  array[pg_temp.v('t1'), pg_temp.v('t2'), pg_temp.v('t3'), pg_temp.v('t4')],
  '4 declines in a row: still at the front');

insert into v values ('tile_job5', tests.post(pg_temp.v('customer'), 'tiler'));
select private.decline_offer(pg_temp.v('t1'), tests.offer_id(pg_temp.v('tile_job5'), pg_temp.v('t1')),
  'too_busy', null, tests.t0());

select is(tests.queue_order('runcorn', 'tiler'),
  array[pg_temp.v('t2'), pg_temp.v('t3'), pg_temp.v('t4'), pg_temp.v('t1')],
  '5 declines in a row: back of the queue');
select is((select consecutive_declines from public.queue_members qm
           where trade_id = pg_temp.v('t1')), 0, 'and the count starts again');

-- ---------------------------------------------------------------------------
-- "Not my kind of work" tunes the trade out of that queue (painter, Runcorn)
-- ---------------------------------------------------------------------------

insert into v values
  ('p1', tests.trade('Painter One', p_categories => '{painter-decorator}')),
  ('p2', tests.trade('Painter Two', p_categories => '{painter-decorator}'));

do $$
declare
  v_job uuid;
begin
  for i in 1..3 loop
    v_job := tests.post(pg_temp.v('customer'), 'painter-decorator');
    perform private.decline_offer(pg_temp.v('p1'), tests.offer_id(v_job, pg_temp.v('p1')),
      'not_my_kind_of_work', null, tests.t0());
  end loop;
end;
$$;

select isnt((select tuned_out_at from public.queue_members where trade_id = pg_temp.v('p1')), null,
  '3 "not my kind of work" declines tune the trade out of the queue');
insert into v values ('paint_job', tests.post(pg_temp.v('customer'), 'painter-decorator'));
select is(tests.offered(pg_temp.v('paint_job')), array[pg_temp.v('p2')], 'tuned-out trades are skipped');
select is(tests.queue_order('runcorn', 'painter-decorator'),
  array[pg_temp.v('p1'), pg_temp.v('p2')], '...but keep their place');

-- ---------------------------------------------------------------------------
-- No reply (fencing, Runcorn)
-- ---------------------------------------------------------------------------

insert into v values ('f1', tests.trade('Fencer One', p_categories => '{fencing}'));
insert into v values
  ('fence_job1', tests.post(pg_temp.v('customer'), 'fencing')),
  ('fence_job2', tests.post(pg_temp.v('customer'), 'fencing', p_now => tests.t0() + interval '1 hour'));

create function pg_temp.offer_status(p_job text, p_trade text) returns text language sql
  as $$ select status::text from public.job_offers where job_id = pg_temp.v(p_job) and trade_id = pg_temp.v(p_trade) $$;

select private.expire_offers(tests.t0() + interval '1 hour 59 minutes');
select is(pg_temp.offer_status('fence_job1', 'f1'), 'pending', 'nothing expires early');
select private.expire_offers(tests.t0() + interval '2 hours');
select is(pg_temp.offer_status('fence_job1', 'f1'), 'expired', 'the offer expires after 2 working hours');
select is((select consecutive_misses from public.trades where id = pg_temp.v('f1')), 1, 'no reply counts as a miss');
select is((select consecutive_declines from public.queue_members where trade_id = pg_temp.v('f1')), 1,
  '...and as a decline');
select private.expire_offers(tests.t0() + interval '3 hours');
select is(pg_temp.offer_status('fence_job2', 'f1'), 'expired', 'the second offer expires');
select is((select paused_at from public.trades where id = pg_temp.v('f1')), null, '2 misses: not paused');

insert into v values ('fence_job3', tests.post(pg_temp.v('customer'), 'fencing'));
select private.expire_offers(tests.t0() + interval '3 hours');
select is((select paused_reason::text from public.trades where id = pg_temp.v('f1')), 'missed_offers',
  '3 misses in a row: paused');
select is((select count(*)::integer from public.admin_alerts
           where kind = 'trade_paused' and user_id = pg_temp.v('f1')), 1, 'the founders are alerted');
insert into v values ('fence_job4', tests.post(pg_temp.v('customer'), 'fencing'));
select is(tests.offered(pg_temp.v('fence_job4')), '{}'::uuid[], 'paused trades get no offers');

-- ---------------------------------------------------------------------------
-- Cap of 15, then the waiting list (locksmith, Warrington)
-- ---------------------------------------------------------------------------

do $$
begin
  for i in 1..16 loop
    insert into v values ('l' || i, tests.trade('Locksmith ' || i, '{warrington}', '{locksmith}'));
  end loop;
end;
$$;

select is(cardinality(tests.queue_order('warrington', 'locksmith')), 15, 'the queue holds 15');
select is((select status::text from public.queue_members where trade_id = pg_temp.v('l16')), 'waiting',
  'the 16th joins the waiting list');

delete from public.trade_towns where trade_id = pg_temp.v('l3');
select private.sync_trade_queues(pg_temp.v('l3'));
select is((select status::text from public.queue_members where trade_id = pg_temp.v('l16')), 'active',
  'when someone leaves, the waiting list moves up');
select is((tests.queue_order('warrington', 'locksmith'))[15], pg_temp.v('l16'), '...to the back of the queue');

-- ---------------------------------------------------------------------------
-- Larger projects (builder, Runcorn)
-- ---------------------------------------------------------------------------

insert into v values
  ('solo', tests.trade('Solo Builder', p_categories => '{builder}')),
  ('team1', tests.trade('Team Builder 1', p_categories => '{builder}', p_large => true)),
  ('team2', tests.trade('Team Builder 2', p_categories => '{builder}', p_large => true)),
  ('team3', tests.trade('Team Builder 3', p_categories => '{builder}', p_large => true));
insert into v values ('large_job', tests.post(pg_temp.v('customer'), 'builder', p_size => 'large'));

select is(tests.offered(pg_temp.v('large_job')),
  array[pg_temp.v('team1'), pg_temp.v('team2'), pg_temp.v('team3')],
  'a larger project skips the solo trade');
select is((tests.queue_order('runcorn', 'builder'))[1], pg_temp.v('solo'), '...who keeps their place');

-- ---------------------------------------------------------------------------
-- Several towns (electrician): winning in Widnes doesn't move you in Runcorn
-- ---------------------------------------------------------------------------

insert into v values
  ('e1', tests.trade('Sparky One', '{runcorn,widnes}', '{electrician}')),
  ('e2', tests.trade('Sparky Two', '{runcorn,widnes}', '{electrician}'));
insert into v values ('widnes_job', tests.post(pg_temp.v('customer'), 'electrician', 'WA8 0AA'));
select private.accept_offer(pg_temp.v('e1'), tests.offer_id(pg_temp.v('widnes_job'), pg_temp.v('e1')), tests.t0());

select is(tests.queue_order('widnes', 'electrician'), array[pg_temp.v('e2'), pg_temp.v('e1')],
  'winning in Widnes: back of the Widnes queue');
select is(tests.queue_order('runcorn', 'electrician'), array[pg_temp.v('e1'), pg_temp.v('e2')],
  '...but still at the front in Runcorn');

-- ---------------------------------------------------------------------------
-- Call-outs (gas and heating)
-- ---------------------------------------------------------------------------

insert into v values
  ('g0', tests.trade('Gas No Callouts', p_categories => '{gas-heating}')),
  ('g1', tests.trade('Gas One', p_categories => '{gas-heating}', p_callouts => true)),
  ('g2', tests.trade('Gas Two', p_categories => '{gas-heating}', p_callouts => true)),
  ('g3', tests.trade('Gas Three', p_categories => '{gas-heating}', p_callouts => true)),
  ('g4', tests.trade('Gas Four', p_categories => '{gas-heating}', p_callouts => true)),
  ('gw', tests.trade('Gas Widnes', '{widnes}', '{gas-heating}', p_callouts => true));
insert into v values ('callout', tests.post(pg_temp.v('customer'), 'gas-heating', p_callout => true));

select is(tests.offered(pg_temp.v('callout')),
  array[pg_temp.v('g1'), pg_temp.v('g2'), pg_temp.v('g3'), pg_temp.v('gw')],
  'wave 1: front 3 who take call-outs, plus neighbouring towns at the same time');
select is((select max(expires_at) from public.job_offers where job_id = pg_temp.v('callout')),
  tests.t0() + interval '30 minutes', 'call-out offers last 30 minutes');

select private.refresh_open_jobs(tests.t0() + interval '9 minutes');
select is(cardinality(tests.offered(pg_temp.v('callout'))), 4, 'no new wave before 10 minutes');
select private.refresh_open_jobs(tests.t0() + interval '10 minutes');
select is(tests.offered(pg_temp.v('callout')),
  array[pg_temp.v('g1'), pg_temp.v('g2'), pg_temp.v('g3'), pg_temp.v('g4'), pg_temp.v('gw')],
  'wave 2 after 10 minutes adds the next in line');

-- ---------------------------------------------------------------------------
-- Neighbouring towns, then the 24-hour alert
-- ---------------------------------------------------------------------------

insert into v values
  ('d1', tests.trade('Damp Runcorn', p_categories => '{damp-waterproofing}')),
  ('d2', tests.trade('Damp Widnes', '{widnes}', '{damp-waterproofing}')),
  ('d3', tests.trade('Damp Warrington', '{warrington}', '{damp-waterproofing}'));
insert into v values ('damp_job', tests.post(pg_temp.v('customer'), 'damp-waterproofing'));

select is(cardinality(tests.offered(pg_temp.v('damp_job'))), 3,
  'when the home queue runs short, neighbouring towns are offered too');

insert into v values ('nobody_job', tests.post(pg_temp.v('customer'), 'driveways-paving'));
select private.alert_unmatched_jobs(tests.t0() + interval '23 hours 59 minutes');
select is((select unmatched_alerted_at from public.jobs where id = pg_temp.v('nobody_job')), null,
  'no alert before 24 hours');
select private.alert_unmatched_jobs(tests.t0() + interval '24 hours');
select is((select count(*)::integer from public.admin_alerts
           where kind = 'job_unmatched' and job_id = pg_temp.v('nobody_job')),
  1, 'the founders are alerted at 24 hours');
select is((select count(*)::integer from public.notification_outbox
           where user_id = pg_temp.v('customer') and template = 'job_still_listed'
             and data ->> 'job_id' = pg_temp.v('nobody_job')::text),
  1, 'the customer is told the job stays listed');

select * from finish();
rollback;
