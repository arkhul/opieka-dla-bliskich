---
change_id: ranked-match-results
title: Ranked match results
status: impl_reviewed
created: 2026-11-04
updated: 2026-11-04
archived_at: null
---

## Notes

<!-- Free-form notes for this change: links, ad-hoc context, decisions that don't belong in research/frame/plan. -->

- Roadmap: S-05 (US-01, FR-016), prerequisites S-02 and S-04 are done.
- Carried over from S-04 review (F6, `context/archive/2026-11-04-caregiver-availability-filter/follow-ups/review-fixes.md`): the empty-result hints on `/opiekunowie` cost one `search_caregivers` call per active filter (up to 5 per request). Replace them with one RPC that returns all "relaxed" counts in one call.

### Wdrożenie produkcyjne (2026-11-04)

- Punkt odniesienia przed wdrożeniem: produkcja ma 0 profili opiekunów (0 kompletnych), więc `/opiekunowie` bez filtrów = „Wyniki: 0” (odczyt `search_caregivers(null, null, null, 1, 0)` przez `supabase db query --linked`).
- `npx supabase db push` zastosował tylko `20261104140000_ranked_caregiver_search.sql`. Sprawdzone na produkcji: nowy kształt wyniku `search_caregivers()`, `count_caregivers_relaxed()` istnieje, `anon` ma `execute`, `count_caregivers_relaxed('2001052', '{towarzystwo}')` zwraca jeden wiersz (`0, 0`).
- `npx wrangler deploy` z lokalnego `master` (`d26bd53`): wersja `9e853843-7b75-4518-909e-3613f6e3fca7`, 100% ruchu od 2026-11-04T12:57:59Z (`wrangler deployments list`). URL: `https://opieka-dla-bliskich.baal-perez.workers.dev`.
- Po wdrożeniu: bez filtrów nadal „Wyniki: 0”. Z filtrami nowe legendy, „Najpierw opiekunowie pokrywający…”, „Żaden opiekun nie spełnia wybranych warunków.” oraz podpowiedzi „Usuń filtr usług (wyniki: 0)” / „Usuń filtr gminy (wyniki: 0)”, bez „Usuń filtr dostępności”. **Luka:** wierszy dopasowania na kartach („Brakuje usług/terminów”, „Pełne dopasowanie”) nie dało się zobaczyć na produkcji, bo nie ma żadnego profilu. Zweryfikowane tylko lokalnie (smoke i ręczne kroki fazy 2).

### Pomiar CPU Workera (2026-11-04, `wrangler tail --format json`)

6 żądań na wariant, wersja `9e853843`, colo WAW, wszystkie `outcome: ok` (żadnego `exceededCpu`). **Każde żądanie wyrenderowało 0 kart** (produkcja bez profili).

| Wariant | CPU typowo (mediana) | CPU max | Czas ściany |
|---|---|---|---|
| A: `/opiekunowie` bez filtrów | 14 ms (8–16 ms) | 74 ms | 76–259 ms |
| B: gmina 1465011 + 3 usługi + 5 terminów (pusty wynik + podpowiedzi) | 11 ms (8–13 ms) | 47 ms | 143–362 ms |
| C: gmina 2001052 + 1 usługa (pusty wynik + podpowiedzi) | 9 ms (8–12 ms) | 12 ms | 142–212 ms |

- Limit planu Workers Free: 10 ms CPU na żądanie. Typowy czas już przy pustej liście jest na granicy limitu lub powyżej. Szczyty 47–74 ms wyglądają na start nowych izolatów. CPU idzie na SSR i sam Worker, nie na ranking w bazie (wariant C z dwoma RPC jest najtańszy).
- **Decyzja (wstępna, 2026-11-04, user): przejść na Workers Paid przed wprowadzeniem prawdziwych profili.** Pełna strona (`CAREGIVER_PAGE_SIZE` = 20 kart) przekroczy limit Free. Warunek ponownego pomiaru: gdy któraś gmina ma ≥ 20 kompletnych profili. Przy tym samym pomiarze sprawdzić na produkcji wiersze dopasowania kart („Brakuje usług/terminów”, „Pełne dopasowanie”), których dziś nie dało się zobaczyć. Samo przejście na Paid nie jest częścią tego planu.

### Wdrożenie poprawek z przeglądu implementacji (2026-11-04)

- `npx supabase db push` zastosował tylko `20261104150000_search_ignores_unknown_selections.sql` (F4). Sprawdzone na produkcji: nowe ciała obu funkcji, `anon` ma `execute`, `public` nie, `count_caregivers_relaxed('2001052', '{nieznana}')` → `without_services = null`.
- `npx wrangler deploy` z niezacommitowanego drzewa roboczego (poprawki F1, F3, F5 nad `6bc9016`): wersja `d1d395cd-bca1-48c2-8913-ad325efa7724`, 100% ruchu od 2026-11-04T13:32:59Z.
- Po wdrożeniu: `/opiekunowie` = „Wyniki: 0”, `?termin=czw-noc` = „Nie ma jeszcze opiekunów z uzupełnionym profilem.” bez noty rankingu (F3), `?gmina=2001052&usluga=towarzystwo` = „Żaden opiekun…” z podpowiedziami usług i gminy (wyniki: 0).
