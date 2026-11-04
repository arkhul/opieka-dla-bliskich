-- Migration: caregiver_profile_delete
-- Purpose: a caregiver can permanently delete their own profile (slice S-06, FR-003, PRD NFR "Opiekun może trwale
-- usunąć swój profil wraz z danymi kontaktowymi; po usunięciu profil nie pojawia się w żadnych wynikach"):
--   * public.caregiver_profiles - new delete policy for the owner and the matching delete grant for authenticated
-- Decisions (S-06):
--   * Only the profile goes away; the login account (auth.users, public.accounts) and its role stay, so the caregiver
--     can create a new profile later. Deleting the whole account is a separate change.
--   * Hard and immediate delete: no deleted_at flag, no grace period.
--   * The dependent rows go with the profile through the existing foreign keys with on delete cascade:
--     caregiver_contacts, caregiver_gminas, caregiver_services (20261103150000_caregiver_profiles.sql) and
--     caregiver_availability (20261104120000_caregiver_availability.sql). Referential actions run with the
--     privileges of the table owner and are not subject to RLS, so no delete grant or policy is needed on those
--     tables (caregiver_contacts keeps having no delete at all).
--   * search_caregivers(), count_caregivers_relaxed() and get_public_caregiver() read the tables live, so a deleted
--     profile disappears from every result at once.
--   * Deployment order: this migration first (supabase db push), then the Worker (wrangler deploy). The old Worker
--     has no delete action, so the new policy alone changes nothing for it.
-- No data changes, no function changes. Table privileges follow 20261103230000_table_grants_mirror_policies.sql:
-- the table already has explicit grants, so only delete is added (no revoke all). Resulting matrix (25 rows):
--   services, gminas        - anon: select;  authenticated: select
--   accounts                - authenticated: select
--   caregiver_profiles      - anon: select;  authenticated: select, insert, update, delete   (+1 row: delete)
--   caregiver_contacts      - authenticated: select, insert, update
--   caregiver_gminas        - anon: select;  authenticated: select, insert, delete
--   caregiver_services      - anon: select;  authenticated: select, insert, delete
--   caregiver_availability  - anon: select;  authenticated: select, insert, delete
-- Rollback: drop policy caregiver_profiles_delete_authenticated on public.caregiver_profiles;
--           revoke delete on public.caregiver_profiles from authenticated;

-- ---------------------------------------------------------------------------
-- Profile delete: only the owner. No role check: a profile row can exist only for a caregiver (insert policy).
-- PostgREST answers a delete of someone else's row with 0 deleted rows, not an error.
-- ---------------------------------------------------------------------------
create policy caregiver_profiles_delete_authenticated on public.caregiver_profiles
  for delete to authenticated
  using (user_id = (select auth.uid()));

comment on policy caregiver_profiles_delete_authenticated on public.caregiver_profiles is
  'Only the owner can delete their caregiver profile. The foreign key cascade deletes the contact, gminas, services and availability with it; the login account stays.';

-- No grant for anon: an anonymous delete fails on the missing privilege before RLS is consulted.
grant delete on public.caregiver_profiles to authenticated;
