-- Migration: table_grants_mirror_policies
-- Purpose: make the table privileges of anon and authenticated equal to the explicit grants of
-- earlier migrations (finding F4 of the F-01 review).
-- Why: Supabase grants ALL table privileges in public to anon and authenticated by default, so the
-- explicit grants in 20260924120000_create_dictionaries.sql and 20261103150000_caregiver_profiles.sql
-- ("table grants mirror the policies") added nothing, and both roles kept INSERT/UPDATE/DELETE without
-- a policy, plus TRUNCATE, REFERENCES and TRIGGER. RLS does not apply to TRUNCATE, so a granted
-- TRUNCATE bypasses every policy (PostgREST does not expose it today, but nothing in the database
-- stopped it).
-- What: for every application table, revoke all from anon and authenticated, then grant back exactly
-- the privileges the earlier migrations granted. Revoke and grant run in this one migration (one
-- transaction), so there is no window without privileges.
-- Unchanged: policies, functions, data and service_role. SECURITY INVOKER functions
-- (save_caregiver_profile, search_gminas, search_caregivers, get_public_caregiver,
-- enforce_caregiver_gminas_limit) use only operations covered by the grants below.
-- Resulting matrix (20 rows):
--   services, gminas    - anon: select;  authenticated: select
--   accounts            - authenticated: select
--   caregiver_profiles  - anon: select;  authenticated: select, insert, update
--   caregiver_contacts  - authenticated: select, insert, update
--   caregiver_gminas    - anon: select;  authenticated: select, insert, delete
--   caregiver_services  - anon: select;  authenticated: select, insert, delete
-- New tables must follow the same pattern (AGENTS.md, Hard Rules): Supabase defaults still grant ALL.

-- ---------------------------------------------------------------------------
-- Dictionaries: read-only for both roles.
-- ---------------------------------------------------------------------------
revoke all on public.services from anon, authenticated;
grant select on public.services to anon, authenticated;

revoke all on public.gminas from anon, authenticated;
grant select on public.gminas to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Account roles: the owner reads their own row; nobody writes via the API.
-- ---------------------------------------------------------------------------
revoke all on public.accounts from anon, authenticated;
grant select on public.accounts to authenticated;

-- ---------------------------------------------------------------------------
-- Caregiver profiles and their lists.
-- ---------------------------------------------------------------------------
revoke all on public.caregiver_profiles from anon, authenticated;
grant select on public.caregiver_profiles to anon;
grant select, insert, update on public.caregiver_profiles to authenticated;

revoke all on public.caregiver_contacts from anon, authenticated;
grant select, insert, update on public.caregiver_contacts to authenticated;

revoke all on public.caregiver_gminas from anon, authenticated;
grant select on public.caregiver_gminas to anon;
grant select, insert, delete on public.caregiver_gminas to authenticated;

revoke all on public.caregiver_services from anon, authenticated;
grant select on public.caregiver_services to anon;
grant select, insert, delete on public.caregiver_services to authenticated;
