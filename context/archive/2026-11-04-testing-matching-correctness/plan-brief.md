# Testy poprawności dopasowania — Plan Brief

> Full plan: `context/changes/testing-matching-correctness/plan.md`
> Research: `context/changes/testing-matching-correctness/research.md`

## What & Why

Etap 1 planu testów (`context/foundation/test-plan.md`) dowodzi, że wyniki wyszukiwania nie pokazują opiekuna spoza wskazanej gminy, nie pomijają obsługującego ją opiekuna, a kolejność i oznaczenia braków zgadzają się z regułą PRD (ryzyka #1 i #2). Dziś jedyny test (smoke) sprawdza „jest/nie ma jednego profilu” i monotoniczność kolejności, czyli dokładnie anty-wzorce z test-planu; oczekiwanie bierze więc z implementacji, a nie z PRD.

## Starting Point

Cała reguła dopasowania żyje w jednej funkcji SQL `search_caregivers()` (`supabase/migrations/20261104150000_…sql:36-193`), a aplikacja tylko przekazuje filtr i mapuje wiersze. Katalog `supabase/tests/` nie istnieje, a spike pgTAP z researchu przeszedł (3/3, bez śladu w bazie).

## Desired End State

Dwa pliki pgTAP w `supabase/tests/database/` dowodzą filtra gminy i rankingu na fixturach z literalną wyrocznią z PRD i decyzji S-05. Jeden krok smoke domyka kontrakt oznaczeń braków na karcie. CI uruchamia `supabase test db` w jobie `smoke`, a mutacje reguły (prefiks gminy, pominięcie `active`, zamiana kolejności, usunięcie progu) wywołują czerwony test.

## Key Decisions Made

| Decision | Choice | Why | Source |
| -------- | ------ | --- | ------ |
| Warstwa testu | pgTAP (`supabase test db`) na `search_caregivers()` jako `anon` | Reguła żyje w SQL, transakcja z rollbackiem daje stabilny dokładny zbiór na współdzielonej bazie | Research |
| Wyrocznia | Literalne zbiory i kolejność z PRD (`prd.md:81`, `:138-142`) i S-05 (próg ≥1 usługa, tie-breaker `updated_at desc`, `user_id`) | Unika problemu wyroczni skopiowanej z implementacji | Research |
| Warstwa aplikacji | Jeden nowy krok smoke (kolejność kanoniczna terminów, brak „Pełne dopasowanie” przy brakach); gmina z URL już pokryta (`smoke.mjs:762-766`) | Tanio zamyka kontrakt, którego pgTAP nie widzi; e2e nie dubluje | Plan |
| `count_caregivers_relaxed()` | Poza zakresem | Dziedziczy regułę, ryzyka #1/#2 jej nie wymieniają | Plan |
| Bramka CI | Krok w jobie `smoke` po „Check table grants” | Supabase już uruchomiony, zero dodatkowego startu | Plan |
| Dowód czułości testów | Min. 4 mutacje funkcji ręcznie, raz, na lokalnej bazie | Realny dowód bez nowego kodu w repo | Plan |
| Granice gmin w fixturach | G, `9999012` (te same 6 cyfr), `9999021` (ten sam powiat), wycofana, brak gmin | Wyłapuje filtr prefiksowy i pominięcie `active` | Research |

## Scope

**In scope:** pgTAP dla #1 i #2, jeden krok smoke dla kontraktu aplikacji, krok CI, raport mutacji, aktualizacja `test-plan.md`, `AGENTS.md`, `README.md`.

**Out of scope:** `count_caregivers_relaxed()`, zmiany migracji i kodu aplikacji, skrypt mutacyjny w repo, runner unit, ryzyka #3–#6 i e2e (etapy 2–3).

## Architecture / Approach

Każdy plik pgTAP w jednej transakcji wstawia gminy testowe `9999xx1`, użytkowników `auth.users`, profile z kontaktem, gminami, usługami i terminami (stałe UUID, jawne `updated_at`), woła funkcję jako `anon` i porównuje wynik z literalnymi listami; transakcja jest wycofywana. Kolejność odczytujemy z emisji wierszy (`WITH ORDINALITY`), nie sortujemy w teście.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Harness pgTAP i filtr gminy | `supabase/tests/database/` + test #1 (zbiory dla gminy G) | Domyślna ścieżka `supabase test db` nie była sprawdzona w spike'u |
| 2. Ranking i oznaczenia braków | test #2: kolejność, próg, tie-breaker, stronicowanie, `missing_*`, wejścia brzegowe | Wyrocznia musi być literalna, a `updated_at` jawne |
| 3. Kontrakt aplikacji w smoke | jeden krok HTML kolejności terminów i „Pełne dopasowanie” | Asercja musi zawęzić się do karty, bo baza zbiera profile z przebiegów |
| 4. Bramka CI i dowód mutacjami | krok w CI, raport ≥4 mutacji, aktualizacja docs | Pobranie obrazu `pg_prove` w CI niezweryfikowane; push do CI wymaga zgody |

**Prerequisites:** lokalny Supabase uruchomiony (`supabase start`), Supabase CLI 2.117.0, Docker; do weryfikacji CI push brancha/PR.
**Estimated effort:** ~2–3 sesje w 4 fazach (fazy 1–2 najdłuższe: fixtury i wyrocznia).

## Open Risks & Assumptions

- Obraz `public.ecr.aws/supabase/pg_prove:3.36` może się nie pobrać w CI; wtedy zatrzymujemy się i pytamy użytkownika zamiast obchodzić.
- Test może ujawnić prawdziwy błąd reguły; wtedy zapisujemy go jako ustalenie, bez zmiany funkcji w tym etapie.
- Domyślną ścieżkę testów (`supabase/tests/database/`) przyjmujemy za dokumentacją Supabase i weryfikujemy w fazie 1.

## Success Criteria (Summary)

- Dla gminy G wynik to dokładnie profile, które ją obsługują, a oczekiwana kolejność rankingu zgadza się z ręcznie wyliczoną wyrocznią.
- Każda z ≥4 mutacji reguły daje czerwony test, a w CI krok `supabase test db` przechodzi.
- Dokumentacja (`test-plan.md`, `AGENTS.md`, `README.md`) opisuje, jak dodać kolejny test dopasowania.
