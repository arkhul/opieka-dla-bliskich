<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Słowniki gmin i usług

- **Plan**: context/changes/gmina-and-service-dictionaries/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-11-03
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 3 warnings, 5 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | WARNING |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Success criteria evidence

- `npm run lint` — PASS (2026-11-03)
- `npx astro check` — PASS, 0 errors / 0 warnings / 0 hints (2026-11-03)
- `npm run build` — PASS (2026-11-03)
- CI na PR #2: `ci` pass, `smoke` pass (job `smoke` wykonuje migracje od zera na lokalnym Supabase i kroki słownikowe)
- `npx supabase db reset` + lokalny smoke — nie powtórzone (Docker nie działa); pokryte przez job `smoke` w CI
- Manual 3.8 (push migracji na produkcję) — działanie operacyjne, niewidoczne w diffie; przyjęte na podstawie odhaczenia

## Findings

### F1 — Odświeżanie gmin nie działa tak, jak opisuje README

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: scripts/generate-gminas-migration.mjs:149, README.md:135-138
- **Detail**: Plan (Phase 3 §8) kazał opisać odświeżanie jako `generate-gminas-migration.mjs <TERC.csv> .../<ts>_update_gminas.sql`. Generator emituje wyłącznie zwykłe `insert into public.gminas ...` (bez `on conflict`, bez usuwania), więc na zapełnionej tabeli pierwsza paczka pada na PK (`23505`) i migracja się wycofuje. README:138 każe „zastąpić” istniejące wiersze ręcznie, a nagłówek wyjścia mówi „GENERATED FILE - do not edit by hand”. Dodatkowo nagłówek ma na sztywno `-- Migration: seed_gminas` (:153), a komentarz użycia (:3) sugeruje nazwę `_seed_gminas.sql`. Wada planu, nie tylko implementacji — plan nie przewidział trybu aktualizacji.
- **Fix A ⭐ Recommended**: Zostawić naprawę w istniejącej zmianie `gminas-generator-upsert`; teraz tylko poprawić README, by wprost mówiło, że odświeżanie nie jest jeszcze obsługiwane i odsyłało do tej zmiany
  - Strength: Zmiana `context/changes/gminas-generator-upsert/` już istnieje i opisuje dokładnie ten problem; F-01 zostaje zamknięte bez rozszerzania zakresu.
  - Tradeoff: Do czasu realizacji follow-upu brak działającej ścieżki odświeżania (najbliższa zmiana TERC zwykle 1 stycznia).
  - Confidence: HIGH — follow-up jest już zarejestrowany.
  - Blind spot: Nie wiadomo, kiedy follow-up zostanie wykonany względem S-01 (patrz F2).
- **Fix B**: Zaimplementować tryb upsert/sync w generatorze teraz, w ramach F-01
  - Strength: Dokumentacja i narzędzie od razu spójne.
  - Tradeoff: Rozszerza zamkniętą zmianę; projekt sync zależy od decyzji z F2 (usuwanie vs wycofywanie gmin).
  - Confidence: MEDIUM — zakres zależy od F2.
  - Blind spot: Zachowanie przy przyszłych FK z profili.
- **Decision**: FIXED (Fix A) — follow-up `gminas-generator-upsert` zrealizowany (tryb upsert/sync w generatorze, README opisuje odświeżanie); archiwum `context/archive/2026-09-24-gminas-generator-upsert/`

### F2 — Klucz `teryt` zawiera cyfrę rodzaju gminy, która zmienia się przy nadaniu praw miejskich

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Architecture
- **Location**: supabase/migrations/20260924120000_create_dictionaries.sql:58
- **Detail**: PK `teryt` = WOJ+POW+GMI+RODZ. Gdy gmina wiejska staje się miejsko-wiejską (co roku kilka-kilkanaście przypadków od 1 stycznia), ostatnia cyfra zmienia się z 2 na 3 — stary kod znika, pojawia się nowy. Dziś nic na nim nie wisi, ale S-01 doda FK z profili opiekunów do `gminas(teryt)`. Wtedy odświeżenie ma tylko złe wyjścia: `delete` blokowane przez `restrict`, utrata danych przy `cascade`, albo martwe wiersze w wyszukiwarce na zawsze. Decyzja musi zapaść przed S-01.
- **Fix A ⭐ Recommended**: Zachować `teryt` jako klucz, dodać wycofywanie gmin (np. `active boolean` / `valid_to`), filtrować `search_gminas` po aktywnych, FK z profili `on delete restrict`, a migracja aktualizująca mapuje stary kod na nowy w profilach — zapisać to jako wymaganie w `gminas-generator-upsert` i w planie S-01
  - Strength: Nie rusza wdrożonego schematu ani danych; kod TERC pozostaje identyfikatorem urzędowym.
  - Tradeoff: Każda aktualizacja wymaga kroku mapowania starych kodów na nowe.
  - Confidence: HIGH — standardowy wzorzec dla słowników z historią.
  - Blind spot: Nie sprawdzono, jak często GUS zmienia też GMI (nie tylko RODZ).
- **Fix B**: Zmienić klucz na stabilny 6-znakowy kod WOJ+POW+GMI (bez RODZ), a RODZ trzymać tylko w `kind`
  - Strength: Zmiana statusu gminy staje się zwykłym `update` — profile nie wymagają przepinania.
  - Tradeoff: Migracja zmieniająca PK na produkcji; kod przestaje być 1:1 z TERC; nadal potrzebne wycofywanie przy łączeniu/znoszeniu gmin.
  - Confidence: MEDIUM — w ramach RODZ 1/2/3 trójka WOJ+POW+GMI powinna być unikalna (np. Łowicz 1005011 vs 1005072), ale nie zweryfikowano tego na całym pliku TERC ani historii zmian.
  - Blind spot: Czy GUS przy nadaniu praw miejskich zachowuje GMI.
