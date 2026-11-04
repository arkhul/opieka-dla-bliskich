---
date: 2026-11-04T23:01:40+01:00
researcher: Claude (Sonnet 5.5)
git_commit: 5706fa4771c029ee84558e580b4d57170079d952
branch: master
repository: 10xdevs (10x-astro-starter, "Opieka dla bliskich")
topic: "Ground rollout Phase 3 of test-plan.md: risks #3 (contact leak), #4 (write/delete abuse, default grants), #6 (partial-write data loss)"
tags: [research, testing, contact-data, rls, table-grants, save-caregiver-profile, smoke, pgtap]
status: complete
last_updated: 2026-11-04
last_updated_by: Claude (Sonnet 5.5)
---

# Research: Phase 3 — contact and write boundaries (risks #3, #4, #6)

**Date**: 2026-11-04T23:01:40+01:00
**Git Commit**: 5706fa4771c029ee84558e580b4d57170079d952 (working tree: `test-plan.md` modified, this change folder untracked; no `src/`, `supabase/` or `scripts/` file is modified)
**Branch**: master

## Research Question

Ground Phase 3 of `context/foundation/test-plan.md` (§3 row 3). For #3, #4 and #6: find the real failure path in code, quote it, verify or correct the Risk Response Guidance, locate existing smoke coverage, name the cheapest useful test layer, and flag speculative risks or misleading hot-spot evidence.

## Summary

- **Coverage already in place is large.** `scripts/smoke.mjs` has 112 steps in the `steps` array that starts at line 195 (14 one-line `["name", …]` entries plus 98 multi-line entries, counted by pattern); the contact-leak and delete-abuse paths are covered at the HTTP and PostgREST level. The Phase 3 job is gap-closing, not building. Most gaps are *write* paths other than delete and the *role* table.
- **#3 (contact leak)**: no public route or public API serves contact data in this inspected tree. Contact data is read from exactly one table (`caregiver_contacts`), which anon has no grant on (live local DB, see Detailed Findings §#3). It is rendered in exactly two places: `/kontakt/[id].astro` (protected) and the owner's own pages/API (`/profil`, `/profil/edycja`, `GET|PUT /api/caregiver/profile`). The guidance's "could hide in JSON or attributes" challenge is already answered by the smoke assertions, which scan the full response text, not just visible fragments. Residual gaps are small (see list below).
- **#4 (write abuse)**: the live local database matches the documented grant matrix (25 grant rows to `anon`/`authenticated`, 25 policies, row-level security on all 8 `public` tables). Smoke covers anon/other-caregiver/coordinator **delete** of a profile and a few inserts. It does **not** cover: another user's `UPDATE` on `caregiver_profiles`/`caregiver_contacts` (contact hijack), another user's `INSERT`/`DELETE` on `caregiver_gminas`/`caregiver_services`, any write to `accounts` (role escalation unlocks every complete contact), or anon execution of `save_caregiver_profile`. **Correction to the guidance**: `scripts/check-table-grants.sql` proves only "no `TRUNCATE`/`REFERENCES`/`TRIGGER` for anon/authenticated on any `public` table"; it does not prove "no default ALL" in the sense of *excess* `SELECT/INSERT/UPDATE/DELETE`, nor does it look at views or functions.
- **#6 (partial-write data loss)**: **the guidance's premise needs reframing.** `PUT /api/caregiver/profile` is a *full replace*, not a patch. A body that omits `gminas`, `services` or `availability` is parsed with `.default([])` and clears those lists; omitted `phone`/`email`/`description` become `null`. "Editing one field leaves the rest untouched" is therefore a property of the *form round-trip* (GET → change one field → PUT everything), not of the endpoint. The only partial-write protection that exists in the database is `p_availability = null` ⇒ keep, and smoke covers it (RPC shape, second caregiver). No smoke step edits one field via the API and then re-reads all the others.
- **Cheapest layer**: #3 stays in smoke (HTTP surfaces). #4's RLS/grant matrix is cheaper and stronger as **pgTAP** (`supabase test db`: one transaction, no accumulating users, `set local role` + JWT claims) than as more smoke steps; 1–2 PostgREST-level probes in smoke are still worth keeping where HTTP semantics matter (0-rows-not-error). #6 fits smoke (needs the API + Zod defaults + the RPC together).

