# Wyniki uszeregowane według dopasowania (S-05) — plan implementacji

## Overview

Publiczna lista `/opiekunowie` przestaje twardo filtrować po usługach i terminach. Gmina zostaje warunkiem twardym, a usługi i terminy ustalają kolejność: najpierw liczba pokrytych wybranych usług, potem liczba pokrytych wybranych terminów. Przy każdej karcie widać, czego brakuje (US-01, FR-016, `context/foundation/prd.md:138-144`). Przy okazji podpowiedzi pustego wyniku liczą się jednym wywołaniem RPC zamiast jednym `search_caregivers` na podpowiedź (follow-up F6 z S-04).

## Current State Analysis

- `search_caregivers()` (`supabase/migrations/20261104120000_caregiver_availability.sql:237-345`) wymaga gminy (jeśli podana), **wszystkich** wybranych usług (AND, `:274-284`) i **co najmniej jednego** wybranego terminu (OR, `:285-297`), a sortuje po `updated_at desc, user_id` (`:306`, `:344`).
- Dane do rankingu już są w bazie: `caregiver_services(caregiver_id, service_slug)` i `caregiver_availability(caregiver_id, slot)` z kluczem głównym i indeksem po wartości (`20261103150000_caregiver_profiles.sql:172-175`, `20261104120000_caregiver_availability.sql:38-44`). Obie mają `select` dla `anon`, a funkcja jest `SECURITY INVOKER`, więc pokrycie i braki liczy ta sama funkcja, bez nowych uprawnień i bez `caregiver_contacts`.
- W aplikacji RPC woła tylko `runSearch()` (`src/lib/services/caregiver.service.ts:187-203`), z niego korzystają `searchCaregivers()` i `countCaregivers()`, a te — wyłącznie `src/pages/opiekunowie/index.astro:53`, `:71`. `PublicRow` jest wspólny z `get_public_caregiver()` (`caregiver.service.ts:156-167`).
- Strona przy pustym wyniku liczy do trzech podpowiedzi, każdą osobnym `countCaregivers()` (`index.astro:55-74`). Legendy filtrów opisują stare AND/OR (`:136`, `:156`). Karta (`:241-282`) nie ma miejsca na braki.
- Smoke (`scripts/smoke.mjs`) sprawdza ukrywanie profilu przez usługi lub terminy w 7 krokach (`:362`, `:446`, `:455`, `:500`, `:590`, `:607`, `:617`). Kolejności nie sprawdza żaden krok. Lokalna baza zbiera profile „Anna Smoke” i „Bartek Smoke” ze wszystkich wcześniejszych uruchomień.

## Desired End State

- `search_caregivers()` zwraca tylko kompletne profile w wybranej (aktywnej) gminie. Gdy wybrano usługi — tylko profile oferujące **co najmniej jedną** z nich. Terminy nikogo nie ukrywają, także profili bez podanej dostępności.
- Kolejność: `matched_services desc, matched_slots desc, updated_at desc, user_id`. Bez wybranych usług i terminów lista wygląda jak dziś.
- Każdy wiersz ma `matched_services`, `missing_services` (wybrane usługi, których profil nie oferuje, `{slug, label}` w `sort_order`), `matched_slots` i `missing_slots` (wybrane terminy, których profil nie ma).
- Karta na `/opiekunowie` pokazuje, gdy koordynator wybrał usługi lub terminy: „Brakuje usług: …” (nazwy), „Brakuje terminów: …” (podsumowanie `summarizeAvailability`) albo „Pełne dopasowanie”.
- Pusty wynik (możliwy tylko przez gminę lub brak jakiejkolwiek wybranej usługi) pokazuje podpowiedzi „Usuń filtr usług” / „Usuń filtr gminy” z liczbami z jednego wywołania `count_caregivers_relaxed()`. Podpowiedzi „Usuń filtr dostępności” nie ma.
- Produkcja ma nową migrację i Worker, a w `change.md` jest zapisany pomiar CPU i decyzja Workers Free/Paid.

Weryfikacja: `npm run smoke` (nowe kroki rankingu, braków i podpowiedzi), ręczny przegląd listy i pomiar na produkcji (faza 3).

### Key Discoveries:

