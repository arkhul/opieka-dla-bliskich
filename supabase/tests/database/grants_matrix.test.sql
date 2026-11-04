-- pgTAP: grant matrix for anon / authenticated on public (test-plan.md risk #4).
-- One transaction, rolled back at the end. No fixtures and no impersonation: it reads the catalog only.
--
-- Why this exists: scripts/check-table-grants.sql proves only the absence of TRUNCATE / REFERENCES /
-- TRIGGER. It does not notice an extra `grant delete ... to anon`, a view, a sequence, a table without
-- RLS or a function that kept the default PUBLIC EXECUTE. This file pins the exact grants.
--
-- Oracle (literal, derived from the migrations, never from a query over the current state):
--   Tables, 25 (role, privilege) rows, from
--     20261103230000_table_grants_mirror_policies.sql:19-56  (gminas, services, accounts,
--       caregiver_profiles, caregiver_contacts, caregiver_gminas, caregiver_services)
--     20261104160000_caregiver_profile_delete.sql:19-26       (the 25-row matrix, caregiver_profiles delete)
--     20261104120000_caregiver_availability.sql:70-72         (caregiver_availability)
--   Functions, from the revoke/grant lines of
--     20260924120000_create_dictionaries.sql:119-120     normalize_pl, search_gminas: plain grant to
--       anon + authenticated, no revoke, so PUBLIC keeps EXECUTE (pure helper + dictionary lookup)
--     20261103150000_caregiver_profiles.sql:407-413       handle_new_user: nobody; save_caregiver_profile:
--       authenticated only; caregiver_profile_missing: anon + authenticated
--     20261103170000_caregiver_gminas_limit.sql:59        enforce_caregiver_gminas_limit: nobody
--     20261104120000_caregiver_availability.sql:416-423   save_caregiver_profile(7 args), search_caregivers,
--       get_public_caregiver
--     20261104150000_search_ignores_unknown_selections.sql:250-254   search_caregivers, count_caregivers_relaxed
--
-- Adding a table or function means updating the literals below on purpose: the lists are compared as
-- sets, so a forgotten revoke/grant (or a new object) turns this file red.

begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

-- 1. Table / view / sequence privileges of anon and authenticated: exactly the documented 25 rows.
--    Read from pg_class.relacl via aclexplode (information_schema.role_table_grants filters by the
--    current role and would hide grants).
select set_eq(
  $$select c.relname::text, a.grantee::regrole::text, a.privilege_type::text
      from pg_class c
      cross join lateral aclexplode(c.relacl) a
     where c.relnamespace = 'public'::regnamespace
       and c.relkind in ('r', 'p', 'v', 'm', 'f', 'S')
       and a.grantee::regrole::text in ('anon', 'authenticated')$$,
  $$values
      -- dictionaries: read-only for everyone (2 + 2)
      ('gminas', 'anon', 'SELECT'),
      ('gminas', 'authenticated', 'SELECT'),
      ('services', 'anon', 'SELECT'),
      ('services', 'authenticated', 'SELECT'),
      -- accounts: read own row only, no write grant at all (1)
      ('accounts', 'authenticated', 'SELECT'),
      -- caregiver_profiles: public read, authenticated may write (5)
      ('caregiver_profiles', 'anon', 'SELECT'),
      ('caregiver_profiles', 'authenticated', 'SELECT'),
      ('caregiver_profiles', 'authenticated', 'INSERT'),
      ('caregiver_profiles', 'authenticated', 'UPDATE'),
      ('caregiver_profiles', 'authenticated', 'DELETE'),
      -- caregiver_contacts: never anon; no delete (3)
      ('caregiver_contacts', 'authenticated', 'SELECT'),
      ('caregiver_contacts', 'authenticated', 'INSERT'),
      ('caregiver_contacts', 'authenticated', 'UPDATE'),
      -- child tables: public read, authenticated insert + delete, no update (4 each)
      ('caregiver_gminas', 'anon', 'SELECT'),
      ('caregiver_gminas', 'authenticated', 'SELECT'),
      ('caregiver_gminas', 'authenticated', 'INSERT'),
      ('caregiver_gminas', 'authenticated', 'DELETE'),
      ('caregiver_services', 'anon', 'SELECT'),
      ('caregiver_services', 'authenticated', 'SELECT'),
      ('caregiver_services', 'authenticated', 'INSERT'),
      ('caregiver_services', 'authenticated', 'DELETE'),
      ('caregiver_availability', 'anon', 'SELECT'),
      ('caregiver_availability', 'authenticated', 'SELECT'),
      ('caregiver_availability', 'authenticated', 'INSERT'),
      ('caregiver_availability', 'authenticated', 'DELETE')
  $$,
  'anon / authenticated hold exactly the documented 25 table privileges (no extras, no missing)'
);

-- 2. Nothing is granted to PUBLIC on any relation of public (a PUBLIC grant reaches anon too).
select is_empty(
  $$select c.relname::text, a.privilege_type::text
      from pg_class c
      cross join lateral aclexplode(c.relacl) a
     where c.relnamespace = 'public'::regnamespace
       and c.relkind in ('r', 'p', 'v', 'm', 'f', 'S')
       and a.grantee = 0$$,
  'no relation in public is granted to PUBLIC'
);

-- 3. The set of tables is the known 8, so a new table forces this file (matrix + RLS) to be updated.
select set_eq(
  $$select c.relname::text from pg_class c
     where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p')$$,
  $$values ('accounts'), ('caregiver_availability'), ('caregiver_contacts'), ('caregiver_gminas'),
           ('caregiver_profiles'), ('caregiver_services'), ('gminas'), ('services')$$,
  'public holds exactly the 8 known tables'
);

-- 4. RLS is enabled on every table of public.
select is_empty(
  $$select c.relname::text from pg_class c
     where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p') and not c.relrowsecurity$$,
  'row level security is enabled on every table in public'
);

-- Functions of public that are not owned by an extension. EXECUTE as seen by each role (including what
-- the role inherits through PUBLIC).
-- 5. anon may execute exactly the read / lookup functions; never save_caregiver_profile or trigger functions.
select set_eq(
  $$select p.proname || '(' || oidvectortypes(p.proargtypes) || ')'
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
       and has_function_privilege('anon', p.oid, 'EXECUTE')$$,
  $$values
      ('caregiver_profile_missing(uuid)'),
      ('count_caregivers_relaxed(text, text[])'),
      ('get_public_caregiver(uuid)'),
      ('normalize_pl(text)'),
      ('search_caregivers(text, text[], text[], integer, integer)'),
      ('search_gminas(text, integer)')
  $$,
  'anon can execute exactly the 6 documented read / lookup functions'
);

-- 6. authenticated: the same plus save_caregiver_profile. handle_new_user and the limit trigger function
--    are executable by nobody.
select set_eq(
  $$select p.proname || '(' || oidvectortypes(p.proargtypes) || ')'
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
       and has_function_privilege('authenticated', p.oid, 'EXECUTE')$$,
  $$values
      ('caregiver_profile_missing(uuid)'),
      ('count_caregivers_relaxed(text, text[])'),
      ('get_public_caregiver(uuid)'),
      ('normalize_pl(text)'),
      ('save_caregiver_profile(text, text, text, text, text[], text[], text[])'),
      ('search_caregivers(text, text[], text[], integer, integer)'),
      ('search_gminas(text, integer)')
  $$,
  'authenticated can execute exactly the 7 documented functions'
);

-- 7. The default PUBLIC EXECUTE survives only on the two helpers that never had a revoke. A new function
--    without `revoke execute ... from public` shows up here (and in 5 and 6).
select set_eq(
  $$select p.proname || '(' || oidvectortypes(p.proargtypes) || ')'
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
       and exists (
         select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
          where a.grantee = 0 and a.privilege_type = 'EXECUTE'
       )$$,
  $$values ('normalize_pl(text)'), ('search_gminas(text, integer)')$$,
  'PUBLIC keeps EXECUTE only on normalize_pl and search_gminas'
);

select * from finish();
rollback;