## Detailed Findings

### Risk #3 — contact data reaching an unauthenticated visitor

**Where contact data lives and who can read it (this inspected tree).**

- Storage: `public.caregiver_contacts (phone, email)` keyed by `caregiver_id` — `supabase/migrations/20261103150000_caregiver_profiles.sql:93-98`.
- Grants: `revoke all … from anon, authenticated` then `grant select, insert, update … to authenticated` — `supabase/migrations/20261103230000_table_grants_mirror_policies.sql:47-48`. **Observed live** on the local DB (`supabase db query --local`, role_table_grants): `caregiver_contacts` has grantee `authenticated` = `INSERT,SELECT,UPDATE` and no row for `anon`. Total rows for anon/authenticated in `public`: 25, equal to the 25-row matrix in `20261104160000_caregiver_profile_delete.sql:19-26`.
- Read policy (the only select policy): owner **or** (coordinator **and** complete profile) — `supabase/migrations/20261103220000_coordinator_contact_access.sql:31-44`.
- Probes run once against the local DB as anon (read-only, 2026-11-04): `GET /rest/v1/caregiver_profiles?select=user_id,caregiver_contacts(phone,email)` → HTTP 401 `permission denied for table caregiver_contacts` (the PostgREST **embed** path is closed by the grant); `POST /graphql/v1` → "pg_graphql extension is not enabled"; `POST /rpc/save_caregiver_profile` → 401 `permission denied for function`. These probes are not in smoke today.
- Functions callable by anon (live `has_function_privilege`): `caregiver_profile_missing` (SECURITY DEFINER, by design, returns `text[]` of missing item names only — `20261103150000_caregiver_profiles.sql:356-391`), `count_caregivers_relaxed`, `get_public_caregiver`, `search_caregivers`, `normalize_pl`. None returns a `phone`/`email` column in the inspected definitions (`get_public_caregiver` returns `user_id, display_name, description, services, gminas, availability`: `20261103220000_coordinator_contact_access.sql:56-98`, recreated in `20261104120000_caregiver_availability.sql:359`).

**Where the app renders it.**

- `src/pages/kontakt/[id].astro:29-32` reads `getPublicCaregiver` + `getCaregiverContact` together; whether `contact` comes back "is decided by RLS alone" (comment at :28). `:51-55` forces `contact = null` and 404 when the profile is not publicly visible. Route is protected: `src/middleware.ts:7` (`PROTECTED_ROUTES` contains `/kontakt`), redirect to sign-in at `:49-51`.
- `getCaregiverContact` — `src/lib/services/caregiver.service.ts:302-315` — is the only service function that selects from `caregiver_contacts` for another user's id. The owner's own contact comes from `getOwnProfile` (`:96-132`, embed `caregiver_contacts(phone, email)` at `:61`), served by `GET|PUT /api/caregiver/profile` behind `guard()` (401/503/403, `src/pages/api/caregiver/profile.ts:103-120`) and `Cache-Control: private, no-store` (`:16`).
- Public pages take `PublicCaregiverDto` only; `CaregiverPublicDetails.astro:3-6` states contact data "cannot be passed to it". `/opiekunowie/[id].astro` and `/opiekunowie` have one React island each (`GminaSelect client:load`, `src/pages/opiekunowie/index.astro:137`), whose serialized props are the selected gmina, not profile data.
- Search indexing: every response that passes middleware gets `X-Robots-Tag: noindex` (`src/middleware.ts:14-23`, applied at `:49-55`). `astro.config.mjs` registers `sitemap()` but sets no `site`; the existing `dist/client` listing contains no `sitemap*` file (checked once on the build output present in the working tree, which may be stale relative to HEAD). There is no `public/robots.txt` (`public/` holds `favicon.png`, `template.png`).

