-- Backed. database, step 5: towns and queues.
--
-- There's one queue per town per trade category. A trade sits in a queue for
-- every town and category they picked. The lowest position is the front.
-- Winning a job moves them to the back of that queue only.

create table public.towns (
  id smallint generated always as identity primary key,
  slug text not null unique,
  name text not null,
  active boolean not null default true
);

insert into public.towns (slug, name) values
  ('runcorn', 'Runcorn'),
  ('widnes', 'Widnes'),
  ('warrington', 'Warrington');

-- Stored both ways round, so lookups only need one column.
create table public.town_neighbours (
  town_id smallint not null references public.towns on delete cascade,
  neighbour_id smallint not null references public.towns on delete cascade,
  primary key (town_id, neighbour_id),
  check (town_id <> neighbour_id)
);

insert into public.town_neighbours (town_id, neighbour_id)
select a.id, b.id
from public.towns a cross join public.towns b
where a.id <> b.id;

create table public.postcode_districts (
  district text primary key check (district = public.normalise_key(district)),
  town_id smallint not null references public.towns on delete cascade
);

insert into public.postcode_districts (district, town_id)
select d.district, t.id
from (values
  ('WA7', 'runcorn'),
  ('WA8', 'widnes'),
  ('WA1', 'warrington'),
  ('WA2', 'warrington'),
  ('WA3', 'warrington'),
  ('WA4', 'warrington'),
  ('WA5', 'warrington')
) as d (district, town_slug)
join public.towns t on t.slug = d.town_slug;

-- The towns a trade covers. Their queues follow from these and their
-- categories (see sync_my_queues).
create table public.trade_towns (
  trade_id uuid not null references public.trades on delete cascade,
  town_id smallint not null references public.towns on delete cascade,
  primary key (trade_id, town_id)
);

create table public.queues (
  id uuid primary key default gen_random_uuid(),
  town_id smallint not null references public.towns on delete cascade,
  category_id smallint not null references public.trade_categories on delete cascade,
  -- Active members allowed; anyone after that joins the waiting list.
  cap integer not null default 15 check (cap > 0),
  created_at timestamptz not null default now(),
  unique (town_id, category_id)
);

insert into public.queues (town_id, category_id)
select t.id, c.id from public.towns t cross join public.trade_categories c;

create type public.queue_member_status as enum ('active', 'waiting');

-- Positions come from one ever-increasing sequence, so "move to the back"
-- is just the next number and can't collide.
create sequence public.queue_position_seq;

create table public.queue_members (
  id uuid primary key default gen_random_uuid(),
  queue_id uuid not null references public.queues on delete cascade,
  trade_id uuid not null references public.trades on delete cascade,
  status public.queue_member_status not null,
  position bigint not null default nextval('public.queue_position_seq'),
  joined_at timestamptz not null default now(),
  -- Declines (including no reply) in a row in this queue; reset on accept.
  consecutive_declines integer not null default 0,
  -- "Not my kind of work" declines in this queue. Enough of them tune the
  -- member out of offers here (they keep their place and can switch back).
  not_my_kind_count integer not null default 0,
  tuned_out_at timestamptz,
  last_offered_at timestamptz,
  last_won_at timestamptz,
  unique (queue_id, trade_id)
);

create index on public.queue_members (queue_id, status, position);
create index on public.queue_members (trade_id);
