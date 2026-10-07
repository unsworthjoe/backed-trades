-- Deleting old jobs, as the privacy policy promises: "Jobs, messages and
-- reports: 2 years after the job ends, then deleted."
--
-- A job ends when it's completed or cancelled. app_settings.job_retention_months
-- (24) after that, the job goes with everything hanging off it: address,
-- photos, offers, matches, messages, alerts and reports about it. Reviews and
-- customer ratings stay (the policy keeps reviews for as long as the trade is
-- on Backed.), so they no longer depend on the match.
--
-- Job photos are storage files, which SQL can't delete, so a nightly cron job
-- wakes the cleanup-ended-jobs Edge Function (same Vault entries and secret as
-- purge-id-images). It deletes each job's photo folder, then the job.
--
-- The same nightly run deletes reports that no longer belong to a job once
-- they've been dealt with for 2 years, and sent notifications after 30 days
-- (they can hold the first lines of a message).

alter table public.app_settings
  add column job_retention_months integer not null default 24,
  add column outbox_retention_days integer not null default 30;

-- ---------------------------------------------------------------------------
-- Reviews and ratings outlive their job
-- ---------------------------------------------------------------------------

alter table public.reviews
  alter column match_id drop not null,
  drop constraint reviews_match_id_fkey,
  add constraint reviews_match_id_fkey foreign key (match_id) references public.job_matches on delete set null;

alter table public.customer_ratings
  alter column match_id drop not null,
  drop constraint customer_ratings_match_id_fkey,
  add constraint customer_ratings_match_id_fkey foreign key (match_id) references public.job_matches on delete set null;

-- Completed jobs that have since been deleted, so a trade's "jobs completed"
-- count doesn't drop after 2 years.
alter table public.trades add column deleted_jobs_completed integer not null default 0;

-- Same as before, except the count adds deleted jobs, and reviews whose job has
-- gone are still listed (without the job title and town).
create or replace function public.trade_profile(p_trade_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'business_name', t.business_name,
    'bio', t.bio,
    'member_since', t.approved_at,
    'id_checked', exists (select 1 from public.id_checks where trade_id = t.id and result = 'passed'),
    'insured_until', (
      select max(expires_on) from public.trade_documents
      where trade_id = t.id and doc_type = 'public_liability_insurance' and status = 'approved'
    ),
    'company_checked', t.company_checked_at is not null,
    'registrations', coalesce((
      select jsonb_agg(r.scheme order by r.scheme) from public.trade_registrations r
      where r.trade_id = t.id and r.status = 'approved'
        and (r.expires_on is null or r.expires_on >= (now() at time zone 'Europe/London')::date)
    ), '[]'),
    'categories', coalesce((
      select jsonb_agg(c.name order by c.sort_order) from public.trade_category_links l
      join public.trade_categories c on c.id = l.category_id
      where l.trade_id = t.id
    ), '[]'),
    'jobs_completed', t.deleted_jobs_completed + (
      select count(*) from public.job_matches m
      where m.trade_id = t.id and m.ended_at is null and private.match_completed_at(m) is not null
    ),
    'rating', (
      select jsonb_build_object(
        'count', count(*),
        'overall', round(avg(overall), 1),
        'quality', round(avg(quality), 1),
        'reliability', round(avg(reliability), 1),
        'tidiness', round(avg(tidiness), 1),
        'value', round(avg(value), 1)
      )
      from public.reviews
      where trade_id = t.id and released_at is not null and hidden_at is null
    ),
    'reviews', coalesce((
      select jsonb_agg(x order by x.created_at desc) from (
        select r.overall, r.quality, r.reliability, r.tidiness, r.value, r.comment, r.created_at,
          split_part(p.full_name, ' ', 1) as first_name,
          j.title as job_title,
          tw.name as town
        from public.reviews r
        join public.profiles p on p.id = r.customer_id
        left join public.job_matches m on m.id = r.match_id
        left join public.jobs j on j.id = m.job_id
        left join public.towns tw on tw.id = j.town_id
        where r.trade_id = t.id and r.released_at is not null and r.hidden_at is null
        order by r.created_at desc
        limit 20
      ) x
    ), '[]')
  )
  from public.trades t
  where t.id = p_trade_id and t.status = 'approved'
