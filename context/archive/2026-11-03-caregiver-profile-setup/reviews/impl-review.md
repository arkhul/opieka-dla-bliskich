<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Opiekun zakłada konto i publikuje profil

- **Plan**: context/changes/caregiver-profile-setup/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4, 5
- **Date**: 2026-11-03
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 3 warnings, 5 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | WARNING |

### Automated verification (run during review)

| Command | Result |
|---|---|
| `npx supabase db reset` | PASS |
| `npx supabase db lint --level error` | PASS (no schema errors) |
| `grep -c "enable row level security" …caregiver_profiles.sql` | PASS (5) |
| `node --check scripts/generate-gminas-migration.mjs` | PASS |
| `npm run lint` | PASS |
| `npx astro check` | PASS (0 errors / 0 warnings / 0 hints) |
| `npm run build` | PASS |
| `npm run smoke` (preview :4321, after db reset) | PASS (31/31 steps) |

All Manual rows in Progress are `[x]`. The agent ran them (psql/curl, Claude in Chrome), as change.md notes. The 375 px check was done in a 375 px iframe.

### After triage

All 8 findings are FIXED. F1 and F3 were checked at runtime: psql for F1, and smoke on the existing preview for both. F2 and F4–F6 passed lint, astro check and build, but **were not checked at runtime**: the preview on :4321 serves the build from before the fixes. To do: restart the preview (`npx astro preview stop` → `npx astro preview --background --port 4321`), run `npm run smoke`, and send a `PUT /api/caregiver/profile` with `displayName: "😀"` (expected 400 with `fieldErrors.displayName`).

**Runtime check done (2026-11-03 18:40):** fresh `npm run build`, preview restarted on :4321, `npm run smoke` PASS (31/31). `PUT /api/caregiver/profile` with `displayName: "😀"` (JSON escape, so the shell cannot mangle the emoji) → 400 `{"fieldErrors":{"displayName":"Imię musi mieć od 2 do 60 znaków."}}`.

## Findings

### F1 — Limit 30 gmin do obejścia przez PostgREST

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20261103150000_caregiver_profiles.sql:150
- **Detail**: Only `save_caregiver_profile` (in plpgsql) and zod enforce the limit of 30 gminas. The `caregiver_gminas_insert_authenticated` policy lets a caregiver run `POST /rest/v1/caregiver_gminas` directly with their own JWT and any number of active gminas, up to all ~2,500. In S-02 such a profile would appear in every gmina's search. Every other rule (CHECKs on phone, e-mail and name; active gminas) holds without the RPC. The plan chose direct insert as "defense in depth" and did not account for the limit.
- **Fix A ⭐ Recommended**: Add a `before insert` trigger on `caregiver_gminas` that rejects the row (errcode `22023`, Polish message) when the caregiver already has 30 links. Put it in a new migration.
  - Strength: The rule lives in the database regardless of the path, and the RPC and existing policies stay unchanged.
  - Tradeoff: One more trigger function. Concurrent inserts can race past 30 by a few rows, which is acceptable at MVP scale.
  - Confidence: HIGH — a common pattern, and only one table needs it.
  - Blind spot: The generator's rebind step can leave a caregiver above 30 after a merge (two retired gminas → one successor never increases the count, but insert-then-delete needs a moment of headroom). Check that the trigger does not block the rebind, e.g. skip it for the `postgres` role.
- **Fix B**: Revoke direct `insert`/`delete` on `caregiver_gminas` and `caregiver_services` from `authenticated` and make `save_caregiver_profile` `security definer` with an explicit `auth.uid()` check.
  - Strength: The RPC is the only write path, so every RPC rule automatically applies.
  - Tradeoff: It drops the plan's decision (`security invoker` under RLS) and makes the RPC a privileged function. A bug in it bypasses RLS.
  - Confidence: MED — it requires rewriting the function and its grants.
  - Blind spot: Impact on future slices (S-04/S-06) that may want direct writes.
- **Decision**: FIXED (Fix A). New migration `supabase/migrations/20261103170000_caregiver_gminas_limit.sql`: a `before insert` trigger that skips rows with no `auth.uid()` (migrations, generator) and rows that already exist. Verified in psql: a direct insert of 40 rows or of a 31st row gives 22023, the RPC with 30 works twice in a row, `on conflict do nothing` at 30 gives `INSERT 0 0`, and a postgres insert has no limit. db lint and smoke pass.

### F2 — Komponenty shadcn importują `cn` z pakietu npm `cn`

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Pattern Consistency
- **Location**: src/components/ui/{badge,checkbox,command,dialog,input,label,popover,radio-group,textarea}.tsx:2–5, package.json (`"cn": "^0.5.2"`)
- **Detail**: `npx shadcn add` in phase 3 generated `import { cn } from "cn"` (shadcn-ui/cn, a "drop-in replacement for clsx + tailwind-merge") and added the dependency. However, `components.json` (`aliases.utils: "@/lib/utils"`), `button.tsx`, all application code and AGENTS.md all use `cn()` from `@/lib/utils`. The repo now has two class-merging engines, and a className already merged in the app is merged again by the other engine. This is not recorded in change.md.
- **Fix A ⭐ Recommended**: Point the 9 imports at `@/lib/utils`, remove `cn` from package.json, and add a note to AGENTS.md: "after `shadcn add`, repoint `cn` to `@/lib/utils`".
  - Strength: Keeps components.json, button.tsx and the AGENTS.md rule consistent, and leaves one proven engine (tailwind-merge).
  - Tradeoff: Every future `shadcn add` needs the same manual fix.
  - Confidence: HIGH — the edit is mechanical and the API (`cn(...inputs)`) is the same.
  - Blind spot: Whether a newer shadcn CLI version still generates `"cn"` despite the alias in components.json was not checked.
