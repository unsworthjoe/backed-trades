-- Blocking, for Apple's rule on apps where people message each other
-- (App Review guideline 1.2): users must be able to block abusive users.
--
-- A trade or a customer blocks the other person from a job they share. From
-- then on, in both directions:
--   * neither can message the other, on any job;
--   * the trade is never offered the customer's jobs (pending offers are
--     withdrawn and go to other trades);
--   * if the shared job is still in progress (matched, not yet marked done),
--     the match ends and the job goes back out, as when a customer asks for a
--     different trade.
-- The blocked person isn't told they were blocked: a blocked trade hears "the
-- customer asked for a different trade", a blocked customer "your trade can't
-- do this job after all". The founders get an alert each time, to check for
-- abuse. Blocks can't be undone in the apps.

alter type public.match_end_reason add value 'trade_blocked_customer';
alter type public.admin_alert_kind add value 'user_blocked';

create table public.blocks (
  blocker_id uuid not null references public.profiles on delete cascade,
  blocked_id uuid not null references public.profiles on delete cascade,
  -- The job it was done from.
  match_id uuid references public.job_matches on delete set null,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index on public.blocks (blocked_id);

alter table public.blocks enable row level security;
grant select on public.blocks to authenticated;
-- People see their own blocks, never who has blocked them.
create policy "People see who they've blocked" on public.blocks for select
  using (blocker_id = auth.uid() or private.is_admin());

-- Either way round.
create function private.is_blocked(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = p_a and blocked_id = p_b) or (blocker_id = p_b and blocked_id = p_a)
  )
$$;

create function private.match_blocked(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.job_matches m
    join public.jobs j on j.id = m.job_id
    where m.id = p_match_id and private.is_blocked(m.trade_id, j.customer_id)
  )
$$;

revoke execute on function private.is_blocked(uuid, uuid), private.match_blocked(uuid)
  from public, anon, authenticated;
-- The message policy below runs it as the signed-in user.
grant execute on function private.match_blocked(uuid) to authenticated;

-- For the message screens: true when either side has blocked the other.
create function public.match_messaging_blocked(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_match_party(p_match_id, false) and private.match_blocked(p_match_id)
$$;

revoke execute on function public.match_messaging_blocked(uuid) from public, anon;
grant execute on function public.match_messaging_blocked(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- No messages once blocked
-- ---------------------------------------------------------------------------

drop policy "Both sides send messages" on public.messages;
create policy "Both sides send messages" on public.messages for insert
  with check (
    sender_id = auth.uid()
    and private.is_match_party(match_id, true)
    and not private.match_blocked(match_id)
  );

-- ---------------------------------------------------------------------------
-- No offers between them
-- ---------------------------------------------------------------------------

-- Same as before, plus: not blocked by or blocking the customer.
create or replace function private.offer_from_queue(
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
      and not private.is_blocked(t.id, v_job.customer_id)
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

-- Sends more offers for a job that's looking for a trade.
create function private.refill_offers(p_job_id uuid, p_now timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select is_callout from public.jobs where id = p_job_id) then
    perform private.send_callout_wave(p_job_id, p_now);
  else
    perform private.top_up_offers(p_job_id, p_now);
  end if;
end;
$$;

revoke execute on function private.refill_offers(uuid, timestamptz) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Blocking
-- ---------------------------------------------------------------------------

create function private.block_from_match(p_user_id uuid, p_match_id uuid, p_now timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_match public.job_matches;
  v_job public.jobs;
  v_by_trade boolean;
  v_trade_id uuid;
  v_customer_id uuid;
  v_other uuid;
  v_offer record;
begin
  select * into v_match from public.job_matches where id = p_match_id;
  if not found then
    raise exception 'MATCH_NOT_FOUND';
  end if;
  select * into v_job from public.jobs where id = v_match.job_id for update;
  if p_user_id is null or p_user_id not in (v_match.trade_id, v_job.customer_id) then
    raise exception 'MATCH_NOT_FOUND';
  end if;

  v_trade_id := v_match.trade_id;
  v_customer_id := v_job.customer_id;
  v_by_trade := p_user_id = v_trade_id;
  v_other := case when v_by_trade then v_customer_id else v_trade_id end;

  insert into public.blocks (blocker_id, blocked_id, match_id, created_at)
    values (p_user_id, v_other, p_match_id, p_now)
    on conflict do nothing;
  if not found then
    return; -- already blocked
  end if;

  -- This job, if it's still in progress: the match ends and it goes back out.
  if v_job.status = 'matched' and v_match.ended_at is null then
    update public.job_matches
      set ended_at = p_now,
          end_reason = case when v_by_trade then 'trade_blocked_customer'
                            else 'customer_requested_another' end::public.match_end_reason
      where id = p_match_id;
    update public.jobs set status = 'offering' where id = v_job.id;
    if v_by_trade then
      perform private.notify(v_customer_id, 'trade_withdrew',
        jsonb_build_object('job_id', v_job.id, 'match_id', p_match_id), p_now);
    else
      perform private.notify(v_trade_id, 'match_ended', jsonb_build_object('job_id', v_job.id), p_now);
    end if;
    perform private.refill_offers(v_job.id, p_now);
  end if;

  -- Offers waiting for the trade on the customer's other jobs go elsewhere.
  for v_offer in
    update public.job_offers o set status = 'withdrawn', responded_at = p_now
      from public.jobs j
      where j.id = o.job_id and o.trade_id = v_trade_id and j.customer_id = v_customer_id
        and o.status = 'pending'
      returning o.job_id
  loop
    perform private.cancel_notifications('offer_reminder', v_offer.job_id, v_trade_id);
    perform private.refill_offers(v_offer.job_id, p_now);
  end loop;

  insert into public.admin_alerts (kind, job_id, user_id, details, created_at)
    values ('user_blocked', v_job.id, v_other,
      jsonb_build_object('blocked_by', p_user_id, 'by', case when v_by_trade then 'trade' else 'customer' end),
      p_now);
end;
$$;

create function public.block_from_match(p_match_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$ select private.block_from_match(auth.uid(), p_match_id, now()) $$;

revoke execute on function private.block_from_match(uuid, uuid, timestamptz) from public, anon, authenticated;
revoke execute on function public.block_from_match(uuid) from public, anon;
grant execute on function public.block_from_match(uuid) to authenticated;
