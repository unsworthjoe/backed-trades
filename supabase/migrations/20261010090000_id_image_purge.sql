-- Deleting ID photos once they've done their job.
--
-- A trade's photo ID and selfie are kept for app_settings.id_image_retention_days
-- (30) after the founders decide on the application, approved or not. Then the
-- files are deleted and only the result (passed / failed) is kept.
--
-- Supabase doesn't allow deleting storage files from SQL, so a nightly cron job
-- wakes the purge-id-images Edge Function, which deletes them through the
-- Storage API. It uses the same Vault entries as the notification sender: the
-- function lives next to send-notifications, and checks the same secret.

-- Rejecting starts the clock too. (Approving already does.) A trade who comes
-- back within the 30 days keeps their photos; after that they upload new ones.
create or replace function public.reject_trade(p_trade_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.app_settings := private.settings();
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
  update public.id_checks
    set images_purge_after = now() + make_interval(days => s.id_image_retention_days)
    where trade_id = p_trade_id and images_purge_after is null;
  update public.admin_alerts set resolved_at = now(), resolved_by = auth.uid()
    where kind = 'application_submitted' and user_id = p_trade_id and resolved_at is null;
  perform private.notify(p_trade_id, 'trade_rejected', jsonb_build_object('reason', p_reason), now());
  perform private.audit('reject_trade', 'trades', p_trade_id::text, jsonb_build_object('reason', p_reason));
end;
$$;

-- A passed ID check still counts once its photos are deleted. One that wasn't
-- passed needs new photos.
create or replace function private.application_problems(p_trade_id uuid)
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
                            and (result = 'passed'
                                 or (result <> 'failed' and cardinality(image_paths) >= 2)))
      then 'id' end
  ], null)
$$;

create index id_checks_purge_due on public.id_checks (images_purge_after)
  where images_purged_at is null;

-- ---------------------------------------------------------------------------
-- The purge function's side (secret key only)
-- ---------------------------------------------------------------------------

create function public.id_images_due_for_purge(p_limit integer default 100)
returns table (id uuid, image_paths text[])
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.image_paths
  from public.id_checks c
  where c.images_purged_at is null and c.images_purge_after <= now()
  order by c.images_purge_after
  limit p_limit
$$;

-- Called once the files are gone. Only rows that are due can be marked.
create function public.mark_id_images_purged(p_ids uuid[])
returns integer
language sql
security definer
set search_path = ''
as $$
  with done as (
    update public.id_checks
      set image_paths = '{}', images_purged_at = now()
      where id = any (p_ids) and images_purged_at is null and images_purge_after <= now()
      returning 1
  )
  select count(*)::integer from done
$$;

revoke execute on function
  public.id_images_due_for_purge(integer),
  public.mark_id_images_purged(uuid[])
  from public, anon, authenticated;
grant execute on function
  public.id_images_due_for_purge(integer),
  public.mark_id_images_purged(uuid[])
  to service_role;

-- ---------------------------------------------------------------------------
-- Waking it each night
-- ---------------------------------------------------------------------------

create function private.wake_id_image_purge()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  if not exists (select 1 from public.id_checks where images_purged_at is null and images_purge_after <= now()) then
    return;
  end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'notification_sender_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'notification_sender_secret';
  if v_url is null or v_secret is null then
    return;
  end if;
  perform net.http_post(
    url := regexp_replace(v_url, '/[^/]*$', '/purge-id-images'),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-sender-secret', v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 5000
  );
end;
$$;

revoke execute on function private.wake_id_image_purge() from public, anon, authenticated;

-- 3:30am UTC, when nobody's waiting on anything.
select cron.schedule('backed-id-image-purge', '30 3 * * *', $$select private.wake_id_image_purge()$$);
