-- pgTAP: write boundaries of anon / authenticated on public (test-plan.md risk #4).
-- One transaction, rolled back at the end: fixtures never persist.
--
-- First use of `authenticated` with JWT claims in this repo. auth.uid() reads request.jwt.claims, so every
-- section sets the claims for its actor (do-block with set_config(..., true)) and then `set local role`;
-- between sections `reset role` returns to postgres, which reads the victim's rows back. The first assertion
-- proves that impersonation works (auth.uid() = the given sub); without it the file could stay green on
-- uid = null.
--
-- Actors: V = victim (complete caregiver profile), M = another caregiver, C = coordinator, anon.
--
-- Oracle (literal, derived from the migrations and the write matrix in research.md, never from a query over
-- the state the test produced):
--   * Policies: 20261103150000_caregiver_profiles.sql (profiles insert needs role caregiver and
--     user_id = uid, update using + with check user_id = uid; contacts insert/update caregiver_id = uid;
--     caregiver_gminas / caregiver_services insert caregiver_id = uid, delete caregiver_id = uid; accounts has
--     a select policy only), 20261104120000_caregiver_availability.sql:61-67 (availability insert/delete),
--     20261104160000_caregiver_profile_delete.sql:34-42 (profile delete, owner only).
--   * Grants (25-row matrix, see grants_matrix.test.sql): caregiver_contacts has no delete and no anon grant;
--     caregiver_gminas / caregiver_services / caregiver_availability have no update grant; accounts has no
--     write grant for anyone; anon cannot write anything.
--   * Limit: 20261103170000_caregiver_gminas_limit.sql:54-56 rejects a 31st gmina (22023) when auth.uid()
--     is set.
--   Result shapes: an UPDATE / DELETE on a row the actor does not own returns zero rows, not an error; a
--   missing grant is 42501 `permission denied for ...`; a failed RLS check on INSERT / UPDATE is 42501
--   `new row violates row-level security policy for table ...`.
--
-- Fixtures (gmina codes are fake, outside the real TERYT range; user ids are b0000000-..., separate from the
-- a0000000-... ids of search_caregivers_gmina.test.sql):
--   V = b0000000-0000-0000-0000-000000000001  caregiver; profile 'Pgtap Wb Ofiara', description 'Opis ofiary',
--       contact +48600200001 / ofiara@example.test, gmina 9999501, service towarzystwo, slot pon-rano
--   M = b0000000-0000-0000-0000-000000000002  caregiver; profile 'Pgtap Wb Opiekun', contact +48600200002,
--       no gminas / services / availability
--   C = b0000000-0000-0000-0000-000000000003  coordinator, no profile
--   9999501 (V's gmina), 9999502 (a second active gmina), 9999103 .. 9999403 (31 gminas for the limit test)

begin;
create extension if not exists pgtap with schema extensions;
select plan(71);

-- Helper: runs a DML statement as the current role and returns the number of affected rows, so that "zero
-- rows" is asserted as a value (a data-modifying statement cannot sit in a sub-select). Rolled back with
-- the rest of the transaction.
create schema wb_helper;
grant usage on schema wb_helper to anon, authenticated;
create function wb_helper.dml_rows(p_sql text) returns bigint
language plpgsql
as $$
declare
  v_rows bigint;
begin
  execute p_sql;
  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;

-- ---------------------------------------------------------------------------
-- Fixtures (as postgres)
-- ---------------------------------------------------------------------------
insert into public.gminas (teryt, name, kind, powiat, wojewodztwo, active) values
  ('9999501', 'Pgtap Wb Gmina V', 'wiejska', 'Pgtap Wb Powiat', 'Pgtap Wb Wojewodztwo', true),
  ('9999502', 'Pgtap Wb Gmina Dwa', 'wiejska', 'Pgtap Wb Powiat', 'Pgtap Wb Wojewodztwo', true);

-- 31 gminas for the limit test: '9999' + two digits (10 .. 40) + '3', i.e. 9999103 .. 9999403.
insert into public.gminas (teryt, name, kind, powiat, wojewodztwo, active)
select '9999' || lpad(n::text, 2, '0') || '3', 'Pgtap Wb Limit ' || n, 'wiejska', 'Pgtap Wb Powiat',
       'Pgtap Wb Wojewodztwo', true
  from generate_series(10, 40) as n;

insert into auth.users (id, email, raw_user_meta_data) values
  ('b0000000-0000-0000-0000-000000000001', 'wb-v@example.test', '{"role":"caregiver"}'::jsonb),
  ('b0000000-0000-0000-0000-000000000002', 'wb-m@example.test', '{"role":"caregiver"}'::jsonb),
  ('b0000000-0000-0000-0000-000000000003', 'wb-c@example.test', '{"role":"coordinator"}'::jsonb);

insert into public.caregiver_profiles (user_id, display_name, description, updated_at) values
  ('b0000000-0000-0000-0000-000000000001', 'Pgtap Wb Ofiara', 'Opis ofiary', '2026-01-01T00:00:00Z'),
  ('b0000000-0000-0000-0000-000000000002', 'Pgtap Wb Opiekun', null, '2026-01-01T00:00:00Z');

insert into public.caregiver_contacts (caregiver_id, phone, email) values
  ('b0000000-0000-0000-0000-000000000001', '+48600200001', 'ofiara@example.test'),
  ('b0000000-0000-0000-0000-000000000002', '+48600200002', null);

insert into public.caregiver_gminas (caregiver_id, teryt) values
  ('b0000000-0000-0000-0000-000000000001', '9999501');
insert into public.caregiver_services (caregiver_id, service_slug) values
  ('b0000000-0000-0000-0000-000000000001', 'towarzystwo');
insert into public.caregiver_availability (caregiver_id, slot) values
  ('b0000000-0000-0000-0000-000000000001', 'pon-rano');

-- ===========================================================================
-- Impersonation check (as M)
-- ===========================================================================
do $$ begin
  perform set_config('request.jwt.claims',
    '{"sub":"b0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
end $$;
set local role authenticated;

-- The claims reach auth.uid(): everything below acts as M, not as uid = null.
select is(
  auth.uid(),
  'b0000000-0000-0000-0000-000000000002'::uuid,
  'impersonation works: auth.uid() equals the sub of the claims (M)'
);

reset role;

-- handle_new_user() copied the sign-up roles (declared in the fixtures above): V, M caregiver, C coordinator.
select is(
  (select count(*)::int from public.accounts
    where (user_id, role) in (
      ('b0000000-0000-0000-0000-000000000001'::uuid, 'caregiver'),
      ('b0000000-0000-0000-0000-000000000002'::uuid, 'caregiver'),
      ('b0000000-0000-0000-0000-000000000003'::uuid, 'coordinator')
    )),
  3,
  'fixture accounts have the declared roles (V caregiver, M caregiver, C coordinator)'
);

-- ===========================================================================
-- caregiver_contacts: insert / update only for the owner, no delete grant, no anon grant
-- ===========================================================================
do $$ begin
  perform set_config('request.jwt.claims',
    '{"sub":"b0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
end $$;
set local role authenticated;

-- Positive control: M updates M's own contact.
select is(
  wb_helper.dml_rows($d$update public.caregiver_contacts set phone = '+48600200022'
    where caregiver_id = 'b0000000-0000-0000-0000-000000000002'$d$),
  1::bigint,
  'M can update M''s own contact (1 row)'
);

-- M cannot update V's contact: the update policy filters the row out, so 0 rows (not an error).
select is(
  wb_helper.dml_rows($d$update public.caregiver_contacts set phone = '+48600999999', email = 'm@example.test'
    where caregiver_id = 'b0000000-0000-0000-0000-000000000001'$d$),
  0::bigint,
  'M updates 0 rows of V''s contact'
);

-- M cannot insert a contact row for V (insert policy: caregiver_id = uid; the row exists, but RLS fires first).
select throws_ok(
  $s$insert into public.caregiver_contacts (caregiver_id, phone)
     values ('b0000000-0000-0000-0000-000000000001', '+48600999999')$s$,
  '42501',
  'new row violates row-level security policy for table "caregiver_contacts"',
  'M cannot insert a contact for V (RLS)'
);

-- caregiver_contacts has no delete grant at all.
select throws_ok(
  $s$delete from public.caregiver_contacts where caregiver_id = 'b0000000-0000-0000-0000-000000000001'$s$,
  '42501',
  'permission denied for table caregiver_contacts',
  'M cannot delete a contact (no delete grant)'
);

reset role;

-- C (coordinator): may read complete contacts, but owns none, so an update matches 0 rows.
do $$ begin
  perform set_config('request.jwt.claims',
    '{"sub":"b0000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
end $$;
set local role authenticated;

select is(
  wb_helper.dml_rows($d$update public.caregiver_contacts set phone = '+48600999999'
    where caregiver_id = 'b0000000-0000-0000-0000-000000000001'$d$),
  0::bigint,
  'C updates 0 rows of V''s contact'
);

reset role;

-- anon: no grant on caregiver_contacts at all.
do $$ begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
end $$;
set local role anon;

select throws_ok(
  $s$update public.caregiver_contacts set phone = '+48600999999'
     where caregiver_id = 'b0000000-0000-0000-0000-000000000001'$s$,
  '42501',
  'permission denied for table caregiver_contacts',
  'anon cannot update a contact (no grant)'
);

select throws_ok(
  $s$delete from public.caregiver_contacts where caregiver_id = 'b0000000-0000-0000-0000-000000000001'$s$,
  '42501',
  'permission denied for table caregiver_contacts',
  'anon cannot delete a contact (no grant)'
);

-- Privacy: anon cannot even read the table.
select throws_ok(
  $s$select count(*) from public.caregiver_contacts$s$,
  '42501',
  'permission denied for table caregiver_contacts',
  'anon cannot read contacts (no grant)'
);

reset role;

-- Victim read back as postgres: phone and e-mail are the fixture values.
select is(
  (select phone || '|' || email from public.caregiver_contacts
    where caregiver_id = 'b0000000-0000-0000-0000-000000000001'),
  '+48600200001|ofiara@example.test',
  'V''s contact is unchanged after all attempts'
);

-- ===========================================================================
-- caregiver_profiles: write only for the owner; insert only for role caregiver
-- ===========================================================================
do $$ begin
  perform set_config('request.jwt.claims',
    '{"sub":"b0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
end $$;
set local role authenticated;

-- Positive control: M updates M's own profile.
select is(
  wb_helper.dml_rows($d$update public.caregiver_profiles set description = 'Opis opiekuna M'
    where user_id = 'b0000000-0000-0000-0000-000000000002'$d$),
  1::bigint,
  'M can update M''s own profile (1 row)'
);

-- M cannot update V's profile (0 rows).
select is(
  wb_helper.dml_rows($d$update public.caregiver_profiles set display_name = 'Pgtap Wb Przejety'
    where user_id = 'b0000000-0000-0000-0000-000000000001'$d$),
  0::bigint,
  'M updates 0 rows of V''s profile'
);

-- M cannot hand M's own row over to V (update with check: user_id = uid).
select throws_ok(
  $s$update public.caregiver_profiles set user_id = 'b0000000-0000-0000-0000-000000000001'
     where user_id = 'b0000000-0000-0000-0000-000000000002'$s$,
  '42501',
  'new row violates row-level security policy for table "caregiver_profiles"',
  'M cannot rewrite user_id of M''s own profile to V (with check)'
);

-- M cannot insert a profile for V (insert policy: user_id = uid).
select throws_ok(
  $s$insert into public.caregiver_profiles (user_id, display_name)
     values ('b0000000-0000-0000-0000-000000000001', 'Pgtap Wb Podszyty')$s$,
  '42501',
  'new row violates row-level security policy for table "caregiver_profiles"',
  'M cannot insert a profile for V (RLS)'
);

-- M cannot delete V's profile (0 rows; delete is owner only).
select is(
  wb_helper.dml_rows($d$delete from public.caregiver_profiles
    where user_id = 'b0000000-0000-0000-0000-000000000001'$d$),
  0::bigint,
  'M deletes 0 rows of V''s profile'
);

reset role;

do $$ begin
  perform set_config('request.jwt.claims',
    '{"sub":"b0000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
end $$;
set local role authenticated;

-- C inserts a profile for C itself: user_id = uid holds, only the caregiver role condition fails.
select throws_ok(
  $s$insert into public.caregiver_profiles (user_id, display_name)
     values ('b0000000-0000-0000-0000-000000000003', 'Pgtap Wb Koordynator')$s$,
  '42501',
  'new row violates row-level security policy for table "caregiver_profiles"',
  'C cannot create a caregiver profile (insert needs role caregiver)'
);

-- C cannot delete V's profile (0 rows).
select is(
  wb_helper.dml_rows($d$delete from public.caregiver_profiles
    where user_id = 'b0000000-0000-0000-0000-000000000001'$d$),
  0::bigint,
  'C deletes 0 rows of V''s profile'
);

reset role;

do $$ begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
end $$;
set local role anon;

select throws_ok(
  $s$update public.caregiver_profiles set display_name = 'Pgtap Wb Anon'
     where user_id = 'b0000000-0000-0000-0000-000000000001'$s$,
  '42501',
  'permission denied for table caregiver_profiles',
  'anon cannot update a profile (no grant)'
);

select throws_ok(
  $s$delete from public.caregiver_profiles where user_id = 'b0000000-0000-0000-0000-000000000001'$s$,
  '42501',
  'permission denied for table caregiver_profiles',
  'anon cannot delete a profile (no grant)'
);

reset role;

-- V's profile read back as postgres: name and description are the fixture values.
select is(
  (select display_name || '|' || description from public.caregiver_profiles
    where user_id = 'b0000000-0000-0000-0000-000000000001'),
  'Pgtap Wb Ofiara|Opis ofiary',
  'V''s profile is unchanged after all attempts'
);

-- No profile appeared for the coordinator.
select is(
  (select count(*)::int from public.caregiver_profiles where user_id = 'b0000000-0000-0000-0000-000000000003'),
  0,
  'C has no caregiver profile'
);

-- ===========================================================================
-- caregiver_gminas: insert / delete only for the owner, no update grant
-- ===========================================================================
do $$ begin
  perform set_config('request.jwt.claims',
    '{"sub":"b0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
end $$;
set local role authenticated;

-- Positive control: M adds an own gmina.
select is(
  wb_helper.dml_rows($d$insert into public.caregiver_gminas (caregiver_id, teryt)
    values ('b0000000-0000-0000-0000-000000000002', '9999502')$d$),
  1::bigint,
  'M can insert an own gmina (1 row)'
);

-- M cannot add a gmina to V (active gmina, so only caregiver_id fails).
select throws_ok(
  $s$insert into public.caregiver_gminas (caregiver_id, teryt)
     values ('b0000000-0000-0000-0000-000000000001', '9999502')$s$,
  '42501',
  'new row violates row-level security policy for table "caregiver_gminas"',
  'M cannot insert a gmina for V (RLS)'
);

-- No update grant on caregiver_gminas.
select throws_ok(
  $s$update public.caregiver_gminas set teryt = '9999502'
     where caregiver_id = 'b0000000-0000-0000-0000-000000000001'$s$,
  '42501',
  'permission denied for table caregiver_gminas',
  'M cannot update caregiver_gminas (no update grant)'
);

-- M cannot delete V's gmina link (0 rows).
select is(
  wb_helper.dml_rows($d$delete from public.caregiver_gminas
    where caregiver_id = 'b0000000-0000-0000-0000-000000000001'$d$),
  0::bigint,
  'M deletes 0 rows of V''s gminas'
);

-- Positive control: M deletes the own gmina.
select is(
  wb_helper.dml_rows($d$delete from public.caregiver_gminas
    where caregiver_id = 'b0000000-0000-0000-0000-000000000002'$d$),
  1::bigint,
  'M can delete an own gmina (1 row)'
);

reset role;

do $$ begin
  perform set_config('request.jwt.claims',
    '{"sub":"b0000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
end $$;
set local role authenticated;

select is(
  wb_helper.dml_rows($d$delete from public.caregiver_gminas
    where caregiver_id = 'b0000000-0000-0000-0000-000000000001'$d$),
  0::bigint,
  'C deletes 0 rows of V''s gminas'
);

reset role;

do $$ begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
end $$;
set local role anon;

select throws_ok(
  $s$insert into public.caregiver_gminas (caregiver_id, teryt)
     values ('b0000000-0000-0000-0000-000000000001', '9999502')$s$,
  '42501',
  'permission denied for table caregiver_gminas',
  'anon cannot insert a gmina link (no grant)'
);

select throws_ok(
  $s$delete from public.caregiver_gminas where caregiver_id = 'b0000000-0000-0000-0000-000000000001'$s$,
  '42501',
  'permission denied for table caregiver_gminas',
  'anon cannot delete a gmina link (no grant)'
);

reset role;

-- V's gminas read back as postgres: exactly {9999501}.
select set_eq(
  $$select teryt from public.caregiver_gminas where caregiver_id = 'b0000000-0000-0000-0000-000000000001'$$,
  $$values ('9999501')$$,
  'V''s gminas are exactly {9999501} after all attempts'
);

-- ===========================================================================
-- caregiver_services: insert / delete only for the owner, no update grant
-- ===========================================================================
do $$ begin
  perform set_config('request.jwt.claims',
    '{"sub":"b0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
end $$;
set local role authenticated;

-- Positive control.
select is(
  wb_helper.dml_rows($d$insert into public.caregiver_services (caregiver_id, service_slug)
    values ('b0000000-0000-0000-0000-000000000002', 'prace-domowe')$d$),
  1::bigint,
  'M can insert an own service (1 row)'
);

select throws_ok(
  $s$insert into public.caregiver_services (caregiver_id, service_slug)
     values ('b0000000-0000-0000-0000-000000000001', 'demencja')$s$,
  '42501',
  'new row violates row-level security policy for table "caregiver_services"',
  'M cannot insert a service for V (RLS)'
);

select throws_ok(
  $s$update public.caregiver_services set service_slug = 'demencja'
     where caregiver_id = 'b0000000-0000-0000-0000-000000000001'$s$,
  '42501',
  'permission denied for table caregiver_services',
  'M cannot update caregiver_services (no update grant)'
);

select is(
  wb_helper.dml_rows($d$delete from public.caregiver_services
    where caregiver_id = 'b0000000-0000-0000-0000-000000000001'$d$),
  0::bigint,
  'M deletes 0 rows of V''s services'
);

-- Positive control.
select is(
  wb_helper.dml_rows($d$delete from public.caregiver_services
    where caregiver_id = 'b0000000-0000-0000-0000-000000000002'$d$),
  1::bigint,
  'M can delete an own service (1 row)'
);

reset role;

do $$ begin
  perform set_config('request.jwt.claims',
    '{"sub":"b0000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
end $$;
set local role authenticated;

select is(
  wb_helper.dml_rows($d$delete from public.caregiver_services
    where caregiver_id = 'b0000000-0000-0000-0000-000000000001'$d$),
  0::bigint,
  'C deletes 0 rows of V''s services'
);

reset role;

do $$ begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
end $$;
set local role anon;

select throws_ok(
  $s$insert into public.caregiver_services (caregiver_id, service_slug)
     values ('b0000000-0000-0000-0000-000000000001', 'demencja')$s$,
  '42501',
  'permission denied for table caregiver_services',
  'anon cannot insert a service link (no grant)'
);

select throws_ok(
  $s$delete from public.caregiver_services where caregiver_id = 'b0000000-0000-0000-0000-000000000001'$s$,
  '42501',
  'permission denied for table caregiver_services',
  'anon cannot delete a service link (no grant)'
);

reset role;

select set_eq(
  $$select service_slug from public.caregiver_services where caregiver_id = 'b0000000-0000-0000-0000-000000000001'$$,
  $$values ('towarzystwo')$$,
  'V''s services are exactly {towarzystwo} after all attempts'
);

-- ===========================================================================
-- caregiver_availability: insert / delete only for the owner, no update grant
-- ===========================================================================
do $$ begin
  perform set_config('request.jwt.claims',
    '{"sub":"b0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
end $$;
set local role authenticated;

-- Positive control.
select is(
  wb_helper.dml_rows($d$insert into public.caregiver_availability (caregiver_id, slot)
    values ('b0000000-0000-0000-0000-000000000002', 'wt-rano')$d$),
  1::bigint,
  'M can insert an own availability slot (1 row)'
);

select throws_ok(
  $s$insert into public.caregiver_availability (caregiver_id, slot)
     values ('b0000000-0000-0000-0000-000000000001', 'wt-rano')$s$,
  '42501',
  'new row violates row-level security policy for table "caregiver_availability"',
  'M cannot insert an availability slot for V (RLS)'
);

select throws_ok(
  $s$update public.caregiver_availability set slot = 'wt-rano'
     where caregiver_id = 'b0000000-0000-0000-0000-000000000001'$s$,
  '42501',
  'permission denied for table caregiver_availability',
  'M cannot update caregiver_availability (no update grant)'
);

select is(
  wb_helper.dml_rows($d$delete from public.caregiver_availability
    where caregiver_id = 'b0000000-0000-0000-0000-000000000001'$d$),
  0::bigint,
  'M deletes 0 rows of V''s availability'
);

-- Positive control.
select is(
  wb_helper.dml_rows($d$delete from public.caregiver_availability
    where caregiver_id = 'b0000000-0000-0000-0000-000000000002'$d$),
  1::bigint,
  'M can delete an own availability slot (1 row)'
);

reset role;

do $$ begin
  perform set_config('request.jwt.claims',
    '{"sub":"b0000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
end $$;
set local role authenticated;

select is(
  wb_helper.dml_rows($d$delete from public.caregiver_availability
    where caregiver_id = 'b0000000-0000-0000-0000-000000000001'$d$),
  0::bigint,
  'C deletes 0 rows of V''s availability'
);

reset role;

do $$ begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
end $$;
set local role anon;

select throws_ok(
  $s$insert into public.caregiver_availability (caregiver_id, slot)
     values ('b0000000-0000-0000-0000-000000000001', 'wt-rano')$s$,
  '42501',
  'permission denied for table caregiver_availability',
  'anon cannot insert an availability slot (no grant)'
);

select throws_ok(
  $s$delete from public.caregiver_availability where caregiver_id = 'b0000000-0000-0000-0000-000000000001'$s$,
  '42501',
  'permission denied for table caregiver_availability',
  'anon cannot delete an availability slot (no grant)'
);

reset role;

select set_eq(
  $$select slot from public.caregiver_availability where caregiver_id = 'b0000000-0000-0000-0000-000000000001'$$,
  $$values ('pon-rano')$$,
  'V''s availability is exactly {pon-rano} after all attempts'
);

-- ===========================================================================
-- 30-gmina limit by direct insert (trigger returns early when auth.uid() is null, so claims are required)
-- ===========================================================================
do $$ begin
  perform set_config('request.jwt.claims',
    '{"sub":"b0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
end $$;
set local role authenticated;

-- M inserts 30 own gminas in one statement: the limit is "at most 30", so all 30 pass.
select is(
  wb_helper.dml_rows($d$insert into public.caregiver_gminas (caregiver_id, teryt)
    select 'b0000000-0000-0000-0000-000000000002', '9999' || lpad(n::text, 2, '0') || '3'
      from generate_series(10, 39) as n$d$),
  30::bigint,
  'M can insert 30 own gminas'
);

-- The 31st own gmina (9999403) is rejected with the Polish message, errcode 22023.
select throws_ok(
  $s$insert into public.caregiver_gminas (caregiver_id, teryt)
     values ('b0000000-0000-0000-0000-000000000002', '9999403')$s$,
  '22023',
  'Możesz wybrać najwyżej 30 gmin.',
  'the 31st own gmina is rejected by the limit trigger'
);

reset role;

-- Exactly 30 rows stayed.
select is(
  (select count(*)::int from public.caregiver_gminas where caregiver_id = 'b0000000-0000-0000-0000-000000000002'),
  30,
  'M has exactly 30 gminas after the rejected 31st'
);

-- ===========================================================================
-- accounts: no write grant for anyone, so the role cannot be changed (the role gates contact reads)
-- ===========================================================================
do $$ begin
  perform set_config('request.jwt.claims',
    '{"sub":"b0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
end $$;
set local role authenticated;

-- M (caregiver): insert, escalate role, delete.
select throws_ok(
  $s$insert into public.accounts (user_id, role) values ('b0000000-0000-0000-0000-000000000002', 'coordinator')$s$,
  '42501',
  'permission denied for table accounts',
  'M cannot insert into accounts'
);
select throws_ok(
  $s$update public.accounts set role = 'coordinator' where user_id = 'b0000000-0000-0000-0000-000000000002'$s$,
  '42501',
  'permission denied for table accounts',
  'M cannot change M''s own role to coordinator'
);
select throws_ok(
  $s$delete from public.accounts where user_id = 'b0000000-0000-0000-0000-000000000002'$s$,
  '42501',
  'permission denied for table accounts',
  'M cannot delete from accounts'
);

-- Role chain, step 1: as a caregiver M still reads no contact of V (own row only).
select is(
  (select count(*)::int from public.caregiver_contacts where caregiver_id = 'b0000000-0000-0000-0000-000000000001'),
  0,
  'M (caregiver) reads 0 contacts of V'
);

reset role;

do $$ begin
  perform set_config('request.jwt.claims',
    '{"sub":"b0000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
end $$;
set local role authenticated;

-- C (coordinator): insert, change role, delete.
select throws_ok(
  $s$insert into public.accounts (user_id, role) values ('b0000000-0000-0000-0000-000000000003', 'caregiver')$s$,
  '42501',
  'permission denied for table accounts',
  'C cannot insert into accounts'
);
select throws_ok(
  $s$update public.accounts set role = 'caregiver' where user_id = 'b0000000-0000-0000-0000-000000000003'$s$,
  '42501',
  'permission denied for table accounts',
  'C cannot change C''s own role'
);
select throws_ok(
  $s$delete from public.accounts where user_id = 'b0000000-0000-0000-0000-000000000003'$s$,
  '42501',
  'permission denied for table accounts',
  'C cannot delete from accounts'
);

-- Role chain, positive control: C (coordinator) reads V's contact, because V's profile is complete
--     (name, phone, active gmina 9999501, service towarzystwo). So the 0 for M above comes from the role.
select is(
  (select count(*)::int from public.caregiver_contacts where caregiver_id = 'b0000000-0000-0000-0000-000000000001'),
  1,
  'C (coordinator) reads V''s contact (complete profile)'
);

reset role;

do $$ begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
end $$;
set local role anon;

-- anon: insert, update, delete.
select throws_ok(
  $s$insert into public.accounts (user_id, role) values ('b0000000-0000-0000-0000-000000000002', 'coordinator')$s$,
  '42501',
  'permission denied for table accounts',
  'anon cannot insert into accounts'
);
select throws_ok(
  $s$update public.accounts set role = 'coordinator' where user_id = 'b0000000-0000-0000-0000-000000000002'$s$,
  '42501',
  'permission denied for table accounts',
  'anon cannot update accounts'
);
select throws_ok(
  $s$delete from public.accounts where user_id = 'b0000000-0000-0000-0000-000000000002'$s$,
  '42501',
  'permission denied for table accounts',
  'anon cannot delete from accounts'
);

reset role;

-- Roles read back as postgres: unchanged after all attempts.
select is(
  (select role from public.accounts where user_id = 'b0000000-0000-0000-0000-000000000002'),
  'caregiver',
  'M is still a caregiver after the escalation attempt'
);
select is(
  (select role from public.accounts where user_id = 'b0000000-0000-0000-0000-000000000003'),
  'coordinator',
  'C is still a coordinator after the attempts'
);

-- ===========================================================================
-- save_caregiver_profile(): EXECUTE for authenticated only; a coordinator is stopped by the profile insert policy
-- ===========================================================================
do $$ begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
end $$;
set local role anon;

select throws_ok(
  $s$select public.save_caregiver_profile('Pgtap Wb Anon', null, null, null, '{}', '{}')$s$,
  '42501',
  'permission denied for function save_caregiver_profile',
  'anon cannot execute save_caregiver_profile'
);

reset role;

do $$ begin
  perform set_config('request.jwt.claims',
    '{"sub":"b0000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
end $$;
set local role authenticated;

-- C may execute the function, but with valid arguments the profile upsert hits the insert policy (role).
select throws_ok(
  $s$select public.save_caregiver_profile('Pgtap Wb Koordynator', null, '+48600200003', null,
       array['9999502'], array['towarzystwo'])$s$,
  '42501',
  'new row violates row-level security policy for table "caregiver_profiles"',
  'C calling save_caregiver_profile is stopped by the role policy'
);

reset role;

-- Nothing was created for C: no profile, no contact.
select is(
  (select count(*)::int from public.caregiver_profiles where user_id = 'b0000000-0000-0000-0000-000000000003'),
  0,
  'the rejected save created no profile for C'
);
select is(
  (select count(*)::int from public.caregiver_contacts where caregiver_id = 'b0000000-0000-0000-0000-000000000003'),
  0,
  'the rejected save created no contact for C'
);

do $$ begin
  perform set_config('request.jwt.claims',
    '{"sub":"b0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
end $$;
set local role authenticated;

-- Positive control: M (caregiver) saves M's own profile.
select lives_ok(
  $s$select public.save_caregiver_profile('Pgtap Wb Opiekun Zapis', null, '+48600200002', null,
       array['9999502'], array['prace-domowe'])$s$,
  'M can save M''s own profile through save_caregiver_profile'
);

reset role;

select is(
  (select display_name from public.caregiver_profiles where user_id = 'b0000000-0000-0000-0000-000000000002'),
  'Pgtap Wb Opiekun Zapis',
  'M''s own save changed M''s profile name'
);

select * from finish();
rollback;
