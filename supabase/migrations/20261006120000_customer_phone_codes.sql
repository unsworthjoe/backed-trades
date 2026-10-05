-- Customer sign-in by text code, protected against text-message fraud.
--
-- 1. The website calls the request-phone-code Edge Function with the phone
--    number and a Cloudflare Turnstile token. It checks the token, then
--    allow_sms_code() records the request (UK mobiles only, with limits per
--    number and per device).
-- 2. The website asks Supabase Auth for a code. Auth hands the text to our
--    send-sms hook, which only sends it if claim_sms_code() finds a recent
--    request for that number. Calling Auth directly, skipping step 1, gets
--    no text.
--
-- Only the Edge Functions (secret key) can call these.

create table private.sms_code_requests (
  id bigint generated always as identity primary key,
  -- International format without the "+", e.g. 447700900123.
  phone text not null check (phone ~ '^447\d{9}$'),
  ip text,
  created_at timestamptz not null default now(),
  used_at timestamptz
);

create index on private.sms_code_requests (phone, created_at);
create index on private.sms_code_requests (ip, created_at);

-- Returns 'ok', or why not: UK_MOBILES_ONLY, TOO_MANY_FOR_NUMBER,
-- TOO_MANY_FROM_DEVICE.
create function public.allow_sms_code(p_phone text, p_ip text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_phone is null or p_phone !~ '^447\d{9}$' then
    return 'UK_MOBILES_ONLY';
  end if;
  if (select count(*) from private.sms_code_requests
      where phone = p_phone and created_at > now() - interval '1 hour') >= 5 then
    return 'TOO_MANY_FOR_NUMBER';
  end if;
  if p_ip is not null and (select count(*) from private.sms_code_requests
      where ip = p_ip and created_at > now() - interval '1 hour') >= 20 then
    return 'TOO_MANY_FROM_DEVICE';
  end if;

  insert into private.sms_code_requests (phone, ip) values (p_phone, p_ip);
  return 'ok';
end;
$$;

-- Uses up the latest unused request for this number from the last 10
-- minutes. False means the code shouldn't be sent.
create function public.claim_sms_code(p_phone text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update private.sms_code_requests set used_at = now()
    where id = (
      select id from private.sms_code_requests
      where phone = p_phone and used_at is null and created_at > now() - interval '10 minutes'
      order by created_at desc
      limit 1
    );
  return found;
end;
$$;

revoke execute on function public.allow_sms_code(text, text), public.claim_sms_code(text)
  from public, anon, authenticated;
grant execute on function public.allow_sms_code(text, text), public.claim_sms_code(text) to service_role;
