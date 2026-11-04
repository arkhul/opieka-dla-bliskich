<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Trwałe usunięcie profilu opiekuna

- **Plan**: context/changes/caregiver-profile-deletion/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-11-04
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | WARNING |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

Every dimension marked WARNING has a single observation-level finding. There are no WARNING- or CRITICAL-severity findings.

## Evidence

- Automated checks, all re-run on 2026-11-04:
  - `npx supabase db reset`: all migrations applied, including `20261104160000_caregiver_profile_delete.sql`.
  - `npx supabase db lint --level error`: no errors.
  - `scripts/check-table-grants.sql`: passes.
  - `npm run lint`: clean.
  - `npx astro check`: 0 errors, 0 warnings, 0 hints.
  - `npm run build`: OK.
  - `npm run smoke` on a fresh build and a restarted preview: all steps passed, including the 7 REST delete steps and the 7 app delete steps.
- Manual checks 1.6 and 1.7, re-checked in the local DB:
  - Grants: `anon: SELECT` and `authenticated: DELETE, INSERT, SELECT, UPDATE`.
  - Policies: exactly one `DELETE` policy, `caregiver_profiles_delete_authenticated`, for `{authenticated}`.
- Manual checks 2.4–2.7 and 3.1–3.4: ticked with SHAs. Phase 3 changed nothing in the repo, as planned; its commit message records the `db push`, the `wrangler deploy` (`0753958e`) and the production cleanup.
- Security:
  - RLS limits the delete to the owner, and anon has no grant.
  - All 4 tables that reference `caregiver_profiles` use `on delete cascade`, and no other table references it.
  - CSRF is blocked by Astro's default `checkOrigin`, which rejects a bodyless cross-site DELETE.
  - No contact data in responses; `no-store` on every response.

## Findings

### F1 — Smoke REST steps placed differently than planned; plan not updated

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: scripts/smoke.mjs:873-996
- **Detail**: The plan puts the REST delete steps "after the availability steps (before the pages section)". The code places them after the coordinator RLS steps instead. The plan's placement could not work, because `coordinatorToken` is first set at about line 844. The reason is only in a code comment (lines 873-874), not in plan.md.
- **Fix**: Add a one-line note to plan.md Phase 1 §2 saying the steps sit after the coordinator RLS steps because `coordinatorToken` is set there.
- **Decision**: FIXED — addendum added to plan.md Phase 1 §2

### F2 — Small unplanned UX additions in the dialog and on the profile page

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: src/components/caregiver/DeleteProfileDialog.tsx:31-36, src/pages/profil/index.astro:164-166
- **Detail**: Additions the plan does not describe:
  - The dialog cannot be closed (Esc, X, overlay) while the request runs.
  - The trigger has a `Trash2` icon, and "Usuwanie…" has a spinner.
  - The "Usuwanie profilu" section has an explanatory paragraph.

  All of them are harmless and follow the plan's intent. None widens the API or the data surface.
- **Fix**: Keep as is; optionally list them in the plan addendum together with F1.
- **Decision**: FIXED — code kept; addendum added to plan.md Phase 2 §3

### F3 — DELETE handler swallows the exception without logging

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/api/caregiver/profile.ts:195
- **Detail**: `catch {}` returns 500 and logs nothing, so a failed delete on production leaves no trace in `wrangler tail`. The GET and PUT handlers in the same file do the same, but other endpoints log the error: `src/pages/api/dictionaries/gminas.ts:44` and `services.ts:17` (`console.error(...)`).
- **Fix**: Change to `catch (error) { console.error("Caregiver profile delete failed", error); … }`. Doing the same for GET and PUT would be a separate change.
- **Decision**: FIXED — `console.error` added to the DELETE catch (lint + astro check clean); production picks it up at the next deploy
