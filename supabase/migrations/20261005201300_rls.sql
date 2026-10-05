-- Backed. database, step 14: who can see and change what.
--
-- Signed-in users get read access through the policies below and can write
-- only the columns granted here. Everything that moves the queue (offers,
-- matches, queue places, subscriptions, job status) changes only through the
-- engine functions, never by writing to the tables directly.

-- ---------------------------------------------------------------------------
-- Policy helpers
-- ---------------------------------------------------------------------------

create function private.is_job_customer(p_job_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select exists (select 1 from public.jobs where id = p_job_id and customer_id = auth.uid()) $$;

-- The signed-in trade has been offered this job (any status) or matched to it.
create function private.trade_can_see_job(p_job_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.job_offers where job_id = p_job_id and trade_id = auth.uid())
$$;

create function private.is_match_party(p_match_id uuid, p_live_only boolean)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.job_matches m
    join public.jobs j on j.id = m.job_id
    where m.id = p_match_id
      and auth.uid() in (m.trade_id, j.customer_id)
      and (not p_live_only or m.ended_at is null)
  )
$$;

create function private.is_approved_trade(p_trade_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select exists (select 1 from public.trades where id = p_trade_id and status = 'approved') $$;

-- Storage paths start with an id folder; this returns null instead of failing
-- when the folder isn't a valid id.
create function private.try_uuid(p_value text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return p_value::uuid;
exception when invalid_text_representation then
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Function permissions
-- ---------------------------------------------------------------------------

-- Nothing in `private` is callable through the API; policies get the few
-- helpers they need.
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function
  private.is_admin(),
  private.my_role(),
  private.is_job_customer(uuid),
  private.trade_can_see_job(uuid),
  private.is_match_party(uuid, boolean),
  private.is_approved_trade(uuid),
  private.try_uuid(text)
to anon, authenticated;

-- The app's API: signed-in users only. Each function checks the caller.
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
revoke execute on function public.handle_new_user(), public.sync_auth_contact_details(), public.set_updated_at()
  from authenticated;
grant execute on function public.normalise_key(text), public.postcode_district(text) to anon;

-- ---------------------------------------------------------------------------
-- Table permissions: start from nothing, then grant what's needed
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

do $$
declare
  v_table text;
begin
  for v_table in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', v_table);
  end loop;
end;
$$;

-- Reference data anyone can read (the website's job form uses it).
grant select on public.trade_categories, public.towns, public.town_neighbours, public.postcode_districts
  to anon, authenticated;
create policy "Anyone can read categories" on public.trade_categories for select using (true);
create policy "Anyone can read towns" on public.towns for select using (true);
create policy "Anyone can read neighbours" on public.town_neighbours for select using (true);
create policy "Anyone can read districts" on public.postcode_districts for select using (true);

-- Admins manage reference data.
grant insert, update, delete on public.trade_categories, public.towns, public.town_neighbours,
  public.postcode_districts to authenticated;
create policy "Admins manage categories" on public.trade_categories for all
  using (private.is_admin()) with check (private.is_admin());
create policy "Admins manage towns" on public.towns for all
  using (private.is_admin()) with check (private.is_admin());
create policy "Admins manage neighbours" on public.town_neighbours for all
  using (private.is_admin()) with check (private.is_admin());
create policy "Admins manage districts" on public.postcode_districts for all
  using (private.is_admin()) with check (private.is_admin());

-- profiles
grant select on public.profiles to authenticated;
grant update (full_name) on public.profiles to authenticated;
create policy "Read own profile, admins read all" on public.profiles for select
  using (id = auth.uid() or private.is_admin());
create policy "Update own name" on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- admin_invites
grant select, insert, delete on public.admin_invites to authenticated;
create policy "Admins manage invites" on public.admin_invites for all
  using (private.is_admin()) with check (private.is_admin());

-- trades: a trade account creates and edits its own business details;
-- status, approval and pausing only change through functions.
grant select on public.trades to authenticated;
grant insert (id, business_name, business_type, company_number, bio, can_take_large_jobs, accepts_callouts)
  on public.trades to authenticated;
grant update (business_name, business_type, company_number, bio, can_take_large_jobs, accepts_callouts)
  on public.trades to authenticated;
create policy "Read own business, admins read all" on public.trades for select
  using (id = auth.uid() or private.is_admin());
create policy "Trade accounts create their business" on public.trades for insert
  with check (id = auth.uid() and private.my_role() = 'trade');
create policy "Trades edit their business" on public.trades for update
  using (id = auth.uid()) with check (id = auth.uid());

-- trade_category_links and trade_towns: a trade's own picks.
grant select, insert, delete on public.trade_category_links, public.trade_towns to authenticated;
create policy "Trades manage their categories" on public.trade_category_links for all
  using (trade_id = auth.uid() or private.is_admin()) with check (trade_id = auth.uid());
create policy "Trades manage their towns" on public.trade_towns for all
  using (trade_id = auth.uid() or private.is_admin()) with check (trade_id = auth.uid());

-- trade_photos: public for approved trades (the bucket is public too).
grant select on public.trade_photos to anon, authenticated;
grant insert (trade_id, storage_path, caption, sort_order), update (caption, sort_order), delete
  on public.trade_photos to authenticated;
create policy "Anyone sees approved trades' photos" on public.trade_photos for select
  using (private.is_approved_trade(trade_id) or trade_id = auth.uid() or private.is_admin());
create policy "Trades add photos" on public.trade_photos for insert
  with check (trade_id = auth.uid());
create policy "Trades edit photos" on public.trade_photos for update
  using (trade_id = auth.uid()) with check (trade_id = auth.uid());
create policy "Trades remove photos" on public.trade_photos for delete
  using (trade_id = auth.uid());

-- Vetting: trades upload; only admins review.
grant select on public.trade_documents, public.trade_registrations, public.id_checks to authenticated;
grant insert (trade_id, doc_type, storage_path, expires_on) on public.trade_documents to authenticated;
grant update (status, reviewed_by, reviewed_at, notes, expires_on) on public.trade_documents to authenticated;
grant insert (trade_id, scheme, registration_number, expires_on) on public.trade_registrations to authenticated;
grant update (status, reviewed_by, reviewed_at, registration_number, expires_on)
  on public.trade_registrations to authenticated;
grant insert (trade_id, image_paths) on public.id_checks to authenticated;
grant update (provider, result, checked_by, checked_at) on public.id_checks to authenticated;

create policy "Own documents, admins see all" on public.trade_documents for select
  using (trade_id = auth.uid() or private.is_admin());
create policy "Trades upload documents" on public.trade_documents for insert
  with check (trade_id = auth.uid());
create policy "Admins review documents" on public.trade_documents for update
  using (private.is_admin()) with check (private.is_admin());

create policy "Own registrations, admins see all" on public.trade_registrations for select
  using (trade_id = auth.uid() or private.is_admin());
create policy "Trades add registrations" on public.trade_registrations for insert
  with check (trade_id = auth.uid());
create policy "Admins review registrations" on public.trade_registrations for update
  using (private.is_admin()) with check (private.is_admin());

create policy "Own ID checks, admins see all" on public.id_checks for select
  using (trade_id = auth.uid() or private.is_admin());
create policy "Trades start an ID check" on public.id_checks for insert
  with check (trade_id = auth.uid());
create policy "Admins record ID results" on public.id_checks for update
  using (private.is_admin()) with check (private.is_admin());

-- Queues: read-only (caps change through set_queue_cap).
grant select on public.queues, public.queue_members to authenticated;
create policy "Signed-in users read queues" on public.queues for select using (true);
create policy "Trades see their own places" on public.queue_members for select
  using (trade_id = auth.uid() or private.is_admin());

-- Jobs: customers see their own; trades see jobs they've been offered;
-- nobody writes directly (post_job, cancel_job etc. do that).
grant select on public.jobs, public.job_addresses, public.job_photos to authenticated;
create policy "Customers, offered trades and admins see jobs" on public.jobs for select
  using (customer_id = auth.uid() or private.trade_can_see_job(id) or private.is_admin());
-- Full postcode and address: never offered trades (they use get_match_contact
-- once matched).
create policy "Customers and admins see addresses" on public.job_addresses for select
  using (private.is_job_customer(job_id) or private.is_admin());

grant insert (job_id, storage_path), delete on public.job_photos to authenticated;
create policy "Customers, offered trades and admins see job photos" on public.job_photos for select
  using (private.is_job_customer(job_id) or private.trade_can_see_job(job_id) or private.is_admin());
create policy "Customers add photos to open jobs" on public.job_photos for insert
  with check (
    private.is_job_customer(job_id)
    and exists (select 1 from public.jobs where id = job_id and status in ('offering', 'matched'))
  );
create policy "Customers remove their job photos" on public.job_photos for delete
  using (private.is_job_customer(job_id));

-- Offers: only the trade it was offered to (and admins). Customers never see
-- offers, so there are no visible competing trades.
grant select on public.job_offers to authenticated;
create policy "Trades see their offers" on public.job_offers for select
  using (trade_id = auth.uid() or private.is_admin());

grant select on public.job_matches to authenticated;
create policy "Both sides of a match and admins see it" on public.job_matches for select
  using (private.is_match_party(id, false) or private.is_admin());

-- Messages: both sides of a live match.
grant select on public.messages to authenticated;
grant insert (match_id, body), update (read_at) on public.messages to authenticated;
create policy "Both sides read messages" on public.messages for select
  using (private.is_match_party(match_id, false) or private.is_admin());
create policy "Both sides send messages" on public.messages for insert
  with check (sender_id = auth.uid() and private.is_match_party(match_id, true));
create policy "Recipients mark messages read" on public.messages for update
  using (sender_id <> auth.uid() and private.is_match_party(match_id, false))
  with check (sender_id <> auth.uid());

-- Reviews: public once released (and not hidden). The customer always sees
-- their own; the trade only sees them once released (blind).
grant select on public.reviews to anon, authenticated;
grant update (hidden_at, hidden_reason) on public.reviews to authenticated;
create policy "Anyone reads released reviews" on public.reviews for select
  using ((released_at is not null and hidden_at is null) or customer_id = auth.uid() or private.is_admin());
create policy "Admins moderate reviews" on public.reviews for update
  using (private.is_admin()) with check (private.is_admin());

-- Customer ratings: never shown to customers. Trades see the ones they
-- wrote; averages come from job_customer_rating().
grant select on public.customer_ratings to authenticated;
create policy "Trades see ratings they gave" on public.customer_ratings for select
  using (trade_id = auth.uid() or private.is_admin());

-- Reports
grant select, insert (job_id, about_user_id, reason, details) on public.reports to authenticated;
grant update (status, resolved_by, resolved_at, resolution_note) on public.reports to authenticated;
create policy "Own reports, admins see all" on public.reports for select
  using (reporter_id = auth.uid() or private.is_admin());
create policy "Signed-in users report problems" on public.reports for insert
  with check (reporter_id = auth.uid());
create policy "Admins resolve reports" on public.reports for update
  using (private.is_admin()) with check (private.is_admin());

-- Subscriptions: read-only; the Stripe webhook writes with the secret key.
grant select on public.subscriptions to authenticated;
create policy "Trades see their subscription" on public.subscriptions for select
  using (trade_id = auth.uid() or private.is_admin());

-- Push tokens: your own devices.
grant select, insert (token, platform), update (last_seen_at), delete on public.push_tokens to authenticated;
create policy "Own push tokens" on public.push_tokens for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Outbox: admins can look (for support); only the engine writes.
grant select on public.notification_outbox to authenticated;
create policy "Admins read the outbox" on public.notification_outbox for select
  using (private.is_admin());

-- Settings: everyone signed in can read (the app shows the reply window);
-- admins change them.
grant select, update on public.app_settings to authenticated;
create policy "Signed-in users read settings" on public.app_settings for select using (true);
create policy "Admins change settings" on public.app_settings for update
  using (private.is_admin()) with check (private.is_admin());

grant select, update (resolved_at, resolved_by) on public.admin_alerts to authenticated;
create policy "Admins see alerts" on public.admin_alerts for select using (private.is_admin());
create policy "Admins resolve alerts" on public.admin_alerts for update
  using (private.is_admin()) with check (private.is_admin());

grant select on public.admin_audit_log to authenticated;
create policy "Admins read the audit log" on public.admin_audit_log for select using (private.is_admin());

-- ---------------------------------------------------------------------------
-- Storage: files sit under a folder named after the trade or job id
-- ---------------------------------------------------------------------------

create policy "Trades upload their documents" on storage.objects for insert to authenticated
  with check (bucket_id in ('trade-documents', 'id-checks')
    and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Trades and admins read vetting files" on storage.objects for select to authenticated
  using (bucket_id in ('trade-documents', 'id-checks')
    and ((storage.foldername(name))[1] = auth.uid()::text or private.is_admin()));

create policy "Trades upload portfolio photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'trade-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Trades replace portfolio photos" on storage.objects for update to authenticated
  using (bucket_id = 'trade-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Trades delete portfolio photos" on storage.objects for delete to authenticated
  using (bucket_id = 'trade-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Customers upload job photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'job-photos'
    and private.is_job_customer(private.try_uuid((storage.foldername(name))[1])));
create policy "Customers delete job photos" on storage.objects for delete to authenticated
  using (bucket_id = 'job-photos'
    and private.is_job_customer(private.try_uuid((storage.foldername(name))[1])));
create policy "Customers, offered trades and admins read job photos" on storage.objects for select to authenticated
  using (bucket_id = 'job-photos' and (
    private.is_job_customer(private.try_uuid((storage.foldername(name))[1]))
    or private.trade_can_see_job(private.try_uuid((storage.foldername(name))[1]))
    or private.is_admin()));
