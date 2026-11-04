-- pgTAP: public.search_caregivers() hard gmina filter (test-plan.md risk #1).
-- One transaction, rolled back at the end: fixtures never persist.
--
-- Oracle (not derived from running the query — derived from PRD + the fixture table below):
--   * US-01 AC3 (prd.md:81): a caregiver with no (active) gmina never appears in results, with or
--     without a gmina filter.
--   * prd.md:142: gmina match is a hard filter — a profile outside the requested gmina never appears.
--   * caregiver_profile_missing() (20261103150000_caregiver_profiles.sql:356-388): complete =
--     display_name + phone + >=1 active gmina + >=1 service. Only an active gmina counts, so a
--     profile whose only gmina is retired is incomplete via the "gminas" item, exactly like a
--     profile with none.
--
-- Fixtures (gmina codes are fake, outside the real TERYT range, so they never collide):
--   G  = 9999011 (searched gmina, active)
--   N1 = 9999012 (shares G's first 6 digits; a buggy 6-digit-prefix filter would wrongly match it)
--   N2 = 9999021 (shares G's powiat, i.e. first 4 digits; a buggy 4-digit-prefix filter would match)
--   R  = 9999031 (retired: active = false)
--
--   Profile | Gminas | Phone | Service | Expectation
--   A       | G      | yes   | yes     | in the result for G
--   B       | G, N2  | yes   | yes     | in the result for G and for N2 (G is not its only gmina)
--   C       | N1     | yes   | yes     | only in the result for N1
--   D       | N2     | yes   | yes     | only in the result for N2
--   E       | none   | yes   | yes     | in no result, including p_teryt = null (missing gminas)
--   F       | R only | yes   | yes     | in no result, including for R and p_teryt = null (R is retired)
--   H       | R, G   | yes   | yes     | in the result for G, not for R; its public gminas = {G} only
--   I       | G      | no    | yes     | in no result (missing phone)
--
-- Expected sets: G -> {A, B, H}; N1 -> {C}; N2 -> {B, D}; R -> {}; p_teryt = null (restricted to
-- these fixture ids, since the local database holds unrelated profiles) -> {A, B, C, D, H}.

begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into public.gminas (teryt, name, kind, powiat, wojewodztwo, active) values
  ('9999011', 'Pgtap Gmina G', 'wiejska', 'Pgtap Powiat', 'Pgtap Wojewodztwo', true),
  ('9999012', 'Pgtap Gmina N1', 'miejska', 'Pgtap Powiat', 'Pgtap Wojewodztwo', true),
  ('9999021', 'Pgtap Gmina N2', 'wiejska', 'Pgtap Powiat', 'Pgtap Wojewodztwo', true),
  ('9999031', 'Pgtap Gmina R', 'wiejska', 'Pgtap Powiat', 'Pgtap Wojewodztwo', false);

insert into auth.users (id, email, raw_user_meta_data) values
  ('a0000000-0000-0000-0000-000000000001', 'gmina-a@example.test', '{"role":"caregiver"}'::jsonb),
  ('a0000000-0000-0000-0000-000000000002', 'gmina-b@example.test', '{"role":"caregiver"}'::jsonb),
  ('a0000000-0000-0000-0000-000000000003', 'gmina-c@example.test', '{"role":"caregiver"}'::jsonb),
  ('a0000000-0000-0000-0000-000000000004', 'gmina-d@example.test', '{"role":"caregiver"}'::jsonb),
  ('a0000000-0000-0000-0000-000000000005', 'gmina-e@example.test', '{"role":"caregiver"}'::jsonb),
  ('a0000000-0000-0000-0000-000000000006', 'gmina-f@example.test', '{"role":"caregiver"}'::jsonb),
  ('a0000000-0000-0000-0000-000000000007', 'gmina-h@example.test', '{"role":"caregiver"}'::jsonb),
  ('a0000000-0000-0000-0000-000000000008', 'gmina-i@example.test', '{"role":"caregiver"}'::jsonb);

select is(
  (select count(*)::int from public.accounts where user_id in (
    'a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000004',
    'a0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000006',
    'a0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000008'
  )),
  8,
  'handle_new_user() created an account row for every fixture'
);

insert into public.caregiver_profiles (user_id, display_name, updated_at) values
  ('a0000000-0000-0000-0000-000000000001', 'Pgtap Gmina A', '2026-01-01T00:00:00Z'),
  ('a0000000-0000-0000-0000-000000000002', 'Pgtap Gmina B', '2026-01-01T00:00:00Z'),
  ('a0000000-0000-0000-0000-000000000003', 'Pgtap Gmina C', '2026-01-01T00:00:00Z'),
  ('a0000000-0000-0000-0000-000000000004', 'Pgtap Gmina D', '2026-01-01T00:00:00Z'),
  ('a0000000-0000-0000-0000-000000000005', 'Pgtap Gmina E', '2026-01-01T00:00:00Z'),
  ('a0000000-0000-0000-0000-000000000006', 'Pgtap Gmina F', '2026-01-01T00:00:00Z'),
  ('a0000000-0000-0000-0000-000000000007', 'Pgtap Gmina H', '2026-01-01T00:00:00Z'),
  ('a0000000-0000-0000-0000-000000000008', 'Pgtap Gmina I', '2026-01-01T00:00:00Z');

-- I has no caregiver_contacts row at all, so it is missing a phone.
insert into public.caregiver_contacts (caregiver_id, phone) values
  ('a0000000-0000-0000-0000-000000000001', '+48600000001'),
  ('a0000000-0000-0000-0000-000000000002', '+48600000002'),
  ('a0000000-0000-0000-0000-000000000003', '+48600000003'),
  ('a0000000-0000-0000-0000-000000000004', '+48600000004'),
  ('a0000000-0000-0000-0000-000000000005', '+48600000005'),
  ('a0000000-0000-0000-0000-000000000006', '+48600000006'),
  ('a0000000-0000-0000-0000-000000000007', '+48600000007');

insert into public.caregiver_services (caregiver_id, service_slug) values
  ('a0000000-0000-0000-0000-000000000001', 'towarzystwo'),
  ('a0000000-0000-0000-0000-000000000002', 'towarzystwo'),
  ('a0000000-0000-0000-0000-000000000003', 'towarzystwo'),
  ('a0000000-0000-0000-0000-000000000004', 'towarzystwo'),
  ('a0000000-0000-0000-0000-000000000005', 'towarzystwo'),
  ('a0000000-0000-0000-0000-000000000006', 'towarzystwo'),
  ('a0000000-0000-0000-0000-000000000007', 'towarzystwo'),
  ('a0000000-0000-0000-0000-000000000008', 'towarzystwo');

insert into public.caregiver_gminas (caregiver_id, teryt) values
  ('a0000000-0000-0000-0000-000000000001', '9999011'), -- A: G
  ('a0000000-0000-0000-0000-000000000002', '9999011'), -- B: G
  ('a0000000-0000-0000-0000-000000000002', '9999021'), -- B: N2
  ('a0000000-0000-0000-0000-000000000003', '9999012'), -- C: N1
  ('a0000000-0000-0000-0000-000000000004', '9999021'), -- D: N2
  -- E: no gminas at all
  ('a0000000-0000-0000-0000-000000000006', '9999031'), -- F: R (retired)
  ('a0000000-0000-0000-0000-000000000007', '9999031'), -- H: R (retired)
  ('a0000000-0000-0000-0000-000000000007', '9999011'), -- H: G
  ('a0000000-0000-0000-0000-000000000008', '9999011'); -- I: G

select is(
  (select updated_at from public.caregiver_profiles where user_id = 'a0000000-0000-0000-0000-000000000001'),
  '2026-01-01T00:00:00Z'::timestamptz,
  'the explicit updated_at of fixture A survives the insert (now() does not overwrite it)'
);

set local role anon;

-- G -> {A, B, H}: hard filter admits only profiles serving G; N1-only (C) must not leak in despite
-- sharing G's first 6 digits, and N2-only (D) must not leak in despite sharing G's powiat.
select set_eq(
  $$select user_id from public.search_caregivers(p_teryt := '9999011') where user_id in (
      'a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002',
      'a0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000004',
      'a0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000006',
      'a0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000008'
    )$$,
  $$values
      ('a0000000-0000-0000-0000-000000000001'::uuid),
      ('a0000000-0000-0000-0000-000000000002'::uuid),
      ('a0000000-0000-0000-0000-000000000007'::uuid)
  $$,
  'gmina G returns exactly {A, B, H} among the fixtures'
);

-- N1 -> {C}: proves N1 is treated as distinct from G, not matched by a shared-prefix comparison.
select set_eq(
  $$select user_id from public.search_caregivers(p_teryt := '9999012') where user_id in (
      'a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002',
      'a0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000004',
      'a0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000006',
      'a0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000008'
    )$$,
  $$values ('a0000000-0000-0000-0000-000000000003'::uuid)$$,
  'gmina N1 returns exactly {C} among the fixtures'
);

-- N2 -> {B, D}: B serves both G and N2; D serves only N2.
select set_eq(
  $$select user_id from public.search_caregivers(p_teryt := '9999021') where user_id in (
      'a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002',
      'a0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000004',
      'a0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000006',
      'a0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000008'
    )$$,
  $$values
      ('a0000000-0000-0000-0000-000000000002'::uuid),
      ('a0000000-0000-0000-0000-000000000004'::uuid)
  $$,
  'gmina N2 returns exactly {B, D} among the fixtures'
);

-- R -> {}: a retired gmina matches nobody, even F and H, which are linked to R.
select is_empty(
  $$select user_id from public.search_caregivers(p_teryt := '9999031') where user_id in (
      'a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002',
      'a0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000004',
      'a0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000006',
      'a0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000008'
    )$$,
  'the retired gmina R returns nobody among the fixtures'
);

-- p_teryt = null -> {A, B, C, D, H}: completeness alone decides; E (no gminas), F (only retired R)
-- and I (no phone) stay excluded even without any gmina filter.
select set_eq(
  $$select user_id from public.search_caregivers(p_teryt := null) where user_id in (
      'a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002',
      'a0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000004',
      'a0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000006',
      'a0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000008'
    )$$,
  $$values
      ('a0000000-0000-0000-0000-000000000001'::uuid),
      ('a0000000-0000-0000-0000-000000000002'::uuid),
      ('a0000000-0000-0000-0000-000000000003'::uuid),
      ('a0000000-0000-0000-0000-000000000004'::uuid),
      ('a0000000-0000-0000-0000-000000000007'::uuid)
  $$,
  'with no gmina filter, exactly {A, B, C, D, H} among the fixtures are complete'
);

-- H's public gminas column (searched by G) must list only the active gmina G: the retired R link
-- stays in caregiver_gminas but is filtered out of the public result (20261104150000_...sql:156-160).
select is(
  (select jsonb_array_length(gminas) from public.search_caregivers(p_teryt := '9999011')
    where user_id = 'a0000000-0000-0000-0000-000000000007'),
  1,
  'H''s public gminas list has exactly one entry (the retired R link is hidden)'
);

select is(
  (select gminas -> 0 ->> 'teryt' from public.search_caregivers(p_teryt := '9999011')
    where user_id = 'a0000000-0000-0000-0000-000000000007'),
  '9999011',
  'H''s single public gmina entry is G, not the retired R'
);

select * from finish();
rollback;