- `updated_at` jest odświeżane przy każdym zapisie profilu (`20261103150000_caregiver_profiles.sql:317`, `:324`), więc tie-breaker `updated_at desc` zachowuje dzisiejszą kolejność listy bez filtrów.
- W obrębie jednego żądania zbiory wybranych usług i terminów są wspólne dla wszystkich profili, więc sortowanie po liczbie pokrytych pozycji i po ich odsetku daje tę samą kolejność. Ranking leksykograficzny jako jedyny gwarantuje, że żadna liczba terminów nie wyprzedzi usługi (`prd.md:142`).
- Zmiana kolumn wyniku wymaga `drop function` + `create` + ponownego `grant` (`20261104120000_caregiver_availability.sql:23-25`). Parametry zostają te same, a stary Worker czyta tylko dawne kolumny (`toPublicCaregiver()`), więc kolejność wdrożenia „migracja, potem Worker” nie ma okna awarii.
- Workers Logs są włączone (`wrangler.jsonc`: `observability.enabled`), więc czas CPU pojedynczego żądania da się odczytać na produkcji bez zmian w kodzie.

## What We're NOT Doing

- Profili bez żadnej wybranej usługi nie pokazujemy (decyzja: próg ≥1 usługa; „w pełni miękko” odrzucone).
- Nie wprowadzamy progu dla terminów (decyzja: terminy w pełni miękkie; „≥1 termin” odrzucone).
- Nie zmieniamy tie-breakera na alfabetyczny ani żaden inny (zostaje `updated_at desc, user_id`).
- Nie pokazujemy na karcie liczników „2 z 3” zamiast nazw braków.
- Bez wag i sumy punktów, bez reputacji i weryfikacji jako czynnika rankingu (`prd.md:26`).
- Bez zmian parametrów URL, formularza filtra, `get_public_caregiver()` i strony `/opiekunowie/[id]`.
- Bez materializacji kompletności ani pokrycia (skala `small`, `prd.md:8-11`).
- Nie usuwamy dodatkowego `countCaregivers()` przy stronie poza zakresem (`caregiver.service.ts:220-221`) — to nie podpowiedź, F6 jej nie dotyczy.
- Bez przejścia na Workers Paid w tym planie — faza 3 tylko mierzy i zapisuje decyzję.

## Implementation Approach

Reguła zostaje w SQL, zgodnie z wzorcem projektu (`caregiver.service.ts:65`, `:188-189`). `search_caregivers()` liczy dla każdego kandydata pokrycie i braki w CTE przed `order by` / `limit`, więc ranking obejmuje cały wynik, a nie jedną stronę. `count_caregivers_relaxed()` nie powtarza reguły, tylko woła `search_caregivers()` dwa razy z jednym zdjętym wymiarem — jedno żądanie HTTP z Workera. Aplikacja mapuje nowe kolumny na osobny `RankedCaregiverDto`, nie poszerzając DTO strony profilu. Faza 1 zmienia bazę i te kroki smoke, które zmiana semantyki odwraca. Faza 2 zmienia stronę i jej kroki smoke. Faza 3 wdraża i mierzy.

## Critical Implementation Details

- **Smoke a narastające dane.** Lokalna baza ma „Annę” i „Bartka” z każdego uruchomienia, z identycznymi danymi, więc w filtrze, w którym wszystkie „Anny” wpadają do wyższej grupy pokrycia niż bieżący Bartek, bieżący Bartek wypada poza pierwszą stronę po ~20 uruchomieniach. Kroki kolejności sprawdzają więc monotoniczność całej zwróconej tablicy (`matched_services`, potem `matched_slots`, potem `updated_at` nierosnąco), a nie pozycje konkretnych osób. Kroki HTML używają terminów, których nie ma nikt (`czw-noc`), albo porównują tylko kolejność znaczników na stronie.
- **Kolejność wdrożenia.** Najpierw `supabase db push`, potem `wrangler deploy`. Nowy Worker przed migracją dostałby wiersze bez `missing_services` i wywołanie nieistniejącej `count_caregivers_relaxed()`.

## Phase 1: Ranking w bazie

### Overview

Nowa migracja zmienia `search_caregivers()` na ranking z kolumnami pokrycia i braków i dodaje `count_caregivers_relaxed()`. Smoke dostaje kroki rankingu, a kroki, które zmiana semantyki odwraca, są przepisane.

### Changes Required:

#### 1. Migracja

**File**: `supabase/migrations/20261104140000_ranked_caregiver_search.sql`

