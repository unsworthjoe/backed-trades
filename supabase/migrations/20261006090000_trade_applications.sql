-- Trade applications: the trade fills in their details at their own pace,
-- then submits. Founders review submitted applications, oldest first.
--
-- ID checks are manual for now: the trade uploads a photo of their ID and a
-- selfie, and a founder compares them.

-- Until phone numbers are verified by text code (added with customer
-- sign-in), the number the trade types in is used as their contact number.
alter table public.trades
  add column contact_phone text,
  -- Set when the trade submits; cleared if the application is rejected, so
  -- it leaves the founders' queue until it's resubmitted.
  add column submitted_at timestamptz;

grant insert (contact_phone), update (contact_phone) on public.trades to authenticated;

alter type public.admin_alert_kind add value 'application_submitted';

-- What's still missing from an application, as short codes the app turns
-- into words. Empty when it's ready to submit.
create function private.application_problems(p_trade_id uuid)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select array_remove(array[
    case when not exists (select 1 from public.trades where id = p_trade_id)
      then 'business' end,
    case when not exists (select 1 from public.trades
                          where id = p_trade_id and length(trim(coalesce(contact_phone, ''))) >= 10)
      then 'phone' end,
    case when not exists (select 1 from public.trade_category_links where trade_id = p_trade_id)
      then 'trades' end,
    case when not exists (select 1 from public.trade_towns where trade_id = p_trade_id)
      then 'areas' end,
    case when not exists (select 1 from public.trade_documents
                          where trade_id = p_trade_id
                            and doc_type = 'public_liability_insurance'
                            and status <> 'rejected'
                            and expires_on >= (now() at time zone 'Europe/London')::date)
      then 'insurance' end,
    case when not exists (select 1 from public.id_checks
                          where trade_id = p_trade_id
                            and result <> 'failed'
                            and cardinality(image_paths) >= 2)
      then 'id' end
  ], null)
$$;

create function public.my_application_problems()
returns text[]
language sql
stable
security definer
set search_path = ''
as $$ select private.application_problems(auth.uid()) $$;

create function public.submit_application()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_problems text[] := private.application_problems(auth.uid());
begin
  if cardinality(v_problems) > 0 then
    raise exception 'APPLICATION_INCOMPLETE' using detail = array_to_string(v_problems, ',');
  end if;

  update public.trades
    set submitted_at = now(), status = 'applied', rejection_reason = null
    where id = auth.uid() and status in ('applied', 'rejected');
  if not found then
    raise exception 'ALREADY_APPROVED';
  end if;

  perform private.alert_admins('application_submitted', null, auth.uid(), '{}');
end;
$$;

-- Approval now needs a submitted application, a passed ID check and
-- approved, in-date insurance.
create or replace function public.approve_trade(p_trade_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'ADMINS_ONLY';
  end if;
  if not exists (select 1 from public.trades where id = p_trade_id and submitted_at is not null) then
    raise exception 'NOT_SUBMITTED';
  end if;
  if not exists (select 1 from public.id_checks where trade_id = p_trade_id and result = 'passed') then
    raise exception 'ID_NOT_PASSED';
  end if;
  if not private.is_insured(p_trade_id, (now() at time zone 'Europe/London')::date) then
    raise exception 'INSURANCE_NOT_APPROVED';
  end if;

  perform private.approve_trade(p_trade_id, auth.uid(), now());
  update public.admin_alerts set resolved_at = now(), resolved_by = auth.uid()
    where kind = 'application_submitted' and user_id = p_trade_id and resolved_at is null;
  perform private.audit('approve_trade', 'trades', p_trade_id::text);
end;
$$;

create or replace function public.reject_trade(p_trade_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'ADMINS_ONLY';
  end if;
  if length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'REASON_REQUIRED';
  end if;
  update public.trades set status = 'rejected', rejection_reason = p_reason, submitted_at = null
    where id = p_trade_id and status = 'applied' and submitted_at is not null;
  if not found then
    raise exception 'TRADE_NOT_REJECTABLE';
  end if;
  update public.admin_alerts set resolved_at = now(), resolved_by = auth.uid()
    where kind = 'application_submitted' and user_id = p_trade_id and resolved_at is null;
  perform private.notify(p_trade_id, 'trade_rejected', jsonb_build_object('reason', p_reason), now());
  perform private.audit('reject_trade', 'trades', p_trade_id::text, jsonb_build_object('reason', p_reason));
end;
$$;

-- Matched customers get the trade's verified phone, or the number they
-- gave on their application until phone checks exist.
create or replace function public.get_match_contact(p_match_id uuid)
returns table (
  job_id uuid,
  trade_business_name text,
  trade_phone text,
  customer_name text,
  customer_phone text,
  postcode text,
  address_line text
)
language sql
stable
security definer
set search_path = ''
as $$
  select j.id, t.business_name, coalesce(tp.phone, t.contact_phone), cp.full_name, cp.phone,
    a.postcode, a.address_line
  from public.job_matches m
  join public.jobs j on j.id = m.job_id
  join public.trades t on t.id = m.trade_id
  join public.profiles tp on tp.id = m.trade_id
  join public.profiles cp on cp.id = j.customer_id
  left join public.job_addresses a on a.job_id = j.id
  where m.id = p_match_id
    and m.ended_at is null
    and (auth.uid() in (m.trade_id, j.customer_id) or private.is_admin())
$$;

revoke execute on function private.application_problems(uuid) from public, anon, authenticated;
revoke execute on function public.my_application_problems(), public.submit_application() from public, anon;
grant execute on function public.my_application_problems(), public.submit_application() to authenticated;