**Existing smoke coverage for #3** (line = start of the step in `scripts/smoke.mjs`):

| Surface | Step | Line |
|---|---|---|
| DB, anon, contacts table | "anon cannot read caregiver contact" (401 + `deniesTable`) | 354 |
| DB, anon, public RPC JSON | "anon reads public caregiver" (no `phone`/`email`/`caregiver_contacts` key, no contact e-mail/phone in `JSON.stringify`) | 667 |
| DB, caregiver ≠ owner | "second caregiver cannot read first caregiver contact" (200, `[]`) | 631 |
| DB, coordinator positive control | "coordinator reads complete caregiver contact" / "…cannot read incomplete…" | 877 / 885 |
| HTML, anon list | "caregiver list renders for anonymous user" (`noindex` header + `hidesListContact`: phone in 3 forms, contact e-mail, login e-mail) | 696 |
| HTML, anon profile | "public profile page hides contact" (+ `hidesProfileContact`) | 805 |
| HTTP, anon contact page | "contact page redirects anonymous user" | 834 |
| HTML, coordinator positive control | "contact page shows contact to coordinator" (`tel:+48600100200`, e-mail, `noindex`) | 1027 |
| HTML, caregiver on someone else's contact | "contact page hides contact from caregiver" | 1042 |
| API, anon | "profile API requires a session" (401) | 830 |

**Verdict on the guidance.**

- *"Page doesn't render the field, so it isn't leaking (could be in JSON/attributes)"* — **already defended**: `hidesListContact` / `hidesProfileContact` (`scripts/smoke.mjs:159-163`) run `text.includes(secret)` over the whole HTML body, which covers attributes and serialized island props. They also have positive controls: the same fixture's phone/e-mail are found on `/kontakt/<id>` for a coordinator (line 1027) and the card name is asserted on the public pages. The secrets come from the fixture constants (`completeProfile`, lines 173-183), not from a response, so there is no oracle problem.
- *"Avoid asserting absence of a fragment that wouldn't appear even if leaking"* — one weak spot: `"600 100 200"` is a substring of the formatted `+48 600 100 200` that `formatPlPhone` produces (`src/lib/phone.ts:13-16`), so the check does cover the app's only rendering of a phone. Variants the app never renders (e.g. `600-100-200`) are not checked; this is not a realistic leak shape. The check on the login e-mail relies on the signed-in Topbar, which is irrelevant for anon pages.
- **Remaining gaps (inspected scope = `scripts/smoke.mjs` as of this commit)**:
  1. The PostgREST **embed** path (`caregiver_profiles?select=…,caregiver_contacts(…)`) as anon and as a non-coordinator caregiver has no smoke step. Probed once for anon (401); not probed for a signed-in caregiver.
  2. `Cache-Control: private, no-store` on `/kontakt/[id]` and on the profile API is set in code (`[id].astro:12`, `profile.ts:16`) but no step asserts it; `hasNoindex` is asserted on 3 pages only (list, public profile, contact), not on e.g. the sign-in page or the 404 for a malformed id. Contact-bearing pages are the first three.
  3. `GET /api/caregiver/profile` as a **coordinator** (should be 403, `profile.ts:103-120`) — smoke covers coordinator `PUT` (line 853) and `DELETE` (line 858), not `GET`.
  4. No assertion on the sitemap/robots surface (none is emitted today, per the single `dist` listing). If `site` is ever added to `astro.config.mjs`, `@astrojs/sitemap` becomes a new indexing surface; a cheap guard is "no `sitemap*` file in the build output and no `/kontakt` path in it".
  5. Accepted risk that must **not** be tested as a leak: any coordinator can fetch every complete profile's contact with one unfiltered `GET /rest/v1/caregiver_contacts` (`20261103220000_coordinator_contact_access.sql:16-19`; PRD accepts it, plan-review F3). Assert the *boundary* (coordinators get only complete profiles — covered at 885), not that mass-read is blocked.
