-- Register your interest: who can see and change the list, the table's checks, and deleting
-- sign-ups after 12 months.

begin;
select plan(12);

create temp table v (k text primary key, id uuid);
grant select on v to anon, authenticated;
create function pg_temp.v(p_key text) returns uuid language sql as $$ select id from v where k = p_key $$;

insert into v values
  ('admin', tests.admin()),
  ('customer', tests.customer('Nosy Customer')),
  ('trade', tests.trade('Nosy Plumbing'));

insert into public.interest_signups (email, kind, category_id, town_id, signed_up_at) values
  ('new.trade@example.com', 'trade', tests.category('plumber'), (select id from public.towns where slug = 'runcorn'), now()),
  ('new.customer@example.com', 'customer', null, null, now()),
  ('old.customer@example.com', 'customer', null, null, now() - interval '12 months' - interval '1 day');

-- Checks
select throws_ok($$insert into public.interest_signups (email, kind) values ('Shouty@Example.com', 'customer')$$,
  '23514', null, 'emails are stored in lower case');
select throws_ok($$insert into public.interest_signups (email, kind) values ('new.customer@example.com', 'trade')$$,
  '23505', null, 'one row per email');
select throws_ok(format($$insert into public.interest_signups (email, kind, category_id)
  values ('c@example.com', 'customer', %s)$$, tests.category('roofer')),
  '23514', null, 'only trades have a trade');

select throws_ok($ into public.interest_signups (email, kind, source) values ('s@example.com', 'customer', 'Bad Tag!')$,
  '23514', null, 'source tags are short lower-case words');

-- Who can see it
set local role anon;
select throws_ok($$select count(*) from public.interest_signups$$, '42501', null, 'the public can''t read it');
select throws_ok($$insert into public.interest_signups (email, kind) values ('x@example.com', 'customer')$$,
  '42501', null, 'or add to it directly');
reset role;

select tests.as_user(pg_temp.v('customer'));
select is((select count(*)::integer from public.interest_signups), 0, 'customers see nothing');
reset role;

select tests.as_user(pg_temp.v('trade'));
select is((select count(*)::integer from public.interest_signups), 0, 'nor do trades');
delete from public.interest_signups;
reset role;
select is((select count(*)::integer from public.interest_signups), 3, 'and they can''t delete any');

select tests.as_user(pg_temp.v('admin'));
select is((select count(*)::integer from public.interest_signups), 3, 'founders see everyone');
delete from public.interest_signups where email = 'new.trade@example.com';
reset role;
select is((select count(*)::integer from public.interest_signups where email = 'new.trade@example.com'), 0,
  'and can remove someone who asks');

-- 12 months
select private.run_cleanup();
select is((select array_agg(email) from public.interest_signups), array['new.customer@example.com'],
  'sign-ups over 12 months old are deleted each night');

select * from finish();
rollback;
