-- A founder who has only typed their password (aal1) is not an admin until they enter the
-- authenticator code (aal2).

begin;
select plan(5);

create temp table v (k text primary key, id uuid);
grant select on v to anon, authenticated;
create function pg_temp.v(p_key text) returns uuid language sql as $$ select id from v where k = p_key $$;

insert into v values ('admin', tests.admin()), ('customer', tests.customer('Cathy Customer'));

select tests.as_user(pg_temp.v('admin'), 'aal1');
select is(private.is_admin(), false, 'password only: not an admin');
select is((select count(*)::integer from public.profiles), 1, '...so only their own profile is visible');
select throws_ok($$select public.approve_trade(gen_random_uuid())$$, 'P0001', 'ADMINS_ONLY',
  '...and admin functions refuse them');

select tests.as_user(pg_temp.v('admin'), 'aal2');
select is(private.is_admin(), true, 'password and code: an admin');

select tests.as_user(pg_temp.v('customer'), 'aal2');
select is(private.is_admin(), false, 'a customer is never an admin');

select * from finish();
rollback;
