---
change_id: testing-matching-correctness
title: Testy integracyjne poprawności dopasowania (filtr gminy i ranking)
status: implementing
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
