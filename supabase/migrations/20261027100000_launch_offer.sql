-- The launch offer: join before 1 January 2027 and the first £14.99 covers you until then; after
-- that you pay the founding price of your plan, and keep it while you stay a member. From 1 January
-- new members pay the standard price.
--
-- membership_offer() is what the website's membership page and the create-checkout function both
-- ask, so they can't disagree:
--   founding    the founding price applies (the founding switch is on, and the end date hasn't passed)
--   intro_until the end date, while there's room for a Stripe subscription to start on it (Stripe
--               needs 48 hours' notice; 49 here). In the last two days, new members get the founding
--               price straight away with no covered-until period.

alter table public.app_settings
  add column launch_offer_ends_at timestamptz not null default '2027-01-01 00:00:00+00';

create function public.membership_offer()
returns table (founding boolean, intro_until timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.founding_pricing_open and now() < s.launch_offer_ends_at,
    case when s.founding_pricing_open and s.launch_offer_ends_at - now() >= interval '49 hours'
      then s.launch_offer_ends_at end
  from public.app_settings s
$$;

revoke execute on function public.membership_offer() from public, anon;
grant execute on function public.membership_offer() to authenticated, service_role;
