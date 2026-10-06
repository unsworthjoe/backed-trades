-- The sender's side of the outbox: claiming, finishing, push tokens, and
-- founders' alert emails.

begin;
select plan(19);

create temp table v (k text primary key, id uuid);
grant select on v to anon, authenticated;
create function pg_temp.v(p_key text) returns uuid language sql as $$ select id from v where k = p_key $$;

-- Start from an empty outbox so the counts below are this test's own.
delete from public.notification_outbox;

insert into v values ('trade', tests.trade('Pushy Plumbing'));
insert into v values ('other', tests.trade('Other Plumbing'));
insert into v values ('admin', tests.admin());
delete from public.notification_outbox;

-- ---------------------------------------------------------------------------
-- Push tokens
-- ---------------------------------------------------------------------------

select tests.as_user(pg_temp.v('trade'));
select lives_ok($$select public.register_push_token('ExponentPushToken[aaa]', 'ios')$$, 'a trade registers their phone');
select lives_ok($$select public.register_push_token('ExponentPushToken[aaa]', 'ios')$$, '...again, without an error');
reset role;

select tests.as_user(pg_temp.v('other'));
select lives_ok($$select public.register_push_token('ExponentPushToken[aaa]', 'ios')$$, 'someone else signs in on the same phone');
reset role;
select is((select user_id from public.push_tokens where token = 'ExponentPushToken[aaa]'), pg_temp.v('other'),
  'the phone now belongs to them only');

select tests.as_user(pg_temp.v('trade'));
select public.unregister_push_token('ExponentPushToken[aaa]');
reset role;
select is((select count(*)::integer from public.push_tokens where token = 'ExponentPushToken[aaa]'), 1, 'you can''t remove someone else''s phone');

select tests.as_user(pg_temp.v('other'));
select public.unregister_push_token('ExponentPushToken[aaa]');
reset role;
select is((select count(*)::integer from public.push_tokens where token = 'ExponentPushToken[aaa]'), 0, 'signing out removes your phone');

-- ---------------------------------------------------------------------------
-- Claiming and finishing
-- ---------------------------------------------------------------------------

insert into public.push_tokens (user_id, token, platform) values (pg_temp.v('trade'), 'ExponentPushToken[bbb]', 'android');
select private.notify(pg_temp.v('trade'), 'new_offer', '{}', now());
select private.notify(pg_temp.v('trade'), 'new_callout', '{}', now(), true);
select private.notify(pg_temp.v('trade'), 'offer_reminder', '{}', now() + interval '1 hour');

create temp table claimed as select * from public.claim_notifications(10);
select is((select count(*)::integer from claimed), 2, 'only messages that are due are claimed');
select is((select template from claimed limit 1), 'new_callout', 'call-outs go first');
select is((select push_tokens from claimed limit 1), array['ExponentPushToken[bbb]'], 'with the trade''s phones');
select is((select count(*)::integer from public.claim_notifications(10)), 0, 'claimed messages aren''t claimed twice');

select public.finish_notification((select id from claimed where template = 'new_callout'), 'sent');
select isnt((select sent_at from public.notification_outbox where template = 'new_callout'), null, 'sent is recorded');

select public.finish_notification((select id from claimed where template = 'new_offer'), 'retry', 'Expo was down');
select ok((select scheduled_for > now() and claimed_at is null and failed_at is null
  from public.notification_outbox where template = 'new_offer'), 'a retry waits a little, then goes again');

update public.notification_outbox set attempts = 5 where template = 'new_offer';
select public.finish_notification((select id from claimed where template = 'new_offer'), 'retry', 'Expo was down');
select isnt((select failed_at from public.notification_outbox where template = 'new_offer'), null,
  'after 5 attempts it gives up');

update public.notification_outbox set claimed_at = now() - interval '10 minutes', scheduled_for = now()
  where template = 'offer_reminder';
select is((select template from public.claim_notifications(10)), 'offer_reminder',
  'a claim abandoned for 5 minutes is picked up again');

select public.forget_push_tokens(array['ExponentPushToken[bbb]']);
select is((select count(*)::integer from public.push_tokens where token = 'ExponentPushToken[bbb]'), 0, 'gone phones are forgotten');

-- ---------------------------------------------------------------------------
-- Founders' alerts
-- ---------------------------------------------------------------------------

select private.alert_admins('job_unmatched', null, null, '{}');
select is(
  (select channel::text || ' ' || template from public.notification_outbox where user_id = pg_temp.v('admin')),
  'email admin_alert', 'founders are emailed about alerts'
);

-- ---------------------------------------------------------------------------
-- Only the sender can claim
-- ---------------------------------------------------------------------------

select tests.as_user(pg_temp.v('trade'));
select throws_ok($$select * from public.claim_notifications(10)$$, '42501', null, 'apps can''t claim messages');
select throws_ok($$select public.finish_notification(1, 'sent')$$, '42501', null, '...or mark them sent');
reset role;

set local role anon;
select throws_ok($$select public.register_push_token('x', 'ios')$$, '42501', null, 'signed-out users can''t register phones');
reset role;

select * from finish();
rollback;
