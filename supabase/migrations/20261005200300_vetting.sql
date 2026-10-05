-- Backed. database, step 4: vetting.
--
-- Trades apply free; the founders check their documents and approve them,
-- and only then can they subscribe. ID images are deleted 30 days after
-- approval (only the check result is kept); insurance documents are kept
-- while the trade is a member.

create type public.document_type as enum ('public_liability_insurance', 'other');
create type public.review_status as enum ('pending', 'approved', 'rejected');
create type public.registration_scheme as enum (
  'gas_safe', 'niceic', 'napit', 'fensa', 'certass', 'oftec', 'other'
);
create type public.id_check_result as enum ('pending', 'passed', 'failed', 'refer');

-- Files live in the private "trade-documents" bucket under {trade_id}/.
create table public.trade_documents (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid not null references public.trades on delete cascade,
  doc_type public.document_type not null,
  storage_path text not null unique,
  expires_on date,
  status public.review_status not null default 'pending',
  reviewed_by uuid references auth.users on delete set null,
  reviewed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  check (doc_type <> 'public_liability_insurance' or expires_on is not null)
);

create index on public.trade_documents (trade_id);

-- Statutory registers: Gas Safe, NICEIC/NAPIT, FENSA/CERTASS, OFTEC.
create table public.trade_registrations (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid not null references public.trades on delete cascade,
  scheme public.registration_scheme not null,
  registration_number text not null,
  expires_on date,
  status public.review_status not null default 'pending',
  reviewed_by uuid references auth.users on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (trade_id, scheme)
);

-- Images live in the private "id-checks" bucket under {trade_id}/. Only the
-- result is kept once images_purge_after has passed.
create table public.id_checks (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid not null references public.trades on delete cascade,
  provider text not null default 'manual',
  result public.id_check_result not null default 'pending',
  image_paths text[] not null default '{}',
  checked_by uuid references auth.users on delete set null,
  checked_at timestamptz,
  -- Set to approval + 30 days when the trade is approved.
  images_purge_after timestamptz,
  images_purged_at timestamptz,
  created_at timestamptz not null default now()
);

create index on public.id_checks (trade_id);

insert into storage.buckets (id, name, public) values
  ('trade-documents', 'trade-documents', false),
  ('id-checks', 'id-checks', false),
  ('trade-photos', 'trade-photos', true),
  ('job-photos', 'job-photos', false);
