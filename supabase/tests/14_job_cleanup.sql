-- Deleting jobs 2 years after they end: what's due, what goes with the job,
-- what stays (reviews, ratings, the trade's completed count), old reports and
-- notifications, and waking the Edge Function.

begin;
select plan(23);

create temp table v (k text primary key, id uuid);
grant select on v to anon, authenticated;
create function pg_temp.v(p_key text) returns uuid language sql as $$ select id from v where k = p_key $$;

insert into v values
  ('customer', tests.customer('Olive Oldjob')),
  ('trade', tests.trade('Lasting Plumbing'));

-- Completed 25 months ago, with a review, a customer rating, messages, a photo
-- and a report.
insert into v values ('old_match', tests.completed_match(pg_temp.v('customer'), pg_temp.v('trade'), 'plumber',
  now() - interval '25 months'));
insert into v select 'old', job_id from public.job_matches where id = pg_temp.v('old_match');
select private.leave_review(pg_temp.v('customer'), pg_temp.v('old_match'), 5::smallint, 5::smallint, 4::smallint,
  4::smallint, 'Great job', now() - interval '25 months' + interval '2 days');
select private.rate_customer(pg_temp.v('trade'), pg_temp.v('old_match'), 5::smallint, '{}', '',
  now() - interval '25 months' + interval '2 days');
insert into public.messages (match_id, sender_id, body)
  values (pg_temp.v('old_match'), pg_temp.v('trade'), 'See you Thursday');
insert into public.job_photos (job_id, storage_path) values (pg_temp.v('old'), pg_temp.v('old') || '/photo-1.jpg');
insert into public.reports (reporter_id, job_id, reason) values (pg_temp.v('customer'), pg_temp.v('old'), 'Late');

-- Completed 23 months ago: not due yet.
insert into v values ('recent_match', tests.completed_match(pg_temp.v('customer'), pg_temp.v('trade'), 'plumber',
  now() - interval '23 months'));
insert into v select 'recent', job_id from public.job_matches where id = pg_temp.v('recent_match');

-- Cancelled 25 months ago, before anyone accepted.
insert into v values ('cancelled', tests.post(pg_temp.v('customer'), 'plumber', p_now => now() - interval '25 months'));
select private.cancel_job(pg_temp.v('customer'), pg_temp.v('cancelled'), now() - interval '25 months' + interval '1 hour');

create temp table profile_before as select public.trade_profile(pg_temp.v('trade')) as p;

-- ---------------------------------------------------------------------------
-- What's due
-- ---------------------------------------------------------------------------

create temp table due as select id from public.ended_jobs_due_for_cleanup(1000)
  where id in (pg_temp.v('old'), pg_temp.v('recent'), pg_temp.v('cancelled'));
select ok(pg_temp.v('old') in (select id from due), 'a job completed over 2 years ago is due');
select ok(pg_temp.v('cancelled') in (select id from due), 'so is one cancelled over 2 years ago');
select ok(pg_temp.v('recent') not in (select id from due), 'one completed 23 months ago isn''t');

select tests.as_user(pg_temp.v('customer'));
select throws_ok($$select * from public.ended_jobs_due_for_cleanup()$$, '42501', null, 'secret key only');
select throws_ok(format($$select public.delete_ended_jobs(array[%L]::uuid[])$$, pg_temp.v('old')), '42501', null,
  '...for deleting too');
reset role;

select is(public.delete_ended_jobs(array[pg_temp.v('recent')]), 0, 'a job that isn''t due can''t be deleted');

-- ---------------------------------------------------------------------------
-- Deleting
-- ---------------------------------------------------------------------------

select is(public.delete_ended_jobs(array[pg_temp.v('old'), pg_temp.v('cancelled')]), 2, 'both due jobs are deleted');
select is((select count(*)::integer from public.jobs where id in (pg_temp.v('old'), pg_temp.v('cancelled'))), 0,
  'they''re gone');
select is((select count(*)::integer from public.messages where match_id = pg_temp.v('old_match')), 0,
  'with their messages');
select is((select count(*)::integer from public.job_photos where job_id = pg_temp.v('old')), 0, 'photos');
select is((select count(*)::integer from public.job_addresses where job_id = pg_temp.v('old')), 0, 'address');
select is((select count(*)::integer from public.reports where reason = 'Late'), 0, 'and reports about them');

select is((select match_id from public.reviews where comment = 'Great job'), null,
  'the review stays, no longer tied to the job');
select is((select count(*)::integer from public.customer_ratings
           where trade_id = pg_temp.v('trade') and customer_id = pg_temp.v('customer')), 1,
  'so does the trade''s rating of the customer');

select is((public.trade_profile(pg_temp.v('trade')) ->> 'jobs_completed'),
  (select p ->> 'jobs_completed' from profile_before), 'the trade''s jobs completed count doesn''t drop');
select is((public.trade_profile(pg_temp.v('trade')) -> 'rating' ->> 'count'),
  (select p -> 'rating' ->> 'count' from profile_before), 'nor does their review count');
select ok(exists (select 1 from jsonb_array_elements(public.trade_profile(pg_temp.v('trade')) -> 'reviews') r
                  where r ->> 'comment' = 'Great job' and r ->> 'job_title' is null),
  'the review is still listed on their profile, without the job title');
select is(public.delete_ended_jobs(array[pg_temp.v('old')]), 0, 'deleting again does nothing');

-- ---------------------------------------------------------------------------
-- Old reports and notifications
-- ---------------------------------------------------------------------------

insert into public.reports (reporter_id, about_user_id, reason, status, resolved_at, created_at) values
  (pg_temp.v('customer'), pg_temp.v('trade'), 'old resolved', 'resolved', now() - interval '25 months', now() - interval '26 months'),
  (pg_temp.v('customer'), pg_temp.v('trade'), 'old open', 'open', null, now() - interval '26 months'),
  (pg_temp.v('customer'), pg_temp.v('trade'), 'recent resolved', 'resolved', now() - interval '1 month', now() - interval '2 months');
select private.delete_old_reports();
select is((select array_agg(reason order by reason) from public.reports where reason like '%resolved' or reason like '%open'),
  array['old open', 'recent resolved'], 'reports dealt with over 2 years ago go; open and recent ones stay');

insert into public.notification_outbox (user_id, channel, template, sent_at, created_at, scheduled_for) values
  (pg_temp.v('trade'), 'push', 'old_sent', now() - interval '31 days', now() - interval '31 days', now() - interval '31 days'),
  (pg_temp.v('trade'), 'push', 'old_waiting', null, now() - interval '31 days', now() + interval '1 day'),
  (pg_temp.v('trade'), 'push', 'recent_sent', now() - interval '1 day', now() - interval '1 day', now() - interval '1 day');
select private.prune_outbox();
select is((select array_agg(template order by template) from public.notification_outbox where template in ('old_sent', 'old_waiting', 'recent_sent')),
  array['old_waiting', 'recent_sent'], 'sent notifications go after 30 days; unsent ones stay');

-- ---------------------------------------------------------------------------
-- Waking the Edge Function
-- ---------------------------------------------------------------------------

delete from vault.secrets where name in ('notification_sender_url', 'notification_sender_secret');
select vault.create_secret('https://example.supabase.co/functions/v1/send-notifications', 'notification_sender_url');
select vault.create_secret('test-secret', 'notification_sender_secret');
create temp table before as select coalesce(max(id), 0) as id from net.http_request_queue;

-- Push any other due jobs (from earlier test data) out of the way.
update public.jobs set completed_at = now(), cancelled_at = now() where status in ('completed', 'cancelled');
select private.wake_job_cleanup();
select is((select count(*)::integer from net.http_request_queue where id > (select id from before)), 0,
  'with nothing due, it isn''t woken');

update public.jobs set completed_at = now() - interval '25 months' where id = pg_temp.v('recent');
select private.wake_job_cleanup();
select is((select url from net.http_request_queue where id > (select id from before)),
  'https://example.supabase.co/functions/v1/cleanup-ended-jobs', 'with a job due, it wakes cleanup-ended-jobs');

select ok(exists (select 1 from cron.job where jobname = 'backed-cleanup'), 'it runs each night');

select * from finish();
rollback;
