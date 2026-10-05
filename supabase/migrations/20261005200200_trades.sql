-- Backed. database, step 3: trade businesses and the work they do.

create type public.trade_status as enum ('applied', 'approved', 'rejected', 'suspended');
create type public.business_type as enum ('sole_trader', 'partnership', 'limited_company');
create type public.pause_reason as enum ('self', 'missed_offers', 'admin');

-- One row per trade business; its id is the business's login.
create table public.trades (
  id uuid primary key references public.profiles on delete cascade,
  business_name text not null check (length(trim(business_name)) > 0),
  business_type public.business_type not null,
  company_number text check (company_number = public.normalise_key(company_number)),
  bio text not null default '',
  -- "Can take on larger projects": larger projects skip members who haven't
  -- ticked this, without costing them their place.
  can_take_large_jobs boolean not null default false,
  -- Opt-in to call-outs (emergencies, 30-minute reply window).
  accepts_callouts boolean not null default false,
  status public.trade_status not null default 'applied',
  applied_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references auth.users on delete set null,
  rejection_reason text,
  -- Founders' manual Companies House check.
  company_checked_at timestamptz,
  paused_at timestamptz,
  paused_reason public.pause_reason,
  -- Offers that ran out with no reply, in a row (any queue).
  consecutive_misses integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (business_type <> 'limited_company' or company_number is not null),
  check ((paused_at is null) = (paused_reason is null))
);

create trigger trades_updated_at before update on public.trades
  for each row execute function public.set_updated_at();

create table public.trade_categories (
  id smallint generated always as identity primary key,
  slug text not null unique,
  name text not null,
  sort_order smallint not null,
  active boolean not null default true
);

insert into public.trade_categories (slug, name, sort_order) values
  ('plumber', 'Plumber', 1),
  ('electrician', 'Electrician', 2),
  ('gas-heating', 'Gas and heating engineer', 3),
  ('builder', 'Builder', 4),
  ('bricklayer', 'Bricklayer', 5),
  ('roofer', 'Roofer', 6),
  ('joiner-carpenter', 'Joiner and carpenter', 7),
  ('plasterer', 'Plasterer', 8),
  ('painter-decorator', 'Painter and decorator', 9),
  ('tiler', 'Tiler', 10),
  ('flooring', 'Flooring fitter', 11),
  ('kitchen-fitter', 'Kitchen fitter', 12),
  ('bathroom-fitter', 'Bathroom fitter', 13),
  ('windows-doors', 'Windows and doors', 14),
  ('locksmith', 'Locksmith', 15),
  ('landscaper-gardener', 'Landscaper and gardener', 16),
  ('fencing', 'Fencing', 17),
  ('driveways-paving', 'Driveways and paving', 18),
  ('handyman', 'Handyman', 19),
  ('damp-waterproofing', 'Damp and waterproofing', 20),
  ('other', 'Other', 21);

create table public.trade_category_links (
  trade_id uuid not null references public.trades on delete cascade,
  category_id smallint not null references public.trade_categories,
  primary key (trade_id, category_id)
);

-- Portfolio photos, in the public "trade-photos" bucket under {trade_id}/.
create table public.trade_photos (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid not null references public.trades on delete cascade,
  storage_path text not null unique,
  caption text not null default '',
  sort_order smallint not null default 0,
  created_at timestamptz not null default now()
);

create index on public.trade_photos (trade_id);