- **Fix B**: Unify on the package: `src/lib/utils.ts` → `export { cn } from "cn";`, drop `clsx`/`tailwind-merge` if unused, and record the decision in AGENTS.md.
  - Strength: One engine with no manual fixes after each `shadcn add`. `@/lib/utils` keeps working in the app.
  - Tradeoff: The whole app switches to a young 0.x package, and its tailwind-merge compatibility is not proven here.
  - Confidence: MED — it changes behavior across all of the UI.
  - Blind spot: Edge cases where the merge results differ.
- **Decision**: FIXED (Fix A). The 9 imports now point to `@/lib/utils`, `npm uninstall cn` was run, and AGENTS.md (Project Structure → `src/components/ui/`) has a note about repointing after `shadcn add`. Lint, astro check and build pass.

### F3 — Smoke „signin sends caregiver to profile” dopasowuje prefiks

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: scripts/smoke.mjs:126
- **Detail**: `location: "/profil"` uses `startsWith`, so a regression that redirects to `/profil/edycja` after sign-in would still pass. This is the same class of bug as the documented `"/"` case, for which the `exact` option was added.
- **Fix**: `{ status: 302, location: "/profil", exact: true }`.
- **Decision**: FIXED. Added `exact: true` with a comment, and smoke passes.

### F4 — Imię z emoji daje 500 zamiast błędu pola

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/caregiver/profile.ts:32 vs supabase/migrations/20261103150000_caregiver_profiles.sql:45
- **Detail**: zod `min(2)` counts UTF-16 code units, while the CHECK uses `char_length`, which counts code points. A name made of a single emoji passes zod but fails the CHECK (23514). The service maps only 22023, so the user sees a generic 500.
- **Fix**: Count code points in zod: refine `[...value].length` between 2 and 60 (and likewise ≤1000 for `description`).
- **Decision**: FIXED. A `charCount()` helper (`Array.from(value).length`; spread was flagged by `@typescript-eslint/no-misused-spread`) in `profile.ts`; `displayName` and `description` are now checked in code points. The logic was checked in node (a single "😀" fails, 60× "😀" passes, 61× fails), and lint and astro check pass. The client-side check in `CaregiverProfileForm.tsx:69` still uses `.length`. A single emoji now gets a 400 with a field error instead of a 500, and the client is never more permissive than the DB.

### F5 — Sztywny limit 13 usług w zod

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/caregiver/profile.ts:70
- **Detail**: The plan's contract (≤13 slugs) duplicates the current catalog size. Once a service is added to `public.services`, selecting all of them returns 400. The DB already rejects unknown slugs and duplicates are removed, so the cap adds nothing. This is a flaw in the plan.
- **Fix**: Remove the `refine(slugs.length <= 13)`, or cap the array at an upper bound unrelated to the catalog (e.g. 50).
- **Decision**: FIXED. The cap is now 50, with the message „Lista usług jest zbyt długa.” and a comment that the catalog is checked by `save_caregiver_profile()`. Lint and astro check pass.

### F6 — Rola czytana dwa razy na żądanie

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architecture
- **Location**: src/components/Topbar.astro:13, src/pages/profil/index.astro:28, src/pages/profil/edycja.astro:29
- **Detail**: Topbar calls `getAccountRole` on every page for a signed-in user, and the `/profil*` pages call it again. That is two extra Supabase round trips per request. It is negligible at MVP scale, but the cost will grow with each role-aware page.
- **Fix**: Read the role once in `src/middleware.ts` and store it in `Astro.locals.role` (extend `App.Locals` in `src/env.d.ts`). Defer this until the next role-dependent page.
- **Decision**: FIXED (variant: lazy getter). The middleware sets `locals.getRole()`, a memoized promise that is read at most once per request and not at all where nobody asks; it is declared in `src/env.d.ts`. Topbar (`.catch(() => null)`) and `/profil*` (inside the existing `try`) use it. The API and signin keep calling `getAccountRole` directly: the API makes one call, and signin has a new session outside `locals`. Lint, astro check and build pass.

### F7 — `caregiver_profile_missing` dostępne dla anon dla dowolnego uuid

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20261103150000_caregiver_profiles.sql:356, :413
- **Detail**: The function is `security definer` with a grant to `anon`, as the plan specifies. For any profile it reveals only whether a phone number is set, never its value, and profile ids are public anyway. This is acceptable and is the intended groundwork for S-02. Today only the owner's own page uses it.
- **Fix**: No change now. In S-02, decide whether the public list should filter completeness in SQL (a view or RPC) instead of calling the function per profile.
- **Decision**: FIXED (follow-up). No code changes. The recommendation for S-02 is queued in `context/changes/caregiver-profile-setup/follow-ups/review-fixes.md`.

### F8 — Dodatki spoza planu i luka w README

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: .gitignore, src/components/ui/dialog.tsx, package.json (`cmdk`, `radix-ui`), README.md (smoke section)
- **Detail**: All extras are harmless. `dialog.tsx`, `cmdk` and `radix-ui` are dependencies of shadcn `command`. `.gitignore` gets `supabase/snippets/` in a separate chore commit. The decisions documented in change.md (the eslint `no-misused-promises` override for `.astro`, `Cache-Control` and Topbar on `/profil*`, PUT replacing the whole profile, the smoke `exact` option, the form hint) match the code. The README smoke section still does not mention the phase-5 page steps.
- **Fix**: Add one line to the README smoke section about the `/profil` page steps (owner, anonymous user, coordinator).
- **Decision**: FIXED. The README smoke section (paragraph at line 228) now covers the `/profil` and `/profil/edycja` steps.
