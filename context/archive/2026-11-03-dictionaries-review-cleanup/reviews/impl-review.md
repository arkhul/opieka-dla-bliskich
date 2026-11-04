<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Domknięcie ustaleń z przeglądu F-01 i porządki w roadmapie

- **Plan**: context/changes/dictionaries-review-cleanup/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-11-04
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 2 observations

## Verdicts

| Dimension           | Verdict              |
| ------------------- | -------------------- |
| Plan Adherence      | PASS                 |
| Scope Discipline    | PASS                 |
| Safety & Quality    | PASS (1 observation) |
| Architecture        | PASS (1 observation) |
| Pattern Consistency | PASS                 |
| Success Criteria    | PASS                 |

## Evidence

- Diff `fdad6eb..43411fe` matches the plan file for file: migration `20261103230000_table_grants_mirror_policies.sql`, `scripts/smoke.mjs` (privilege steps + try/catch loop), `AGENTS.md` Hard Rule, `src/middleware.ts`, `src/pages/api/dictionaries/{gminas,services}.ts`, `README.md`, archived F-01 review, `roadmap.md`. No unplanned code changes.
- Re-run during this review: `npm run lint` (0 errors), `npx astro check` (0 errors/warnings/hints), `npm run build` (complete), `npx supabase db lint` (no schema errors), local privilege query (exactly the 20-row matrix, no TRUNCATE/REFERENCES/TRIGGER), `npm run smoke` against the local preview (all steps passed, including `anon cannot write gminas dictionary` → 401 and `signed-in user cannot write services dictionary` → 403), `BASE_URL=http://localhost:4399 npm run smoke` (59 FAIL lines with `-> error fetch failed`, summary `59 step(s) failed`, exit 1, no unhandled exception), `grep -c "Decision\*\*: PENDING"` on the F-01 review (0), `npx prettier --check` on roadmap and F-01 review (pass).
- Production, read-only: `npx supabase db query --linked` privilege count = 20, forbidden privileges = 0; `npx wrangler deployments list` shows a deployment at 2026-11-04T03:23Z, after `f8933a0`.
- Not re-run: `npx supabase db reset` (wipes local data; the migration is already applied and the matrix checks out). Manual rows 1.6, 2.4, 2.5, 3.3, 3.5, 4.3 were taken from the implementation run; 4.3 confirmed in the `ff423c9` diff.

## Findings

### F1 — Nothing in CI stops a future table from shipping with Supabase's default ALL grants

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: .github/workflows/ci.yml:59 (N/A — missing check)
- **Detail**: The plan deliberately skips `alter default privileges` (What We're NOT Doing). That leaves the AGENTS.md Hard Rule as the only protection for the S-04/S-06 tables. The smoke privilege steps check named tables (`gminas`, `services`, `caregiver_contacts`, `accounts`), so a new table that forgets `revoke all` still passes CI with INSERT/UPDATE/DELETE/TRUNCATE granted to `anon`/`authenticated`. CI already runs a local Supabase (`ci.yml:51-52`), so a check that applies to every table is cheap to add.
- **Fix**: Add a CI step after `supabase start` that runs `supabase db query --local` and fails when any `public` table grants `TRUNCATE`, `REFERENCES` or `TRIGGER` to `anon`/`authenticated`. Write it so it covers every table, not a list of names.
  - Strength: Covers S-04/S-06 tables without anyone editing the check; uses the query already in the plan; the forbidden set is stable even as the allowed matrix grows.
  - Tradeoff: One more CI step to maintain. It catches only the "forgot revoke" case (TRUNCATE is the signature of default ALL), not a wrong INSERT/UPDATE grant on a new table.
  - Confidence: MED — `supabase db query --local` works with the pinned CLI 2.117.0 locally; its output format/exit code in CI has not been checked.
  - Blind spot: Whether `supabase db query` returns non-zero on SQL errors; a `do $$ … raise exception` wrapper may be needed for a failing exit code.
- **Decision**: FIXED — `scripts/check-table-grants.sql` (a DO block that raises if any `public` table grants TRUNCATE/REFERENCES/TRIGGER to anon/authenticated) plus a `Check table grants` step in `.github/workflows/ci.yml` after `Start local Supabase`. Checked locally: exit 0 on the current schema; a probe table created without revoke gives exit 1 with the table and privileges listed, and the probe is rolled back.

### F2 — Middleware skips auth for the whole `/api/dictionaries/` prefix

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architecture
- **Location**: src/middleware.ts:28
- **Detail**: `startsWith("/api/dictionaries/")` sets `locals.user = null` for every current and future route under the prefix. Today both endpoints ignore `locals` (they build their own client, `gminas.ts:33`, `services.ts:6`), so this is correct. But a later dictionary endpoint that reads `locals.user` or `locals.getRole()` would silently get `null`. Only the comment documents this.
- **Fix**: Accept as is (the comment documents the contract), or narrow the bypass to the two exact paths if another endpoint under `/api/dictionaries/` is planned.
- **Decision**: FIXED — `src/middleware.ts`: `NO_AUTH_ROUTES` set with the exact paths `/api/dictionaries/gminas` and `/api/dictionaries/services` replaces the prefix check; lint, astro check and build green, smoke passes on a fresh preview.
