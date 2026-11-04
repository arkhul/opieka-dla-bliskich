# Review fixes: ranked-match-results

Source: `reviews/impl-review.md` (triage 2026-11-04). The fixes are in the code; what is left are the production steps.

- [x] **Production DB (F4):** (2026-11-04: applied; `count_caregivers_relaxed(..., '{nieznana}')` → `without_services = null`, `anon` execute, no `public` execute) `npx supabase db push` for `supabase/migrations/20261104150000_search_ignores_unknown_selections.sql`. `create or replace` with the same signatures and columns: no window without the function and no change of deploy order. Requires the user's consent.
- [x] **Production Worker (F1, F3, F5):** (2026-11-04: version `d1d395cd-bca1-48c2-8913-ad325efa7724`, 100% of traffic since 13:32:59Z) `npm run build` + `npx wrangler deploy`, then `npx wrangler deployments list`. Changes: the hint RPC failure no longer replaces the empty result with an error (`src/pages/opiekunowie/index.astro`), the empty-result states (ranking note only when there are cards; with only slots selected, "Nie ma jeszcze opiekunów…"), and the guard for an empty row in `countRelaxedCaregivers`. Independent of the migration above (either order). Requires the user's consent.
- [ ] **Production re-check (F2):** at the CPU re-measurement (a gmina with ≥ 20 complete profiles), check the cards' match lines on production (see `change.md` Notes).