- **Speculative / out of scope**: `display_name` and `description` are public free text (anon select policies `using (true)`: `20261103150000_caregiver_profiles.sql:64-66`); a caregiver can type a phone number into them. The app cannot detect that and no test can meaningfully assert it. Also: incomplete profiles' public columns (name, description, gminas, services) are readable by anon straight from the tables; only `search_caregivers()`/`get_public_caregiver()` filter on completeness. No contact data is involved, so this is not a #3 failure.

**Hot-spot evidence check.** The plan cites `src/pages/api/` and `src/components/caregiver/` as likelihood evidence for #3. In this tree, contact data is not served by any route under `src/pages/api/` other than the owner's `caregiver/profile`; `src/pages/api/auth/*` (the other hot files: 2 commits each in the 30-day window) and `dictionaries/*` handle no contact data. The real surfaces for #3 are the table grants, the select policy and the three pages above. Treat the hot-spot as *weak* evidence for #3.

### Risk #4 — modify/delete/mass-read someone else's data via the database API

**The write boundary as implemented** (policy → operation → who):

| Table | insert | update | delete | Source |
|---|---|---|---|---|
| `caregiver_profiles` | `user_id = uid` and role `caregiver` | `user_id = uid` (using and with check) | `user_id = uid` | `20261103150000…:72-87`, `20261104160000…:34-36` |
| `caregiver_contacts` | `caregiver_id = uid` | `caregiver_id = uid` | no grant, no policy | `20261103150000…:113-120` |
| `caregiver_gminas` | `caregiver_id = uid` and gmina active; 30-row trigger | none | `caregiver_id = uid` | `20261103150000…:150-164`, `20261103170000…:18-56` |
| `caregiver_services` | `caregiver_id = uid` | none | `caregiver_id = uid` | `20261103150000…:190-196` |
| `caregiver_availability` | `caregiver_id = uid` | none | `caregiver_id = uid` | `20261104120000…:61-72` |
| `accounts` | no policy, no grant | no policy, no grant | no policy, no grant | `20261103150000…:33-35`, `20261103230000…:37-38` |
| `gminas`, `services` | none | none | none (select only) | `20261103230000…:28-32` |

All 8 `public` tables (`accounts`, `caregiver_availability`, `caregiver_contacts`, `caregiver_gminas`, `caregiver_profiles`, `caregiver_services`, `gminas`, `services`) have row-level security enabled, and there are no views, materialized views or sequences in `public` (live `pg_class` query, `relkind in ('r','p','v','m','S')`, returned exactly these 8 relations). The live `pg_policies` list has 25 policies: accounts 1, availability 4, contacts 3, caregiver_gminas 4, profiles 5, caregiver_services 4, dictionaries 2+2 — one per operation and role, as the policy table above states. Note "coordinator cannot write" is **not** a separate rule: coordinators simply have no row they own, and the profile insert policy requires the `caregiver` role.

Role escalation matters here: `accounts.role` gates the contact select policy (`20261103220000…:36-41`). A path to `UPDATE`/`INSERT` on `accounts` — or a trigger that re-reads role from editable user metadata — would turn "caregiver" into "coordinator" and open every complete contact. Current state: `handle_new_user()` is an `after insert` trigger on `auth.users` only (`20261103150000…:229-232`), `authenticated` has `SELECT` only on `accounts`. The signup role itself is chosen by the visitor (`options.data.role`), which is by design.

