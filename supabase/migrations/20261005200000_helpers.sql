-- Backed. database, step 1: shared helpers.
--
-- Everything the queue engine and row level security policies use internally
-- lives in the `private` schema, which the public API doesn't expose. The
-- app's API is the security definer functions in `public`, each of which
-- checks the caller itself.

create schema if not exists private;
-- Policies run as the signed-in (or anonymous) user, so they need to reach
-- the helpers.
grant usage on schema private to anon, authenticated;

-- Uppercase and strip whitespace, so "wa7 1ab" matches "WA71AB".
create function public.normalise_key(value text)
returns text
language sql
immutable
set search_path = ''
as $$ select upper(regexp_replace(coalesce(value, ''), '\s', '', 'g')) $$;

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- The postcode district ("outward code") of a full UK postcode: everything
-- but the last three characters. "WA7 1AB" -> "WA7". Returns null when the
-- postcode is too short to be valid.
create function public.postcode_district(p_postcode text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when length(public.normalise_key(p_postcode)) between 5 and 7
      then left(public.normalise_key(p_postcode), length(public.normalise_key(p_postcode)) - 3)
  end
$$;

-- Adds working minutes to a moment, counting only the hours between
-- p_day_start and p_day_end, UK time (Europe/London, so it follows BST).
-- With 7am-8pm: 120 minutes from 7:30pm is 8:30am the next day, and 120
-- minutes from 10pm is 9am the next day.
create function private.working_minutes_add(
  p_from timestamptz,
  p_minutes integer,
  p_day_start time default '07:00',
  p_day_end time default '20:00'
)
returns timestamptz
language plpgsql
stable
set search_path = ''
as $$
declare
  v_local timestamp := p_from at time zone 'Europe/London';
  v_left numeric := p_minutes;
  v_available numeric;
begin
  if p_day_end <= p_day_start then
    raise exception 'INVALID_WORKING_HOURS';
  end if;

  loop
    if v_local::time < p_day_start then
      v_local := v_local::date + p_day_start;
    elsif v_local::time >= p_day_end then
      v_local := (v_local::date + 1) + p_day_start;
    end if;

    v_available := extract(epoch from ((v_local::date + p_day_end) - v_local)) / 60;
    if v_left <= v_available then
      return (v_local + make_interval(mins => v_left::integer)) at time zone 'Europe/London';
    end if;

    v_left := v_left - v_available;
    v_local := (v_local::date + 1) + p_day_start;
  end loop;
end;
$$;
