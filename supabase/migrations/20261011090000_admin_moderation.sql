-- Founders' tools for reports and reviews.
--
-- A new report becomes an admin alert, so every founder is emailed about it.
-- Resolving reports and hiding reviews go through functions that check the
-- caller is an admin, ask for a reason and write to the audit log. The direct
-- table updates the founders had before are taken away, so nothing skips it.

alter type public.admin_alert_kind add value 'report_filed';

create function private.alert_admins_about_report()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.alert_admins('report_filed', new.job_id, new.about_user_id,
    jsonb_build_object('report_id', new.id, 'reason', new.reason));
  return null;
end;
$$;

create trigger reports_alert_admins after insert on public.reports
  for each row execute function private.alert_admins_about_report();

-- ---------------------------------------------------------------------------
-- Reports
-- ---------------------------------------------------------------------------

-- 'resolved' or 'dismissed' closes a report (a note is required: what was
-- done, or why nothing was); 'open' reopens it.
create function public.resolve_report(p_report_id uuid, p_status public.report_status, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'ADMINS_ONLY';
  end if;
  if p_status <> 'open' and length(trim(coalesce(p_note, ''))) = 0 then
    raise exception 'REASON_REQUIRED';
  end if;

  if p_status = 'open' then
    update public.reports set status = 'open', resolved_by = null, resolved_at = null, resolution_note = null
      where id = p_report_id and status <> 'open';
  else
    update public.reports
      set status = p_status, resolved_by = auth.uid(), resolved_at = now(), resolution_note = trim(p_note)
      where id = p_report_id and status = 'open';
  end if;
  if not found then
    raise exception 'REPORT_NOT_FOUND';
  end if;

  update public.admin_alerts set resolved_at = case when p_status = 'open' then null else now() end,
                                 resolved_by = case when p_status = 'open' then null else auth.uid() end
    where kind = 'report_filed' and details->>'report_id' = p_report_id::text;

  perform private.audit(case when p_status = 'open' then 'reopen_report' else p_status::text || '_report' end,
    'reports', p_report_id::text, jsonb_build_object('note', p_note));
end;
$$;

-- ---------------------------------------------------------------------------
-- Reviews
-- ---------------------------------------------------------------------------

-- Hidden reviews disappear from the trade's profile, rating and reviews page.
-- UK law (DMCC Act 2024) doesn't allow hiding genuine reviews because they're
-- negative, so a reason is always recorded.
create function public.set_review_hidden(p_review_id uuid, p_hidden boolean, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'ADMINS_ONLY';
  end if;
  if p_hidden and length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'REASON_REQUIRED';
  end if;

  if p_hidden then
    update public.reviews set hidden_at = now(), hidden_reason = trim(p_reason)
      where id = p_review_id and hidden_at is null;
  else
    update public.reviews set hidden_at = null, hidden_reason = null
      where id = p_review_id and hidden_at is not null;
  end if;
  if not found then
    raise exception 'REVIEW_NOT_FOUND';
  end if;

  perform private.audit(case when p_hidden then 'hide_review' else 'show_review' end,
    'reviews', p_review_id::text, jsonb_build_object('reason', p_reason));
end;
$$;

revoke update (hidden_at, hidden_reason) on public.reviews from authenticated;
revoke update (status, resolved_by, resolved_at, resolution_note) on public.reports from authenticated;
drop policy "Admins moderate reviews" on public.reviews;
drop policy "Admins resolve reports" on public.reports;
