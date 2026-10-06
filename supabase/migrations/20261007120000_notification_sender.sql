-- Sending what the engine queues in notification_outbox.
--
-- The send-notifications Edge Function claims due messages, sends them by
-- push (Expo), text (Twilio) or email (Resend), then records how it went.
-- It's woken straight away when a message is queued for now, and once a
-- minute for anything scheduled (reminders) or being retried.
--
-- Where to wake it is kept in Vault, so this migration holds no secrets:
--   notification_sender_url     https://<project>.supabase.co/functions/v1/send-notifications
--   notification_sender_secret  the same value as the function's NOTIFICATION_SENDER_SECRET
-- Until both are set, nothing is woken and messages wait in the outbox.

create extension if not exists pg_net with schema extensions;

-- Set while the sender is working on a message. A claim older than 5 minutes
-- (the function crashed) is picked up again.
alter table public.notification_outbox add column claimed_at timestamptz;

-- Messages queued before there was a sender are out of date now; don't send
-- them all at once when it's switched on.
update public.notification_outbox
  set cancelled_at = now(), last_error = 'queued before the sender existed'
  where sent_at is null and cancelled_at is null and failed_at is null
    and scheduled_for < now() - interval '1 hour';

-- ---------------------------------------------------------------------------
-- Push tokens: one device belongs to whoever signed in on it last
-- ---------------------------------------------------------------------------

create function public.register_push_token(p_token text, p_platform text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'SIGN_IN_REQUIRED';
  end if;
  insert into public.push_tokens (user_id, token, platform)
    values (auth.uid(), p_token, p_platform)
    on conflict (token) do update
      set user_id = excluded.user_id, platform = excluded.platform, last_seen_at = now();
end;
$$;

-- Called on sign-out, so the next person on the phone doesn't get your offers.
create function public.unregister_push_token(p_token text)
returns void
language sql
security definer
set search_path = ''
as $$ delete from public.push_tokens where token = p_token and user_id = auth.uid() $$;

-- ---------------------------------------------------------------------------
-- The sender's side (secret key only)
-- ---------------------------------------------------------------------------

-- Claims up to p_limit due messages, call-outs first, with everything needed
-- to send them. Skips rows another run is working on.
create function public.claim_notifications(p_limit integer default 50)
returns table (
  id bigint,
  user_id uuid,
  channel public.notification_channel,
  template text,
  data jsonb,
  urgent boolean,
  attempts integer,
  role public.user_role,
  full_name text,
  email text,
  phone text,
  push_tokens text[]
)
language sql
security definer
set search_path = ''
as $$
  with due as (
    select o.id from public.notification_outbox o
    where o.sent_at is null and o.cancelled_at is null and o.failed_at is null
      and o.scheduled_for <= now()
      and (o.claimed_at is null or o.claimed_at < now() - interval '5 minutes')
    order by o.urgent desc, o.scheduled_for
    limit p_limit
    for update skip locked
  ),
  claimed as (
    update public.notification_outbox o
      set claimed_at = now(), attempts = o.attempts + 1
      from due
      where o.id = due.id
      returning o.*
  )
  select c.id, c.user_id, c.channel, c.template, c.data, c.urgent, c.attempts,
    p.role, p.full_name, p.email, p.phone,
    coalesce((select array_agg(t.token) from public.push_tokens t where t.user_id = c.user_id), '{}')
  from claimed c
  join public.profiles p on p.id = c.user_id
$$;

-- p_outcome: 'sent'; 'skipped' (out of date, e.g. the offer already ran out);
-- 'retry' (a temporary problem: tried again with a growing wait, up to 5
-- attempts); 'failed' (won't work, e.g. no way to reach the person).
create function public.finish_notification(p_id bigint, p_outcome text, p_error text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.notification_outbox o
    set claimed_at = null,
        last_error = coalesce(p_error, o.last_error),
        sent_at = case when p_outcome = 'sent' then now() end,
        cancelled_at = case when p_outcome = 'skipped' then now() end,
        failed_at = case when p_outcome = 'failed' or (p_outcome = 'retry' and o.attempts >= 5) then now() end,
        scheduled_for = case when p_outcome = 'retry'
          then now() + make_interval(mins => 2 * o.attempts) else o.scheduled_for end
    where o.id = p_id;
end;
$$;

-- Gone devices (the app was deleted, or notifications were switched off).
create function public.forget_push_tokens(p_tokens text[])
returns void
language sql
security definer
set search_path = ''
as $$ delete from public.push_tokens where token = any (p_tokens) $$;

revoke execute on function
  public.claim_notifications(integer),
  public.finish_notification(bigint, text, text),
  public.forget_push_tokens(text[])
  from public, anon, authenticated;
grant execute on function
  public.claim_notifications(integer),
  public.finish_notification(bigint, text, text),
  public.forget_push_tokens(text[])
  to service_role;

revoke execute on function public.register_push_token(text, text), public.unregister_push_token(text)
  from public, anon;
grant execute on function public.register_push_token(text, text), public.unregister_push_token(text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Founders hear about alerts by email
-- ---------------------------------------------------------------------------

create function private.email_admins_about_alert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid;
begin
  for v_admin in select id from public.profiles where role = 'admin' loop
    perform private.notify(v_admin, 'admin_alert',
      jsonb_build_object('kind', new.kind, 'job_id', new.job_id, 'user_id', new.user_id, 'details', new.details),
      now());
  end loop;
  return null;
end;
$$;

create trigger admin_alerts_email after insert on public.admin_alerts
  for each row execute function private.email_admins_about_alert();

-- ---------------------------------------------------------------------------
-- Waking the sender
-- ---------------------------------------------------------------------------

create function private.wake_notification_sender()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'notification_sender_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'notification_sender_secret';
  if v_url is null or v_secret is null then
    return;
  end if;
  -- pg_net sends after the transaction commits, so the sender sees the rows.
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-sender-secret', v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 5000
  );
end;
$$;

create function private.wake_sender_if_due_now()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from new_rows where scheduled_for <= now()) then
    perform private.wake_notification_sender();
  end if;
  return null;
end;
$$;

create trigger notification_outbox_wake after insert on public.notification_outbox
  referencing new table as new_rows
  for each statement execute function private.wake_sender_if_due_now();

create function private.wake_sender_if_anything_due()
returns void
language sql
security definer
set search_path = ''
as $$
  select private.wake_notification_sender()
  where exists (
    select 1 from public.notification_outbox
    where sent_at is null and cancelled_at is null and failed_at is null and scheduled_for <= now()
  )
$$;

revoke execute on function private.wake_notification_sender(), private.wake_sender_if_anything_due()
  from public, anon, authenticated;

select cron.schedule('backed-notifications', '* * * * *', $$select private.wake_sender_if_anything_due()$$);
