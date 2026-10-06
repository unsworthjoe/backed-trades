-- Deleting your own account now goes through the delete-account Edge Function,
-- which cancels a trade's Stripe membership and deletes their uploaded files
-- before the account. The database-only version skipped both, so it goes.

drop function public.delete_my_account();
