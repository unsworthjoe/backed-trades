-- The launch offer: who gets the founding price, and when the "covered until" period applies.

begin;
select plan(7);

update public.app_settings set founding_pricing_open = true, launch_offer_ends_at = now() + interval '10 days';
select is((select founding from public.membership_offer()), true, 'founding price while the offer is open');
select is((select intro_until is not null from public.membership_offer()), true, '...with the covered-until period');

update public.app_settings set launch_offer_ends_at = now() + interval '30 hours';
select is((select founding from public.membership_offer()), true, 'last two days: still the founding price');
select is((select intro_until from public.membership_offer()), null, '...but no covered-until period (Stripe needs 48 hours)');

update public.app_settings set launch_offer_ends_at = now() - interval '1 day';
select is((select founding from public.membership_offer()), false, 'after the end date: the standard price');

update public.app_settings set founding_pricing_open = false, launch_offer_ends_at = now() + interval '10 days';
select is((select founding from public.membership_offer()), false, 'the founding switch off: the standard price');

set local role anon;
select throws_ok($$select * from public.membership_offer()$$, '42501', null, 'signed-out visitors can''t call it');
reset role;

select * from finish();
rollback;
