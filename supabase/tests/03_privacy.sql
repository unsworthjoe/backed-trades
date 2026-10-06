-- Row level security: who can see and change what, tested as real signed-in
-- users through the same permissions the app uses.

begin;
select plan(26);

create temp table v (k text primary key, id uuid);
grant select on v to anon, authenticated;
create function pg_temp.v(p_key text) returns uuid language sql as $$ select id from v where k = p_key $$;

insert into v values
  ('customer', tests.customer('Cathy Customer')),
  ('other_customer', tests.customer('Oscar Other')),
  ('offered', tests.trade('Offered Plumber')),
  ('electrician', tests.trade('Some Electrician', p_categories => '{electrician}')),
  ('admin', tests.admin());
-- Posted now (not tests.t0()): the offer is accepted below through the real API, at now().
insert into v values ('job', tests.post(pg_temp.v('customer'), 'plumber', p_now => now()));
insert into v select 'offer', tests.offer_id(pg_temp.v('job'), pg_temp.v('offered'));
create temp table customer_phone as select phone from auth.users where id = pg_temp.v('customer');
grant select on customer_phone to authenticated;

-- ---------------------------------------------------------------------------
-- A trade with an offer, before accepting
-- ---------------------------------------------------------------------------

select tests.as_user(pg_temp.v('offered'));

select is((select district from public.jobs where id = pg_temp.v('job')), 'WA7', 'the offered trade sees the job and district');
select is((select count(*)::integer from public.job_addresses), 0, '...but not the full postcode or address');
select is((select count(*)::integer from public.profiles where id = pg_temp.v('customer')), 0,
  '...or the customer''s name and phone');
select is((select count(*)::integer from public.get_match_contact(
  (select id from public.job_matches limit 1))), 0, 'no contact details without a match');
select is((select is_new_customer from public.job_customer_rating(pg_temp.v('job'))), true,
  'a customer with no ratings shows as "New customer"');

-- No direct writes to the queue engine's tables.
select throws_ok($$update public.queue_members set position = 0$$, '42501', null, 'trades can''t move themselves in a queue');
select throws_ok(format($$update public.job_offers set status = 'accepted' where id = %L$$, pg_temp.v('offer')),
  '42501', null, 'trades can''t accept by editing the offer');
select throws_ok(format($$insert into public.job_matches (job_id, trade_id, offer_id, contact_due_at) values (%L, %L, %L, now())$$,
  pg_temp.v('job'), pg_temp.v('offered'), pg_temp.v('offer')), '42501', null, 'trades can''t create matches');
select throws_ok($$update public.subscriptions set status = 'active'$$, '42501', null, 'trades can''t edit subscriptions');
select throws_ok($$update public.trades set status = 'approved'$$, '42501', null, 'trades can''t approve themselves');
select throws_ok($$update public.trades set paused_at = null$$, '42501', null, 'trades can''t unpause by editing');
select throws_ok($$select private.accept_offer(auth.uid(), null, now())$$, '42501', null,
  'the engine''s private functions can''t be called through the API');

-- Accept through the real API.
select lives_ok(format($$select public.accept_offer(%L)$$, pg_temp.v('offer')), 'the trade accepts through the API');
select is((select postcode from public.get_match_contact((select id from public.job_matches where job_id = pg_temp.v('job')))),
  'WA71AA', 'once matched, the trade gets the postcode');
select is((select customer_phone from public.get_match_contact((select id from public.job_matches where job_id = pg_temp.v('job')))),
  (select phone from customer_phone), '...and the customer''s phone number');
select lives_ok(format($$insert into public.messages (match_id, body) values ((select id from public.job_matches where job_id = %L), 'On my way')$$,
  pg_temp.v('job')), 'the matched trade can message the customer');

-- ---------------------------------------------------------------------------
-- Other people
-- ---------------------------------------------------------------------------

select tests.as_user(pg_temp.v('electrician'));
select is((select count(*)::integer from public.jobs), 0, 'a trade without an offer sees no jobs');
select is((select count(*)::integer from public.messages), 0, '...and no messages');

select tests.as_user(pg_temp.v('other_customer'));
select is((select count(*)::integer from public.jobs), 0, 'customers can''t see other customers'' jobs');
select throws_ok(format($$select public.accept_offer(%L)$$, pg_temp.v('offer')), 'OFFER_NOT_FOUND',
  'customers can''t accept offers');

select tests.as_user(pg_temp.v('customer'));
select is((select count(*)::integer from public.job_offers), 0, 'customers never see offers (no competing trades)');
select is((select count(*)::integer from public.messages), 1, 'the customer sees the trade''s message');

-- ---------------------------------------------------------------------------
-- Vetting documents
-- ---------------------------------------------------------------------------

select tests.as_user(pg_temp.v('electrician'));
select is((select count(*)::integer from public.trade_documents), 1, 'trades see their own documents');
select tests.as_user(pg_temp.v('offered'));
select is((select count(*)::integer from public.trade_documents where trade_id = pg_temp.v('electrician')), 0,
  '...but not other trades'' documents');
select tests.as_user(pg_temp.v('admin'));
select cmp_ok((select count(*)::integer from public.trade_documents), '>=', 2, 'admins see every trade''s documents');

-- ---------------------------------------------------------------------------
-- Signed out
-- ---------------------------------------------------------------------------

reset role;
select set_config('role', 'anon', true);
select throws_ok($$select count(*) from public.jobs$$, '42501', null, 'signed-out visitors can''t read jobs');

reset role;
select * from finish();
rollback;
