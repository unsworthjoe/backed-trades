-- A trade sees their own place in each queue, and nothing about anyone else.

begin;
select plan(8);

create temp table v (k text primary key, id uuid);
grant select on v to anon, authenticated;
create function pg_temp.v(p_key text) returns uuid language sql as $$ select id from v where k = p_key $$;

insert into v values ('first', tests.trade('First Plumbing'));
insert into v values ('second', tests.trade('Second Plumbing', '{runcorn,widnes}'));
insert into v values ('third', tests.trade('Third Plumbing'));
insert into v values ('customer', tests.customer());
-- Third joined while there was room; move them to the waiting list by hand.
update public.queue_members set status = 'waiting' where trade_id = pg_temp.v('third');

insert into v values ('job', tests.post(pg_temp.v('customer'), 'plumber'));
select private.decline_offer(pg_temp.v('second'), tests.offer_id(pg_temp.v('job'), pg_temp.v('second')),
  'too_busy', null, tests.t0());

select tests.as_user(pg_temp.v('second'));

select is(
  (select array_agg(town_name || ':' || place || '/' || list_size order by town_name) from public.my_queue_places()),
  array['Runcorn:2/2', 'Widnes:1/1'],
  'second in Runcorn behind First, front of Widnes on their own'
);
select is(
  (select jobs_last_30_days from public.my_queue_places() where town_name = 'Runcorn'),
  1, 'counts recent jobs in the queue'
);
select is(
  (select jobs_last_30_days from public.my_queue_places() where town_name = 'Widnes'),
  0, '...per town'
);
select is((select count(*)::integer from public.my_queue_places()), 2, 'only their own queues');
select is(
  (select consecutive_declines from public.my_queue_places() where town_name = 'Runcorn'),
  1, 'shows declines in a row'
);
reset role;

select tests.as_user(pg_temp.v('third'));
select is(
  (select status::text || ' ' || place || '/' || list_size from public.my_queue_places()),
  'waiting 1/1', 'waiting list place'
);
reset role;

select tests.as_user(pg_temp.v('customer'));
select is((select count(*)::integer from public.my_queue_places()), 0, 'customers have no queues');
reset role;

set local role anon;
select throws_ok($$select * from public.my_queue_places()$$, '42501', null, 'signed-out users can''t call it');
reset role;

select * from finish();
rollback;
