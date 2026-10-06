-- Account deletion goes through the delete-account Edge Function only.

begin;
select plan(1);

select hasnt_function('public', 'delete_my_account', 'the database-only delete (no Stripe cancel, no file clean-up) is gone');

select * from finish();
rollback;
