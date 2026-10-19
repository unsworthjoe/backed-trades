-- Where a register-interest sign-up came from: the ?from= tag on the link they followed
-- (for example backedtrades.co.uk/?from=fb-runcorn-trades), so we can see which flyers, groups
-- and merchant counters bring people in. Null = no tag.

alter table public.interest_signups
  add column source text check (source ~ '^[a-z0-9_-]{1,40}$');