**Intent**: Wyniki ułożone według dopasowania, z brakami przy każdym wierszu, i tania odpowiedź na pytanie „ile byłoby bez usług / bez gminy” — w bazie, nie w Workerze (`roadmap.md:157`).

**Contract**:

- Nagłówek w stylu `20261104120000_caregiver_availability.sql:1-33`: cel, decyzje S-05 (próg ≥1 usługa, terminy miękkie, ranking leksykograficzny, tie-breaker `updated_at desc, user_id`), kolejność wdrożenia (migracja, potem Worker; stary Worker czyta tylko dawne kolumny), brak zmian danych i tabel (macierz uprawnień tabel bez zmian).
- `drop function public.search_caregivers(text, text[], text[], int, int);` i `create` z **tymi samymi parametrami i wartościami domyślnymi**. `returns table` = dotychczasowe kolumny w tej samej kolejności oraz, przed `total_count`: `matched_services int`, `missing_services jsonb`, `matched_slots int`, `missing_slots text[]`. `language sql stable security invoker set search_path = ''`.
- Wybrane usługi = różne, niepuste wpisy `p_services`. Wybrane terminy = różne, niepuste wpisy `p_availability`. `null`, `'{}'` i `'{null}'` oznaczają brak wyboru.
- Zbiór wyników: kompletny profil (`caregiver_profile_missing()` puste) i gmina jak dziś (`:263-273`) **oraz** (brak wybranych usług **lub** `matched_services >= 1`). Terminy nie wpływają na zbiór.
- `matched_services` = liczba wybranych usług, które profil oferuje. `matched_slots` = liczba wybranych terminów, które profil ma. Obie są liczone w CTE dla każdego kandydata, przed `count(*) over ()`, `order by` i `limit/offset`.
- `missing_services` = wybrane usługi, których profil nie oferuje, złączone ze słownikiem `services` (nieznany slug pomijany), jako `jsonb` `[{slug, label}]` w `sort_order`; `'[]'` gdy brak. `missing_slots` = wybrane terminy, których profil nie ma, w kolejności tekstowej; `'{}'` gdy brak (kolejność kanoniczną ustawia aplikacja). Liczone tylko dla zwracanej strony (≤ 50 wierszy), jak `services`/`gminas`.
- Kolejność w `paged` i w końcowym `select`: `matched_services desc, matched_slots desc, updated_at desc, user_id`. `total_count` i obcięcie `limit`/`offset` bez zmian.
- Komentarz nad funkcją i `comment on function` opisują nową semantykę (zastępują opis AND/OR).
- Nowa `public.count_caregivers_relaxed(p_teryt text default null, p_services text[] default null) returns table (without_services bigint, without_gmina bigint)`: zawsze dokładnie jeden wiersz, `language sql stable security invoker set search_path = ''`. `without_services` = liczba wyników `search_caregivers(p_teryt, null, null, 1, 0)` (`coalesce(total_count, 0)`), albo `null` gdy nie wybrano usług (brak niepustych wpisów w `p_services`, jak w `search_caregivers()`: `null`, `'{}'` i `'{null}'`; aplikacja wysyła `[]`, nie `null`). `without_gmina` = liczba wyników `search_caregivers(null, p_services, null, 1, 0)`, albo `null` gdy `p_teryt is null`. Terminów nie przyjmuje, bo nigdy nie zawężają wyniku. Komentarz: zastępuje do trzech wywołań `search_caregivers` na żądanie (F6).
- Uprawnienia: `revoke execute ... from public; grant execute ... to anon, authenticated` dla obu funkcji (wzorzec `:419-420`).

#### 2. Smoke: baza

**File**: `scripts/smoke.mjs`

**Intent**: Smoke dowodzi nowej reguły (próg usług, miękkie terminy, kolejność, braki, jedno RPC podpowiedzi) i przestaje oczekiwać ukrywania przez terminy.

**Contract**:

