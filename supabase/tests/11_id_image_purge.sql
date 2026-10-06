-- Deleting ID photos 30 days after the founders' decision: when the clock
-- starts, what's due, marking as deleted, and waking the Edge Function.

begin;
select plan(18);

create temp table v (k text primary key, id uuid);
grant select on v to anon, authenticated;
create function pg_temp.v(p_key text) returns uuid language sql as $$ select id from v where k = p_key $$;

insert into v values
  ('admin', tests.admin()),
  ('approved', tests.trade('Approved Plumbing', p_approve => false)),
  ('rejected', tests.trade('Rejected Plumbing', p_approve => false)),
  ('waiting', tests.trade('Waiting Plumbing', p_approve => false));

insert into public.id_checks (trade_id, result, image_paths) values
  (pg_temp.v('approved'), 'passed', array[pg_temp.v('approved') || '/id.jpg', pg_temp.v('approved') || '/selfie.jpg']),
  (pg_temp.v('rejected'), 'pending', array[pg_temp.v('rejected') || '/id.jpg', pg_temp.v('rejected') || '/selfie.jpg']),
  (pg_temp.v('waiting'), 'pending', array[pg_temp.v('waiting') || '/id.jpg', pg_temp.v('waiting') || '/selfie.jpg']);
update public.trades set contact_phone = '07700900123', submitted_at = now()
  where id in (pg_temp.v('rejected'), pg_temp.v('waiting'));

create function pg_temp.purge_after(p_trade uuid) returns timestamptz language sql as $$
  select images_purge_after from public.id_checks where trade_id = p_trade
$$;

-- ---------------------------------------------------------------------------
-- When the clock starts
-- ---------------------------------------------------------------------------

select private.approve_trade(pg_temp.v('approved'), pg_temp.v('admin'), now());
select is(pg_temp.purge_after(pg_temp.v('approved')), now() + interval '30 days', 'approving keeps the photos for 30 days');

select tests.as_user(pg_temp.v('admin'));
select public.reject_trade(pg_temp.v('rejected'), 'Your insurance has expired.');
reset role;
select is(pg_temp.purge_after(pg_temp.v('rejected')), now() + interval '30 days', 'so does rejecting');
select is(pg_temp.purge_after(pg_temp.v('waiting')), null, 'applications waiting for a decision keep their photos');

select is((select count(*)::integer from public.id_images_due_for_purge()
           where id in (select id from public.id_checks where trade_id in (pg_temp.v('approved'), pg_temp.v('rejected')))),
  0, 'nothing is due before the 30 days are up');

-- ---------------------------------------------------------------------------
-- Due, and deleted
-- ---------------------------------------------------------------------------

update public.id_checks set images_purge_after = now() - interval '1 minute'
  where trade_id in (pg_temp.v('approved'), pg_temp.v('rejected'));

create temp table due as select * from public.id_images_due_for_purge()
  where id in (select id from public.id_checks where trade_id in (pg_temp.v('approved'), pg_temp.v('rejected')));
select is((select count(*)::integer from due), 2, 'both are due after 30 days');
select ok((select bool_and(cardinality(image_paths) = 2) from due), 'with their file paths');

select tests.as_user(pg_temp.v('admin'));
select throws_ok($$select * from public.id_images_due_for_purge()$$, '42501', null, 'admins can''t call it: secret key only');
select throws_ok(format($$select public.mark_id_images_purged(array[%L]::uuid[])$$, pg_temp.v('approved')), '42501', null,
  '...nor mark photos as deleted');
reset role;

select is(public.mark_id_images_purged(array(select id from due)), 2, 'marking them as deleted');
select is((select image_paths from public.id_checks where trade_id = pg_temp.v('approved')), '{}'::text[],
  'the file paths are cleared');
select isnt((select images_purged_at from public.id_checks where trade_id = pg_temp.v('approved')), null,
  'and the deletion is recorded');
select is((select result from public.id_checks where trade_id = pg_temp.v('approved')), 'passed'::public.id_check_result,
  'the result is kept');
select is(public.mark_id_images_purged(array(select id from public.id_checks where trade_id = pg_temp.v('waiting'))), 0,
  'photos that aren''t due can''t be marked as deleted');

-- ---------------------------------------------------------------------------
-- Coming back after the photos are gone
-- ---------------------------------------------------------------------------

select ok('id' = any (private.application_problems(pg_temp.v('rejected'))),
  'a rejected trade whose ID wasn''t checked uploads new photos');
update public.id_checks set result = 'passed' where trade_id = pg_temp.v('rejected');
select ok(not 'id' = any (private.application_problems(pg_temp.v('rejected'))),
  'a passed ID check still counts once its photos are deleted');

-- ---------------------------------------------------------------------------
-- Waking the Edge Function
-- ---------------------------------------------------------------------------

delete from vault.secrets where name in ('notification_sender_url', 'notification_sender_secret');
select vault.create_secret('https://example.supabase.co/functions/v1/send-notifications', 'notification_sender_url');
select vault.create_secret('test-secret', 'notification_sender_secret');

update public.id_checks set images_purged_at = now() where images_purged_at is null and images_purge_after <= now();
create temp table before as select coalesce(max(id), 0) as id from net.http_request_queue;
select private.wake_id_image_purge();
select is((select count(*)::integer from net.http_request_queue where id > (select id from before)), 0,
  'with nothing due, it isn''t woken');

update public.id_checks set images_purged_at = null, images_purge_after = now() - interval '1 minute'
  where trade_id = pg_temp.v('waiting');
select private.wake_id_image_purge();
select is((select url from net.http_request_queue where id > (select id from before)),
  'https://example.supabase.co/functions/v1/purge-id-images', 'with photos due, it wakes purge-id-images');

select ok(exists (select 1 from cron.job where jobname = 'backed-id-image-purge'), 'it runs each night');

select * from finish();
rollback;
