---
date: 2026-11-04T18:43:08+01:00
researcher: Claude (claude-opus-5-5)
git_commit: 0e88024f57d02ccc80e37d4e124c6b7b1be5bf87
branch: master
repository: 10xdevs (origin: arkhul/opieka-dla-bliskich)
topic: "Ugruntowanie etapu 1 planu testów: poprawność dopasowania (ryzyka #1, #2)"
tags: [research, testing, search_caregivers, ranking, gmina, pgtap, smoke]
status: complete
last_updated: 2026-11-04
last_updated_by: Claude (claude-opus-5-5)
---

# Research: Ugruntowanie etapu 1 planu testów — poprawność dopasowania

**Date**: 2026-11-04T18:43:08+01:00
**Researcher**: Claude (claude-opus-5-5)
**Git Commit**: 0e88024f57d02ccc80e37d4e124c6b7b1be5bf87 (drzewo robocze: niezatwierdzone `context/foundation/test-plan.md` i ten folder zmiany)
**Branch**: master
**Repository**: 10xdevs (origin `arkhul/opieka-dla-bliskich`)

## Research Question

Ugruntować etap 1 z `context/foundation/test-plan.md` („Poprawność dopasowania”, ryzyka #1 i #2, testy integracyjne). Dla każdego ryzyka: znaleźć prawdziwą ścieżkę awarii w kodzie i zacytować ją, zweryfikować lub poprawić Risk Response Guidance z §2, zlokalizować istniejące testy, wskazać najtańszą warstwę testu z realnym sygnałem i oznaczyć ryzyka spekulatywne lub mylący dowód hot-spotu (`change.md` Notes, test-plan §2 i §3).

## Summary

- **Cała reguła dopasowania jest w jednej funkcji SQL.** `public.search_caregivers()` w ostatniej definicji (`supabase/migrations/20261104150000_search_ignores_unknown_selections.sql:36-193`) realizuje: filtr kompletności (`:91`), twardy filtr gminy (`:92-102`), próg ≥1 wybranej usługi (`:104-109`), ranking i tie-breaker (`:131`, `:192`) oraz oznaczenia braków (`:168-189`). Aplikacja przekazuje filtr bez zmian (`src/lib/services/caregiver.service.ts:226-232`) i tylko przemapowuje wiersze (`:213-221`). Dowód hot-spotu z §2 (`supabase/migrations/`) wskazuje właściwy obszar.
- **Ryzyko #1 potwierdzone, ale w kodzie ma trzy osobne ścieżki.** (a) gmina musi być równa `p_teryt` i aktywna (`:96-100`); (b) profil bez gmin odpada przez regułę kompletności, a nie przez filtr gminy, więc znika także bez wybranej gminy (`:91` + `20261103150000_caregiver_profiles.sql:375-381`); (c) wycofana albo nieistniejąca gmina w URL powoduje, że strona *zdejmuje* filtr gminy i pokazuje listę bez filtra z komunikatem (`src/pages/opiekunowie/index.astro:47-53`), a zniekształcony kod gminy jest ignorowany po cichu (`src/lib/caregiver-search.ts:24,31`).
- **Ryzyko #2 potwierdzone.** Kolejność to `matched_services desc, matched_slots desc, updated_at desc, user_id` (`:131`, powtórzona na stronie wyniku `:192`), liczona dla wszystkich kandydatów przed `limit/offset` (`:110-134`). Gdy wybrano usługi, profil bez żadnej z nich nie pojawia się na liście (`:107-108`). To decyzja S-05 (`context/archive/2026-11-04-ranked-match-results/plan-brief.md:23`), która zawęża dosłowne brzmienie PRD (`context/foundation/prd.md:142`).
- **Istniejący smoke nie spełnia wymogów odpowiedzi na ryzyko.** Kroki wyszukiwania w `scripts/smoke.mjs` sprawdzają obecność lub brak *jednego* profilu (`:132-137`) i monotoniczność kolejności (`:138-150`). To dokładnie anty-wzorce z §2: „lista nie jest pusta” i „kolejność nie rośnie”. Smoke działa na współdzielonej gminie `1465011`, w której lokalna baza zbiera profile z każdego uruchomienia (`:139-140`), więc dokładnego zbioru ani kolejności nie da się tam sprawdzić.
- **Najtańsza warstwa z realnym sygnałem: pgTAP przez `supabase test db`** na lokalnym Supabase. Każdy plik działa w jednej transakcji z `rollback`, fixtury są wstawiane bezpośrednio (w tym testowe gminy `9999xx1`), a wywołanie idzie jako `anon`. Spike w tej sesji przeszedł (3/3, `Result: PASS`) i nie zostawił danych (sprawdzone zapytaniem: 0 testowych gmin, 0 testowych użytkowników). Dzięki temu oczekiwany zbiór i kolejność można zapisać literalnie, z deklaracji fixtur, a nie z wyniku zapytania.

## Detailed Findings

### Punkt wejścia wyszukiwania (baza → serwis → strona)

- `search_caregivers()` ma 5 parametrów: `p_teryt`, `p_services`, `p_availability`, `p_limit`, `p_offset` (`20261104150000_…sql:36-42`). Działa jako `security invoker` z `search_path = ''` (`:57-60`). Ostatnią definicją jest `create or replace` z migracji 20261104150000; wcześniejsze definicje to `20261103200000:25`, `20261104120000:237` i `20261104140000:53` (wyszukiwanie `grep -n search_caregivers supabase/migrations`).
- Wybrane usługi to unikalne wpisy obecne w słowniku `public.services` (`:62-66`). Wybrane terminy to unikalne niepuste wpisy (`:67-71`). Nieznany, ale niepusty termin zostaje w zbiorze i nie pasuje do nikogo, więc trafia tylko do `missing_slots` (komentarz `:17-19`).
- Serwis: `runSearch` przekazuje `filter.teryt/services/availability` 1:1 (`src/lib/services/caregiver.service.ts:226-232`). `searchCaregivers` pobiera stronę rozmiaru `CAREGIVER_PAGE_SIZE = 20` (`:166`, `:254`). `toRankedCaregiver` mapuje `missing_services` → `match.missingServices` i `missing_slots` → `match.missingAvailability` przez `sortAvailability` (`:213-221`).
- Parser URL: `gmina` musi pasować do `^[0-9]{6}[123]$`, w przeciwnym razie `teryt = null` bez komunikatu (`src/lib/caregiver-search.ts:8`, `:24`, `:31`). Usługi są filtrowane do slugów ze słownika w kolejności katalogu (`:32`). Terminy przechodzą przez `sortAvailability`, który odrzuca nieznane wartości i duplikaty (`:33`; `src/lib/availability.ts:47-51`).
- Strona: poprawny składniowo, ale nieaktywny lub nieistniejący `teryt` → `getActiveGmina` zwraca `null` → `filter.teryt = null` + komunikat „Wybrana gmina nie istnieje lub została wycofana — wybierz ją ponownie.” (`src/pages/opiekunowie/index.astro:47-53`; `src/lib/services/dictionary.service.ts:55-61`). Linia dopasowania na karcie pojawia się tylko, gdy wybrano usługi lub terminy (`index.astro:100`, `:296`). „Pełne dopasowanie” = obie listy braków puste (`:266`, `:305`), „Brakuje usług: …” to etykiety w kolejności z SQL (`:306-308`), „Brakuje terminów: …” to `summarizeAvailability(missingAvailability)` (`:265`, `:309`).

### Ryzyko #1 — twardy filtr gminy

- **Ścieżka filtra** (`20261104150000_…sql:92-102`): `p_teryt is null or exists (… cg.teryt = p_teryt and g.active)`. Porównanie to równość tekstu, bez `like` ani prefiksu. Kod gminy z tego samego powiatu (te same 4 pierwsze cyfry) nie powinien więc przejść. To wymaga dowodu, nie założenia.
- **Profil bez gmin**: `caregiver_profile_missing()` zwraca `'gminas'`, gdy profil nie ma *aktywnej* gminy (`20261103150000_caregiver_profiles.sql:375-381`). `search_caregivers` dopuszcza tylko profile z pustym wynikiem tej funkcji (`:91`). Wniosek: profil bez gmin oraz profil, którego wszystkie gminy są wycofane, odpada także przy `p_teryt = null` (US-01 AC3, `prd.md:81`: „nie pojawia się w wynikach”, bez zastrzeżenia o filtrze).
- **Wycofana gmina**: `gminas.active` dodano w `20261103120000_retirable_gminas.sql:16-20`. Wyszukiwanie z `p_teryt` = wycofana gmina nie zwraca nikogo (`:100`). Profil z wycofaną gminą R i aktywną H jest kompletny, pojawia się dla H, a nie dla R. W kolumnie `gminas` wyniku są tylko aktywne gminy (`:157-160`).
- **Zachowanie na poziomie strony** (punkt (c) z Summary): zniekształcona, nieistniejąca lub wycofana gmina w URL nie daje pustej listy, tylko listę *bez filtra gminy* (z komunikatem dla poprawnej składniowo; bez komunikatu dla zniekształconej). To istniejące, celowe zachowanie aplikacji. Ryzyka #1 nie łamie, bo koordynator dostaje informację, że filtr nie zadziałał, ale wyrocznia testu musi je nazwać wprost. Inaczej test „gmina G nie istnieje → lista niepusta” wyglądałby na wyciek spoza gminy.
- **Wymagania danych testowych**: `gminas.teryt` musi pasować do `^[0-9]{6}[123]$` (`20260924120000_create_dictionaries.sql:58`). Tabela nie ma grantu zapisu dla `anon` (smoke `scripts/smoke.mjs:356-363`), ale rola `postgres` w teście pgTAP może wstawić gminy testowe. W spike'u przeszły `9999011` i `9999021`. Lokalna baza ma dziś 2479 aktywnych i 0 wycofanych gmin, 6 profili, w tym 4 kompletne (zapytanie `db query --local`, 2026-11-04). Wycofaną gminę test musi więc utworzyć sam.

### Ryzyko #2 — ranking i oznaczenia braków

- **Liczniki** (`:78-89`): `matched_services` = |wybrane ∩ oferowane|, `matched_slots` = |wybrane ∩ dostępne| (0, gdy nic nie wybrano).
- **Próg** (`:104-109`): przy co najmniej jednej wybranej usłudze ze słownika profil musi mieć `matched_services >= 1`. Terminy nigdy nie ukrywają profilu (komentarz `:22`, brak warunku na `matched_slots`).
- **Kolejność globalna, nie per strona**: `count(*) over ()` i `order by … limit … offset` są liczone na zbiorze `matches` (`:110-134`), więc profil (2 usługi, 0 terminów) na stronie 2 przy `p_limit` mniejszym niż liczba wyników byłby błędem. Spike tego nie sprawdzał. To wniosek z kodu do udowodnienia testem z małym `p_limit` i `p_offset`.
- **Tie-breaker**: `updated_at desc`, potem `user_id` rosnąco (`:131`, `:192`). `caregiver_profiles.updated_at` ma `default now()` (`20261103150000_caregiver_profiles.sql:48`), a `save_caregiver_profile` ustawia `now()` przy zapisie (`20261104130000_save_profile_keeps_availability.sql:119`, `:126`). W jednej transakcji testu `now()` jest stałe, więc fixtury muszą mieć jawne `updated_at`, inaczej kolejność rozstrzygnie dopiero `user_id`. W spike'u jawne `updated_at` w `insert` zostało zachowane (asercja 3 przeszła).
- **`missing_services`** (`:168-178`): wybrane usługi ze słownika minus oferowane, jako `[{slug, label}]` w `services.sort_order`. Kolejność słownika: `20260924120000_create_dictionaries.sql:125-139` (13 usług, `towarzystwo` = 1 … `cwiczenia-usprawniajace` = 13). Wyrocznia powinna porównywać *dokładną* listę, a nie `some` (smoke `:400-401` sprawdza tylko obecność `demencja`).
- **`missing_slots`** (`:180-189`): wybrane minus dostępne, posortowane po *tekście* slotu, a nie kanonicznie. Kanoniczną kolejność ustala aplikacja (`caregiver.service.ts:218`). W SQL porównywać więc jako zbiór albo z kolejnością tekstową; kolejność kanoniczna to kontrakt warstwy aplikacji.
- **Wejścia brzegowe** (migracja 20261104150000, poprawka F4): `''` i nieznany slug usługi są ignorowane (`:62-66`), `''` dla terminu też (`:70`), duplikaty są zwijane (`distinct`, `:63`, `:68`).

### Istniejące testy

- `scripts/smoke.mjs` (1138 linii, bez zależności) to jedyny test automatyczny. Kroki wyszukiwania: `:304-308` (ukrywa niekompletny), `:370-390` (jest w gminie / nie ma w innej gminie), `:391-410` (brak usługi oznaczony, jedna usługa), `:485-545` (terminy, próg, usługi przed terminami), `:546-560` (podpowiedzi), `:730-745` (HTML: „Brakuje usług: …”, „Dostępność nie podana”).
- Wszystkie asercje dotyczą jednego lub dwóch znanych profili (`listsCaregiver`, `hidesCaregiver`, `findFirstCaregiver`, `findSecondCaregiver`, `:132-137`) albo monotoniczności (`rankedInOrder`, `:142-150`). Komentarz `:138-141` mówi wprost, że pozycje nie są sprawdzane, bo lokalna baza zbiera profile z każdego uruchomienia.
- Luki względem odpowiedzi na ryzyko (sprawdzony zakres: kroki z `searchCaregivers(` w `smoke.mjs`): brak dokładnego zbioru dla gminy; brak profilu *bez gmin* (niekompletny profil w smoke'u nie ma telefonu, `:289-302`); brak wycofanej gminy; brak gminy sąsiedniej z tego samego powiatu (smoke używa `1061011` Łódź vs `1465011` Warszawa); brak dokładnej kolejności i tie-breakera; brak granicy strony; brak dokładnej listy `missing_services`.
- `supabase/tests/` nie istnieje. W repo nie ma konfiguracji vitest, jest ani playwright (test-plan §4, potwierdzone listingiem).

### Najtańsza warstwa: pgTAP (`supabase test db`)

- Supabase CLI 2.117.0 (lokalnie i w CI, `.github/workflows/ci.yml`: `supabase/setup-cli@v3` z `version: 2.117.0`) ma `supabase test db [path...]` (pgTAP przez obraz `public.ecr.aws/supabase/pg_prove:3.36`, pobrany przy pierwszym uruchomieniu w tej sesji). Rozszerzenie `pgtap` 1.3.3 jest dostępne w lokalnym Postgresie, ale nie jest zainstalowane na stałe (zapytanie do `pg_extension` po spike'u: 0).
- Wzorzec z dokumentacji Supabase (Context7, `/supabase/supabase`, „testing-row-level-security”; sprawdzone 2026-11-04): `begin; create extension if not exists pgtap with schema extensions; select plan(n); … select * from finish(); rollback;`, `insert into auth.users`, `set local role …`. Pliki leżą w `supabase/tests/`.
- **Spike** (plik tymczasowy w scratchpadzie, nie w repo): wstawienie 2 gmin testowych, 1 użytkownika `auth.users` z `raw_user_meta_data = {"role":"caregiver"}` (wymagane przez `handle_new_user`, `20261103150000_caregiver_profiles.sql:204-232`), profilu z jawnym `updated_at`, kontaktu z telefonem `+48…` (check `:95`), gminy i usługi. Potem `set local role anon` i 3 asercje: dokładny zbiór dla G, pusty wynik dla gminy sąsiedniej, zachowane `updated_at`. Wynik: `All tests successful. Files=1, Tests=3 … Result: PASS`. CLI wypisał NOTICE „extension "pgtap" already exists”, czyli sam przygotowuje rozszerzenie w swojej sesji.
- **Trigger limitu gmin** (`20261103170000_caregiver_gminas_limit.sql:54-56`) działa tylko przy ustawionym `auth.uid()` (komentarz `:50-51`), więc przy bezpośrednich insertach jako `postgres` nie przeszkadza.
- **CI**: job `smoke` uruchamia już `supabase start` (`ci.yml`, krok „Start local Supabase”). Krok `supabase test db` zmieściłby się po „Check table grants”, przed buildem. Nie zweryfikowano pobrania obrazu `pg_prove` w CI. Lista `-x` wyklucza inne usługi i nie dotyczy kontenera uruchamianego przez `test db`, ale to wniosek bez uruchomienia w CI.
- **Dlaczego nie smoke**: rozszerzenie `smoke.mjs` wymagałoby rejestrowania użytkowników przez GoTrue i sprzątania po sobie (usunięcie profilu przez właściciela działa, `smoke.mjs:16-20`). Przerwany przebieg zostawia jednak dane, a testowych gmin nie da się utworzyć przez API (brak grantu). Dokładny zbiór byłby więc niestabilny lokalnie przy kolejnych uruchomieniach. pgTAP nie ma tego problemu, bo transakcja jest wycofywana.
- **Warstwa aplikacji** (mapowanie i karta): logika ogranicza się do `sortAvailability` i warunku `fullMatch` (`caregiver.service.ts:216-219`, `index.astro:266`). Smoke sprawdza tekst „Brakuje usług: …” (`smoke.mjs:731-734`). Nie ma runnera testów jednostkowych, a test-plan §4 ich nie planuje. Kolejność kanoniczna `missingAvailability` i warunek „Pełne dopasowanie” to zatem kontrakt bez dedykowanego testu (zob. Open Questions).

### Weryfikacja Risk Response Guidance (§2)

- **#1, „co dowodziłoby ochrony”**: poprawne. Doprecyzowania wynikające z kodu: (1) profil bez gmin sprawdzać także przy `p_teryt = null`, bo wykluczenie pochodzi z reguły kompletności; (2) dodać profil, którego jedyna gmina jest wycofana, oraz wyszukiwanie po wycofanej gminie; (3) „sąsiednia” gmina = inny kod z tego samego powiatu (wspólny prefiks), żeby wyłapać ewentualny filtr prefiksowy; (4) profil obsługujący G i inne gminy musi się pojawić (G nie jest jego jedyną gminą). „Gminy wycofane” były już w kolumnie kontekstu. Potwierdzone.
- **#1, anty-wzorzec**: potwierdzony. Smoke ma dokładnie wzorzec „jest / nie ma jednego profilu”.
- **#2, „co dowodziłoby ochrony”**: poprawne. Doprecyzowania: (1) wyrocznia musi uwzględniać próg ≥1 usługi (profil z 0 wybranych usług *nie* jest na końcu listy, tylko nie ma go wcale); (2) tie-breaker `updated_at desc, user_id` z jawnymi `updated_at`; (3) ranking globalny względem stronicowania; (4) `missing_services` jako dokładna lista w `sort_order`, `missing_slots` jako zbiór; (5) wejścia `''`, nieznany slug i duplikaty jak „niewybrane”.
- **#2, anty-wzorzec**: potwierdzony. `rankedInOrder` w smoke'u (`:142-150`) przepisuje regułę implementacji (porównanie par), więc jest wyrocznią skopiowaną z kodu.
- **Najtańsza warstwa**: „integracja (lokalny Supabase)”. Potwierdzone, z doprecyzowaniem: pgTAP bezpośrednio na funkcji, a nie HTTP przez aplikację.
- **Przeniesienie do planu testów**: §4 Stack nie wymienia pgTAP ani `supabase test db`. Po etapie 1 trzeba dopisać wiersz warstwy (pgTAP 1.3.3, `pg_prove:3.36`, Supabase CLI 2.117.0) i wypełnić §6.1.

## Code References

- `supabase/migrations/20261104150000_search_ignores_unknown_selections.sql:36-193` — obowiązująca definicja `search_caregivers()`
- `supabase/migrations/20261104150000_search_ignores_unknown_selections.sql:62-71` — normalizacja wybranych usług i terminów
- `supabase/migrations/20261104150000_search_ignores_unknown_selections.sql:91-102` — kompletność i twardy filtr gminy
- `supabase/migrations/20261104150000_search_ignores_unknown_selections.sql:104-109` — próg ≥1 usługi
- `supabase/migrations/20261104150000_search_ignores_unknown_selections.sql:110-134`, `:192` — liczenie, kolejność, stronicowanie
- `supabase/migrations/20261104150000_search_ignores_unknown_selections.sql:168-189` — `missing_services`, `missing_slots`
- `supabase/migrations/20261103150000_caregiver_profiles.sql:356-388` — `caregiver_profile_missing()` (aktywna gmina wymagana)
- `supabase/migrations/20261103150000_caregiver_profiles.sql:204-232` — `handle_new_user` (rola w metadanych wymagana przy fixturach)
- `supabase/migrations/20261103120000_retirable_gminas.sql:16-20` — `gminas.active`
- `supabase/migrations/20260924120000_create_dictionaries.sql:57-64`, `:125-139` — tabela gmin (check teryt), słownik usług i `sort_order`
- `supabase/migrations/20261103170000_caregiver_gminas_limit.sql:30-56` — limit 30 gmin (tylko z `auth.uid()`)
- `src/lib/services/caregiver.service.ts:213-261` — mapowanie wiersza i stronicowanie
- `src/lib/caregiver-search.ts:20-37` — parser filtrów z URL
- `src/pages/opiekunowie/index.astro:47-53`, `:100`, `:264-310` — zdjęcie filtra wycofanej gminy, linia dopasowania
- `scripts/smoke.mjs:132-150`, `:370-560`, `:730-745` — obecne kroki wyszukiwania i rankingu
- `.github/workflows/ci.yml` — job `smoke` z lokalnym Supabase (miejsce na krok `supabase test db`)

## Architecture Insights

- Reguła dopasowania ma jedno źródło prawdy w SQL. Aplikacja świadomie jej nie powtarza (komentarz `caregiver.service.ts:224-225`), więc test na funkcji SQL pokrywa regułę dla aplikacji i dla bezpośrednich wywołań RPC.
- Reguła kompletności (`caregiver_profile_missing`) jest współdzielona przez wyszukiwanie, `get_public_caregiver` i dostęp do kontaktu (`20261103220000_coordinator_contact_access.sql:11`, `:52`). Fixtura „profil bez gmin” sprawdza więc pośrednio także tę regułę.
- `missing_slots` z SQL i `match.missingAvailability` z aplikacji mają różne kolejności (tekst vs kanoniczna). Kontrakt kolejności kanonicznej leży w TS.

## Historical Context (from prior changes)

- `context/archive/2026-11-04-ranked-match-results/plan-brief.md:23-24` — decyzja S-05: próg ≥1 usługa, terminy bez progu. **Supported**: kod `:104-109` jest z nią zgodny.
- `context/archive/2026-11-04-ranked-match-results/research.md:154` — otwarte wówczas pytanie, czy profil z zerowym pokryciem usług ma się pojawiać (dosłownie `prd.md:142`). Rozstrzygnięte w plan-brief `:23` na korzyść progu. Wyrocznia etapu 1 bierze regułę z PRD *oraz* tej zarejestrowanej decyzji.
- `context/archive/2026-11-04-ranked-match-results/reviews/impl-review.md:61-69` (F4, cytowane w test-plan §2 jako dowód #2) — pusty string i nieznany slug liczyły się jako wybrana usługa. **Naprawione** w `20261104150000_…sql`. Test etapu 1 powinien to utrwalić (ochrona przed regresją). Uwaga z F4: „Not yet on production”. Stan produkcji nie był sprawdzany w tym badaniu.
- `context/archive/2026-11-04-ranked-match-results/plan.md:35` — „w pełni miękko” odrzucone. **Supported**.

## Related Research

- `context/archive/2026-11-04-ranked-match-results/research.md` — projekt rankingu S-05
- `context/archive/2026-11-03-public-caregiver-search/` — pierwotne wyszukiwanie (nie czytane szczegółowo; poza zakresem pytań)

## Open Questions

1. **Wycofana lub nieistniejąca gmina w URL → lista bez filtra gminy** (`index.astro:47-53`; zniekształcona: po cichu, `caregiver-search.ts:24,31`). Czy plan etapu 1 ma utrwalić to zachowanie testem (wymagałoby warstwy HTTP lub e2e, nie pgTAP), czy zostawić je etapowi 2 (e2e)? Na poziomie SQL ta ścieżka jest pokryta wynikiem pustym dla wycofanej gminy.
2. **Kontrakt warstwy aplikacji dla oznaczeń braków** (kanoniczna kolejność `missingAvailability`, warunek „Pełne dopasowanie” i bramka `isRanked`): bez runnera unit zostaje jedna dodatkowa asercja HTML w smoke'u albo e2e w etapie 2. To wybór dla planu. Ryzyko jest niskie (2 linie mapowania), ale to część „oznaczenia braków” z ryzyka #2.
3. **CI**: krok `supabase test db` w jobie `smoke` nie był uruchomiony w CI. Pobranie obrazu `public.ecr.aws/supabase/pg_prove:3.36` (inny rejestr niż ghcr.io) to niezweryfikowane założenie.
4. **Czy `count_caregivers_relaxed()` wchodzi w zakres**: liczy z `search_caregivers()` (`20261104150000_…sql:209-241`), więc dziedziczy jej regułę. Ryzyka #1 i #2 jej nie wymieniają. Proponowane: poza zakresem etapu 1.