**What `check-table-grants.sql` actually proves.** `scripts/check-table-grants.sql:9-16` lists `anon`/`authenticated` × {`TRUNCATE`,`REFERENCES`,`TRIGGER`} on `pg_class` rows with `relkind in ('r','p')` in `public`, and raises if any hit. Consequences:
- A new table whose migration forgot `revoke all` keeps Supabase's default `ALL`, which includes `TRUNCATE` ⇒ it **is** caught. This is the failure the guidance names, and the check is a valid proxy for it.
- A table that revokes and then **over-grants** (e.g. `grant delete … to anon`) is **not** caught; neither is a policy-less `UPDATE` grant (RLS would deny it, but nothing asserts that). The guidance phrase "no table carries default ALL grants" is satisfied; the stronger "grants equal the documented matrix" is not asserted anywhere automatically (the matrix is a comment in migrations; I compared it manually to the live DB: 25 rows, equal).
- Views (`relkind v/m`), sequences and function `EXECUTE` are outside the query. Functions default to `EXECUTE` for PUBLIC; each migration here revokes it explicitly, and live state is correct (e.g. `save_caregiver_profile`: anon false / authenticated true; trigger functions false/false), but nothing guards a *future* `create function` that forgets the revoke.

**Existing smoke coverage for #4** (direct to PostgREST, bypassing the app):

| Case | Step | Line |
|---|---|---|
| anon `POST gminas` (dictionary) → 401 grant denial | "anon cannot write gminas dictionary" | 364 |
| signed-in `POST services` → 403 grant denial | "signed-in user cannot write services dictionary" | 433 |
| anon `POST caregiver_availability` → 401 | "anon cannot write caregiver availability" | 461 |
| caregiver inserts availability row for another → 403 RLS | "caregiver cannot write another caregiver's availability" | 470 |
| coordinator `POST caregiver_profiles` → 403 | "coordinator cannot create caregiver profile" | 890 |
| anon `DELETE caregiver_profiles` → 401 | "anon cannot delete a caregiver profile" | 944 |
| other caregiver `DELETE` → 200, `[]`, target still present afterwards | "other caregiver cannot delete a profile" | 949 |
| coordinator `DELETE` → same | "coordinator cannot delete a profile" | 964 |
| owner delete cascades to contact/gminas/services/availability | "deleted profile leaves no data" | 988 |
| anon `GET accounts` → 401 | "anon cannot read account roles" | 359 |

**Verdict on the guidance.**

- *"The app blocks it, so the database does too"* — correct challenge, and partially answered: the delete steps go to PostgREST with real tokens. The pattern at 949/964 is the right one: PostgREST answers an RLS-filtered delete/update with 200 and zero rows rather than an error, so a status-only assertion would be a false green; those steps assert both the empty `return=representation` result and that the row is still readable afterwards.
- **Uncovered write paths (scope: `scripts/smoke.mjs` as of this commit; `grep` for `PATCH` finds 0 occurrences, and `rest/v1/accounts` appears only in the anon read at line 360)**:
  1. Another caregiver `PATCH caregiver_contacts?caregiver_id=eq.<victim>` (change phone/e-mail) and `POST caregiver_contacts` for another id — highest impact: silent contact hijack/vandalism.
  2. Another caregiver `PATCH caregiver_profiles` (display name/description), and own `PATCH` that tries to change `user_id` (with check).
  3. Another caregiver `POST`/`DELETE` on `caregiver_gminas` and `caregiver_services`; `DELETE` on `caregiver_availability` of another (only the availability *insert* is covered). A successful delete silently removes the victim from search.
  4. Authenticated (caregiver and coordinator) `PATCH`/`POST`/`DELETE` on `accounts` (role escalation); optionally `PUT /auth/v1/user` with `data.role` and confirm `accounts.role` unchanged.
  5. A 31st direct `POST caregiver_gminas` row by the owner (the 30-limit trigger, `20261103170000…:54-56`) — no smoke step.
  6. anon (and coordinator) `POST /rpc/save_caregiver_profile` (anon denial probed live: 401; coordinator denial is covered via the app at line 853, not via RPC).
  7. A grants-equal-matrix assertion (and a function-`EXECUTE` assertion) — see above.