$$;

-- ---------------------------------------------------------------------------
-- Which jobs are due
-- ---------------------------------------------------------------------------

create function private.job_ended_at(p_job public.jobs)
returns timestamptz
language sql
immutable
set search_path = ''
as $$
  select case p_job.status
    when 'completed' then p_job.completed_at
    when 'cancelled' then p_job.cancelled_at
  end
$$;

create function private.job_cleanup_due(p_job public.jobs)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.job_ended_at(p_job)
    <= now() - make_interval(months => (private.settings()).job_retention_months)
$$;

revoke execute on function private.job_ended_at(public.jobs), private.job_cleanup_due(public.jobs)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- The Edge Function's side (secret key only)
-- ---------------------------------------------------------------------------

create function public.ended_jobs_due_for_cleanup(p_limit integer default 50)
returns table (id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select j.id
  from public.jobs j
  where j.status in ('completed', 'cancelled') and private.job_cleanup_due(j)
  order by private.job_ended_at(j)
  limit p_limit
$$;

-- Called once a job's photos are gone. Only jobs that are due are deleted.
create function public.delete_ended_jobs(p_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids uuid[];
  v_count integer;
begin
  select coalesce(array_agg(j.id), '{}') into v_ids
    from public.jobs j
    where j.id = any (p_ids) and j.status in ('completed', 'cancelled') and private.job_cleanup_due(j);
  if cardinality(v_ids) = 0 then
    return 0;
  end if;

  update public.trades t set deleted_jobs_completed = t.deleted_jobs_completed + done.n
    from (
      select m.trade_id, count(*)::integer as n
      from public.job_matches m
      where m.job_id = any (v_ids) and m.ended_at is null and private.match_completed_at(m) is not null
      group by m.trade_id
    ) done
    where t.id = done.trade_id;

  -- Reports only point at the job (set null on delete), so they go first.
  delete from public.reports where job_id = any (v_ids);
  delete from public.jobs where id = any (v_ids);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function
  public.ended_jobs_due_for_cleanup(integer),
  public.delete_ended_jobs(uuid[])
  from public, anon, authenticated;
grant execute on function
  public.ended_jobs_due_for_cleanup(integer),
  public.delete_ended_jobs(uuid[])
  to service_role;

-- ---------------------------------------------------------------------------
-- The nightly run
-- ---------------------------------------------------------------------------

-- Reports with no job (it was deleted with an account, or the report was
-- about a person), 2 years after they were dealt with. Open ones stay.
create function private.delete_old_reports()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  delete from public.reports
    where job_id is null and status <> 'open'
      and coalesce(resolved_at, created_at)
        <= now() - make_interval(months => (private.settings()).job_retention_months);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Notifications that were sent, cancelled or gave up.
create function private.prune_outbox()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  delete from public.notification_outbox
    where (sent_at is not null or cancelled_at is not null or failed_at is not null)
      and created_at <= now() - make_interval(days => (private.settings()).outbox_retention_days);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create function private.wake_job_cleanup()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  if not exists (select 1 from public.jobs j
                 where j.status in ('completed', 'cancelled') and private.job_cleanup_due(j)) then
    return;
  end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'notification_sender_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'notification_sender_secret';
  if v_url is null or v_secret is null then
    return;
  end if;
  perform net.http_post(
    url := regexp_replace(v_url, '/[^/]*$', '/cleanup-ended-jobs'),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-sender-secret', v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 5000
  );
end;
$$;

create function private.run_cleanup()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.delete_old_reports();
  perform private.prune_outbox();
  perform private.wake_job_cleanup();
end;
$$;

revoke execute on function
  private.delete_old_reports(),
  private.prune_outbox(),
  private.wake_job_cleanup(),
  private.run_cleanup()
  from public, anon, authenticated;

-- 3:45am UTC, after the ID photo purge.
select cron.schedule('backed-cleanup', '45 3 * * *', $$select private.run_cleanup()$$);
