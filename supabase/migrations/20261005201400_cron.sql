-- Backed. database, step 15: timers.
--
-- Every minute: expire offers, top up offers, send call-out waves, alert on
-- unmatched jobs and missed contact, auto-close jobs, release ratings.
-- Every morning (8am UTC): insurance expiry warnings.

create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule('backed-engine', '* * * * *', $$select private.run_engine()$$);
select cron.schedule('backed-daily', '0 8 * * *', $$select private.run_daily()$$);
