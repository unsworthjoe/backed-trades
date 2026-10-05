-- Backed. database, step 8: in-app messages between a customer and their
-- matched trade. Phone numbers come from get_match_contact() (engine step),
-- which only works for the two people in a live match.

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.job_matches on delete cascade,
  sender_id uuid not null references public.profiles on delete cascade default auth.uid(),
  body text not null check (length(trim(body)) between 1 and 4000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index on public.messages (match_id, created_at);

alter publication supabase_realtime add table public.messages;
