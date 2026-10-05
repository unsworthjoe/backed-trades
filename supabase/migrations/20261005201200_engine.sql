-- Backed. database, step 13: the queue engine.
--
-- All of the fairness rules run here, on the server, so they can't be gamed
-- from a phone. The real work is in `private` functions that take the user
-- and the time as arguments (so tests can control both). The app calls the
-- thin `public` wrappers, which check who's calling.
--
-- Locking: anything that changes a job's offers locks the job row first, so
-- exactly one trade can win a job and nothing deadlocks.

-- ---------------------------------------------------------------------------
-- Small helpers
-- ---------------------------------------------------------------------------

create function private.settings()
returns public.app_settings
language sql
stable
security definer
set search_path = ''
as $$ select * from public.app_settings where id $$;

-- Queues a message. The channel follows the person: customers get texts,
-- trades get push notifications, admins get email.
create function private.notify(
  p_user uuid,
  p_template text,
  p_data jsonb,
  p_scheduled_for timestamptz,
  p_urgent boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notification_outbox (user_id, channel, template, data, scheduled_for, urgent)
  select p.id,
    case p.role
      when 'customer' then 'sms'::public.notification_channel
      when 'trade' then 'push'::public.notification_channel
      else 'email'::public.notification_channel
    end,
    p_template, p_data, p_scheduled_for, p_urgent
  from public.profiles p
  where p.id = p_user;
end;
$$;

-- Cancels unsent messages for a job, e.g. sign-off reminders once signed off.
create function private.cancel_notifications(p_template text, p_job_id uuid, p_user uuid default null)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.notification_outbox
    set cancelled_at = now()
    where template = p_template
      and data ->> 'job_id' = p_job_id::text
      and (p_user is null or user_id = p_user)
      and sent_at is null
      and cancelled_at is null
$$;

create function private.alert_admins(p_kind public.admin_alert_kind, p_job_id uuid, p_user_id uuid, p_details jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.admin_alerts (kind, job_id, user_id, details)
    values (p_kind, p_job_id, p_user_id, coalesce(p_details, '{}'))
$$;

create function private.audit(p_action text, p_table text, p_target_id text, p_details jsonb default '{}')
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.admin_audit_log (admin_id, action, target_table, target_id, details)
    values (auth.uid(), p_action, p_table, p_target_id, coalesce(p_details, '{}'))
$$;

create function private.has_active_subscription(p_trade_id uuid, p_at timestamptz)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.subscriptions
    where trade_id = p_trade_id
      and status in ('active', 'trialing')
      and (current_period_end is null or current_period_end > p_at)
  )
$$;

create function private.is_insured(p_trade_id uuid, p_on date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.trade_documents
    where trade_id = p_trade_id
      and doc_type = 'public_liability_insurance'
      and status = 'approved'
      and expires_on >= p_on
  )
$$;

create function private.queue_for(p_town_id smallint, p_category_id smallint)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$ select id from public.queues where town_id = p_town_id and category_id = p_category_id $$;

-- When a match was completed (signed off or auto-closed), or null.
create function private.match_completed_at(p_match public.job_matches)
returns timestamptz
language sql
immutable
set search_path = ''
as $$ select coalesce(p_match.signed_off_at, p_match.auto_closed_at) $$;

-- ---------------------------------------------------------------------------
-- Queue membership
-- ---------------------------------------------------------------------------

-- Moves people off the waiting list while the queue has room.
create function private.promote_waiting(p_queue_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cap integer;
  v_member public.queue_members;
begin
  select cap into v_cap from public.queues where id = p_queue_id for update;

  while (select count(*) from public.queue_members
         where queue_id = p_queue_id and status = 'active') < v_cap loop
    update public.queue_members
      set status = 'active', position = nextval('public.queue_position_seq')
      where id = (
        select id from public.queue_members
        where queue_id = p_queue_id and status = 'waiting'
        order by position
        limit 1
      )
      returning * into v_member;
    exit when not found;
    perform private.notify(v_member.trade_id, 'left_waiting_list',
      jsonb_build_object('queue_id', p_queue_id), now());
  end loop;
end;
$$;

-- Makes an approved trade's queue memberships match the towns and categories
-- they picked. New queues go to the back (or the waiting list when full);
-- existing places are kept.
create function private.sync_trade_queues(p_trade_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_queue record;
  v_active integer;
begin
  if not exists (select 1 from public.trades where id = p_trade_id and status = 'approved') then
    return;
  end if;

  for v_queue in
    delete from public.queue_members qm
    using public.queues q
    where qm.queue_id = q.id
      and qm.trade_id = p_trade_id
      and not (
        exists (select 1 from public.trade_towns
                where trade_id = p_trade_id and town_id = q.town_id)
        and exists (select 1 from public.trade_category_links
                    where trade_id = p_trade_id and category_id = q.category_id)
      )
    returning qm.queue_id
  loop
    perform private.promote_waiting(v_queue.queue_id);
  end loop;

  for v_queue in
    select q.id, q.cap
    from public.queues q
    join public.trade_towns tt on tt.town_id = q.town_id and tt.trade_id = p_trade_id
    join public.trade_category_links cl on cl.category_id = q.category_id and cl.trade_id = p_trade_id
    where not exists (
      select 1 from public.queue_members
      where queue_id = q.id and trade_id = p_trade_id
    )
    order by q.town_id, q.category_id
  loop
    perform 1 from public.queues where id = v_queue.id for update;
    select count(*) into v_active from public.queue_members
      where queue_id = v_queue.id and status = 'active';
    insert into public.queue_members (queue_id, trade_id, status)
      values (v_queue.id, p_trade_id,
        case when v_active < v_queue.cap then 'active' else 'waiting' end::public.queue_member_status);
  end loop;
end;
$$;

-- Counts a decline (or no reply, p_reason null) against a queue place.
create function private.record_decline(p_member_id uuid, p_reason public.decline_reason, p_now timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.app_settings := private.settings();
  v_member public.queue_members;
begin
  if p_member_id is null then
    return;
  end if;

  update public.queue_members
    set consecutive_declines = consecutive_declines + 1,
        not_my_kind_count = not_my_kind_count
          + case when p_reason = 'not_my_kind_of_work' then 1 else 0 end
    where id = p_member_id
    returning * into v_member;
  if not found then
    return;
  end if;

  if p_reason = 'not_my_kind_of_work'
    and v_member.not_my_kind_count >= s.not_my_kind_limit
    and v_member.tuned_out_at is null then
    update public.queue_members set tuned_out_at = p_now where id = p_member_id;
    perform private.notify(v_member.trade_id, 'tuned_out_of_queue',
      jsonb_build_object('queue_id', v_member.queue_id), p_now);
  end if;

  if v_member.consecutive_declines >= s.decline_limit then
    update public.queue_members
      set position = nextval('public.queue_position_seq'), consecutive_declines = 0
      where id = p_member_id;
    perform private.notify(v_member.trade_id, 'moved_to_back',
      jsonb_build_object('queue_id', v_member.queue_id), p_now);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Sending offers
-- ---------------------------------------------------------------------------

-- Offers a job to the front p_count eligible members of one queue. Members
-- who aren't eligible are skipped without losing their place. Eligible =
-- approved, subscribed, not paused, insured today, tuned in to this queue,
-- able to take larger projects (if it's one), opted in to call-outs (if it's
-- one), and not already offered this job (withdrawn offers don't count).
create function private.offer_from_queue(
  p_job_id uuid,
  p_queue_id uuid,
  p_count integer,
  p_wave integer,
  p_now timestamptz
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.app_settings := private.settings();
  v_job public.jobs;
  v_expires timestamptz;
  v_member record;
  v_sent integer := 0;
begin
  if p_count <= 0 or p_queue_id is null then
    return 0;
  end if;

  select * into v_job from public.jobs where id = p_job_id;

  if v_job.is_callout then
    v_expires := p_now + make_interval(mins => s.callout_window_minutes);
  else
    v_expires := private.working_minutes_add(
      p_now, s.reply_window_minutes, s.working_day_start, s.working_day_end);
  end if;

  for v_member in
    select qm.id, qm.trade_id
    from public.queue_members qm
    join public.trades t on t.id = qm.trade_id
    where qm.queue_id = p_queue_id
      and qm.status = 'active'
      and qm.tuned_out_at is null
      and t.status = 'approved'
      and t.paused_at is null
      and (v_job.size = 'small' or t.can_take_large_jobs)
      and (not v_job.is_callout or t.accepts_callouts)
      and t.id <> v_job.customer_id
      and private.has_active_subscription(t.id, p_now)
      and private.is_insured(t.id, (p_now at time zone 'Europe/London')::date)
      and not exists (
        select 1 from public.job_offers
        where job_id = v_job.id and trade_id = t.id and status <> 'withdrawn'
      )
    order by qm.position
    limit p_count
  loop
    insert into public.job_offers (job_id, trade_id, queue_member_id, wave, offered_at, expires_at)
      values (v_job.id, v_member.trade_id, v_member.id, p_wave, p_now, v_expires);
    update public.queue_members set last_offered_at = p_now where id = v_member.id;

    perform private.notify(v_member.trade_id,
      case when v_job.is_callout then 'new_callout' else 'new_offer' end,
      jsonb_build_object('job_id', v_job.id, 'expires_at', v_expires),
      p_now, v_job.is_callout);
    if not v_job.is_callout then
      perform private.notify(v_member.trade_id, 'offer_reminder',
        jsonb_build_object('job_id', v_job.id, 'expires_at', v_expires),
        private.working_minutes_add(
          p_now, s.offer_reminder_minutes, s.working_day_start, s.working_day_end));
    end if;

    v_sent := v_sent + 1;
  end loop;

  return v_sent;
end;
$$;

-- Keeps a normal job's live offers topped up to offers_per_wave. When the
-- home town's queue can't fill them, neighbouring towns are added (once, and
-- from then on).
create function private.top_up_offers(p_job_id uuid, p_now timestamptz)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.app_settings := private.settings();
  v_job public.jobs;
  v_need integer;
  v_sent integer;
  v_queue record;
begin
  select * into v_job from public.jobs where id = p_job_id for update;
  if v_job.status <> 'offering' or v_job.is_callout then
    return 0;
  end if;

  v_need := s.offers_per_wave - (
    select count(*) from public.job_offers where job_id = p_job_id and status = 'pending');
  if v_need <= 0 then
    return 0;
  end if;

  v_sent := private.offer_from_queue(
    p_job_id, private.queue_for(v_job.town_id, v_job.category_id), v_need, 1, p_now);

  if v_sent < v_need and v_job.expanded_at is null then
    update public.jobs set expanded_at = p_now where id = p_job_id;
    v_job.expanded_at := p_now;
  end if;

  if v_job.expanded_at is not null then
    for v_queue in
      select q.id
      from public.town_neighbours tn
      join public.queues q on q.town_id = tn.neighbour_id and q.category_id = v_job.category_id
      where tn.town_id = v_job.town_id
      order by tn.neighbour_id
    loop
      exit when v_sent >= v_need;
      v_sent := v_sent + private.offer_from_queue(p_job_id, v_queue.id, v_need - v_sent, 1, p_now);
    end loop;
  end if;

  return v_sent;
end;
$$;

-- Call-outs: each wave offers the front few of the home town's queue and of
-- every neighbouring town's queue at the same time.
create function private.send_callout_wave(p_job_id uuid, p_now timestamptz)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.app_settings := private.settings();
  v_job public.jobs;
  v_wave integer;
  v_sent integer := 0;
  v_queue record;
begin
  select * into v_job from public.jobs where id = p_job_id for update;
  if v_job.status <> 'offering' or not v_job.is_callout then
    return 0;
  end if;

  v_wave := v_job.current_wave + 1;

  for v_queue in
    select q.id, 0 as sort_key
    from public.queues q
    where q.town_id = v_job.town_id and q.category_id = v_job.category_id
    union all
    select q.id, tn.neighbour_id
    from public.town_neighbours tn
    join public.queues q on q.town_id = tn.neighbour_id and q.category_id = v_job.category_id
    where tn.town_id = v_job.town_id
    order by 2
  loop
    v_sent := v_sent + private.offer_from_queue(p_job_id, v_queue.id, s.offers_per_wave, v_wave, p_now);
  end loop;

  update public.jobs
    set current_wave = v_wave, last_wave_at = p_now, expanded_at = coalesce(expanded_at, p_now)
    where id = p_job_id;

  return v_sent;
end;
$$;

-- ---------------------------------------------------------------------------
-- Customers: posting and managing jobs
-- ---------------------------------------------------------------------------

create function private.post_job(
  p_customer_id uuid,
  p_category_id smallint,
  p_postcode text,
  p_address_line text,
  p_title text,
  p_description text,
  p_size public.job_size,
  p_is_callout boolean,
  p_timing public.job_timing,
  p_budget public.job_budget,
  p_now timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_district text := public.postcode_district(p_postcode);
  v_town_id smallint;
  v_job_id uuid;
begin
  if v_district is null then
    raise exception 'INVALID_POSTCODE';
  end if;

  select pd.town_id into v_town_id
    from public.postcode_districts pd
    join public.towns t on t.id = pd.town_id and t.active
    where pd.district = v_district;
  if not found then
    raise exception 'AREA_NOT_COVERED';
  end if;

  if not exists (select 1 from public.trade_categories where id = p_category_id and active) then
    raise exception 'INVALID_CATEGORY';
  end if;

  insert into public.jobs (
    customer_id, category_id, town_id, district, size, is_callout,
    title, description, timing, budget, created_at
  ) values (
    p_customer_id, p_category_id, v_town_id, v_district, coalesce(p_size, 'small'),
    coalesce(p_is_callout, false), p_title, coalesce(p_description, ''),
    coalesce(p_timing, 'flexible'), coalesce(p_budget, 'not_sure'), p_now
  ) returning id into v_job_id;

  insert into public.job_addresses (job_id, postcode, address_line)
    values (v_job_id, public.normalise_key(p_postcode), coalesce(p_address_line, ''));

  if coalesce(p_is_callout, false) then
    perform private.send_callout_wave(v_job_id, p_now);
  else
    perform private.top_up_offers(v_job_id, p_now);
  end if;

  return v_job_id;
end;
$$;

create function public.post_job(
  p_category_id smallint,
  p_postcode text,
  p_title text,
  p_description text default '',
  p_address_line text default '',
  p_size public.job_size default 'small',
  p_is_callout boolean default false,
  p_timing public.job_timing default 'flexible',
  p_budget public.job_budget default 'not_sure'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.my_role() is distinct from 'customer' then
    raise exception 'CUSTOMERS_ONLY';
  end if;
  return private.post_job(auth.uid(), p_category_id, p_postcode, p_address_line, p_title,
    p_description, p_size, p_is_callout, p_timing, p_budget, now());
end;
$$;

-- The customer can ask for a different trade any time before the job is
-- marked done. The current match ends and offers go out again (the previous
-- trade is never offered the same job twice).
create function private.request_another_trade(p_customer_id uuid, p_job_id uuid, p_now timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.jobs;
  v_trade_id uuid;
begin
  select * into v_job from public.jobs where id = p_job_id for update;
  if not found or v_job.customer_id <> p_customer_id then
    raise exception 'JOB_NOT_FOUND';
  end if;
  if v_job.status <> 'matched' then
    raise exception 'JOB_NOT_MATCHED';
  end if;

  update public.job_matches
    set ended_at = p_now, end_reason = 'customer_requested_another'
    where job_id = p_job_id and ended_at is null
    returning trade_id into v_trade_id;
  perform private.notify(v_trade_id, 'match_ended', jsonb_build_object('job_id', p_job_id), p_now);

  update public.jobs set status = 'offering' where id = p_job_id;

  if v_job.is_callout then
    perform private.send_callout_wave(p_job_id, p_now);
  else
    perform private.top_up_offers(p_job_id, p_now);
  end if;
end;
$$;

create function public.request_another_trade(p_job_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$ select private.request_another_trade(auth.uid(), p_job_id, now()) $$;

create function private.cancel_job(p_customer_id uuid, p_job_id uuid, p_now timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.jobs;
  v_trade record;
begin
  select * into v_job from public.jobs where id = p_job_id for update;
  if not found or v_job.customer_id <> p_customer_id then
    raise exception 'JOB_NOT_FOUND';
  end if;
  if v_job.status not in ('offering', 'matched') then
    raise exception 'JOB_CANNOT_BE_CANCELLED';
  end if;

  for v_trade in
    update public.job_offers set status = 'withdrawn', responded_at = p_now
      where job_id = p_job_id and status = 'pending'
      returning trade_id
  loop
    perform private.cancel_notifications('offer_reminder', p_job_id, v_trade.trade_id);
  end loop;

  for v_trade in
    update public.job_matches set ended_at = p_now, end_reason = 'cancelled'
      where job_id = p_job_id and ended_at is null
      returning trade_id
  loop
    perform private.notify(v_trade.trade_id, 'job_cancelled', jsonb_build_object('job_id', p_job_id), p_now);
  end loop;

  update public.jobs set status = 'cancelled', cancelled_at = p_now where id = p_job_id;
end;
$$;

create function public.cancel_job(p_job_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$ select private.cancel_job(auth.uid(), p_job_id, now()) $$;

-- ---------------------------------------------------------------------------
-- Trades: answering offers
-- ---------------------------------------------------------------------------

-- First to accept wins. The job row lock means two trades accepting at the
-- same moment are handled one after the other; the second gets JOB_TAKEN.
create function private.accept_offer(p_trade_id uuid, p_offer_id uuid, p_now timestamptz)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.app_settings := private.settings();
  v_offer public.job_offers;
  v_job public.jobs;
  v_match_id uuid;
  v_other record;
begin
  select * into v_offer from public.job_offers where id = p_offer_id;
  if not found or v_offer.trade_id <> p_trade_id then
    raise exception 'OFFER_NOT_FOUND';
  end if;

  select * into v_job from public.jobs where id = v_offer.job_id for update;
  -- Read again now the job is locked: another trade may have just won it.
  select * into v_offer from public.job_offers where id = p_offer_id;

  if v_job.status <> 'offering' or v_offer.status = 'withdrawn' then
    raise exception 'JOB_TAKEN';
  end if;
  if v_offer.status <> 'pending' or v_offer.expires_at <= p_now then
    raise exception 'OFFER_EXPIRED';
  end if;

  update public.job_offers set status = 'accepted', responded_at = p_now where id = p_offer_id;
  perform private.cancel_notifications('offer_reminder', v_job.id, p_trade_id);

  for v_other in
    update public.job_offers set status = 'withdrawn', responded_at = p_now
      where job_id = v_job.id and status = 'pending'
      returning trade_id
  loop
    perform private.cancel_notifications('offer_reminder', v_job.id, v_other.trade_id);
    perform private.notify(v_other.trade_id, 'job_taken', jsonb_build_object('job_id', v_job.id), p_now);
  end loop;

  insert into public.job_matches (job_id, trade_id, offer_id, matched_at, contact_due_at)
    values (v_job.id, p_trade_id, p_offer_id, p_now,
      p_now + make_interval(hours => s.contact_due_hours))
    returning id into v_match_id;

  update public.jobs set status = 'matched' where id = v_job.id;

  -- Winning moves them to the back of this queue only, and resets their
  -- declines here and their misses everywhere.
  update public.queue_members
    set position = nextval('public.queue_position_seq'),
        consecutive_declines = 0,
        last_won_at = p_now
    where id = v_offer.queue_member_id;
  update public.trades set consecutive_misses = 0 where id = p_trade_id;

  perform private.notify(v_job.customer_id, 'job_matched',
    jsonb_build_object('job_id', v_job.id, 'match_id', v_match_id), p_now);

  return v_match_id;
end;
$$;

create function public.accept_offer(p_offer_id uuid)
returns uuid
language sql
security definer
set search_path = ''
as $$ select private.accept_offer(auth.uid(), p_offer_id, now()) $$;

create function private.decline_offer(
  p_trade_id uuid,
  p_offer_id uuid,
  p_reason public.decline_reason,
  p_note text,
  p_now timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_offer public.job_offers;
begin
  if p_reason is null then
    raise exception 'DECLINE_REASON_REQUIRED';
  end if;

  select * into v_offer from public.job_offers where id = p_offer_id;
  if not found or v_offer.trade_id <> p_trade_id then
    raise exception 'OFFER_NOT_FOUND';
  end if;

  perform 1 from public.jobs where id = v_offer.job_id for update;
  update public.job_offers
    set status = 'declined', responded_at = p_now, decline_reason = p_reason, decline_note = p_note
    where id = p_offer_id and status = 'pending'
    returning * into v_offer;
  if not found then
    raise exception 'OFFER_NOT_PENDING';
  end if;

  perform private.cancel_notifications('offer_reminder', v_offer.job_id, p_trade_id);
  update public.trades set consecutive_misses = 0 where id = p_trade_id;
  perform private.record_decline(v_offer.queue_member_id, p_reason, p_now);
  perform private.top_up_offers(v_offer.job_id, p_now);
end;
$$;

create function public.decline_offer(p_offer_id uuid, p_reason public.decline_reason, p_note text default null)
returns void
language sql
security definer
set search_path = ''
as $$ select private.decline_offer(auth.uid(), p_offer_id, p_reason, p_note, now()) $$;

-- Offers that ran out count as a decline and a miss. Too many misses in a
-- row pauses the trade until they resume.
create function private.expire_offers(p_now timestamptz)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.app_settings := private.settings();
  v_due record;
  v_offer public.job_offers;
  v_trade public.trades;
  v_jobs uuid[] := '{}';
  v_job_id uuid;
  v_count integer := 0;
begin
  for v_due in
    select id, job_id from public.job_offers
    where status = 'pending' and expires_at <= p_now
    order by expires_at
  loop
    perform 1 from public.jobs where id = v_due.job_id for update;
    update public.job_offers set status = 'expired', responded_at = p_now
      where id = v_due.id and status = 'pending'
      returning * into v_offer;
    continue when not found;

    v_count := v_count + 1;
    v_jobs := array_append(v_jobs, v_offer.job_id);
    perform private.cancel_notifications('offer_reminder', v_offer.job_id, v_offer.trade_id);
    perform private.notify(v_offer.trade_id, 'offer_expired', jsonb_build_object('job_id', v_offer.job_id), p_now);
    perform private.record_decline(v_offer.queue_member_id, null, p_now);

    update public.trades set consecutive_misses = consecutive_misses + 1
      where id = v_offer.trade_id
      returning * into v_trade;
    if v_trade.consecutive_misses >= s.miss_limit and v_trade.paused_at is null then
      update public.trades
        set paused_at = p_now, paused_reason = 'missed_offers', consecutive_misses = 0
        where id = v_trade.id;
      perform private.notify(v_trade.id, 'paused_missed_offers', '{}', p_now);
      perform private.alert_admins('trade_paused', null, v_trade.id,
        jsonb_build_object('reason', 'missed_offers'));
    end if;
  end loop;

  foreach v_job_id in array coalesce((select array_agg(distinct j) from unnest(v_jobs) as j), '{}') loop
    perform private.top_up_offers(v_job_id, p_now);
  end loop;

  return v_count;
end;
$$;

-- Runs every minute: keeps normal jobs topped up (e.g. after trades join or
-- resume) and sends the next call-out wave where it's due.
create function private.refresh_open_jobs(p_now timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.app_settings := private.settings();
  v_job record;
begin
  for v_job in
    select j.id from public.jobs j
    where j.status = 'offering' and not j.is_callout
      and (select count(*) from public.job_offers o
           where o.job_id = j.id and o.status = 'pending') < s.offers_per_wave
  loop
    perform private.top_up_offers(v_job.id, p_now);
  end loop;

  for v_job in
    select id from public.jobs
    where status = 'offering' and is_callout
      and last_wave_at <= p_now - make_interval(mins => s.callout_wave_minutes)
  loop
    perform private.send_callout_wave(v_job.id, p_now);
  end loop;
end;
$$;

-- After 24 hours with nobody taking it: alert the founders and tell the
-- customer the job stays listed.
create function private.alert_unmatched_jobs(p_now timestamptz)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.app_settings := private.settings();
  v_job public.jobs;
  v_count integer := 0;
begin
  for v_job in
    update public.jobs set unmatched_alerted_at = p_now
      where status = 'offering'
        and unmatched_alerted_at is null
        and created_at <= p_now - make_interval(hours => s.unmatched_alert_hours)
      returning *
  loop
    perform private.alert_admins('job_unmatched', v_job.id, v_job.customer_id, '{}');
    perform private.notify(v_job.customer_id, 'job_still_listed', jsonb_build_object('job_id', v_job.id), p_now);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- After a match
-- ---------------------------------------------------------------------------

create function private.mark_contacted(p_trade_id uuid, p_match_id uuid, p_now timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.job_matches
    set contacted_at = coalesce(contacted_at, p_now)
    where id = p_match_id and trade_id = p_trade_id and ended_at is null;
  if not found then
    raise exception 'MATCH_NOT_FOUND';
  end if;
end;
$$;

create function public.mark_contacted(p_match_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$ select private.mark_contacted(auth.uid(), p_match_id, now()) $$;

-- Trades must contact the customer within 24 hours. If not, the founders
-- are alerted and the customer is asked if they'd like another trade.
create function private.check_no_contact(p_now timestamptz)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_match record;
  v_count integer := 0;
begin
  for v_match in
    update public.job_matches m set no_contact_flagged_at = p_now
      from public.jobs j
      where j.id = m.job_id
        and m.ended_at is null
        and m.contacted_at is null
        and m.done_at is null
        and m.no_contact_flagged_at is null
        and m.contact_due_at <= p_now
      returning m.id, m.job_id, m.trade_id, j.customer_id
  loop
    perform private.alert_admins('no_contact', v_match.job_id, v_match.trade_id,
      jsonb_build_object('match_id', v_match.id));
    perform private.notify(v_match.customer_id, 'no_contact_check',
      jsonb_build_object('job_id', v_match.job_id, 'match_id', v_match.id), p_now);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- The trade marks the job done. The customer is reminded to sign it off at
-- each of signoff_reminder_hours; at auto_close_hours it closes by itself.
create function private.mark_done(p_trade_id uuid, p_match_id uuid, p_now timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.app_settings := private.settings();
  v_match public.job_matches;
  v_job public.jobs;
  v_hours integer;
begin
  select * into v_match from public.job_matches where id = p_match_id;
  if not found or v_match.trade_id <> p_trade_id or v_match.ended_at is not null then
    raise exception 'MATCH_NOT_FOUND';
  end if;

  select * into v_job from public.jobs where id = v_match.job_id for update;
  if v_job.status <> 'matched' then
    raise exception 'JOB_NOT_IN_PROGRESS';
  end if;

  update public.job_matches
    set done_at = p_now, contacted_at = coalesce(contacted_at, p_now)
    where id = p_match_id;
  update public.jobs set status = 'done' where id = v_job.id;

  perform private.notify(v_job.customer_id, 'job_marked_done',
    jsonb_build_object('job_id', v_job.id, 'match_id', p_match_id), p_now);
  foreach v_hours in array s.signoff_reminder_hours loop
    continue when v_hours >= s.auto_close_hours;
    perform private.notify(v_job.customer_id, 'signoff_reminder',
      jsonb_build_object('job_id', v_job.id, 'match_id', p_match_id, 'hours', v_hours),
      p_now + make_interval(hours => v_hours));
  end loop;
end;
$$;

create function public.mark_done(p_match_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$ select private.mark_done(auth.uid(), p_match_id, now()) $$;

create function private.sign_off(p_customer_id uuid, p_job_id uuid, p_now timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.jobs;
  v_trade_id uuid;
begin
  select * into v_job from public.jobs where id = p_job_id for update;
  if not found or v_job.customer_id <> p_customer_id then
    raise exception 'JOB_NOT_FOUND';
  end if;
  if v_job.status <> 'done' then
    raise exception 'JOB_NOT_DONE';
  end if;

  update public.job_matches set signed_off_at = p_now
    where job_id = p_job_id and ended_at is null
    returning trade_id into v_trade_id;
  update public.jobs set status = 'completed', completed_at = p_now where id = p_job_id;

  perform private.cancel_notifications('signoff_reminder', p_job_id);
  perform private.notify(v_trade_id, 'job_signed_off', jsonb_build_object('job_id', p_job_id), p_now);
end;
$$;

create function public.sign_off(p_job_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$ select private.sign_off(auth.uid(), p_job_id, now()) $$;

create function private.auto_close(p_now timestamptz)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.app_settings := private.settings();
  v_match record;
  v_count integer := 0;
begin
  for v_match in
    select m.id, m.job_id, m.trade_id, j.customer_id
    from public.job_matches m
    join public.jobs j on j.id = m.job_id
    where m.ended_at is null
      and m.done_at <= p_now - make_interval(hours => s.auto_close_hours)
      and m.signed_off_at is null
      and m.auto_closed_at is null
      and j.status = 'done'
    for update of j
  loop
    update public.job_matches set auto_closed_at = p_now where id = v_match.id;
    update public.jobs set status = 'completed', completed_at = p_now where id = v_match.job_id;
    perform private.cancel_notifications('signoff_reminder', v_match.job_id);
    perform private.notify(v_match.customer_id, 'job_auto_closed',
      jsonb_build_object('job_id', v_match.job_id, 'match_id', v_match.id), p_now);
    perform private.notify(v_match.trade_id, 'job_auto_closed',
      jsonb_build_object('job_id', v_match.job_id, 'match_id', v_match.id), p_now);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- Phone numbers and address, only for the two people in a live match.
create function public.get_match_contact(p_match_id uuid)
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
  select j.id, t.business_name, tp.phone, cp.full_name, cp.phone, a.postcode, a.address_line
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

-- ---------------------------------------------------------------------------
-- Reviews and customer ratings (blind until both rate, or the window ends)
-- ---------------------------------------------------------------------------

create function private.check_low_customer_rating(p_customer_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.app_settings := private.settings();
  v_count integer;
  v_average numeric;
begin
  select count(*), avg(stars) into v_count, v_average
    from public.customer_ratings
    where customer_id = p_customer_id and released_at is not null;

  if v_count >= s.low_rating_min_count
    and v_average < s.low_rating_threshold
    and not exists (
      select 1 from public.admin_alerts
      where kind = 'low_customer_rating' and user_id = p_customer_id and resolved_at is null
    ) then
    perform private.alert_admins('low_customer_rating', null, p_customer_id,
      jsonb_build_object('ratings', v_count, 'average', round(v_average, 2)));
  end if;
end;
$$;

create function private.release_if_both_rated(p_match_id uuid, p_now timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer_id uuid;
begin
  if exists (select 1 from public.reviews where match_id = p_match_id and released_at is null)
    and exists (select 1 from public.customer_ratings where match_id = p_match_id and released_at is null) then
    update public.reviews set released_at = p_now where match_id = p_match_id;
    update public.customer_ratings set released_at = p_now where match_id = p_match_id
      returning customer_id into v_customer_id;
    perform private.check_low_customer_rating(v_customer_id);
  end if;
end;
$$;

create function private.leave_review(
  p_customer_id uuid,
  p_match_id uuid,
  p_quality smallint,
  p_reliability smallint,
  p_tidiness smallint,
  p_value smallint,
  p_comment text,
  p_now timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.app_settings := private.settings();
  v_match public.job_matches;
  v_review_id uuid;
begin
  select m.* into v_match
    from public.job_matches m
    join public.jobs j on j.id = m.job_id
    where m.id = p_match_id and j.customer_id = p_customer_id and m.ended_at is null;
  if not found then
    raise exception 'MATCH_NOT_FOUND';
  end if;
  if private.match_completed_at(v_match) is null then
    raise exception 'JOB_NOT_COMPLETED';
  end if;
  if p_now > private.match_completed_at(v_match) + make_interval(days => s.review_window_days) then
    raise exception 'REVIEW_WINDOW_CLOSED';
  end if;
  if exists (select 1 from public.reviews where match_id = p_match_id) then
    raise exception 'ALREADY_REVIEWED';
  end if;

  insert into public.reviews (match_id, trade_id, customer_id, quality, reliability, tidiness, value, comment, created_at)
    values (p_match_id, v_match.trade_id, p_customer_id, p_quality, p_reliability, p_tidiness,
      p_value, coalesce(p_comment, ''), p_now)
    returning id into v_review_id;

  perform private.release_if_both_rated(p_match_id, p_now);
  return v_review_id;
end;
$$;

create function public.leave_review(
  p_match_id uuid,
  p_quality smallint,
  p_reliability smallint,
  p_tidiness smallint,
  p_value smallint,
  p_comment text default ''
)
returns uuid
language sql
security definer
set search_path = ''
as $$
  select private.leave_review(auth.uid(), p_match_id, p_quality, p_reliability, p_tidiness,
    p_value, p_comment, now())
$$;

-- Trades can rate the customer once they've marked the job done.
create function private.rate_customer(
  p_trade_id uuid,
  p_match_id uuid,
  p_stars smallint,
  p_tags text[],
  p_comment text,
  p_now timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.app_settings := private.settings();
  v_match public.job_matches;
  v_customer_id uuid;
  v_rating_id uuid;
begin
  select * into v_match from public.job_matches
    where id = p_match_id and trade_id = p_trade_id and ended_at is null;
  if not found then
    raise exception 'MATCH_NOT_FOUND';
  end if;
  if v_match.done_at is null then
    raise exception 'JOB_NOT_DONE';
  end if;
  if private.match_completed_at(v_match) is not null
    and p_now > private.match_completed_at(v_match) + make_interval(days => s.review_window_days) then
    raise exception 'REVIEW_WINDOW_CLOSED';
  end if;
  if exists (select 1 from public.customer_ratings where match_id = p_match_id) then
    raise exception 'ALREADY_RATED';
  end if;

  select customer_id into v_customer_id from public.jobs where id = v_match.job_id;
  insert into public.customer_ratings (match_id, customer_id, trade_id, stars, tags, comment, created_at)
    values (p_match_id, v_customer_id, p_trade_id, p_stars, coalesce(p_tags, '{}'),
      coalesce(p_comment, ''), p_now)
    returning id into v_rating_id;

  perform private.release_if_both_rated(p_match_id, p_now);
  return v_rating_id;
end;
$$;

create function public.rate_customer(
  p_match_id uuid,
  p_stars smallint,
  p_tags text[] default '{}',
  p_comment text default ''
)
returns uuid
language sql
security definer
set search_path = ''
as $$ select private.rate_customer(auth.uid(), p_match_id, p_stars, p_tags, p_comment, now()) $$;

-- Once the review window has ended, whatever was left is released anyway.
create function private.release_due_ratings(p_now timestamptz)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.app_settings := private.settings();
  v_customer record;
  v_count integer := 0;
begin
  update public.reviews r set released_at = p_now
    from public.job_matches m
    where m.id = r.match_id
      and r.released_at is null
      and private.match_completed_at(m) + make_interval(days => s.review_window_days) <= p_now;
  get diagnostics v_count = row_count;

  for v_customer in
    update public.customer_ratings cr set released_at = p_now
      from public.job_matches m
      where m.id = cr.match_id
        and cr.released_at is null
        and private.match_completed_at(m) + make_interval(days => s.review_window_days) <= p_now
      returning cr.customer_id
  loop
    perform private.check_low_customer_rating(v_customer.customer_id);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- What a trade sees about the customer on an offer: an average once they
-- have enough released ratings, otherwise "New customer".
create function public.job_customer_rating(p_job_id uuid)
returns table (rating_count integer, average_stars numeric, is_new_customer boolean)
language sql
stable
security definer
set search_path = ''
as $$
  with allowed as (
    select j.customer_id from public.jobs j
    where j.id = p_job_id
      and (private.is_admin()
        or exists (select 1 from public.job_offers o
                   where o.job_id = j.id and o.trade_id = auth.uid()))
  ),
  stats as (
    select count(cr.id)::integer as n, avg(cr.stars) as average
    from allowed a
    left join public.customer_ratings cr
      on cr.customer_id = a.customer_id and cr.released_at is not null
  )
  select n,
    case when n >= (select customer_rating_min_count from public.app_settings where id)
      then round(average, 1) end,
    n < (select customer_rating_min_count from public.app_settings where id)
  from stats
  where exists (select 1 from allowed)
$$;

-- ---------------------------------------------------------------------------
-- Trades: queues and pausing
-- ---------------------------------------------------------------------------

-- Call after changing your towns or categories.
create function public.sync_my_queues()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.my_role() is distinct from 'trade' then
    raise exception 'TRADES_ONLY';
  end if;
  perform private.sync_trade_queues(auth.uid());
end;
$$;

create function public.pause_offers()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.trades
    set paused_at = coalesce(paused_at, now()), paused_reason = coalesce(paused_reason, 'self')
    where id = auth.uid();
  if not found then
    raise exception 'TRADES_ONLY';
  end if;
end;
$$;

create function public.resume_offers()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.trades
    set paused_at = null, paused_reason = null, consecutive_misses = 0
    where id = auth.uid() and paused_reason is distinct from 'admin';
  if not found then
    raise exception 'CANNOT_RESUME';
  end if;
end;
$$;

-- Switches offers back on in a queue the trade was tuned out of.
create function public.tune_back_in(p_queue_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.queue_members
    set tuned_out_at = null, not_my_kind_count = 0
    where queue_id = p_queue_id and trade_id = auth.uid();
  if not found then
    raise exception 'NOT_IN_QUEUE';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Admins
-- ---------------------------------------------------------------------------

-- Approval sets the founding order: trades join their queues in the order
-- they're approved.
create function private.approve_trade(p_trade_id uuid, p_admin_id uuid, p_now timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.app_settings := private.settings();
begin
  update public.trades
    set status = 'approved', approved_at = p_now, approved_by = p_admin_id, rejection_reason = null
    where id = p_trade_id and status in ('applied', 'rejected', 'suspended');
  if not found then
    raise exception 'TRADE_NOT_APPROVABLE';
  end if;

  update public.id_checks
    set images_purge_after = p_now + make_interval(days => s.id_image_retention_days)
    where trade_id = p_trade_id and images_purge_after is null;

  perform private.sync_trade_queues(p_trade_id);
  perform private.notify(p_trade_id, 'trade_approved', '{}', p_now);
end;
$$;

create function public.approve_trade(p_trade_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'ADMINS_ONLY';
  end if;
  perform private.approve_trade(p_trade_id, auth.uid(), now());
  perform private.audit('approve_trade', 'trades', p_trade_id::text);
end;
$$;

create function public.reject_trade(p_trade_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'ADMINS_ONLY';
  end if;
  update public.trades set status = 'rejected', rejection_reason = p_reason
    where id = p_trade_id and status = 'applied';
  if not found then
    raise exception 'TRADE_NOT_REJECTABLE';
  end if;
  perform private.notify(p_trade_id, 'trade_rejected', jsonb_build_object('reason', p_reason), now());
  perform private.audit('reject_trade', 'trades', p_trade_id::text, jsonb_build_object('reason', p_reason));
end;
$$;

-- Suspends a trade (or lifts it). Suspended trades keep their queue places
-- but get no offers.
create function public.set_trade_suspended(p_trade_id uuid, p_suspended boolean, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'ADMINS_ONLY';
  end if;
  if p_suspended then
    update public.trades set status = 'suspended', paused_at = coalesce(paused_at, now()), paused_reason = 'admin'
      where id = p_trade_id and status = 'approved';
  else
    update public.trades set status = 'approved', paused_at = null, paused_reason = null
      where id = p_trade_id and status = 'suspended';
  end if;
  if not found then
    raise exception 'TRADE_NOT_FOUND';
  end if;
  perform private.audit(case when p_suspended then 'suspend_trade' else 'unsuspend_trade' end,
    'trades', p_trade_id::text, jsonb_build_object('reason', p_reason));
end;
$$;

create function public.mark_company_checked(p_trade_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'ADMINS_ONLY';
  end if;
  update public.trades set company_checked_at = now() where id = p_trade_id;
  perform private.audit('mark_company_checked', 'trades', p_trade_id::text);
end;
$$;

create function public.set_queue_cap(p_queue_id uuid, p_cap integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'ADMINS_ONLY';
  end if;
  -- Lowering a cap never removes anyone; it just stops new members joining.
  update public.queues set cap = p_cap where id = p_queue_id;
  perform private.promote_waiting(p_queue_id);
  perform private.audit('set_queue_cap', 'queues', p_queue_id::text, jsonb_build_object('cap', p_cap));
end;
$$;

-- ---------------------------------------------------------------------------
-- Timers (scheduled by pg_cron in the next migration)
-- ---------------------------------------------------------------------------

create function private.run_engine(p_now timestamptz default now())
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.expire_offers(p_now);
  perform private.refresh_open_jobs(p_now);
  perform private.alert_unmatched_jobs(p_now);
  perform private.check_no_contact(p_now);
  perform private.auto_close(p_now);
  perform private.release_due_ratings(p_now);
end;
$$;

-- Once a day: warn trades whose insurance expires in 14 days or 3 days.
-- Lapsed insurance already stops offers (see offer_from_queue).
create function private.run_daily(p_now timestamptz default now())
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_doc record;
begin
  for v_doc in
    select d.trade_id, d.expires_on
    from public.trade_documents d
    join public.trades t on t.id = d.trade_id and t.status = 'approved'
    where d.doc_type = 'public_liability_insurance'
      and d.status = 'approved'
      and d.expires_on - (p_now at time zone 'Europe/London')::date in (14, 3)
      and not exists (
        select 1 from public.trade_documents newer
        where newer.trade_id = d.trade_id
          and newer.doc_type = 'public_liability_insurance'
          and newer.expires_on > d.expires_on
          and newer.status <> 'rejected'
      )
  loop
    perform private.notify(v_doc.trade_id, 'insurance_expiring',
      jsonb_build_object('expires_on', v_doc.expires_on), p_now);
    perform private.alert_admins('insurance_expiring', null, v_doc.trade_id,
      jsonb_build_object('expires_on', v_doc.expires_on));
  end loop;
end;
$$;
