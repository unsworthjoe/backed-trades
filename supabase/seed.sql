-- Local development only (runs after migrations on `supabase db reset`).
-- The live project's admin invites are added by hand.
insert into public.admin_invites (email) values ('joe@backedtrades.co.uk');