- **Speculative / do not over-test**: `UPDATE`/`TRUNCATE` on tables from `service_role` (not reachable with the keys the app ships), and graphql (extension disabled locally; production state not verified in this research — `Open Questions`).

**Hot-spot check.** `supabase/migrations/` (11 commits/30d per the plan) is relevant evidence for #4: the directory holds 13 migration files, and each new table since `20261103230000…` repeated the revoke/grant pattern (availability: `20261104120000…:69-72`); the one historical miss (default `ALL` left) was already fixed by `20261103230000…`. Verdict: hot-spot evidence is **valid** for #4.

### Risk #6 — a profile save silently drops previously saved data

**Real failure path (write contract).**

- Entry points: `PUT /api/caregiver/profile` (`src/pages/api/caregiver/profile.ts:136-180`) → `saveOwnProfile` (`src/lib/services/caregiver.service.ts:135-152`) → RPC `save_caregiver_profile` (latest definition: `supabase/migrations/20261104130000_save_profile_keeps_availability.sql:14-157`).
- Body parsing: `gminas`, `services`, `availability` use `.default([])` (`profile.ts:74,81,91`); `description`, `phone`, `email` use `optionalText` = missing/null/blank → `null` (`:31-38`). `displayName` is required. So **an omitted array becomes `[]`**.
- RPC semantics: for gminas and services, rows not in the new array are deleted (`…130000:128-130, 137-139`): an empty array deletes all; contacts upsert overwrites phone/email with the given values including `null` (`:121-126`). For availability: `p_availability is null` ⇒ keep, any array (also `{}`) ⇒ replace (`:96-153`, the F1 fix from `2026-11-04-caregiver-availability-filter/reviews/impl-review.md:29-37`).
- Net effect for a body like `{ "displayName": "Nowe imię" }` (inspected by reading; **not executed**): the API clears gminas, services, availability, phone, e-mail and description in one successful call; the response is 200 with `profile.missing` listing `phone`, `gminas`, `services`, and the caregiver disappears from `search_caregivers()` because `caregiver_profile_missing()` is no longer empty. The application UI cannot produce that body: `CaregiverProfileForm.tsx:101-111` builds the full command from state initialised from `initialProfile` (`:50-57`), with the comment "PUT replaces the whole profile, so every field is sent".
- The save is atomic: validation (22023) happens before any write and the function is a single plpgsql call, so a rejected save leaves existing data unchanged (reading of `…130000:62-112` before the first write at `:114`). A retired gmina in the list makes the whole save fail rather than dropping data silently; the form also blocks it client-side (`CaregiverProfileForm.tsx:80-81`).

