<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Wyniki uszeregowane według dopasowania (S-05)

- **Plan**: context/changes/ranked-match-results/plan.md
- **Mode**: Deep
- **Date**: 2026-11-04
- **Verdict**: SOUND
- **Findings**: 0 critical, 2 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding
Grounding: 5/5 paths ✓, 9/9 symbols ✓, line refs ✓, brief↔plan ✓

Verified without a sub-agent: every rewritten and new smoke step was replayed against data accumulated by earlier runs (the current Anna/Bartek is at the top of their group or alone in it); `toPublicCaregiver` ignores the extra columns (no outage window for the old Worker on the new DB); Nowinka `2001052` is active in the seed; `Cz: noc` and the label "Opieka nad osobą z demencją" match the code and the dictionary; Progress ↔ Phase is consistent.

## Findings

### F1 — Rollback order is reversed

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Migration Notes
- **Detail**: The rollback ran "migration restoring the old function, then the previous Worker", while the phase 2 Worker needs the new columns and `count_caregivers_relaxed()`, so `/opiekunowie` would return an error in the window between the steps. The old Worker works on the new DB, so the safe order is the reverse.
- **Fix**: Previous Worker first, then the migration restoring the old function.
- **Decision**: FIXED

### F2 — CPU measured on a nearly empty production catalogue

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 3 — 3. CPU measurement and decision
- **Detail**: Worker CPU depends mainly on SSR of the cards (≤ 20), not on ranking in the database. With few profiles on production the measurement does not represent a full page, yet the decision would have been recorded as final.
- **Fix**: Record the number of cards per measured request; below 20 the decision is "provisional" with a recheck trigger.
  - Strength: The decision stays honest at no extra cost.
  - Tradeoff: The roadmap unknown may stay half-closed.
  - Confidence: MED — the number of profiles on production is not verified.
  - Blind spot: Precision of Workers Logs for values around 1–3 ms.
- **Decision**: FIXED

### F3 — Page changes the build will enforce are not listed

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 — 3. List page
- **Detail**: `index.astro:31` (`PublicCaregiverDto[]`) breaks astro check on `caregiver.match`; the `countCaregivers` import (`:8`) loses its users (lint); `gminaHint`/`noNeighbourHint` (`:86-89`) were not named.
- **Fix**: Added the type, import and `:86-89` replacement to the page contract.
- **Decision**: FIXED

### F4 — Two edge cases left to the implementer

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 — Migration (`count_caregivers_relaxed`), Smoke (`rankedInOrder`)
- **Detail**: (a) The app sends `p_services: []`, so checking only `is null` would produce a false "Usuń filtr usług" hint; (b) comparing `updated_at` as text is unreliable (varying fractional digits).
- **Fix**: (a) "no selected services" = no non-null entries, as in `search_caregivers()`; (b) `Date.parse(updated_at)`.
- **Decision**: FIXED
