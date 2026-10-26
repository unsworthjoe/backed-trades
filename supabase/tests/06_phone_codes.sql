-- The text-code gate: only UK mobiles, limits per number and per device,
-- each request sends one code, and only the Edge Functions can use it.

begin;
select plan(10);

select is(public.allow_sms_code('441928123456', '1.2.3.4'), 'UK_MOBILES_ONLY', 'landlines are refused');
select is(public.allow_sms_code('14155550100', '1.2.3.4'), 'UK_MOBILES_ONLY', 'non-UK numbers are refused');

select is(public.claim_sms_code('447700900001'), false, 'no request: no text');
select is(public.allow_sms_code('447700900001', '1.2.3.4'), 'ok', 'a UK mobile is allowed');
select is(public.claim_sms_code('447700900001'), true, 'the request allows one text');
select is(public.claim_sms_code('447700900001'), false, '...and only one');

do $$
begin
  for i in 1..4 loop
    perform public.allow_sms_code('447700900001', '1.2.3.4');
  end loop;
end;
$$;
select is(public.allow_sms_code('447700900001', '5.6.7.8'), 'TOO_MANY_FOR_NUMBER', '5 an hour per number');

do $$
begin
  for i in 1..20 loop
    perform public.allow_sms_code('4477009001' || lpad(i::text, 2, '0'), '9.9.9.9');
  end loop;
end;
$$;
select is(public.allow_sms_code('447700900999', '9.9.9.9'), 'TOO_MANY_FROM_DEVICE', '20 an hour per device');

insert into private.sms_code_requests (phone)
  select '4477009' || lpad(i::text, 5, '0') from generate_series(1, 300) i;
select is(public.allow_sms_code('447700900998', '8.8.8.8'), 'TEXT_LIMIT_REACHED', '300 a day for the whole site');

set local role authenticated;
select throws_ok($$select public.allow_sms_code('447700900002', null)$$, '42501', null,
  'apps can''t call it directly, only the Edge Functions can');
reset role;

select * from finish();
rollback;
