-- pgTAP: public.search_caregivers() ranking and gap markers (test-plan.md risk #2).
-- One transaction, rolled back at the end: fixtures never persist.
--
-- Oracle (not derived from running the query — derived from PRD + the S-05 decision table below):
--   * prd.md:138-142: gmina match is a hard filter (not re-tested here, see search_caregivers_gmina.test.sql);
--     services and slots rank softly, services outweighing slots lexicographically; a profile missing a slot
--     stays visible, lower, never removed.
--   * S-05 decision (context/archive/2026-11-04-ranked-match-results/plan-brief.md:23-24): threshold >= 1
--     selected service (no threshold on slots), order = matched_services desc, matched_slots desc,
--     updated_at desc, user_id asc as the final tie-breaker.
--   * missing_services sort order = public.services.sort_order (20260924120000_create_dictionaries.sql:125-139),
--     not alphabetical by label.
--   * F4 regression guard (context/archive/2026-11-04-ranked-match-results/reviews/impl-review.md:61-69):
--     '', an unknown slug, and a duplicate in p_services/p_availability must be ignored, not treated as a
--     selected-but-unmet service/slot.
--
-- All fixtures share one fake gmina (9999041, outside the real TERYT range) with p_teryt := '9999041' passed
-- on every call, so the hard gmina filter scopes every assertion to exactly these fixtures and the local
-- database's unrelated profiles (which may also offer towarzystwo/demencja) never leak into the ranked order.
--
-- Services: S1 = towarzystwo (sort_order 1), S2 = demencja (sort_order 11), S3 = wizyty-lekarskie (sort_order 8,
-- used only by P7, to exercise the >=1-service threshold without colliding with S1/S2).
-- Slots: T1 = pon-rano, T2 = wt-rano.
--
--   Profile | Services | Slots  | updated_at   | Note
--   P8      | S1, S2   | T1, T2 | 2026-03-08   | most services + most slots: first
--   P1      | S1, S2   | --     | 2026-03-01   | second despite no slots: services outweigh slots
--   P2      | S1       | T1, T2 | 2026-03-02   | below P1: one service beats two slots
--   P4      | S1       | T1     | 2026-03-04   | newer updated_at than P3
--   P3      | S1       | T1     | 2026-03-03   | older than P4
--   P5      | S1       | --     | 2026-03-05   | tied with P6 on updated_at -> user_id asc
--   P6      | S1       | --     | 2026-03-05   | higher user_id than P5
--   P7      | S3       | T1, T2 | 2026-03-07   | hidden by the >=1-selected-service threshold
--
-- Expected order for p_services = {S1,S2}, p_availability = {T1,T2}: [P8, P1, P2, P4, P3, P5, P6], total_count
-- = 7, P7 absent. Order with only {S1} selected and no availability (isolates the updated_at/user_id
-- tie-breaker from the services/slots dimensions): [P8, P5, P6, P4, P3, P2, P1], total_count = 7.

begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

insert into public.gminas (teryt, name, kind, powiat, wojewodztwo, active) values
  ('9999041', 'Pgtap Gmina Rank', 'wiejska', 'Pgtap Powiat', 'Pgtap Wojewodztwo', true);

insert into auth.users (id, email, raw_user_meta_data) values
  ('b0000000-0000-0000-0000-000000000001', 'rank-p1@example.test', '{"role":"caregiver"}'::jsonb),
  ('b0000000-0000-0000-0000-000000000002', 'rank-p2@example.test', '{"role":"caregiver"}'::jsonb),
  ('b0000000-0000-0000-0000-000000000003', 'rank-p3@example.test', '{"role":"caregiver"}'::jsonb),
  ('b0000000-0000-0000-0000-000000000004', 'rank-p4@example.test', '{"role":"caregiver"}'::jsonb),
  ('b0000000-0000-0000-0000-000000000005', 'rank-p5@example.test', '{"role":"caregiver"}'::jsonb),
  ('b0000000-0000-0000-0000-000000000006', 'rank-p6@example.test', '{"role":"caregiver"}'::jsonb),
  ('b0000000-0000-0000-0000-000000000007', 'rank-p7@example.test', '{"role":"caregiver"}'::jsonb),
  ('b0000000-0000-0000-0000-000000000008', 'rank-p8@example.test', '{"role":"caregiver"}'::jsonb);

select is(
  (select count(*)::int from public.accounts where user_id in (
    'b0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002',
    'b0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000004',
    'b0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000006',
    'b0000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000008'
  )),
  8,
  'handle_new_user() created an account row for every fixture'
);

insert into public.caregiver_profiles (user_id, display_name, updated_at) values
  ('b0000000-0000-0000-0000-000000000001', 'Pgtap Rank P1', '2026-03-01T00:00:00Z'),
  ('b0000000-0000-0000-0000-000000000002', 'Pgtap Rank P2', '2026-03-02T00:00:00Z'),
  ('b0000000-0000-0000-0000-000000000003', 'Pgtap Rank P3', '2026-03-03T00:00:00Z'),
  ('b0000000-0000-0000-0000-000000000004', 'Pgtap Rank P4', '2026-03-04T00:00:00Z'),
  ('b0000000-0000-0000-0000-000000000005', 'Pgtap Rank P5', '2026-03-05T00:00:00Z'),
  ('b0000000-0000-0000-0000-000000000006', 'Pgtap Rank P6', '2026-03-05T00:00:00Z'),
  ('b0000000-0000-0000-0000-000000000007', 'Pgtap Rank P7', '2026-03-07T00:00:00Z'),
  ('b0000000-0000-0000-0000-000000000008', 'Pgtap Rank P8', '2026-03-08T00:00:00Z');

insert into public.caregiver_contacts (caregiver_id, phone) values
  ('b0000000-0000-0000-0000-000000000001', '+48610000001'),
  ('b0000000-0000-0000-0000-000000000002', '+48610000002'),
  ('b0000000-0000-0000-0000-000000000003', '+48610000003'),
  ('b0000000-0000-0000-0000-000000000004', '+48610000004'),
  ('b0000000-0000-0000-0000-000000000005', '+48610000005'),
  ('b0000000-0000-0000-0000-000000000006', '+48610000006'),
  ('b0000000-0000-0000-0000-000000000007', '+48610000007'),
  ('b0000000-0000-0000-0000-000000000008', '+48610000008');

insert into public.caregiver_gminas (caregiver_id, teryt) values
  ('b0000000-0000-0000-0000-000000000001', '9999041'),
  ('b0000000-0000-0000-0000-000000000002', '9999041'),
  ('b0000000-0000-0000-0000-000000000003', '9999041'),
  ('b0000000-0000-0000-0000-000000000004', '9999041'),
  ('b0000000-0000-0000-0000-000000000005', '9999041'),
  ('b0000000-0000-0000-0000-000000000006', '9999041'),
  ('b0000000-0000-0000-0000-000000000007', '9999041'),
  ('b0000000-0000-0000-0000-000000000008', '9999041');

insert into public.caregiver_services (caregiver_id, service_slug) values
  ('b0000000-0000-0000-0000-000000000001', 'towarzystwo'),
  ('b0000000-0000-0000-0000-000000000001', 'demencja'),
  ('b0000000-0000-0000-0000-000000000002', 'towarzystwo'),
  ('b0000000-0000-0000-0000-000000000003', 'towarzystwo'),
  ('b0000000-0000-0000-0000-000000000004', 'towarzystwo'),
  ('b0000000-0000-0000-0000-000000000005', 'towarzystwo'),
  ('b0000000-0000-0000-0000-000000000006', 'towarzystwo'),
  ('b0000000-0000-0000-0000-000000000007', 'wizyty-lekarskie'),
  ('b0000000-0000-0000-0000-000000000008', 'towarzystwo'),
  ('b0000000-0000-0000-0000-000000000008', 'demencja');

insert into public.caregiver_availability (caregiver_id, slot) values
  ('b0000000-0000-0000-0000-000000000002', 'pon-rano'),
  ('b0000000-0000-0000-0000-000000000002', 'wt-rano'),
  ('b0000000-0000-0000-0000-000000000003', 'pon-rano'),
  ('b0000000-0000-0000-0000-000000000004', 'pon-rano'),
  ('b0000000-0000-0000-0000-000000000007', 'pon-rano'),
  ('b0000000-0000-0000-0000-000000000007', 'wt-rano'),
  ('b0000000-0000-0000-0000-000000000008', 'pon-rano'),
  ('b0000000-0000-0000-0000-000000000008', 'wt-rano');

select is(
  (select updated_at from public.caregiver_profiles where user_id = 'b0000000-0000-0000-0000-000000000005'),
  '2026-03-05T00:00:00Z'::timestamptz,
  'the explicit updated_at of fixture P5 survives the insert (now() does not overwrite it)'
);

set local role anon;

-- (1) Selecting both services and both slots: services outweigh slots lexicographically (P1 beats P2 despite
-- fewer slots), then updated_at desc (P4 beats P3), then user_id asc (P5 beats P6). P7 is hidden by the
-- >=1-selected-service threshold even though it has both slots.
select results_eq(
  $$
    select t.user_id, t.total_count
    from public.search_caregivers(
      p_teryt := '9999041',
      p_services := array['towarzystwo', 'demencja'],
      p_availability := array['pon-rano', 'wt-rano'],
      p_limit := 50,
      p_offset := 0
    ) with ordinality as t(
      user_id, display_name, description, updated_at, services, gminas, availability,
      matched_services, missing_services, matched_slots, missing_slots, total_count, ord
    )
    order by t.ord
  $$,
  $$
    values
      ('b0000000-0000-0000-0000-000000000008'::uuid, 7::bigint),
      ('b0000000-0000-0000-0000-000000000001'::uuid, 7::bigint),
      ('b0000000-0000-0000-0000-000000000002'::uuid, 7::bigint),
      ('b0000000-0000-0000-0000-000000000004'::uuid, 7::bigint),
      ('b0000000-0000-0000-0000-000000000003'::uuid, 7::bigint),
      ('b0000000-0000-0000-0000-000000000005'::uuid, 7::bigint),
      ('b0000000-0000-0000-0000-000000000006'::uuid, 7::bigint)
  $$,
  'towarzystwo+demencja and pon-rano+wt-rano rank P8,P1,P2,P4,P3,P5,P6 in that order; P7 is hidden by the threshold'
);

-- (2) Dedicated tie-breaker proof: only S1 selected, no slots selected, so matched_services (1 for everyone
-- but P7) and matched_slots (0 for everyone) are both tied across the board. The entire remaining order comes
-- from updated_at desc, then user_id asc for the P5/P6 tie -- isolated from the services/slots dimensions.
select results_eq(
  $$
    select t.user_id, t.total_count
    from public.search_caregivers(
      p_teryt := '9999041',
      p_services := array['towarzystwo'],
      p_availability := null,
      p_limit := 50,
      p_offset := 0
    ) with ordinality as t(
      user_id, display_name, description, updated_at, services, gminas, availability,
      matched_services, missing_services, matched_slots, missing_slots, total_count, ord
    )
    order by t.ord
  $$,
  $$
    values
      ('b0000000-0000-0000-0000-000000000008'::uuid, 7::bigint),
      ('b0000000-0000-0000-0000-000000000005'::uuid, 7::bigint),
      ('b0000000-0000-0000-0000-000000000006'::uuid, 7::bigint),
      ('b0000000-0000-0000-0000-000000000004'::uuid, 7::bigint),
      ('b0000000-0000-0000-0000-000000000003'::uuid, 7::bigint),
      ('b0000000-0000-0000-0000-000000000002'::uuid, 7::bigint),
      ('b0000000-0000-0000-0000-000000000001'::uuid, 7::bigint)
  $$,
  'with matched_services and matched_slots tied for everyone, order falls through to updated_at desc, then user_id asc for the P5/P6 tie'
);

-- (3) Ranking is global before paging: four pages of the scenario from (1) with p_limit = 2 reproduce the same
-- order split into pages, and total_count stays 7 (all matches) on every page, not the page size.
select results_eq(
  $$
    select t.user_id, t.total_count
    from public.search_caregivers(
      p_teryt := '9999041', p_services := array['towarzystwo', 'demencja'],
      p_availability := array['pon-rano', 'wt-rano'], p_limit := 2, p_offset := 0
    ) with ordinality as t(
      user_id, display_name, description, updated_at, services, gminas, availability,
      matched_services, missing_services, matched_slots, missing_slots, total_count, ord
    )
    order by t.ord
  $$,
  $$ values
      ('b0000000-0000-0000-0000-000000000008'::uuid, 7::bigint),
      ('b0000000-0000-0000-0000-000000000001'::uuid, 7::bigint)
  $$,
  'page 1 (limit 2, offset 0) is [P8, P1] with total_count 7'
);

select results_eq(
  $$
    select t.user_id, t.total_count
    from public.search_caregivers(
      p_teryt := '9999041', p_services := array['towarzystwo', 'demencja'],
      p_availability := array['pon-rano', 'wt-rano'], p_limit := 2, p_offset := 2
    ) with ordinality as t(
      user_id, display_name, description, updated_at, services, gminas, availability,
      matched_services, missing_services, matched_slots, missing_slots, total_count, ord
    )
    order by t.ord
  $$,
  $$ values
      ('b0000000-0000-0000-0000-000000000002'::uuid, 7::bigint),
      ('b0000000-0000-0000-0000-000000000004'::uuid, 7::bigint)
  $$,
  'page 2 (limit 2, offset 2) is [P2, P4] with total_count 7'
);

select results_eq(
  $$
    select t.user_id, t.total_count
    from public.search_caregivers(
      p_teryt := '9999041', p_services := array['towarzystwo', 'demencja'],
      p_availability := array['pon-rano', 'wt-rano'], p_limit := 2, p_offset := 4
    ) with ordinality as t(
      user_id, display_name, description, updated_at, services, gminas, availability,
      matched_services, missing_services, matched_slots, missing_slots, total_count, ord
    )
    order by t.ord
  $$,
  $$ values
      ('b0000000-0000-0000-0000-000000000003'::uuid, 7::bigint),
      ('b0000000-0000-0000-0000-000000000005'::uuid, 7::bigint)
  $$,
  'page 3 (limit 2, offset 4) is [P3, P5] with total_count 7'
);

select results_eq(
  $$
    select t.user_id, t.total_count
    from public.search_caregivers(
      p_teryt := '9999041', p_services := array['towarzystwo', 'demencja'],
      p_availability := array['pon-rano', 'wt-rano'], p_limit := 2, p_offset := 6
    ) with ordinality as t(
      user_id, display_name, description, updated_at, services, gminas, availability,
      matched_services, missing_services, matched_slots, missing_slots, total_count, ord
    )
    order by t.ord
  $$,
  $$ values
      ('b0000000-0000-0000-0000-000000000006'::uuid, 7::bigint)
  $$,
  'page 4 (limit 2, offset 6) is the tail [P6] with total_count still 7'
);

-- (4) missing_services for P2 (has S1, selected S1+S2): exactly the one service it lacks.
select is(
  (
    select missing_services
    from public.search_caregivers(
      p_teryt := '9999041', p_services := array['towarzystwo', 'demencja'],
      p_availability := array['pon-rano', 'wt-rano'], p_limit := 50, p_offset := 0
    )
    where user_id = 'b0000000-0000-0000-0000-000000000002'
  ),
  '[{"slug": "demencja", "label": "Opieka nad osobą z demencją"}]'::jsonb,
  'P2 (offers only towarzystwo) is missing exactly demencja when both are selected'
);

-- (5) missing_slots for P1 (no slots, selected T1+T2), compared as a set (sort-independent) per the plan.
select is(
  (
    select array(select unnest(missing_slots) order by 1)
    from public.search_caregivers(
      p_teryt := '9999041', p_services := array['towarzystwo', 'demencja'],
      p_availability := array['pon-rano', 'wt-rano'], p_limit := 50, p_offset := 0
    )
    where user_id = 'b0000000-0000-0000-0000-000000000001'
  ),
  array['pon-rano', 'wt-rano'],
  'P1 (no availability) is missing both selected slots, as a set'
);

-- (6) missing_services dictionary order, not alphabetical: P7 offers only wizyty-lekarskie (sort_order 8), so
-- selecting towarzystwo (1) + demencja (11) + wizyty-lekarskie (8) lets it pass the threshold via the third
-- service while missing the other two. Expected order is sort_order (towarzystwo, then demencja); the labels'
-- alphabetical order ("Opieka..." before "Towarzystwo...") would put demencja first instead.
select is(
  (
    select missing_services
    from public.search_caregivers(
      p_teryt := '9999041',
      p_services := array['towarzystwo', 'demencja', 'wizyty-lekarskie'],
      p_availability := null, p_limit := 50, p_offset := 0
    )
    where user_id = 'b0000000-0000-0000-0000-000000000007'
  ),
  '[{"slug": "towarzystwo", "label": "Towarzystwo i rozmowa"}, {"slug": "demencja", "label": "Opieka nad osobą z demencją"}]'::jsonb,
  'missing_services for P7 lists towarzystwo before demencja (sort_order 1 then 11), not alphabetically by label'
);

-- (7) With no services selected, the threshold does not apply: P7 is included, and order falls entirely to
-- matched_slots desc, then updated_at desc, then user_id asc. total_count is 8 (every fixture).
select results_eq(
  $$
    select t.user_id, t.total_count
    from public.search_caregivers(
      p_teryt := '9999041', p_services := null,
      p_availability := array['pon-rano', 'wt-rano'], p_limit := 50, p_offset := 0
    ) with ordinality as t(
      user_id, display_name, description, updated_at, services, gminas, availability,
      matched_services, missing_services, matched_slots, missing_slots, total_count, ord
    )
    order by t.ord
  $$,
  $$ values
      ('b0000000-0000-0000-0000-000000000008'::uuid, 8::bigint),
      ('b0000000-0000-0000-0000-000000000007'::uuid, 8::bigint),
      ('b0000000-0000-0000-0000-000000000002'::uuid, 8::bigint),
      ('b0000000-0000-0000-0000-000000000004'::uuid, 8::bigint),
      ('b0000000-0000-0000-0000-000000000003'::uuid, 8::bigint),
      ('b0000000-0000-0000-0000-000000000005'::uuid, 8::bigint),
      ('b0000000-0000-0000-0000-000000000006'::uuid, 8::bigint),
      ('b0000000-0000-0000-0000-000000000001'::uuid, 8::bigint)
  $$,
  'with no services selected, P7 is no longer hidden; order is [P8,P7,P2,P4,P3,P5,P6,P1] by slots then updated_at then user_id, total_count 8'
);

-- (8) F4 regression: '', an unknown slug and a duplicate in p_services are ignored, same as selecting only
-- towarzystwo.
select results_eq(
  $$
    select t.user_id, t.matched_services, t.matched_slots, t.missing_services, t.missing_slots, t.total_count
    from public.search_caregivers(
      p_teryt := '9999041', p_services := array['', 'nieznany-slug', 'towarzystwo', 'towarzystwo'],
      p_availability := null, p_limit := 50, p_offset := 0
    ) as t
    order by t.user_id
  $$,
  $$
    select t.user_id, t.matched_services, t.matched_slots, t.missing_services, t.missing_slots, t.total_count
    from public.search_caregivers(
      p_teryt := '9999041', p_services := array['towarzystwo'],
      p_availability := null, p_limit := 50, p_offset := 0
    ) as t
    order by t.user_id
  $$,
  'p_services = {"", "nieznany-slug", "towarzystwo", "towarzystwo"} behaves exactly like {"towarzystwo"}'
);

-- (9) '' alone in p_services behaves like no services selected at all (null).
select results_eq(
  $$
    select t.user_id, t.matched_services, t.matched_slots, t.missing_services, t.missing_slots, t.total_count
    from public.search_caregivers(
      p_teryt := '9999041', p_services := array [''],
      p_availability := null, p_limit := 50, p_offset := 0
    ) as t
    order by t.user_id
  $$,
  $$
    select t.user_id, t.matched_services, t.matched_slots, t.missing_services, t.missing_slots, t.total_count
    from public.search_caregivers(
      p_teryt := '9999041', p_services := null,
      p_availability := null, p_limit := 50, p_offset := 0
    ) as t
    order by t.user_id
  $$,
  'p_services = {""} behaves exactly like p_services = null (nothing selected)'
);

-- (10) '' alone in p_availability behaves like no slots selected at all (null).
select results_eq(
  $$
    select t.user_id, t.matched_services, t.matched_slots, t.missing_services, t.missing_slots, t.total_count
    from public.search_caregivers(
      p_teryt := '9999041', p_services := array['towarzystwo'],
      p_availability := array [''], p_limit := 50, p_offset := 0
    ) as t
    order by t.user_id
  $$,
  $$
    select t.user_id, t.matched_services, t.matched_slots, t.missing_services, t.missing_slots, t.total_count
    from public.search_caregivers(
      p_teryt := '9999041', p_services := array['towarzystwo'],
      p_availability := null, p_limit := 50, p_offset := 0
    ) as t
    order by t.user_id
  $$,
  'p_availability = {""} behaves exactly like p_availability = null (nothing selected)'
);

select * from finish();
rollback;
