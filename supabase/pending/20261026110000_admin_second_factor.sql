-- ON HOLD: move this into supabase/migrations/ only once the website with the second-step screen is live
-- and every founder has enrolled an authenticator app. Pushing it earlier locks founders out of admin data.

-- Founders need a second step (an authenticator-app code) as well as their password.
-- A founder who has only typed their password has a session at level "aal1"; once they enter
-- the code it becomes "aal2". is_admin() is what every admin policy and admin function asks,
-- so from now on an aal1 session sees and changes nothing admin-only.
--
-- Ship the website's second-step screen (src/app/admin/two-step.tsx) first, and make sure
-- each founder has enrolled an authenticator app, or they'll be signed in but see no data.

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
$$;