- `secondCaregiverProfile.p_services` = `["towarzystwo", "zakupy-i-sprawy"]`, żeby Bartek pokrywał więcej usług niż Anna.
- Helper `rankedInOrder(json)`: tablica, w której dla kolejnych wierszy para (`matched_services`, `matched_slots`) jest leksykograficznie nierosnąca, a przy równej parze `updated_at` jest nierosnące (porównanie `Date.parse(updated_at)`, nie tekstu: PostgREST zwraca `timestamptz` ze zmienną liczbą cyfr ułamka sekundy). Helper `countRelaxed(args)` dla `/rest/v1/rpc/count_caregivers_relaxed` (wzorzec `searchCaregivers`, `:107`).
- Kroki przepisane (stara nazwa → nowa):
  - `:362` „search requires all selected services” → „search ranks profile missing a selected service”: `p_services: ["towarzystwo", "demencja"]` → wiersz Anny ma `matched_services === 1` i `missing_services` ze slugiem `demencja`.
  - `:446` „search matches any selected slot” → „search ranks profiles by covered slots”: `p_availability: ["sr-noc", "czw-noc"]` → Bartek ma `matched_slots === 1`, `missing_slots` = `["czw-noc"]` i dotychczasową `availability`; Anna jest na liście (`listsCaregiver`) z `matched_slots === 0`; `rankedInOrder`.
  - `:455` „search hides profile without matching slot” → „search keeps profile without matching slot”: `["czw-noc"]` → Bartek jest, `matched_slots === 0`, `missing_slots` = `["czw-noc"]`.
  - `:500` „search without availability filter keeps profile without availability”: część `filtered` oczekuje Bartka z `matched_slots === 0` i `missing_slots` = `["sr-noc"]` zamiast jego braku.
- Kroki nowe (po zapisie profilu Bartka, przed wyczyszczeniem jego terminów):
  - „search hides profile without any selected service”: `p_services: ["demencja"]` → `hidesCaregiver`.
  - „search ranks services above availability”: `p_teryt: "1465011"`, `p_services: ["towarzystwo", "zakupy-i-sprawy"]`, `p_availability: ["pon-rano"]` → Bartek ma `matched_services === 2, matched_slots === 0`; Anna, jeśli jest na stronie, ma `1, 1`; `rankedInOrder`; Bartek przed Anną, jeśli oboje są w wyniku.
  - „relaxed counts come in one row”: `countRelaxed({ p_teryt: "1465011", p_services: ["demencja"] })` → jeden wiersz, `Number(without_services) >= 2`, `without_gmina` jest liczbą; oraz `countRelaxed({ p_services: ["demencja"] })` → `without_services` liczbą, `without_gmina === null`.
