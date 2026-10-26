-- A ceiling on sign-in texts for the whole site: if someone gets past the per-number and per-device
-- limits (many numbers, many devices), the bill still stops at 300 codes in any 24 hours.
-- The same function as before, with one more check; people see "try again later" past the ceiling.

create or replace function public.allow_sms_code(p_phone text, p_ip text)
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
  if (select count(*) from private.sms_code_requests
      where created_at > now() - interval '24 hours') >= 300 then
    return 'TEXT_LIMIT_REACHED';
  end if;

  insert into private.sms_code_requests (phone, ip) values (p_phone, p_ip);
  return 'ok';
end;
$$;
