-- Test helpers, shared by every test file (they run in name order). These
-- live in a `tests` schema in the local database only.

begin;
create extension if not exists pgtap with schema extensions;
create schema if not exists tests;
grant usage on schema tests to anon, authenticated;

-- A fixed "now" for timing tests: Tuesday 6 Oct 2026, 10am UK time.
create or replace function tests.t0()
returns timestamptz
language sql
immutable
as $$ select '2026-10-06 10:00 Europe/London'::timestamptz $$;

create or replace function tests.create_user(p_email text, p_phone text, p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email, phone, raw_user_meta_data, created_at, updated_at)
    values (v_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      p_email, p_phone, jsonb_build_object('full_name', p_name), now(), now());
  return v_id;
end;
$$;

create or replace function tests.customer(p_name text default 'Test Customer')
returns uuid
language sql
as $$
  select tests.create_user(null, '447700' || lpad((floor(random() * 1000000))::integer::text, 6, '0'), p_name)
$$;

create or replace function tests.admin()
returns uuid
language plpgsql
as $$
declare
  v_email text := 'admin.' || substr(gen_random_uuid()::text, 1, 8) || '@example.com';
begin
  insert into public.admin_invites (email) values (v_email);
  return tests.create_user(v_email, null, 'Test Admin');
end;
$$;

-- A trade business. By default: approved, subscribed, insured, plumber in
-- Runcorn. Approval time sets the founding order.
create or replace function tests.trade(
  p_name text,
  p_towns text[] default '{runcorn}',
  p_categories text[] default '{plumber}',
  p_large boolean default false,
  p_callouts boolean default false,
  p_subscribed boolean default true,
  p_insured boolean default true,
  p_approve boolean default true
)
returns uuid
language plpgsql
as $$
declare
  v_id uuid;
begin
  v_id := tests.create_user(
    lower(replace(p_name, ' ', '.')) || '.' || substr(gen_random_uuid()::text, 1, 8) || '@example.com',
    '447800' || lpad((floor(random() * 1000000))::integer::text, 6, '0'),
    p_name);
  insert into public.trades (id, business_name, business_type, can_take_large_jobs, accepts_callouts)
    values (v_id, p_name, 'sole_trader', p_large, p_callouts);
  insert into public.trade_towns (trade_id, town_id)
    select v_id, id from public.towns where slug = any (p_towns);
  insert into public.trade_category_links (trade_id, category_id)
    select v_id, id from public.trade_categories where slug = any (p_categories);
  if p_insured then
    insert into public.trade_documents (trade_id, doc_type, storage_path, expires_on, status)
      values (v_id, 'public_liability_insurance', v_id || '/insurance.pdf', '2099-01-01', 'approved');
  end if;
  if p_subscribed then
    insert into public.subscriptions (trade_id, stripe_customer_id, plan, is_founding, price_pence, status)
      values (v_id, 'cus_test', 'monthly', true, 1499, 'active');
  end if;
  if p_approve then
    perform private.approve_trade(v_id, null, clock_timestamp());
  end if;
  return v_id;
end;
$$;

create or replace function tests.category(p_slug text)
returns smallint
language sql
as $$ select id from public.trade_categories where slug = p_slug $$;

create or replace function tests.post(
  p_customer uuid,
  p_category text,
  p_postcode text default 'WA7 1AA',
  p_size public.job_size default 'small',
  p_callout boolean default false,
  p_now timestamptz default tests.t0()
)
returns uuid
language sql
as $$
  select private.post_job(p_customer, tests.category(p_category), p_postcode, '1 Test Street',
    'Test job', 'Testing', p_size, p_callout, 'flexible', 'not_sure', p_now)
$$;

-- Trades with a live offer for a job, front of the queue first.
create or replace function tests.offered(p_job uuid)
returns uuid[]
language sql
as $$
  select coalesce(array_agg(o.trade_id order by qm.position), '{}')
  from public.job_offers o
  left join public.queue_members qm on qm.id = o.queue_member_id
  where o.job_id = p_job and o.status = 'pending'
$$;

create or replace function tests.offer_id(p_job uuid, p_trade uuid)
returns uuid
language sql
as $$
  select id from public.job_offers
  where job_id = p_job and trade_id = p_trade and status <> 'withdrawn'
$$;

-- Active members of a queue, front first.
create or replace function tests.queue_order(p_town text, p_category text)
returns uuid[]
language sql
as $$
  select coalesce(array_agg(qm.trade_id order by qm.position), '{}')
  from public.queue_members qm
  join public.queues q on q.id = qm.queue_id
  join public.towns t on t.id = q.town_id
  where t.slug = p_town and q.category_id = tests.category(p_category) and qm.status = 'active'
$$;

-- Runs a job from posting to signed off with a given trade (who must be
-- at the front of the queue). Returns the match id.
create or replace function tests.completed_match(
  p_customer uuid,
  p_trade uuid,
  p_category text,
  p_now timestamptz default tests.t0()
)
returns uuid
language plpgsql
as $$
declare
  v_job uuid := tests.post(p_customer, p_category, 'WA7 1AA', 'small', false, p_now);
  v_match uuid;
begin
  v_match := private.accept_offer(p_trade, tests.offer_id(v_job, p_trade), p_now);
  perform private.mark_done(p_trade, v_match, p_now + interval '1 day');
  perform private.sign_off(p_customer, v_job, p_now + interval '1 day 1 hour');
  return v_match;
end;
$$;

-- Acts as a signed-in user for the rest of the transaction (`reset role`
-- goes back to the test runner). Signed in with the second step done (aal2), as founders must be.
create or replace function tests.as_user(p_user uuid, p_aal text default 'aal2')
returns void
language sql
as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated', 'aal', p_aal)::text, true);
  select set_config('role', 'authenticated', true);
$$;

grant execute on all functions in schema tests to anon, authenticated;

select plan(1);
select pass('test helpers installed');
select * from finish();
commit;