**Where "200 means data intact" is weaker/stronger than the guidance says.** `PUT` returns `getOwnProfile` re-read after the RPC (`profile.ts:175`), not an echo of the request, so the 200 body already reflects stored state. That is a real signal, but it goes through the same service mapping that could drop a field, so an independent read (owner's PostgREST read of `caregiver_contacts`, anon `search_caregivers`/`get_public_caregiver`) is a stronger oracle.

**Existing smoke coverage for #6.**

| Case | Step | Line |
|---|---|---|
| Full save returns name, phone, completeness, availability | "profile save normalizes phone and completes profile" — does **not** assert gminas, services, e-mail, description | 318 |
| Save without phone → incomplete, not listed | "profile save without phone leaves profile incomplete" / "search hides incomplete profile" | 298 / 313 |
| RPC 6-parameter shape keeps availability | "profile save without availability keeps it" (second caregiver, RPC, not API) | 585 |
| Explicit `[]` clears availability | "profile save with empty availability clears it" | 604 |
| No step: edit **one** field via the API, then compare **all** other fields (name, description, phone, e-mail, gminas, services, availability) before/after |  | — |

**Verdict on the guidance.**

- *"Prove editing one field leaves the rest untouched"* — **reframe**: at the API contract the property is false by design (full replace). The test should (a) lock the round-trip contract the form relies on — GET the profile, change exactly one field, PUT the whole command built from the GET, then compare **every** field including `gminas`, `services`, `availability`, `description`, `email` — and (b) decide, as a plan-time product decision, whether the omitted-array behaviour is acceptable or should become a 400 (that would be a code change, outside this change's "tests only" scope). Without (b), a test asserting "PUT with one field keeps the rest" would fail today; a test asserting "PUT with one field clears the rest" would pin a surprising behaviour — avoid either unless decided.
- *"Avoid asserting only the edited field"* — confirmed: every current save step asserts a subset (line 318 omits gminas/services/e-mail).
- The cheapest layer is smoke (API + Zod defaults + RPC together). A pgTAP test could additionally pin the RPC contract (`null` keeps availability; arrays replace; gminas/services replace), but the RPC semantics are already partly pinned by smoke 585/604 and the Zod default is not visible at that layer.
- Concurrency (two tabs, last-write-wins) is **speculative** for this change: no version/etag exists and no evidence of an incident; not recommended for Phase 3.

**Hot-spot check.** `src/pages/api/` (profile.ts changed 6 times in the 30-day window per `git log`) and `src/components/caregiver/` (`CaregiverProfileForm.tsx` 4 times) are valid likelihood evidence for #6 — they are where the full-replace contract is shaped. However, the actual destructive step is in SQL (`supabase/migrations/20261104130000_…`), so the hot-spot directories point at the *producer* of the command, not at the deletion logic.

## Code References

- `src/middleware.ts:7` — `PROTECTED_ROUTES = ["/dashboard", "/profil", "/kontakt"]`; `:14-23` `withNoindex`; `:49-55` redirect + noindex.
- `src/pages/kontakt/[id].astro:12,28-32,35-41,51-55` — contact page: no-store header, RLS-decided contact, role explanation, 404 forces `contact = null`.
- `src/pages/opiekunowie/[id].astro:133,148,190-196` — public profile page; contact only as a link to `/kontakt/<id>`.
- `src/components/caregiver/CaregiverPublicDetails.astro:3-6` — takes `PublicCaregiverDto` only.
- `src/pages/api/caregiver/profile.ts:16,31-38,74,81,91,103-120,136-180,183-201` — JSON helper with no-store, optional text, `.default([])` lists, guard, PUT, DELETE.
- `src/lib/services/caregiver.service.ts:96-132,135-152,156-164,302-315` — own profile read, save RPC call, delete, contact read.
- `src/components/caregiver/CaregiverProfileForm.tsx:50-57,101-111` — state from `initialProfile`, full-command PUT.
- `supabase/migrations/20261103150000_caregiver_profiles.sql:64-87,93-120,150-164,190-196,241-344,356-391` — policies, contacts table, original save function, completeness rule.
- `supabase/migrations/20261103220000_coordinator_contact_access.sql:16-19,31-44` — accepted mass-read risk; contact select policy.
- `supabase/migrations/20261103230000_table_grants_mirror_policies.sql:28-56` — revoke-all-then-grant for each table.
- `supabase/migrations/20261104130000_save_profile_keeps_availability.sql:14-157` — current `save_caregiver_profile` (null = keep availability).
- `supabase/migrations/20261104160000_caregiver_profile_delete.sql:34-42` — owner delete policy and grant.
- `scripts/check-table-grants.sql:9-16` — TRUNCATE/REFERENCES/TRIGGER check, `relkind in ('r','p')`.
- `scripts/smoke.mjs:103-116` — `supabase()` helper (direct PostgREST, token optional); `:120-123` `deniesTable`; `:159-163` hide-contact predicates; `:173-183` `completeProfile` fixture.
- `.github/workflows/ci.yml:56,59,71-72` — grants check, `supabase test db`, smoke + e2e.

## Architecture Insights

- Contact privacy is enforced in three independent layers: table grant (anon has none), RLS select policy (owner or coordinator + complete profile), and type-level separation in the app (`PublicCaregiverDto` has no contact fields; `CaregiverPublicDetails` accepts only it). The smoke suite tests the layers from outside; none of the layers is tested in isolation at the database level except via PostgREST.
- Role (`accounts.role`) is a security input to RLS, not just a UI flag. Its integrity is the single most valuable invariant on the write side and has zero direct tests.
- Every new table so far repeats: enable RLS → `revoke all` → explicit grants → one policy per operation and role. The grants matrix lives only in migration comments; CI enforces a negative subset of it.
- Test infrastructure available: smoke (HTTP + PostgREST with real user tokens, state accumulates across runs, steps are order-dependent on the shared `jar` cookie session), pgTAP with fixture users inserted into `auth.users` (trigger creates `accounts`) and `set local role anon` (`search_caregivers_gmina.test.sql:111`), but no existing pgTAP test uses `authenticated` + JWT claims (`grep "jwt|set local"` finds only `set local role anon` at the two quoted lines).

## Historical Context (from prior changes)

Each sentence scored separately against this tree.

- `context/archive/2026-11-04-caregiver-availability-filter/reviews/impl-review.md:29-37` (F1: omitting `p_availability` cleared availability) — **supported and resolved**: migration `20261104130000_…` makes the default `null` = keep; smoke steps 585/604 pin both behaviours. The note's reasoning concerned an old-Worker rollback via the RPC shape; it says nothing about the API's Zod defaults, which are still full-replace (**not contradicted, but not covering #6 at the API level**).
- `context/archive/2026-11-03-contact-reveal-after-signin/reviews/plan-review.md` F3 (mass read by one unfiltered GET not named as a risk) — **supported and resolved**: documented in `20261103220000…:16-19`.
- Test-plan row #4 cites `caregiver-profile-setup` impl-review F1 (30-gmina limit bypassed via direct DB API) — **partial**: I confirmed the fix exists (`20261103170000_caregiver_gminas_limit.sql`, trigger at `:54-56`), not the review text itself; `grep` of `scripts/smoke.mjs` for `31`, `30 gmin` and `limit` (excluding `p_limit`) finds no step for a 31st direct `caregiver_gminas` insert, so that bypass has no regression test either (a #4 gap).
- Test-plan row #3 cites `caregiver-profile-setup` impl-review F7 (`caregiver_profile_missing` anon-callable) — **supported**: F7 text read; function still anon-executable live and returns only `text[]`; accepted.
- Test-plan §6.2/§6.4 say "TBD — see Phase 3": still true (this change fills them).

## Related Research

- `context/archive/2026-11-04-testing-matching-correctness/` and `context/archive/2026-11-04-testing-browser-flow/` — Phases 1–2 of the same rollout (pgTAP pattern §6.1; Playwright §6.3). Not re-read for this document beyond `test-plan.md` §6.5.

## Open Questions

1. **Product/code decision for #6**: should `PUT /api/caregiver/profile` keep treating omitted arrays as empty, or reject them (400) / treat them as "keep" like `p_availability = null`? Phase 3 is test-only; the answer decides which assertion is correct for partial bodies.
2. **Layer for #4**: smoke-only (consistent with test-plan §3 "integration", fewer new tools) versus pgTAP for the RLS/grant matrix (stronger, rolled back, but first use of `authenticated` + JWT claims in pgTAP). Recommendation: pgTAP for the matrix and per-operation denials, plus 1–2 smoke probes where PostgREST semantics matter (0-rows-not-error, `accounts`). User/plan choice.
3. **Production parity**: this research read the **local** database. The production grants, `pg_graphql` state and sitemap were not verified (test-plan §5 lists the deployed-Worker smoke as optional/manual).
4. Whether to extend `check-table-grants.sql` to also assert the exact grant matrix and function `EXECUTE` for anon (cheap, CI already runs it) or leave the matrix as a pgTAP assertion.
5. The text of `caregiver-profile-setup` impl-review F1 (30-gmina direct insert) was taken from the test plan, not re-read; only the migration fix and the absent smoke step were checked.
