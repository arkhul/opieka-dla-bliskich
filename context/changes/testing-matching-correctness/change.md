---
change_id: testing-matching-correctness
title: Testy integracyjne poprawności dopasowania (filtr gminy i ranking)
status: impl_reviewed
created: 2026-11-04
updated: 2026-11-04
archived_at: null
---

## Notes

Open a change folder for rollout Phase 1 of context/foundation/test-plan.md: "Poprawność dopasowania".
Risks covered: #1 (wyniki pokazują opiekuna spoza wskazanej gminy albo bez gmin, a pomijają pasującego), #2 (ranking stawia wyżej profil pokrywający mniej wymaganych usług albo oznaczenie braków jest nieprawdziwe). Test types planned: integration.
Risk response intent:
- #1: na ustalonym zestawie profili wynik dla gminy G zawiera dokładnie profile obsługujące G; profil bez gmin i profil z sąsiedniej gminy się nie pojawiają (oczekiwany zbiór z reguł PRD, nie z wyniku zapytania).
- #2: na zestawie z ręcznie wyliczoną kolejnością (usługi przed terminami) wynik ma dokładnie tę kolejność, a oznaczenia braków zgadzają się z deklaracjami profili (unikać problemu wyroczni).
After creating the folder, follow the downstream continuation rule.

## Mutation proof (re-run 2026-11-04, impl review F1)

Mutated copy of `search_caregivers()` applied locally, `supabase test db` after each; function restored afterwards (`pg_get_functiondef` md5 unchanged, tests PASS).

| Mutation | Red assertions |
| -------- | -------------- |
| gmina filter by 6-digit prefix | gmina: 3 (G ≠ {A,B,H}), 4 (N1 ≠ {C}) |
| `g.active` dropped | gmina: 6 (retired R returns nobody) |
| order `matched_slots` before `matched_services` | ranking: 5–7 (paging pages 1–3) |
| threshold `matched_services >= 1` removed | ranking: 3–6 (order, tie-break, paging) |
