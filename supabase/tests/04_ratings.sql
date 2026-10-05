-- Reviews and customer ratings: blind release, the 14-day fallback, the
-- "New customer" label, and the low-rating flag.

begin;
select plan(11);

create temp table v (k text primary key, id uuid);
grant select on v to anon, authenticated;
create function pg_temp.v(p_key text) returns uuid language sql as $$ select id from v where k = p_key $$;

insert into v values
  ('customer', tests.customer()),
  ('trade', tests.trade('Handy Andy', '{widnes}', '{handyman}'));
insert into v values ('match1', tests.completed_match(pg_temp.v('customer'), pg_temp.v('trade'), 'handyman'));

-- ---------------------------------------------------------------------------
-- Blind until both sides rate
-- ---------------------------------------------------------------------------

select private.leave_review(pg_temp.v('customer'), pg_temp.v('match1'),
  5::smallint, 5::smallint, 5::smallint, 5::smallint, 'Brilliant', tests.t0() + interval '2 days');

select tests.as_user(pg_temp.v('trade'));
select is((select count(*)::integer from public.reviews), 0, 'the trade can''t see the review yet');
reset role;
select set_config('role', 'anon', true);
select is((select count(*)::integer from public.reviews), 0, '...nor can the public');
reset role;

select private.rate_customer(pg_temp.v('trade'), pg_temp.v('match1'), 4::smallint, '{clear_brief}', '',
  tests.t0() + interval '3 days');

select set_config('role', 'anon', true);
select is((select count(*)::integer from public.reviews), 1, 'once both have rated, the review is public');
reset role;
select tests.as_user(pg_temp.v('customer'));
select is((select count(*)::integer from public.customer_ratings), 0, 'customers never see ratings of themselves');
reset role;

-- ---------------------------------------------------------------------------
-- Released after 14 days if only one side rates
-- ---------------------------------------------------------------------------

insert into v values ('match2', tests.completed_match(pg_temp.v('customer'), pg_temp.v('trade'), 'handyman'));
select private.leave_review(pg_temp.v('customer'), pg_temp.v('match2'),
  3::smallint, 3::smallint, 3::smallint, 3::smallint, '', tests.t0() + interval '2 days');

-- completed_match signs off at t0 + 1 day 1 hour.
select private.release_due_ratings(tests.t0() + interval '1 day 1 hour' + interval '13 days 23 hours');
select is((select released_at from public.reviews where match_id = pg_temp.v('match2')), null,
  'still blind just before 14 days');
select private.release_due_ratings(tests.t0() + interval '1 day 1 hour' + interval '14 days');
select isnt((select released_at from public.reviews where match_id = pg_temp.v('match2')), null,
  'released after 14 days even if the trade never rates');

-- ---------------------------------------------------------------------------
-- "New customer", then an average after 3 ratings; flag after 5 under 3
-- ---------------------------------------------------------------------------

create function pg_temp.rate(p_stars smallint) returns void language plpgsql as $$
declare
  v_match uuid := tests.completed_match(pg_temp.v('customer'), pg_temp.v('trade'), 'handyman');
begin
  perform private.rate_customer(pg_temp.v('trade'), v_match, p_stars, '{}', '', tests.t0() + interval '2 days');
  perform private.leave_review(pg_temp.v('customer'), v_match, 4::smallint, 4::smallint, 4::smallint, 4::smallint, '',
    tests.t0() + interval '2 days');
end;
$$;

-- Ratings so far: 4 stars (match1). Add one more.
select pg_temp.rate(1::smallint);
insert into v values ('next_job', tests.post(pg_temp.v('customer'), 'handyman', 'WA8 1AA'));
select tests.as_user(pg_temp.v('trade'));
select is((select is_new_customer from public.job_customer_rating(pg_temp.v('next_job'))), true,
  '2 ratings: still "New customer"');
reset role;

select pg_temp.rate(1::smallint);
select tests.as_user(pg_temp.v('trade'));
select is((select average_stars from public.job_customer_rating(pg_temp.v('next_job'))), 2.0,
  '3 ratings: the average is shown on offers');
reset role;

select pg_temp.rate(1::smallint);
select is((select count(*)::integer from public.admin_alerts where kind = 'low_customer_rating'), 0,
  '4 ratings averaging under 3: no flag yet');
select pg_temp.rate(1::smallint);
select is((select count(*)::integer from public.admin_alerts
           where kind = 'low_customer_rating' and user_id = pg_temp.v('customer')), 1,
  '5 ratings averaging under 3: the founders are alerted');
select pg_temp.rate(1::smallint);
select is((select count(*)::integer from public.admin_alerts where kind = 'low_customer_rating'), 1,
  'only one open alert per customer');

select * from finish();
rollback;