- **Decision**: FIXED (Fix A) — `supabase/migrations/20261103120000_retirable_gminas.sql` (wycofywanie gmin, `replaced_by`, `search_gminas` tylko po aktywnych); wymagania dla profili zapisane jako ograniczenia S-01 w `context/foundation/roadmap.md`

### F3 — Błędy bazy połykane bez logowania

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/dictionaries/gminas.ts:41, src/pages/api/dictionaries/services.ts:14
- **Detail**: `catch { ... 500 }` odrzuca błąd, który serwis opakował komunikatem z bazy (`dictionary.service.ts:26,40`). Awaria na produkcji nie zostawia śladu w Workers Logs.
- **Fix**: `catch (error) { console.error(error); ... }` w obu endpointach (odpowiedź do klienta bez zmian).
- **Decision**: FIXED — w `dictionaries-review-cleanup`: `console.error("Gmina search failed", error)` / `console.error("Services failed to load", error)` w catch `src/pages/api/dictionaries/gminas.ts` i `services.ts`, odpowiedź do klienta bez zmian; lint, astro check i build zielone (commit `f8933a0`)

### F4 — `grant select` nie czyni tabel tylko-do-odczytu

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20260924120000_create_dictionaries.sql:113-118
- **Detail**: Komentarz mówi „read-only access for API roles”, ale domyślne uprawnienia Supabase w schemacie `public` dają `anon`/`authenticated` także INSERT/UPDATE/DELETE/TRUNCATE; zapisy blokuje wyłącznie RLS, a TRUNCATE nie podlega RLS (nieosiągalny przez PostgREST, ale to druga linia obrony).
- **Fix**: Nowa migracja `revoke insert, update, delete, truncate on public.services, public.gminas from anon, authenticated;`.
- **Decision**: FIXED — w `dictionaries-review-cleanup`, zakres rozszerzony na wszystkie 7 tabel `public` (services, gminas, accounts, caregiver_profiles, caregiver_contacts, caregiver_gminas, caregiver_services): migracja `supabase/migrations/20261103230000_table_grants_mirror_policies.sql` (`revoke all` + jawne granty odpowiadające politykom) i reguła w AGENTS.md (Hard Rules). Sprawdzone: `has_table_privilege` lokalnie i na produkcji zwraca tę samą macierz 20 wierszy; nowe kroki smoke (anon POST `/rest/v1/gminas` → 401 permission denied, authenticated POST `/rest/v1/services` → 403 permission denied, odczyt `caregiver_contacts`/`accounts` przez anon → permission denied); na produkcji anon dostaje permission denied dla POST gminas i GET caregiver_contacts (commity `fdad6eb`, `9ca6bea`)

### F5 — Middleware woła `getUser()` przy każdym zapytaniu autocomplete

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/middleware.ts:12
- **Detail**: Dla zalogowanych użytkowników każde naciśnięcie klawisza w wyszukiwarce gmin (S-01/S-02) to dodatkowy round-trip do Supabase Auth. Dla anonimowych bez sesji koszt jest pomijalny. Cache'owanie odpowiedzi jest świadomie poza zakresem (plan: What We're NOT Doing).
- **Fix**: Przy S-01/S-02 pominąć `getUser()` dla `/api/dictionaries/` w middleware.
- **Decision**: FIXED — w `dictionaries-review-cleanup`: `src/middleware.ts` pomija `getUser()` dla `/api/dictionaries/`; smoke zielony (commit `f8933a0`)

### F6 — README: sekcja smoke opisuje tylko przepływ auth

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: README.md:58, README.md:195
- **Detail**: Smoke od fazy 3 sprawdza też słowniki, a README nadal mówi, że testuje wyłącznie auth flow.
- **Fix**: Dopisać kroki słownikowe do obu opisów smoke w README.
- **Decision**: FIXED — w `dictionaries-review-cleanup`: oba opisy smoke w README obejmują kroki słownikowe (commit `f8933a0`)

### F7 — Zmiana `normalize_pl` nie przeliczy zapisanej kolumny `search_name`

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20260924120000_create_dictionaries.sql:63
- **Detail**: `search_name` to kolumna `generated ... stored` z funkcji użytkownika. Późniejsze `create or replace function normalize_pl` nie przeliczy istniejących wierszy, a wyszukiwanie będzie normalizować zapytanie nową wersją — ciche rozjechanie.
- **Fix**: Przy kolejnej migracji dotykającej gmin dodać `comment on function normalize_pl` z ostrzeżeniem, że zmiana wymaga `update public.gminas set name = name`.
- **Decision**: FIXED — `comment on function public.normalize_pl` z ostrzeżeniem o `update public.gminas set name = name` w `supabase/migrations/20261103120000_retirable_gminas.sql:66-67`

### F8 — Smoke kończy się bez podsumowania przy błędzie sieci/JSON

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: scripts/smoke.mjs:24-39
- **Detail**: Odrzucony `fetch` (serwer nie wstał) lub niepoprawny JSON przy `content-type: application/json` daje nieobsłużony wyjątek zamiast czytelnego FAIL kroku.
- **Fix**: Owinąć wykonanie kroku w try/catch i liczyć go jako FAIL.
- **Decision**: FIXED — w `dictionaries-review-cleanup`: try/catch wokół każdego kroku w `scripts/smoke.mjs`, wyjątek liczony jako FAIL kroku; sprawdzone: smoke przy zatrzymanym serwerze wypisuje linie FAIL i podsumowanie, exit 1 (commit `f8933a0`)
