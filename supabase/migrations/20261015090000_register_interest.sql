-- "Register your interest" on the coming-soon page: people leave an email address to be told
-- when Backed. is live near them. Sign-ups only arrive through the register-interest Edge
-- Function (it checks Turnstile first), so the public can't read or write this table directly.
-- Founders see the list on /admin/interest. The privacy policy promises deletion 12 months after
-- someone signs up (or signs up again).

create table public.interest_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(email) and length(email) <= 254),
  kind text not null check (kind in ('customer', 'trade')),
  -- Only for trades. Null town = "somewhere else".
  category_id smallint references public.trade_categories on delete set null,
  town_id smallint references public.towns on delete set null,
  signed_up_at timestamptz not null default now(),
  check (kind = 'trade' or category_id is null)
);

alter table public.interest_signups enable row level security;

revoke all on public.interest_signups from anon, authenticated;
grant select, delete on public.interest_signups to authenticated;
create policy "Admins see interest" on public.interest_signups for select using (private.is_admin());
create policy "Admins remove interest" on public.interest_signups for delete using (private.is_admin());

create function private.delete_old_interest()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.interest_signups where signed_up_at < now() - interval '12 months';
$$;

create or replace function private.run_cleanup()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.delete_old_reports();
  perform private.prune_outbox();
  perform private.delete_old_interest();
  perform private.wake_job_cleanup();
end;
$$;

revoke execute on function private.delete_old_interest(), private.run_cleanup() from public, anon, authenticated;
