-- Message and review notifications, and the trade's public profile.

begin;
select plan(17);

create temp table v (k text primary key, id uuid);
grant select on v to anon, authenticated;
create function pg_temp.v(p_key text) returns uuid language sql as $$ select id from v where k = p_key $$;

insert into v values ('customer', tests.customer('Cathy Smith'));
insert into v values ('trade', tests.trade('Reliable Plumbing'));
insert into v values ('job', tests.post(pg_temp.v('customer'), 'plumber', p_now => now()));
insert into v select 'match', private.accept_offer(pg_temp.v('trade'),
  tests.offer_id(pg_temp.v('job'), pg_temp.v('trade')), now());
delete from public.notification_outbox;

-- ---------------------------------------------------------------------------
-- Messages
-- ---------------------------------------------------------------------------

select tests.as_user(pg_temp.v('trade'));
insert into public.messages (match_id, body) values (pg_temp.v('match'), 'Hi Cathy, I can come Thursday');
insert into public.messages (match_id, body) values (pg_temp.v('match'), 'Morning or afternoon?');
reset role;

select is(
  (select count(*)::integer from public.notification_outbox where user_id = pg_temp.v('customer') and template = 'new_message'),
  1, 'the customer gets one text for a burst of messages'
);
select is(
  (select data ->> 'preview' from public.notification_outbox where user_id = pg_temp.v('customer') and template = 'new_message'),
  'Hi Cathy, I can come Thursday', 'with the first message as a preview'
);
select is(
  (select channel::text from public.notification_outbox where user_id = pg_temp.v('customer') and template = 'new_message'),
  'sms', 'by text'
);

select tests.as_user(pg_temp.v('customer'));
insert into public.messages (match_id, body) values (pg_temp.v('match'), 'Morning please');
insert into public.messages (match_id, body) values (pg_temp.v('match'), 'After 9');
select lives_ok(
  format($$update public.messages set read_at = now() where match_id = %L and sender_id <> auth.uid()$$, pg_temp.v('match')),
  'the customer marks the trade''s messages read'
);
reset role;

select is(
  (select count(*)::integer from public.notification_outbox where user_id = pg_temp.v('trade') and template = 'new_message'),
  2, 'the trade gets a push for every message'
);
select is(
  (select data ->> 'sender_name' from public.notification_outbox where user_id = pg_temp.v('trade') and template = 'new_message' limit 1),
  'Cathy Smith', 'saying who it''s from'
);
select is(
  (select count(*)::integer from public.messages where read_at is not null),
  2, 'only the messages sent to the customer were marked read'
);

select tests.as_user(pg_temp.v('customer'));
select throws_ok(
  format($$update public.messages set body = 'changed' where match_id = %L$$, pg_temp.v('match')),
  '42501', null, 'nobody can edit a message'
);
reset role;

-- ---------------------------------------------------------------------------
-- Done, signed off, rated both ways: the review goes public
-- ---------------------------------------------------------------------------

select private.mark_done(pg_temp.v('trade'), pg_temp.v('match'), now());
select private.sign_off(pg_temp.v('customer'), pg_temp.v('job'), now());
select private.leave_review(pg_temp.v('customer'), pg_temp.v('match'), 5::smallint, 4::smallint, 5::smallint, 4::smallint,
  'Turned up on time and tidied up', now());

select is(
  (select count(*)::integer from public.notification_outbox where template = 'review_released'),
  0, 'no notification while the review is still blind'
);
select is((public.trade_profile(pg_temp.v('trade')) -> 'rating' ->> 'count')::integer, 0,
  'a blind review isn''t on the profile');

select private.rate_customer(pg_temp.v('trade'), pg_temp.v('match'), 5::smallint, '{paid_promptly}', '', now());

select is(
  (select data ->> 'overall' from public.notification_outbox where user_id = pg_temp.v('trade') and template = 'review_released'),
  '4.50', 'once both have rated, the trade hears about their review'
);

-- ---------------------------------------------------------------------------
-- The public profile
-- ---------------------------------------------------------------------------

set local role anon;
select is((public.trade_profile(pg_temp.v('trade')) ->> 'business_name'), 'Reliable Plumbing', 'anyone can see a trade''s profile');
select is((public.trade_profile(pg_temp.v('trade')) -> 'rating' ->> 'overall'), '4.5', 'with their average rating');
select is((public.trade_profile(pg_temp.v('trade')) -> 'reviews' -> 0 ->> 'first_name'), 'Cathy',
  'reviews show the customer''s first name only');
select is((public.trade_profile(pg_temp.v('trade')) ->> 'jobs_completed')::integer, 1, 'and jobs completed');
select is((public.trade_profile(pg_temp.v('trade')) ->> 'insured_until'), '2099-01-01', 'and insurance');
reset role;

insert into v values ('applicant', tests.trade('Not Yet Approved', p_approve => false));
select is(public.trade_profile(pg_temp.v('applicant')), null, 'trades that aren''t approved have no profile');

select * from finish();
rollback;
