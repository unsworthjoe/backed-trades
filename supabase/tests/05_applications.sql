-- Trade applications: what's missing, submitting, and the founders'
-- approve/reject checks. Run as the real signed-in users.

begin;
select plan(19);

create temp table v (k text primary key, id uuid);
grant select on v to anon, authenticated;
create function pg_temp.v(p_key text) returns uuid language sql as $$ select id from v where k = p_key $$;

insert into v values
  ('admin', tests.admin()),
  ('new', tests.create_user('new.trade@example.com', null, 'New Trade')),
  ('applicant', tests.trade('Applicant Plumbing', p_insured => false, p_approve => false)),
  ('second', tests.trade('Second Plumbing', p_insured => false, p_approve => false));

-- ---------------------------------------------------------------------------
-- Filling in the application
-- ---------------------------------------------------------------------------

select tests.as_user(pg_temp.v('new'));
select is(public.my_application_problems(), array['business', 'phone', 'trades', 'areas', 'insurance', 'id'],
  'a brand new account has everything left to do');

select tests.as_user(pg_temp.v('applicant'));
select is(public.my_application_problems(), array['phone', 'insurance', 'id'],
  'business, trades and areas done: phone, insurance and ID left');
select throws_ok($$select public.submit_application()$$, 'APPLICATION_INCOMPLETE',
  'an incomplete application can''t be submitted');

update public.trades set contact_phone = '07700 900123' where id = auth.uid();
insert into public.trade_documents (trade_id, doc_type, storage_path, expires_on)
  values (auth.uid(), 'public_liability_insurance', auth.uid() || '/insurance.pdf', '2099-01-01');
insert into public.id_checks (trade_id, image_paths)
  values (auth.uid(), array[auth.uid() || '/id.jpg', auth.uid() || '/selfie.jpg']);

update public.trade_documents set status = 'approved' where trade_id = auth.uid();
select is((select status::text from public.trade_documents where trade_id = auth.uid()), 'pending',
  'trades can''t approve their own insurance');

select is(public.my_application_problems(), '{}'::text[], 'everything filled in: nothing left to do');
select lives_ok($$select public.submit_application()$$, 'the complete application is submitted');
select isnt((select submitted_at from public.trades where id = auth.uid()), null, 'it''s marked as submitted');
select throws_ok(format($$select public.approve_trade(%L)$$, pg_temp.v('applicant')), 'ADMINS_ONLY',
  'trades can''t approve themselves');

-- ---------------------------------------------------------------------------
-- The founders' review
-- ---------------------------------------------------------------------------

select tests.as_user(pg_temp.v('admin'));
select is((select count(*)::integer from public.admin_alerts
           where kind = 'application_submitted' and user_id = pg_temp.v('applicant') and resolved_at is null),
  1, 'the founders are alerted to the new application');

select throws_ok(format($$select public.approve_trade(%L)$$, pg_temp.v('applicant')), 'ID_NOT_PASSED',
  'can''t approve before the ID check has passed');
update public.id_checks set result = 'passed', checked_by = auth.uid(), checked_at = now()
  where trade_id = pg_temp.v('applicant');
select throws_ok(format($$select public.approve_trade(%L)$$, pg_temp.v('applicant')), 'INSURANCE_NOT_APPROVED',
  'can''t approve before the insurance is approved');
update public.trade_documents set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
  where trade_id = pg_temp.v('applicant');

select lives_ok(format($$select public.approve_trade(%L)$$, pg_temp.v('applicant')), 'the founder approves');
select is((select status::text from public.trades where id = pg_temp.v('applicant')), 'approved', 'the trade is approved');
select is(tests.queue_order('runcorn', 'plumber'), array[pg_temp.v('applicant')], '...and joins their queue');
select is((select count(*)::integer from public.admin_alerts
           where kind = 'application_submitted' and user_id = pg_temp.v('applicant') and resolved_at is null),
  0, 'the alert is cleared');

-- ---------------------------------------------------------------------------
-- Rejecting and resubmitting
-- ---------------------------------------------------------------------------

reset role;
update public.trades set contact_phone = '07700 900456' where id = pg_temp.v('second');
insert into public.trade_documents (trade_id, doc_type, storage_path, expires_on)
  values (pg_temp.v('second'), 'public_liability_insurance', pg_temp.v('second') || '/insurance.pdf', '2099-01-01');
insert into public.id_checks (trade_id, image_paths)
  values (pg_temp.v('second'), array['a.jpg', 'b.jpg']);
select tests.as_user(pg_temp.v('second'));
select public.submit_application();

select tests.as_user(pg_temp.v('admin'));
select throws_ok(format($$select public.reject_trade(%L, '  ')$$, pg_temp.v('second')), 'REASON_REQUIRED',
  'a rejection needs a reason');
select public.reject_trade(pg_temp.v('second'), 'The insurance certificate is for a different business.');
select is((select submitted_at from public.trades where id = pg_temp.v('second')), null,
  'a rejected application leaves the founders'' queue');

select tests.as_user(pg_temp.v('second'));
select is((select rejection_reason from public.trades where id = auth.uid()),
  'The insurance certificate is for a different business.', 'the trade sees why');
select public.submit_application();
select is((select status::text from public.trades where id = auth.uid()), 'applied', 'they can fix it and resubmit');

reset role;
select * from finish();
rollback;
