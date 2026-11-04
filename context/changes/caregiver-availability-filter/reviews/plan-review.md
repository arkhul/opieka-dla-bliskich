<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Dostępność opiekuna i filtr po dostępności

- **Plan**: context/changes/caregiver-availability-filter/plan.md
- **Mode**: Deep
- **Date**: 2026-11-04
- **Verdict**: REVISE → SOUND (after fixes)
- **Findings**: 0 critical · 3 warnings · 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding
10/10 paths ✓, 6/6 symbols ✓ (save_caregiver_profile at :241 not :221; noNeighbourHint at :81 not :83), brief↔plan ✓ (both carried the F1 row-count error).

## Findings

### F1 — Macierz grantów ma 24 wiersze, nie 23

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Faza 1 (Contract, Manual, 1.6), Faza 4 (Manual, 4.2), plan-brief
- **Detail**: `20261103230000_table_grants_mirror_policies.sql:16-23` lists 20 rows; the plan adds 4 (anon select; authenticated select, insert, delete) = 24, but the plan and brief said 23.
- **Fix**: Change "23" to "24" in every place in the plan and brief.
- **Decision**: FIXED

### F2 — Smoke pisze dostępność trzeciego opiekuna, zanim on powstanie

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Faza 1 §2 — "caregiver cannot write another caregiver's availability"
- **Detail**: The DB steps run after `smoke.mjs:359`; the third caregiver is created only at `:382`, so `incompleteCaregiverId` is "" and the POST returns 400 (invalid uuid) instead of 403 from RLS.
- **Fix**: Use `caregiverId` (Anna, exists since `:254`) as the other caregiver's id.
- **Decision**: FIXED

### F3 — Podpowiedzi nie uruchomią się przy samym filtrze dostępności

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Faza 3 §3 — Podpowiedzi przy pustym wyniku
- **Detail**: Hint candidates are computed only when `filter.teryt || filter.services.length > 0` (`index.astro:54`). The plan updated `hasFilters` but not this condition, so an availability-only filter with zero results would show no "Usuń filtr dostępności" hint. Smoke always passes a gmina, so it would not catch this.
- **Fix**: The Phase 3 §3 contract says the condition at `index.astro:54` also includes `filter.availability.length > 0`.
- **Decision**: FIXED

### F4 — Asercja „dostępny” trafia też w „niedostępny”; checkboxy filtra bez nazwy

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Faza 3 §5; Faza 2 §6 AvailabilityGrid
- **Detail**: `includes("dostępny")` also matches "niedostępny". The `name` mode of AvailabilityGrid had no accessible name for its checkboxes.
- **Fix**: Assert `>dostępny<`; give the checkboxes in `name` mode `aria-label={slotLabel(slot)}`.
- **Decision**: FIXED

### F5 — Brak zapisanej liczby wyników przed wdrożeniem w Fazie 4

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Faza 4 — Manual (4.4)
- **Detail**: Criterion 4.4 compares the unfiltered result count with the count before deployment, but no step recorded that count.
- **Fix**: Phase 4 §1 first records "Wyniki: N" from production `/opiekunowie` before `db push`.
- **Decision**: FIXED
