-- Founders' tools: reports become alerts, resolving reports, hiding reviews.
-- Run as the real signed-in users.

begin;
select plan(22);

create temp table v (k text primary key, id uuid);
grant select on v to anon, authenticated;
create function pg_temp.v(p_key text) returns uuid language sql as $$ select id from v where k = p_key $$;

insert into v values
  ('admin', tests.admin()),
  ('customer', tests.customer('Rita Reporter')),
  ('trade', tests.trade('Moderated Roofing', p_categories => '{roofer}'));
insert into v values ('match', tests.completed_match(pg_temp.v('customer'), pg_temp.v('trade'), 'roofer', now() - interval '2 days'));
insert into v values ('job', (select job_id from public.job_matches where id = pg_temp.v('match')));

-- ---------------------------------------------------------------------------
-- A report is filed
-- ---------------------------------------------------------------------------

select tests.as_user(pg_temp.v('customer'));
insert into public.reports (job_id, about_user_id, reason, details)
  values (pg_temp.v('job'), pg_temp.v('trade'), 'They didn’t turn up', 'Waited in all day.');
reset role;
insert into v values ('report', (select id from public.reports where reporter_id = pg_temp.v('customer')));

select is((select count(*)::integer from public.admin_alerts
           where kind = 'report_filed' and details->>'report_id' = pg_temp.v('report')::text and resolved_at is null),
  1, 'a new report becomes an admin alert');
select is((select count(*)::integer from public.notification_outbox
           where user_id = pg_temp.v('admin') and template = 'admin_alert' and data->>'kind' = 'report_filed'),
  1, '...so the founders are emailed');
select is((select data->'details'->>'reason' from public.notification_outbox
           where user_id = pg_temp.v('admin') and template = 'admin_alert' and data->>'kind' = 'report_filed'),
  'They didn’t turn up', 'the email gets the reason');

-- ---------------------------------------------------------------------------
-- Resolving it
-- ---------------------------------------------------------------------------

select tests.as_user(pg_temp.v('customer'));
select throws_ok(format($$select public.resolve_report(%L, 'dismissed', 'no')$$, pg_temp.v('report')), 'ADMINS_ONLY',
  'only admins resolve reports');
select throws_ok(format($$update public.reports set status = 'dismissed' where id = %L$$, pg_temp.v('report')), '42501', null,
  'nobody can change a report directly');
reset role;

select tests.as_user(pg_temp.v('admin'));
select throws_ok(format($$update public.reports set status = 'dismissed' where id = %L$$, pg_temp.v('report')), '42501', null,
  '...not even an admin, so it''s always logged');
select throws_ok(format($$select public.resolve_report(%L, 'resolved', '  ')$$, pg_temp.v('report')), 'REASON_REQUIRED',
  'closing a report needs a note');
select lives_ok(format($$select public.resolve_report(%L, 'resolved', 'Spoke to both. Trade apologised.')$$, pg_temp.v('report')),
  'an admin resolves it with a note');
reset role;

select is((select status from public.reports where id = pg_temp.v('report')), 'resolved'::public.report_status, 'the report is resolved');
select is((select resolution_note from public.reports where id = pg_temp.v('report')), 'Spoke to both. Trade apologised.',
  'with the note');
select isnt((select resolved_at from public.admin_alerts where details->>'report_id' = pg_temp.v('report')::text), null,
  'and its alert is cleared');
select is((select count(*)::integer from public.admin_audit_log where action = 'resolved_report' and target_id = pg_temp.v('report')::text),
  1, 'and it''s in the audit log');

select tests.as_user(pg_temp.v('admin'));
select throws_ok(format($$select public.resolve_report(%L, 'dismissed', 'again')$$, pg_temp.v('report')), 'REPORT_NOT_FOUND',
  'a closed report can''t be closed again');
select lives_ok(format($$select public.resolve_report(%L, 'open')$$, pg_temp.v('report')), 'it can be reopened');
reset role;
select is((select resolution_note from public.reports where id = pg_temp.v('report')), null, 'reopening clears the note');
select is((select resolved_at from public.admin_alerts where details->>'report_id' = pg_temp.v('report')::text), null,
  'and brings the alert back');

-- ---------------------------------------------------------------------------
-- Hiding a review
-- ---------------------------------------------------------------------------

select private.leave_review(pg_temp.v('customer'), pg_temp.v('match'), 1::smallint, 1::smallint, 1::smallint, 1::smallint,
  'Call me on 07700 900999 and I''ll tell you what I really think', now());
update public.reviews set released_at = now() where match_id = pg_temp.v('match');
insert into v values ('review', (select id from public.reviews where match_id = pg_temp.v('match')));

select tests.as_user(pg_temp.v('admin'));
select throws_ok(format($$update public.reviews set hidden_at = now() where id = %L$$, pg_temp.v('review')), '42501', null,
  'reviews aren''t hidden directly');
select throws_ok(format($$select public.set_review_hidden(%L, true)$$, pg_temp.v('review')), 'REASON_REQUIRED',
  'hiding a review needs a reason');
select lives_ok(format($$select public.set_review_hidden(%L, true, 'Contains personal details')$$, pg_temp.v('review')),
  'an admin hides it with a reason');
reset role;

select is((public.trade_profile(pg_temp.v('trade'))->'reviews')::text, '[]', 'it''s gone from the trade''s public profile');

select tests.as_user(pg_temp.v('trade'));
select is((select count(*)::integer from public.reviews where id = pg_temp.v('review')), 0, 'and from the trade''s own view');
reset role;

select tests.as_user(pg_temp.v('admin'));
select lives_ok(format($$select public.set_review_hidden(%L, false)$$, pg_temp.v('review')), 'it can be shown again');
reset role;

select * from finish();
rollback;
