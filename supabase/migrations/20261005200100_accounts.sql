-- Backed. database, step 2: accounts.
--
-- Three kinds of account, decided by how they sign up:
--   * customers sign in with a UK phone number and a text code,
--   * trades sign up with email and password (one login per business),
--   * admins are invite-only: their email must be in admin_invites first.

create type public.user_role as enum ('customer', 'trade', 'admin');

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  role public.user_role not null,
  full_name text not null default '',
  -- Copied from auth.users, so they stay in step with sign-in details.
  phone text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create table public.admin_invites (
  email text primary key check (email = lower(email)),
  invited_by uuid references auth.users on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  )
$$;

create function private.my_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$ select role from public.profiles where id = auth.uid() $$;

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := coalesce(new.raw_user_meta_data ->> 'full_name', '');
begin
  if new.email is not null
    and exists (select 1 from public.admin_invites where email = lower(new.email)) then
    insert into public.profiles (id, role, full_name, email, phone)
      values (new.id, 'admin', v_name, lower(new.email), new.phone);
    delete from public.admin_invites where email = lower(new.email);
    return new;
  end if;

  -- Trades sign up with email and password.
  if new.email is not null then
    insert into public.profiles (id, role, full_name, email, phone)
      values (new.id, 'trade', v_name, lower(new.email), new.phone);
    return new;
  end if;

  -- Customers sign in with their phone. Auth stores numbers without the "+".
  if new.phone is not null then
    if new.phone not like '44%' then
      raise exception 'UK_NUMBERS_ONLY';
    end if;
    insert into public.profiles (id, role, full_name, phone)
      values (new.id, 'customer', v_name, new.phone);
    return new;
  end if;

  raise exception 'SIGNUP_NOT_ALLOWED';
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keeps profiles.phone and profiles.email in step when a trade verifies their
-- phone, or anyone changes their email.
create function public.sync_auth_contact_details()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
    set phone = new.phone, email = lower(new.email)
    where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_contact_changed
  after update of phone, email on auth.users
  for each row
  when (old.phone is distinct from new.phone or old.email is distinct from new.email)
  execute function public.sync_auth_contact_details();

-- Lets anyone delete their own account (Apple requires this for apps that
-- allow account creation).
create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- Trigger functions are never called directly.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.sync_auth_contact_details() from public, anon, authenticated;
