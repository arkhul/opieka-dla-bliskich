# Testy poprawności dopasowania (filtr gminy i ranking) — plan implementacji

## Overview

Etap 1 planu testów (`context/foundation/test-plan.md` §3) dowodzi, że `search_caregivers()` stosuje twardy filtr gminy (ryzyko #1) i szereguje wyniki zgodnie z regułą PRD i decyzją S-05 z prawdziwymi oznaczeniami braków (ryzyko #2). Oczekiwany zbiór i kolejność są zapisane literalnie w testach, wyprowadzone z PRD (`context/foundation/prd.md:71-82`, `:117`, `:136-144`) oraz zarejestrowanej decyzji S-05 (`context/archive/2026-11-04-ranked-match-results/plan-brief.md:23-24`), a nie z wyniku zapytania. Testy to pgTAP uruchamiane przez `supabase test db` bezpośrednio na funkcji SQL. Dochodzi jeden krok smoke dla kontraktu warstwy aplikacji, bramka w CI i dowód mutacjami, że testy faktycznie łapią błąd.

## Current State Analysis

- Cała reguła dopasowania to jedna funkcja SQL: `search_caregivers()` w `supabase/migrations/20261104150000_search_ignores_unknown_selections.sql:36-193` (kompletność `:91`, filtr gminy `:92-102`, próg ≥1 usługi `:104-109`, kolejność i stronicowanie `:110-134`, `:192`, braki `:168-189`). Aplikacja przekazuje filtr 1:1 i tylko mapuje wiersze (`src/lib/services/caregiver.service.ts:213-232`).
- Istniejący smoke (`scripts/smoke.mjs`, jedyny test automatyczny) sprawdza „jest/nie ma jednego profilu” (`:132-137`) i monotoniczność kolejności (`:138-150`). To anty-wzorce z test-planu §2 (#1, #2). Współdzielona gmina `1465011` zbiera profile z każdego uruchomienia, więc dokładnego zbioru ani kolejności nie da się tam sprawdzić.
- `supabase/tests/` nie istnieje. Spike w researchu (3/3, `Result: PASS`) potwierdził, że `supabase test db` działa na lokalnym Supabase, wycofuje transakcję i nie zostawia danych.
- Smoke już pokrywa zachowanie strony dla gminy nieistniejącej lub wycofanej w URL: krok „caregiver list reports unknown gmina” (`scripts/smoke.mjs:762-766`) sprawdza komunikat „nie istnieje lub została wycofana”. Kroki oznaczeń braków sprawdzają tylko pojedyncze braki: `:699-711`, `:712-728`, `:730-734`.
- CI ma job `smoke` z uruchomionym lokalnym Supabase (`.github/workflows/ci.yml:27-69`), z krokiem „Check table grants” (`:55-56`), w który zmieści się krok `supabase test db`.

## Desired End State

- `supabase/tests/database/` zawiera dwa pliki pgTAP: filtr gminy (#1) i ranking z oznaczeniami braków (#2). Oba przechodzą na lokalnym Supabase, każdy w jednej transakcji z `rollback`, bez śladu w bazie.
- Smoke ma jeden dodatkowy krok kontraktu aplikacji (kolejność kanoniczna wielu brakujących terminów, brak „Pełne dopasowanie” dla profilu z brakami).
- CI uruchamia `supabase test db` w jobie `smoke`; bramka „testy poprawności dopasowania” z test-planu §5 jest spełniona.
- Mutacje reguły (filtr po prefiksie, pominięcie `active`, zamiana kolejności usługi/terminy, usunięcie progu) powodują czerwony test, a po przywróceniu funkcji testy są zielone.
- `context/foundation/test-plan.md` (§4, §6.1, §6.5, status etapu) i `AGENTS.md` (sekcja Testing & CI) opisują nowy wzorzec.

Weryfikacja: `supabase test db` (Phase 1–2), `npm run smoke` (Phase 3), zielony job `smoke` w CI i raport mutacji (Phase 4).

### Key Discoveries:

- Kompletność profilu = nazwa + telefon + ≥1 **aktywna** gmina + ≥1 usługa (`supabase/migrations/20261103150000_caregiver_profiles.sql:356-388`). Profil bez gmin, z samą wycofaną gminą albo bez usług odpada także przy `p_teryt = null`. Fixtury „kompletne” muszą mieć telefon (`caregiver_contacts`), gminę i usługę.
- `gminas.teryt` musi pasować do `^[0-9]{6}[123]$` (`20260924120000_create_dictionaries.sql:58`). Gminy testowe `9999xx1` są wolne, a `9999012` (te same 6 cyfr, inny rodzaj) to najtrudniejsza „sąsiednia” gmina dla ewentualnego filtra prefiksowego.
- W jednej transakcji `now()` jest stałe, więc fixtury muszą mieć jawne `updated_at` (spike: wartość z `insert` zostaje). Bez tego remisy rozstrzygałby tylko `user_id`.
- Ranking liczony jest dla wszystkich kandydatów przed `limit/offset` (`...:110-134`), więc test z małym `p_limit` i `p_offset` ma dowieść kolejności globalnej, a nie sortowania w obrębie strony.
- `missing_services` jest w `services.sort_order` (`20260924120000_create_dictionaries.sql:125-139`: np. `towarzystwo`=1, `demencja`=11), a nie alfabetycznie. `missing_slots` w SQL jest po tekście slotu; kolejność kanoniczna to kontrakt warstwy aplikacji (`caregiver.service.ts:218`, `src/lib/availability.ts:47`).
- Limit 30 gmin działa tylko przy ustawionym `auth.uid()` (`20261103170000_caregiver_gminas_limit.sql:50-56`), więc bezpośrednie wstawki fixtur go nie dotykają. `handle_new_user` wymaga roli w `raw_user_meta_data` (`20261103150000_caregiver_profiles.sql:204-232`).

## What We're NOT Doing

- Nie testujemy `count_caregivers_relaxed()` (podpowiedzi pustego wyniku): dziedziczy regułę z `search_caregivers()`, a ryzyka #1 i #2 jej nie wymieniają (decyzja użytkownika).
- Nie dodajemy kroku smoke dla gminy nieistniejącej/wycofanej w URL — istnieje (`scripts/smoke.mjs:762-766`).
- Nie zmieniamy migracji, funkcji SQL ani kodu aplikacji. Jeśli test ujawni błąd reguły, zapisujemy go jako ustalenie i zgłaszamy użytkownikowi, a nie poprawiamy po cichu w tym etapie.
- Nie piszemy skryptu mutacyjnego w repo ani nie instalujemy vitest/jest (mutacje wykonujemy ręcznie raz, test-plan §4 nie planuje unit testów).
- Nie rozszerzamy smoke o dokładny zbiór ani kolejność na współdzielonej gminie (niestabilne przy narastających danych).
- Nie testujemy ryzyk #3–#6 (etap 3) ani przeglądarki (etap 2).
- Nie zmieniamy `scripts/check-table-grants.sql` ani istniejących kroków smoke.

## Implementation Approach

Test to funkcja SQL na lokalnym Supabase: każdy plik pgTAP w jednej transakcji tworzy gminy testowe, użytkowników `auth.users`, profile z kontaktem, gminami, usługami i terminami, po czym jako `anon` woła `search_caregivers()` i porównuje wynik z literalną listą z deklaracji fixtur. Kolejność wyniku odczytujemy z kolejności emisji wierszy funkcji (`WITH ORDINALITY`), nie sortujemy jej ponownie w teście. Każda oczekiwana lista ma komentarz z regułą PRD/S-05, z której wynika; żadna nie powstaje przez uruchomienie zapytania i skopiowanie wyniku. Faza 1 stawia harness i dowodzi #1, faza 2 dowodzi #2 na tym samym wzorcu, faza 3 domyka kontrakt aplikacji w smoke, faza 4 podłącza CI, dowodzi czułości testów mutacjami i aktualizuje dokumentację.

## Phase 1: Harness pgTAP i filtr gminy (#1)

### Overview

Pierwszy plik pgTAP w `supabase/tests/database/` z fixturami i asercjami zbioru wyników dla gminy G. Faza weryfikuje też, że `supabase test db` bez argumentów znajduje plik w tej lokalizacji (ścieżka domyślna nie była sprawdzona w spike'u).

### Changes Required:

#### 1. Test filtra gminy

**File**: `supabase/tests/database/search_caregivers_gmina.test.sql` (nowy)

**Intent**: Dowieść, że wynik dla gminy G zawiera dokładnie profile obsługujące G, a profile bez gmin, z gminą z tego samego powiatu, z gminą różniącą się tylko 7. cyfrą, z samą wycofaną gminą i niekompletne się nie pojawiają. Oczekiwane zbiory wynikają z PRD (US-01 AC3 `prd.md:81`, zgodność gminy jako warunek twardy `prd.md:142`).

**Contract**: Plik w schemacie pgTAP (`begin; create extension if not exists pgtap with schema extensions; select plan(n); … select * from finish(); rollback;`). Fixtury wstawiane jako rola `postgres`, wywołania jako `set local role anon`. Gminy testowe: G `9999011` (szukana), N1 `9999012` (te same 6 cyfr), N2 `9999021` (ten sam powiat, wspólny prefiks 4 cyfr), R `9999031` (wycofana: `active = false`). Opiekunowie (stałe UUID, wszyscy z telefonem i ≥1 usługą, o ile nie zaznaczono inaczej):

| Profil | Gminy | Oczekiwanie |
| ------ | ----- | ----------- |
| A | G | w wyniku dla G |
| B | G, N2 | w wyniku dla G i dla N2 (G nie jest jego jedyną gminą) |
| C | N1 | tylko dla N1 |
| D | N2 | tylko dla N2 |
| E | brak gmin | w żadnym wyniku, także przy `p_teryt = null` |
| F | R (wycofana) | w żadnym wyniku, także dla R i `p_teryt = null` |
| H | R, G | w wyniku dla G, nie dla R; jego `gminas` zawiera tylko G |
| I | G, bez telefonu | w żadnym wyniku (niekompletny) |

Oczekiwane: G → `{A, B, H}`; N1 → `{C}`; N2 → `{B, D}`; R → `{}`; `p_teryt = null` ograniczone do ID fixtur (baza lokalna ma inne profile) → `{A, B, C, D, H}`. Zbiory porównywane bez względu na kolejność (kolejność to #2). Dodatkowa asercja sanity: odczyt `updated_at` fixtur przed wyszukaniem potwierdza jawnie ustawioną wartość.

### Success Criteria:

#### Automated Verification:

- `supabase test db` (bez argumentów) znajduje nowy plik i kończy się `Result: PASS`
- Po przebiegu w lokalnej bazie nie ma gmin `9999%` ani użytkowników fixtur: `supabase db query --local "select (select count(*) from public.gminas where teryt like '9999%') + (select count(*) from auth.users where raw_user_meta_data->>'role' = 'caregiver' and email like '%.test')"` zwraca 0 (dokładne zapytanie dopasować do emaili użytych w fixturach)

#### Manual Verification:

- Przegląd pliku: każdy oczekiwany zbiór jest literalny i ma komentarz z regułą PRD/S-05; żaden nie jest wynikiem zapytania ani nie przepisuje warunku z funkcji (oracle problem)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: Ranking i oznaczenia braków (#2)

### Overview

Drugi plik pgTAP dowodzi kolejności (usługi przed terminami), progu ≥1 usługi, tie-breakera, rankingu globalnego przy stronicowaniu, dokładnych list braków i ignorowania wejść `''`/nieznany slug/duplikat (regresja F4 z `context/archive/2026-11-04-ranked-match-results/reviews/impl-review.md:61-69`).

### Changes Required:

#### 1. Test rankingu i braków

**File**: `supabase/tests/database/search_caregivers_ranking.test.sql` (nowy)

**Intent**: Na zestawie z ręcznie wyliczoną kolejnością dowieść, że `search_caregivers()` zwraca dokładnie tę kolejność i prawdziwe oznaczenia braków. Wyrocznia bierze regułę z PRD (`prd.md:138-142`: najwięcej waży pokrycie usług, terminy miękko) i z decyzji S-05 (próg ≥1 usługa, terminy bez progu, tie-breaker `updated_at desc`, potem `user_id`), nie z implementacji.

**Contract**: Ta sama konwencja pliku co w fazie 1, własne fixtury w jednej gminie testowej (np. `9999041`). Wybrane: usługi S1=`towarzystwo`, S2=`demencja` (sort_order 1 i 11), terminy T1=`pon-rano`, T2=`wt-rano`. Profile (stałe UUID, jawne `updated_at`; wszystkie kompletne):

| Profil | Usługi | Terminy | (usługi, terminy) | Uwaga |
| ------ | ------ | ------- | ----------------- | ----- |
| P8 | S1, S2 | T1, T2 | (2, 2) | pierwszy |
| P1 | S1, S2 | — | (2, 0) | drugi mimo braku terminów |
| P2 | S1 | T1, T2 | (1, 2) | niżej niż P1: usługi przed terminami |
| P4 | S1 | T1 | (1, 1) | nowszy `updated_at` niż P3 |
| P3 | S1 | T1 | (1, 1) | starszy `updated_at` |
| P5 | S1 | — | (1, 0) | remis z P6 w `updated_at` → `user_id` rosnąco |
| P6 | S1 | — | (1, 0) | wyższy `user_id` niż P5 |
| P7 | inna usługa niż S1/S2 | T1, T2 | (0, 2) | ukryty progiem ≥1 usługi mimo pasujących terminów |

Asercje: (1) wybrane S1+S2+T1+T2 → kolejność `[P8, P1, P2, P4, P3, P5, P6]`, `total_count = 7`, P7 nieobecny; (2) stronicowanie `p_limit = 2` z `p_offset` 0/2/4/6 → `[P8,P1]`, `[P2,P4]`, `[P3,P5]`, `[P6]`, `total_count = 7` na każdej stronie (ranking globalny, nie per strona); (3) `matched_*` i `missing_*` per profil z deklaracji fixtur — `missing_services` jako dokładne `[{slug, label}]` w `sort_order` (co najmniej jeden profil brakujący obu usług, żeby kolejność słownika różniła się od alfabetycznej), `missing_slots` porównywane jako zbiór; (4) bez wybranych usług (tylko terminy T1+T2) usługi nie zawężają wyniku (P7 obecny, wynik z (0, 2)), a kolejność wynika z liczby terminów, potem `updated_at` i `user_id` (przy braku jakiegokolwiek wyboru tylko `updated_at`, potem `user_id`); (5) wejścia `p_services = {'', 'nieznany', S1, S1}` dają ten sam wynik co `{S1}`, `{''}` samo daje wynik jak „nic nie wybrano”, `p_availability = {''}` jak brak terminów. Kolejność wyniku odczytywana przez `WITH ORDINALITY` z emisji funkcji, bez ponownego sortowania w teście.

### Success Criteria:

#### Automated Verification:

- `supabase test db` uruchamia oba pliki i kończy się `Result: PASS`
- Po przebiegu w lokalnej bazie nie ma gmin `9999%` ani użytkowników fixtur (to samo zapytanie co w fazie 1)

#### Manual Verification:

- Przegląd pliku: oczekiwana kolejność i listy braków są literalne i wyprowadzone z tabeli fixtur w komentarzu, nie z uruchomienia zapytania; tie-breaker i granice stron mają osobne asercje, a nie tylko „kolejność nie rośnie”

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 3: Kontrakt aplikacji w smoke

### Overview

Jeden dodatkowy krok smoke zamyka kontrakt, którego pgTAP nie widzi: kolejność kanoniczna wielu brakujących terminów na karcie i warunek „Pełne dopasowanie” (`src/lib/services/caregiver.service.ts:216-219`, `src/pages/opiekunowie/index.astro:265-266`, `:305-309`).

### Changes Required:

#### 1. Krok smoke dla oznaczeń braków

**File**: `scripts/smoke.mjs`

**Intent**: Dopisać jeden krok HTML obok istniejących kroków listy (okolice `:730-744`), który dowodzi: (a) brakujące terminy są wymienione w kolejności kanonicznej Pn…Nd i pór dnia, nie w kolejności tekstowej slotów z SQL, (b) karta profilu z brakami nie zawiera „Pełne dopasowanie”.

**Contract**: Żądanie `/opiekunowie?gmina=1465011&…` z co najmniej dwoma terminami, których nie ma profil smoke, o przeciwnej kolejności tekstowej i kanonicznej (np. `czw-noc` < `pon-noc` tekstowo, ale `pon-noc` przed `czw-noc` kanonicznie), oraz z usługą, której brakuje (wzorzec: `demencja`, krok `:730-734`). Oczekiwany ciąg „Brakuje terminów: …” zapisany literalnie, zgodnie z formatem `summarizeAvailability` (`src/lib/availability.ts:78`). Asercja „bez Pełne dopasowanie” zawężona do karty konkretnego profilu (fragment HTML od nazwy profilu do następnej karty), bo lokalna baza zbiera profile z wcześniejszych przebiegów i inna karta może legalnie być pełnym dopasowaniem. Odporne na narastające dane tak jak sąsiednie kroki (`scripts/smoke.mjs:696-697`).

### Success Criteria:

#### Automated Verification:

- Świeży `npm run preview` (restart zalegającego procesu na `:4321`) i `npm run smoke` przechodzą, w tym nowy krok
- `npm run lint` przechodzi

#### Manual Verification:

- Tymczasowe złamanie kontraktu (np. pominięcie `sortAvailability` przy mapowaniu w `caregiver.service.ts:218`) powoduje czerwony nowy krok; zmiana wycofana i smoke znowu zielony

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 4: Bramka CI i dowód mutacjami

### Overview

Podłącza `supabase test db` do CI jako wymaganą bramkę, dowodzi mutacjami, że testy z faz 1–2 łapią błędy reguły, i aktualizuje dokumentację testów.

### Changes Required:

#### 1. Krok w jobie `smoke`

**File**: `.github/workflows/ci.yml`

**Intent**: Dodać do joba `smoke` krok uruchamiający `supabase test db` po „Check table grants” (`:55-56`), przed „Configure secrets for build and preview”, na już uruchomionym lokalnym Supabase.

**Contract**: Krok `run: supabase test db` z nazwą w stylu pozostałych („Run database tests”) i krótkim komentarzem, co łapie. Bez zmian w wersji CLI (2.117.0) ani liście `-x` usług. Pobranie obrazu `public.ecr.aws/supabase/pg_prove:3.36` w CI nie było sprawdzone (inny rejestr niż ghcr.io); jeśli się nie powiedzie, zatrzymać się i zgłosić użytkownikowi zamiast obchodzić problem.

#### 2. Dowód mutacjami

**File**: `context/changes/testing-matching-correctness/` (raport w sekcji Manual Verification / notatka w `change.md`)

**Intent**: Dowieść, że testy nie są zielone z błędnego powodu. Na lokalnej bazie zastosować co najmniej 4 mutacje `search_caregivers()` (przez zmodyfikowaną kopię funkcji w katalogu scratchpad, bez zmiany migracji w repo), po każdej uruchomić `supabase test db`, potwierdzić czerwony wynik i przywrócić funkcję.

**Contract**: Mutacje: (1) filtr gminy po prefiksie 6 cyfr zamiast równości `cg.teryt = p_teryt` (łapie N1 `9999012`), (2) usunięcie `g.active` z filtra (łapie profil z wycofaną gminą), (3) zamiana kolejności `matched_slots desc, matched_services desc` (łapie P2 vs P1), (4) usunięcie progu `matched_services >= 1` (łapie P7). Opcjonalnie: tie-breaker `updated_at asc`, kolejność `missing_services` alfabetyczna. Przywrócenie przez ponowne zastosowanie funkcji z migracji `20261104150000_…` i potwierdzenie: `pg_get_functiondef` bez zmian względem stanu przed mutacjami oraz `supabase test db` zielone.

#### 3. Dokumentacja testów

**File**: `context/foundation/test-plan.md`, `AGENTS.md`, `README.md`

**Intent**: Uzupełnić dokumentację tak, by kolejny agent wiedział, jak dodać test dopasowania i że istnieje warstwa pgTAP.

**Contract**: `test-plan.md`: §3 status etapu 1 → ukończony, §4 nowy wiersz warstwy (pgTAP 1.3.3, `pg_prove:3.36`, Supabase CLI 2.117.0, `supabase test db`), §6.1 wypełnione wzorcem (ustalony zestaw fixtur, literalna wyrocznia z PRD, `WITH ORDINALITY`, jawne `updated_at`, gminy `9999xx1`), §6.5 notatka etapu, §8 daty. `AGENTS.md` sekcja Testing & CI: zdanie „There is no unit or integration test suite. `npm run smoke` is the only automated test.” przestaje być prawdziwe — dodać `supabase test db` i wskazać `supabase/tests/database/`. `README.md`: krótka wzmianka w sekcji o testach/CI, jeśli opisuje job `smoke` (`README.md:239`).

### Success Criteria:

#### Automated Verification:

- `.github/workflows/ci.yml` zawiera krok `supabase test db` w jobie `smoke` (grep)
- `supabase test db` lokalnie zielone po przywróceniu funkcji, `pg_get_functiondef('public.search_caregivers'::regprocedure)` ma ten sam skrót co przed mutacjami
- `npm run lint` przechodzi

#### Manual Verification:

- Raport mutacji: każda z ≥4 mutacji dała czerwony `supabase test db` (z nazwą nieudanej asercji), po przywróceniu zielone
- Job `smoke` w CI dla brancha z PR przechodzi, a log kroku zawiera `Result: PASS` (wymaga pushu brancha/PR — wykonać za zgodą użytkownika)
- `test-plan.md`, `AGENTS.md` i `README.md` opisują nową warstwę zgodnie z faktycznym stanem

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Testing Strategy

### Unit Tests:

- Brak runnera unit i nie planujemy go (test-plan §4): logika dopasowania żyje w SQL, więc najtańszy realny sygnał to pgTAP.

### Integration Tests:

- pgTAP na `search_caregivers()` jako `anon` na lokalnym Supabase: zbiór dla gminy (6 przypadków granicznych), dokładna kolejność z wyrocznią z PRD/S-05, tie-breaker, ranking globalny przy stronicowaniu, dokładne `missing_services` i `missing_slots`, wejścia `''`/nieznane/duplikaty.
- Smoke HTTP: kontrakt oznaczeń braków na karcie (kolejność kanoniczna, „Pełne dopasowanie”).

### Manual Testing Steps:

1. Mutacje reguły na lokalnej bazie (faza 4) i potwierdzenie czerwonych testów.
2. Tymczasowe złamanie `sortAvailability` w mapowaniu i potwierdzenie czerwonego kroku smoke (faza 3).
3. Zielony job `smoke` w CI na branchu z PR.

## Performance Considerations

Testy działają w transakcjach z kilkunastoma wierszami. Dodatkowy czas CI to krok `supabase test db` na już uruchomionym Supabase plus jednorazowe pobranie obrazu `pg_prove`. Wydajność wyszukiwania (< 1 s) jest poza zakresem (test-plan §7).

## Migration Notes

Brak migracji i zmian schematu. Fixtury żyją tylko w transakcji `rollback`; testowe gminy `9999xx1` i użytkownicy nie trafiają na produkcję ani nie zostają w lokalnej bazie. Plan nie wymaga wdrożenia Workera.

## References

- Related research: `context/changes/testing-matching-correctness/research.md`
- Test plan: `context/foundation/test-plan.md` (§2 ryzyka #1 i #2, §3 etap 1, §5 bramki, §6.1)
- Reguła dopasowania: `supabase/migrations/20261104150000_search_ignores_unknown_selections.sql:36-193`
- Decyzja S-05: `context/archive/2026-11-04-ranked-match-results/plan-brief.md:23-24`
- Istniejący smoke: `scripts/smoke.mjs:132-150`, `:699-766`
- CI: `.github/workflows/ci.yml:27-69`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Harness pgTAP i filtr gminy (#1)

#### Automated

- [x] 1.1 `supabase test db` (bez argumentów) znajduje nowy plik i kończy się `Result: PASS` — 071b8e3
- [x] 1.2 Po przebiegu w lokalnej bazie nie ma gmin `9999%` ani użytkowników fixtur — 071b8e3

#### Manual

- [x] 1.3 Przegląd pliku: każdy oczekiwany zbiór jest literalny i ma komentarz z regułą PRD/S-05, żaden nie jest wynikiem zapytania ani przepisaniem warunku z funkcji — 071b8e3

### Phase 2: Ranking i oznaczenia braków (#2)

#### Automated

- [x] 2.1 `supabase test db` uruchamia oba pliki i kończy się `Result: PASS` — 65a5521
- [x] 2.2 Po przebiegu w lokalnej bazie nie ma gmin `9999%` ani użytkowników fixtur — 65a5521

#### Manual

- [x] 2.3 Przegląd pliku: oczekiwana kolejność i listy braków są literalne, tie-breaker i granice stron mają osobne asercje — 65a5521

### Phase 3: Kontrakt aplikacji w smoke

#### Automated

- [x] 3.1 Świeży `npm run preview` i `npm run smoke` przechodzą, w tym nowy krok
- [x] 3.2 `npm run lint` przechodzi

#### Manual

- [x] 3.3 Tymczasowe złamanie `sortAvailability` w mapowaniu powoduje czerwony nowy krok, po wycofaniu smoke zielony

### Phase 4: Bramka CI i dowód mutacjami

#### Automated

- [ ] 4.1 `.github/workflows/ci.yml` zawiera krok `supabase test db` w jobie `smoke`
- [ ] 4.2 `supabase test db` lokalnie zielone po przywróceniu funkcji, `pg_get_functiondef` bez zmian względem stanu przed mutacjami
- [ ] 4.3 `npm run lint` przechodzi

#### Manual

- [ ] 4.4 Raport mutacji: każda z ≥4 mutacji dała czerwony `supabase test db`, po przywróceniu zielone
- [ ] 4.5 Job `smoke` w CI dla brancha z PR przechodzi, log kroku zawiera `Result: PASS`
- [ ] 4.6 `test-plan.md`, `AGENTS.md` i `README.md` opisują nową warstwę zgodnie z faktycznym stanem
