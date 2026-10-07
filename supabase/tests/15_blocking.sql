-- Blocking: a trade blocking a customer mid-job, a customer blocking a trade
-- mid-job and after it's finished, what each side sees, messages, offers on
-- other jobs, and the founders' alert.

begin;
select plan(22);

create temp table v (k text primary key, id uuid);
grant select on v to anon, authenticated;
create function pg_temp.v(p_key text) returns uuid language sql as $$ select id from v where k = p_key $$;

create function pg_temp.job_of(p_match uuid) returns uuid language sql as $$
  select job_id from public.job_matches where id = p_match
$$;

-- ---------------------------------------------------------------------------
-- A trade blocks a customer while the job is in progress
-- ---------------------------------------------------------------------------

insert into v values
  ('cust_a', tests.customer('Rude Customer')),
  ('roofer', tests.trade('Blocking Roofing', p_categories => '{roofer}')),
  ('roofer2', tests.trade('Other Roofing', p_categories => '{roofer}'));
insert into v values ('job_a', tests.post(pg_temp.v('cust_a'), 'roofer', p_now => now()));
insert into v select 'match_a', private.accept_offer(pg_temp.v('roofer'),
  tests.offer_id(pg_temp.v('job_a'), pg_temp.v('roofer')), now());
delete from public.notification_outbox;

select tests.as_user(pg_temp.v('roofer'));
select lives_ok(format($$select public.block_from_match(%L)$$, pg_temp.v('match_a')), 'a trade can block their customer');
select is((select count(*)::integer from public.blocks where blocked_id = pg_temp.v('cust_a')), 1,
  'and sees their block');
reset role;

select is((select end_reason::text from public.job_matches where id = pg_temp.v('match_a')), 'trade_blocked_customer',
  'the job they were doing ends');
select is((select status::text from public.jobs where id = pg_temp.v('job_a')), 'offering', 'and goes back out');
select ok(pg_temp.v('roofer2') = any (tests.offered(pg_temp.v('job_a'))), 'to other trades');
select ok(not pg_temp.v('roofer') = any (tests.offered(pg_temp.v('job_a'))), 'not to the trade who blocked');
select is((select template from public.notification_outbox where user_id = pg_temp.v('cust_a')), 'trade_withdrew',
  'the customer is told their trade can''t do it, not that they were blocked');
select is((select user_id from public.admin_alerts where kind = 'user_blocked' and job_id = pg_temp.v('job_a')),
  pg_temp.v('cust_a'), 'the founders get an alert about the blocked customer');

select tests.as_user(pg_temp.v('cust_a'));
select is((select count(*)::integer from public.blocks), 0, 'the customer can''t see they were blocked');
select is(public.match_messaging_blocked(pg_temp.v('match_a')), true, '...but their old thread is closed');
reset role;

insert into v values ('job_a2', tests.post(pg_temp.v('cust_a'), 'roofer', p_now => now()));
select ok(not pg_temp.v('roofer') = any (tests.offered(pg_temp.v('job_a2'))),
  'the trade isn''t offered the customer''s next job');
select ok(pg_temp.v('roofer2') = any (tests.offered(pg_temp.v('job_a2'))), 'other trades are');

select tests.as_user(pg_temp.v('roofer'));
select public.block_from_match(pg_temp.v('match_a'));
reset role;
select is((select count(*)::integer from public.admin_alerts where kind = 'user_blocked' and job_id = pg_temp.v('job_a')), 1,
  'blocking twice does nothing more');

-- ---------------------------------------------------------------------------
-- A customer blocks a trade after the job is finished
-- ---------------------------------------------------------------------------

insert into v values
  ('cust_b', tests.customer('Unhappy Customer')),
  ('tiler', tests.trade('Pushy Tiling', p_categories => '{tiler}'));
insert into v values ('match_b', tests.completed_match(pg_temp.v('cust_b'), pg_temp.v('tiler'), 'tiler', now() - interval '2 days'));
delete from public.notification_outbox;

select tests.as_user(pg_temp.v('tiler'));
insert into public.messages (match_id, body) values (pg_temp.v('match_b'), 'Any chance of a review?');
reset role;
select tests.as_user(pg_temp.v('cust_b'));
select public.block_from_match(pg_temp.v('match_b'));
reset role;

select is((select ended_at from public.job_matches where id = pg_temp.v('match_b')), null,
  'a finished job stays finished');
select is((select count(*)::integer from public.notification_outbox where user_id = pg_temp.v('tiler')), 0,
  'and the trade isn''t told anything');
select tests.as_user(pg_temp.v('tiler'));
select throws_ok(format($$insert into public.messages (match_id, body) values (%L, 'Hello?')$$, pg_temp.v('match_b')),
  '42501', null, 'the trade can''t message the customer any more');
reset role;
select tests.as_user(pg_temp.v('cust_b'));
select throws_ok(format($$insert into public.messages (match_id, body) values (%L, 'Stop it')$$, pg_temp.v('match_b')),
  '42501', null, 'nor can the customer message them');
reset role;

-- ---------------------------------------------------------------------------
-- A customer blocks a trade mid-job, who has an offer on their other job
-- ---------------------------------------------------------------------------

insert into v values
  ('cust_c', tests.customer('Careful Customer')),
  ('locksmith', tests.trade('Dodgy Locks', p_categories => '{locksmith}')),
  ('locksmith2', tests.trade('Good Locks', p_categories => '{locksmith}'));
insert into v values ('job_c', tests.post(pg_temp.v('cust_c'), 'locksmith', p_now => now()));
insert into v select 'match_c', private.accept_offer(pg_temp.v('locksmith'),
  tests.offer_id(pg_temp.v('job_c'), pg_temp.v('locksmith')), now());
insert into v values ('job_c2', tests.post(pg_temp.v('cust_c'), 'locksmith', p_now => now()));
delete from public.notification_outbox;

select ok(pg_temp.v('locksmith') = any (tests.offered(pg_temp.v('job_c2'))), 'before: the trade has an offer on their other job');
select tests.as_user(pg_temp.v('cust_c'));
select public.block_from_match(pg_temp.v('match_c'));
reset role;

select is((select end_reason::text from public.job_matches where id = pg_temp.v('match_c')), 'customer_requested_another',
  'the trade sees it as the customer asking for a different trade');
select is((select template from public.notification_outbox where user_id = pg_temp.v('locksmith') and template = 'match_ended'),
  'match_ended', 'and is told so');
select ok(not pg_temp.v('locksmith') = any (tests.offered(pg_temp.v('job_c2'))), 'their offer on the other job is withdrawn');

-- ---------------------------------------------------------------------------
-- Only the two people on the job
-- ---------------------------------------------------------------------------

select tests.as_user(pg_temp.v('cust_a'));
select throws_ok(format($$select public.block_from_match(%L)$$, pg_temp.v('match_b')), 'MATCH_NOT_FOUND',
  'someone else can''t block from a job that isn''t theirs');
reset role;

select * from finish();
rollback;
