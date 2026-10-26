-- Free-text fields have a ceiling, so nobody can store megabytes of text.

begin;
select plan(3);

create temp table v (k text primary key, id uuid);
insert into v values ('customer', tests.customer('Lena Limits'));

select lives_ok($$update public.profiles set full_name = repeat('a', 100) where id = (select id from v where k = 'customer')$$,
  'a name at the limit is saved');
select throws_ok($$update public.profiles set full_name = repeat('a', 101) where id = (select id from v where k = 'customer')$$,
  '23514', null, 'a longer name is refused');
select throws_ok($$update public.profiles set full_name = repeat('a', 5000) where id = (select id from v where k = 'customer')$$,
  '23514', null, '...and so is a huge one');

select * from finish();
rollback;