- Kroki stron odwrócone przez nową semantykę (strona jeszcze bez zmian, asercje prawdziwe w fazie 1 i 2):
  - `:590` „caregiver list filters by availability” i `:607` „caregiver list shows availability relax hint” → jeden krok „caregiver list keeps profiles without matching slot”: `/opiekunowie?gmina=1465011&termin=czw-noc` zawiera „Anna Smoke” i „Bartek Smoke”, nie zawiera „Usuń filtr dostępności” i spełnia `hidesListContact`.
  - `:617` „caregiver list shows relax hints when nothing matches”: `/opiekunowie?gmina=2001052&usluga=towarzystwo` (Nowinka, gmina bez profili smoke) zawiera „Usuń filtr gminy (wyniki:” i „Spróbuj sąsiedniej gminy”.
- Komentarz nagłówka (`:1-13`): wyszukiwanie filtruje twardo tylko gminę, usługi wymagają co najmniej jednej pasującej, terminy i usługi ustalają kolejność, wiersze niosą braki, podpowiedzi liczy jedno RPC.

### Success Criteria:

#### Automated Verification:

- Wszystkie migracje stosują się od zera: `npx supabase db reset`
- Lint bazy bez błędów: `npx supabase db lint --level error`
- Kontrola grantów przechodzi: `npx supabase db query --local -f scripts/check-table-grants.sql`
- Lint i typy: `npm run lint` i `npx astro check`
- Smoke przechodzi z nowymi krokami bazy: `npm run smoke` (na świeżym `npm run build` + `npm run preview`)

#### Manual Verification:

- W psql lokalnie `select user_id, matched_services, matched_slots, missing_services, missing_slots from public.search_caregivers('1465011', '{towarzystwo,zakupy-i-sprawy}', '{pon-rano}', 50, 0)` pokazuje grupy w kolejności (2,·) → (1,·), a w grupie — więcej terminów wyżej
- `explain analyze` tego wywołania ze wszystkimi 13 usługami i 28 terminami trwa lokalnie poniżej 50 ms
- `select * from public.count_caregivers_relaxed('2001052', '{towarzystwo}')` zwraca jeden wiersz `0, N` z N > 0

**Implementation Note**: Po przejściu weryfikacji automatycznej zatrzymaj się na ręczne potwierdzenie, zanim przejdziesz do fazy 2.

---

## Phase 2: Lista pokazuje ranking i braki

### Overview

Serwis mapuje nowe kolumny, karta pokazuje braki, legendy i komunikaty opisują nową regułę, a podpowiedzi pustego wyniku idą przez jedno RPC.

### Changes Required:

#### 1. Typy

**File**: `src/types.ts`

**Intent**: Pola dopasowania dotyczą tylko listy, więc dostają osobny DTO zamiast poszerzać `PublicCaregiverDto` strony profilu.

**Contract**:

- `CaregiverMatchDto { missingServices: ServiceDto[]; missingAvailability: AvailabilitySlot[] }` (usługi w `sort_order`, terminy w kolejności kanonicznej).
- `RankedCaregiverDto extends PublicCaregiverDto { match: CaregiverMatchDto }`.
- `RelaxedCaregiverCounts { withoutServices: number | null; withoutGmina: number | null }` (`null` = ten wymiar nie był wybrany).
- Komentarz `CaregiverSearchFilter` (`:72-73`): gmina twardo, usługi — co najmniej jedna musi pasować, więcej pasujących = wyżej; terminy tylko ustalają kolejność.

#### 2. Serwis wyszukiwania

**File**: `src/lib/services/caregiver.service.ts`

**Intent**: Lista dostaje profile z brakami, a podpowiedzi — obie liczby jednym wywołaniem.

**Contract**:

- `SearchRow extends PublicRow` dostaje `matched_services: number`, `missing_services: ServiceDto[]`, `matched_slots: number`, `missing_slots: string[]` (obok `total_count`). `PublicRow` bez zmian.
- `toRankedCaregiver(row: SearchRow): RankedCaregiverDto` = `toPublicCaregiver(row)` + `match` (`missingAvailability` przez `sortAvailability`).
- `searchCaregivers()` zwraca `{ caregivers: RankedCaregiverDto[]; total }`, poza tym bez zmian. `countCaregivers()` zostaje (strona poza zakresem).
- Nowa `countRelaxedCaregivers(supabase, filter): Promise<RelaxedCaregiverCounts>`: jedno `rpc("count_caregivers_relaxed", { p_teryt, p_services })`. `bigint` przychodzi jako liczba albo tekst, więc `Number()`, a `null` zostaje `null`. Błąd → `Error("Failed to count relaxed caregivers: …")`, jak `runSearch()`.

#### 3. Strona listy

**File**: `src/pages/opiekunowie/index.astro`

**Intent**: Koordynator widzi, że lista jest ułożona według dopasowania i czego brakuje każdemu profilowi, a podpowiedzi nie kosztują już do trzech zapytań.

**Contract**:

- Typy i importy: `let caregivers: RankedCaregiverDto[]` (`:31`, zamiast `PublicCaregiverDto[]`), import `countRelaxedCaregivers` zamiast `countCaregivers` (`:8`, strona przestaje go używać), `RelaxHint`/`hints` zostają, a reguła „Spróbuj sąsiedniej gminy” poniżej zastępuje `gminaHint`/`noNeighbourHint` (`:86-89`).
- Podpowiedzi (`:55-74`): przy `total === 0` i (`filter.teryt` lub wybrane usługi) — jedno `countRelaxedCaregivers()`. „Usuń filtr usług” powstaje, gdy `withoutServices !== null`; „Usuń filtr gminy”, gdy `withoutGmina !== null`; linki jak dziś przez `buildCaregiverSearchHref`. Kandydat „Usuń filtr dostępności” znika. „Spróbuj sąsiedniej gminy”: `withoutGmina > 0` i (`withoutServices === null` lub `0`).
- Komunikat pustego wyniku (`:218`): „Żaden opiekun nie spełnia wybranych warunków.” (bez „wszystkich”).
- Legendy: usługi (`:136`) „Rodzaj usług (wyżej opiekunowie oferujący więcej wybranych; musi pasować co najmniej jedna)”, dostępność (`:156`) „Dostępność (wyżej opiekunowie z większą liczbą zaznaczonych terminów)”.
- Pod „Wyniki: N”, gdy wybrano usługi lub terminy: „Najpierw opiekunowie pokrywający najwięcej wybranych usług, potem terminów.”
- Karta, gdy wybrano usługi lub terminy, ma wiersz dopasowania pod linią dostępności:
  - `match.missingServices` niepuste → „Brakuje usług: ” + etykiety połączone „, ”;
  - `match.missingAvailability` niepuste → „Brakuje terminów: ” + `summarizeAvailability(match.missingAvailability)`;
  - oba puste → „Pełne dopasowanie”.
  Styl: braki w odcieniu amber, pełne dopasowanie w odcieniu zielonym; tekst niesie znaczenie bez koloru. Warunkowe klasy przez `class:list`/`cn()`, bez sklejania stringów. Bez danych kontaktowych (braki to dane publiczne).

#### 4. Smoke: strony

**File**: `scripts/smoke.mjs`

**Intent**: Smoke dowodzi znaczników braków i ich kolejności w HTML.

**Contract**:

- „caregiver list keeps profiles without matching slot” (z fazy 1) dodatkowo zawiera „Brakuje terminów: Cz: noc”.
- Nowy „caregiver list marks full matches first”: `/opiekunowie?gmina=1465011&termin=pon-rano` zawiera „Anna Smoke” i „Pełne dopasowanie”; jeśli zawiera „Brakuje terminów”, to pierwsze „Pełne dopasowanie” stoi przed pierwszym „Brakuje terminów”; `hidesListContact`.
- Nowy „caregiver list names missing services”: `/opiekunowie?gmina=1465011&usluga=towarzystwo&usluga=demencja` zawiera „Brakuje usług: Opieka nad osobą z demencją”.
- „caregiver list shows relax hints when nothing matches” (z fazy 1) dodatkowo zawiera „Usuń filtr usług (wyniki: 0)”.

#### 5. README

**File**: `README.md`

**Intent**: Opis smoke odpowiada nowej regule.

**Contract**: W akapicie „Smoke sprawdza też…” (`## Smoke test`) fragmenty o „wymogu wszystkich wybranych usług” i filtrze „co najmniej jeden termin” zastępuje opis rankingu: gmina twardo, co najmniej jedna wybrana usługa, kolejność po pokryciu usług, potem terminów, braki w wierszach RPC i na kartach („Brakuje usług”, „Brakuje terminów”, „Pełne dopasowanie”), podpowiedzi z `count_caregivers_relaxed`.

### Success Criteria:

#### Automated Verification:

- Lint i typy: `npm run lint` i `npx astro check`
- Build: `npm run build`
- Smoke przechodzi z krokami stron: `npm run smoke`

#### Manual Verification:

- Anonim na `/opiekunowie` wybiera gminę, dwie usługi i dwa terminy: karty są ułożone od pełnego dopasowania, każda pokazuje „Brakuje usług: …” / „Brakuje terminów: …” albo „Pełne dopasowanie”, a profil bez dostępności jest na liście niżej
- Bez wybranych usług i terminów lista ma tę samą kolejność co przed zmianą i karty nie mają wiersza dopasowania
- Gmina bez opiekunów z wybraną usługą: komunikat i podpowiedzi z prawdziwymi liczbami; w logach Supabase jedno wywołanie `count_caregivers_relaxed` zamiast kilku `search_caregivers`
- Na 375 px karty z wierszem braków są czytelne bez przewijania w poziomie

**Implementation Note**: Po przejściu weryfikacji automatycznej zatrzymaj się na ręczne potwierdzenie, zanim przejdziesz do fazy 3.

---

## Phase 3: Wdrożenie produkcyjne i pomiar CPU

### Overview

Migracja i kod z faz 1–2 trafiają na produkcję w kolejności baza → Worker. Potem mierzymy czas CPU żądań listy i zapisujemy decyzję Workers Free/Paid (`roadmap.md:156`).

### Changes Required:

#### 1. Migracja na produkcji

**File**: brak zmian w repo (operacja)

**Intent**: Produkcyjna baza ma ranking, zanim pojawi się nowy Worker.

**Contract**: Najpierw zanotować „Wyniki: N” z produkcyjnego `/opiekunowie` bez filtrów (punkt odniesienia). Potem, z commita scalonego do `master`: `npx supabase db push`. Przed wykonaniem pytam użytkownika o zgodę.

#### 2. Wdrożenie Workera

**File**: brak zmian w repo (operacja)

**Intent**: Karta z brakami i nowe podpowiedzi działają na wdrożonym Workerze.

**Contract**: `npm run build` i `npx wrangler deploy` (procedura z `README.md` §Deployment). Przed wykonaniem pytam użytkownika o zgodę. Potwierdzenie przez `npx wrangler deployments list`.

#### 3. Pomiar CPU i decyzja

**File**: `context/changes/ranked-match-results/change.md` (sekcja Notes)

**Intent**: Zamknąć niewiadomą roadmapy „Workers Free czy Paid” na prawdziwym ruchu.

**Contract**: Po kilku żądaniach do `/opiekunowie` bez filtrów, z gminą + 3 usługami + 5 terminami i z pustym wynikiem (podpowiedzi) odczytać czas CPU wywołań w Workers Logs (panel Cloudflare → Workers → `opieka-dla-bliskich` → Observability, pole czasu CPU). Zapisać w Notes: maksymalny i typowy czas CPU każdego wariantu, liczbę kart wyrenderowanych w każdym mierzonym żądaniu, limit planu Free (10 ms) i decyzję (zostajemy na Free / przechodzimy na Paid) z datą. CPU Workera zależy głównie od SSR kart (najwyżej `CAREGIVER_PAGE_SIZE` = 20), nie od rankingu w bazie, więc gdy żaden mierzony wariant nie renderuje pełnej strony, decyzja jest oznaczona jako „wstępna” z warunkiem ponownego pomiaru (np. „gdy któraś gmina ma ≥ 20 kompletnych profili”). Decyzja należy do użytkownika; przejście na Paid nie jest częścią tego planu.

### Success Criteria:

#### Manual Verification:

- `npx supabase db push` zastosował `20261104140000_ranked_caregiver_search.sql` na produkcji
- `npx wrangler deploy` zakończony, nowe wdrożenie widoczne w `npx wrangler deployments list`
- Na produkcji `/opiekunowie` bez filtrów ma tę samą liczbę wyników co przed wdrożeniem, a z usługami lub terminami karty pokazują braki albo „Pełne dopasowanie”
- Czas CPU trzech wariantów żądań i decyzja Free/Paid zapisane w `change.md`

**Implementation Note**: Faza wyłącznie ręczna, z akceptacją użytkownika przed każdym `db push` i `deploy`.

---

## Testing Strategy

### Unit Tests:

- Brak (repo nie ma zestawu testów jednostkowych). Mapowanie braków sprawdza pośrednio smoke: znaczniki w HTML i tekst „Brakuje terminów: Cz: noc” z `summarizeAvailability`.

### Integration Tests:

- `npm run smoke`, faza 1: RPC jako anon — próg usług (ukrycie przy 0 z 1, obecność przy 1 z 2), terminy nikogo nie ukrywają, kolejność monotoniczna, usługi wyżej niż terminy, `missing_services`/`missing_slots`, jeden wiersz `count_caregivers_relaxed` z `null` dla niewybranego wymiaru.
- `npm run smoke`, faza 2: HTML jako anon — znaczniki braków i pełnego dopasowania, kolejność znaczników, podpowiedzi bez „Usuń filtr dostępności”, brak kontaktu w HTML.
- `scripts/check-table-grants.sql`: macierz uprawnień tabel bez zmian.

### Manual Testing Steps:

1. Gmina + 2 usługi + 2 terminy: kolejność od pełnego dopasowania, wiersz braków na każdej karcie
2. Ta sama gmina z samym terminem, którego nikt nie ma: wszyscy na liście, każdy z „Brakuje terminów”
3. Gmina, w której nikt nie oferuje wybranej usługi: komunikat, dwie podpowiedzi z liczbami, „Spróbuj sąsiedniej gminy”, gdy pomaga tylko inna gmina
4. Lista bez filtrów usług i terminów: kolejność jak przed zmianą, bez wiersza dopasowania
5. Wszystko na 375 px

## Performance Considerations

Pokrycie to dwa `count` po kluczach głównych `(caregiver_id, service_slug)` i `(caregiver_id, slot)` na kandydata, liczone przed `limit`, bo ranking obejmuje cały wynik. Braki i kolumny `jsonb` są liczone tylko dla zwracanej strony (≤ 50 wierszy). Przy skali `small` mieści się to w NFR < 1 s (`prd.md:131`), a ręczny `explain analyze` w fazie 1 to potwierdza. `count_caregivers_relaxed()` to dwa wywołania tej samej funkcji w jednym żądaniu HTTP. Praca Workera to mapowanie ≤ 20 wierszy; faza 3 mierzy jego CPU na produkcji.

## Migration Notes

Migracja nie zmienia danych ani tabel; zmienia tylko kształt wyniku `search_caregivers()` i dodaje funkcję. Wdrożenie: `db push`, potem `wrangler deploy` (Critical Implementation Details). Wycofanie w odwrotnej kolejności niż wdrożenie: najpierw poprzednia wersja Workera (`npx wrangler rollback` albo `wrangler deploy` z poprzedniego commita; stary Worker działa na nowej bazie, bo czyta tylko dawne kolumny), potem nowa migracja odtwarzająca `search_caregivers()` z `20261104120000_caregiver_availability.sql:237-345` i usuwająca `count_caregivers_relaxed()`. Odwrotnie nie wolno: kod fazy 2 wymaga nowych kolumn i funkcji.

## References

- Research: `context/changes/ranked-match-results/research.md`
- PRD: `context/foundation/prd.md:117-118`, `:131`, `:138-144` (FR-016, NFR, Business Logic)
- Roadmap: `context/foundation/roadmap.md:144-157` (S-05)
- F6: `context/archive/2026-11-04-caregiver-availability-filter/follow-ups/review-fixes.md:6`, `reviews/impl-review.md:103-105`
- Poprzedni wycinek (wzorzec planu, migracji i wdrożenia): `context/archive/2026-11-04-caregiver-availability-filter/plan.md`
- Funkcja do zmiany: `supabase/migrations/20261104120000_caregiver_availability.sql:220-348`, uprawnienia `:419-420`
- Serwis: `src/lib/services/caregiver.service.ts:152-225`; typy: `src/types.ts:63-78`; terminy: `src/lib/availability.ts:47-101`
- Strona: `src/pages/opiekunowie/index.astro:53-89`, `:136`, `:156`, `:241-282`
- Smoke: `scripts/smoke.mjs:107`, `:144-151`, `:362`, `:446`, `:455`, `:500`, `:590`, `:607`, `:617`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Ranking w bazie

#### Automated

- [x] 1.1 Wszystkie migracje stosują się od zera: `npx supabase db reset` — 470479a
- [x] 1.2 Lint bazy bez błędów: `npx supabase db lint --level error` — 470479a
- [x] 1.3 Kontrola grantów przechodzi: `npx supabase db query --local -f scripts/check-table-grants.sql` — 470479a
- [x] 1.4 Lint i typy: `npm run lint` i `npx astro check` — 470479a
- [x] 1.5 Smoke przechodzi z nowymi krokami bazy: `npm run smoke` — 470479a

#### Manual

- [x] 1.6 psql: grupy pokrycia w kolejności (2,·) → (1,·), w grupie więcej terminów wyżej — 470479a
- [x] 1.7 `explain analyze` z 13 usługami i 28 terminami poniżej 50 ms lokalnie — 470479a
- [x] 1.8 `count_caregivers_relaxed('2001052', '{towarzystwo}')` zwraca jeden wiersz `0, N` z N > 0 — 470479a

### Phase 2: Lista pokazuje ranking i braki

#### Automated

- [x] 2.1 Lint i typy: `npm run lint` i `npx astro check`
- [x] 2.2 Build: `npm run build`
- [x] 2.3 Smoke przechodzi z krokami stron: `npm run smoke`

#### Manual

- [x] 2.4 Gmina + 2 usługi + 2 terminy: kolejność od pełnego dopasowania, braki na każdej karcie, profil bez dostępności niżej
- [x] 2.5 Bez usług i terminów: kolejność jak przed zmianą, bez wiersza dopasowania
- [x] 2.6 Pusty wynik: podpowiedzi z prawdziwymi liczbami, jedno wywołanie `count_caregivers_relaxed`
- [x] 2.7 375 px: karty z wierszem braków bez przewijania w poziomie

### Phase 3: Wdrożenie produkcyjne i pomiar CPU

#### Manual

- [ ] 3.1 `npx supabase db push` zastosował migrację na produkcji
- [ ] 3.2 `npx wrangler deploy` zakończony i widoczny w `wrangler deployments list`
- [ ] 3.3 Produkcja: liczba wyników bez filtrów bez zmian, karty z filtrami pokazują braki
- [ ] 3.4 Czas CPU trzech wariantów i decyzja Free/Paid zapisane w `change.md`
