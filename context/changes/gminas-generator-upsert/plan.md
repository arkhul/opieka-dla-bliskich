# Tryb aktualizacji w generatorze migracji gmin — Implementation Plan

## Overview

Generator `scripts/generate-gminas-migration.mjs` emituje dziś wyłącznie zwykłe `insert`y, więc migracja aktualizująca gminy pada na kluczu głównym zapełnionej tabeli. Wprowadzamy wycofywanie gmin w schemacie (`active`, `replaced_by`), wyszukiwarkę zwracającą tylko gminy aktywne oraz jeden tryb generatora („sync”): upsert gmin z pliku TERC, wycofanie gmin, których w pliku nie ma, automatyczne wskazanie następcy przy zmianie RODZ i próg bezpieczeństwa. Zamyka to ustalenia F1 i F2 z przeglądu F-01 i ustala reguły, które S-01 (`caregiver-profile-setup`) przyjmie przy kluczach obcych do `gminas(teryt)`.

## Current State Analysis

- Generator buduje paczki po 500 wierszy `insert into public.gminas (teryt, name, kind, powiat, wojewodztwo) values …` (`scripts/generate-gminas-migration.mjs:144-150`), bez `on conflict` i bez usuwania. Na zapełnionej tabeli pierwsza paczka kończy się `23505` i migracja się wycofuje.
- Nagłówek ma na sztywno `-- Migration: seed_gminas` (`:153`), a komentarz użycia sugeruje `_seed_gminas.sql` (`:3`). Argumenty są wyłącznie pozycyjne, a nadmiarowy argument kończy się błędem (`:61-63`).
- Generator nie łączy się z bazą — nie wie, co jest w tabeli. Różnica „w bazie, a nie w pliku” musi więc być liczona w wygenerowanym SQL, nie w skrypcie.
- `public.gminas` (`supabase/migrations/20260924120000_create_dictionaries.sql:58-65`): PK `teryt` = WOJ+POW+GMI+RODZ, brak kolumny statusu. RLS: tylko `select` dla `anon`/`authenticated`; migracje działają jako właściciel i omijają RLS.
- `search_gminas` (`:92-111`) zwraca `setof public.gminas` przez `g.*` — nowe kolumny trafią do wyniku RPC, ale serwis wybiera pola jawnie (`src/lib/services/dictionary.service.ts:45-52`), więc DTO i API się nie zmieniają.
- Nic jeszcze nie wskazuje na `gminas(teryt)` (brak tabel profili) — to najtańszy moment na zmianę schematu.
- W obecnym seedzie (`supabase/migrations/20260924130000_seed_gminas.sql`, 2479 wierszy) 6-znakowy prefiks WOJ+POW+GMI jest unikalny — sprawdzone na danych.
- README (`README.md:131-138`) opisuje odświeżanie, które nie działa, i każe ręcznie poprawiać plik oznaczony „GENERATED FILE - do not edit by hand”.
- Smoke (`scripts/smoke.mjs:51-60`) sprawdza wyszukiwarkę po kodach `1061011` (Łódź) i `1465011` (Warszawa); CI job `smoke` wykonuje wszystkie migracje od zera.
- Surowy plik TERC nie jest w repo (README: „do not commit the raw CSV”) — weryfikacja generatora wymaga lokalnego pliku.

## Desired End State

- Nowa migracja schematu dodaje `gminas.active` i `gminas.replaced_by`; `search_gminas` zwraca tylko gminy aktywne; komentarz na `normalize_pl` ostrzega o przeliczeniu `search_name` (F7).
- `node scripts/generate-gminas-migration.mjs <TERC.csv> supabase/migrations/<ts>_update_gminas.sql` tworzy migrację, która przechodzi na zapełnionej tabeli: aktualizuje istniejące gminy, dodaje nowe, wycofuje brakujące (z następcą przy zmianie RODZ), a przy zbyt wielu wycofaniach bez następcy przerywa się bez zmian w tabeli.
- README opisuje działającą procedurę odświeżania; wpis S-01 w roadmapie zawiera ograniczenia wynikające z tej zmiany.

### Key Discoveries:

- `scripts/generate-gminas-migration.mjs:144-160` — jedyne miejsce emitujące SQL; tu zmienia się kształt wyjścia.
- `scripts/generate-gminas-migration.mjs:118-132` — istniejące kontrole przed zapisem (16 województw, duplikaty teryt, 2470–2490 gmin); kontrolę unikalności prefiksu dokładamy w tym samym miejscu.
- `supabase/migrations/20260924120000_create_dictionaries.sql:92-111` — `search_gminas` do zastąpienia przez `create or replace` z filtrem `g.active`.
- `supabase/migrations/20260924120000_create_dictionaries.sql:63` — `search_name` to kolumna generowana z `normalize_pl`; zmiana `name` w upsercie przelicza ją automatycznie.

## What We're NOT Doing

- Nie zmieniamy klucza na 6-znakowy WOJ+POW+GMI (wariant B z przeglądu F2) — zostaje 7-znakowy `teryt`.
- Nie dodajemy flagi `--update` ani osobnego trybu seed — jest jeden tryb sync.
- Nie dodajemy pliku mapowania następców (`--successors`); połączenia i zniesienia gmin dostają następcę ręcznie napisaną migracją.
- Nie przepinamy profili ze starego kodu na nowy — tabel profili jeszcze nie ma; to obowiązek S-01 (zapisany w roadmapie w fazie 3).
- Nie regenerujemy ani nie edytujemy zastosowanej migracji `20260924130000_seed_gminas.sql`.
- Nie commitujemy żadnej wygenerowanej migracji aktualizującej — nowa wersja TERC pojawi się dopiero od 1 stycznia; migracje testowe z weryfikacji są usuwane.
- Nie zmieniamy API, DTO, serwisu ani UI.
- Nie zajmujemy się pozostałymi ustaleniami przeglądu F-01 (F3, F4, F5, F6, F8).

## Implementation Approach

Najpierw schemat (faza 1), bo SQL z generatora odwołuje się do nowych kolumn. Wygenerowana migracja ładuje wiersze TERC do tabeli tymczasowej, a cała logika (upsert, wycofanie, następcy, próg) działa w SQL względem tej tabeli — generator pozostaje bez dostępu do bazy i bez zależności. Jeden tryb działa i na pustej, i na zapełnionej tabeli, więc nie da się wybrać złego trybu.

## Critical Implementation Details

- **Kolejność w wygenerowanym SQL**: najpierw upsert (żeby następca istniał, zanim `replaced_by` go wskaże przez FK), potem kontrola progu i wycofanie, na końcu skracanie łańcuchów następców. Reaktywacja gminy (wraca do pliku) w upsercie ustawia `active = true, replaced_by = null` w tym samym poleceniu, więc ograniczenie „aktywna gmina nie ma następcy” nie jest naruszane w żadnym kroku.
- **Transakcyjność**: przerwanie przy progu (`raise exception`) ma zostawić tabelę bez zmian — zakładamy, że Supabase CLI wykonuje plik migracji w jednej transakcji. Tabelę tymczasową usuwamy jawnym `drop table` na końcu (nie polegamy na `on commit drop`). Scenariusz 3 w ręcznej weryfikacji fazy 2 potwierdza to założenie.
- **Widoczność wycofań**: `raise notice` może nie być wyświetlany przez `supabase db push`, dlatego README każe po migracji sprawdzić wycofane gminy zapytaniem (faza 3), a notice jest tylko dodatkiem.

## Phase 1: Schemat — gminy z wycofywaniem

### Overview

Nowa migracja pozwala oznaczyć gminę jako wycofaną i wskazać jej następcę, a wyszukiwarka przestaje pokazywać gminy wycofane.

### Changes Required:

#### 1. Migracja wycofywania gmin

**File**: `supabase/migrations/<YYYYMMDDHHmmss>_retirable_gminas.sql` (znacznik czasu późniejszy niż `20260924130000`, np. `20261103120000`)

**Intent**: Dodać do `public.gminas` stan aktywności i następcę, przefiltrować wyszukiwarkę po aktywnych gminach i zostawić ostrzeżenie F7 na `normalize_pl`. Nagłówek migracji w stylu `create_dictionaries` (`-- Migration:`, `-- Purpose:`).

**Contract**:
- `gminas.active boolean not null default true` — istniejące 2479 wierszy stają się aktywne.
- `gminas.replaced_by text null references public.gminas(teryt)` (domyślne `no action`/restrict) — kod TERC następcy wycofanej gminy.
- Ograniczenia: `check (not active or replaced_by is null)` (aktywna gmina nie ma następcy) i `check (replaced_by <> teryt)`.
- `comment on column` dla obu kolumn; aktualizacja `comment on table public.gminas` (gminy nie są usuwane, tylko wycofywane).
- `create or replace function public.search_gminas(q text, max_results int default 20)` — ta sama sygnatura, kolejność i limit; dodatkowy warunek `g.active`. Zachować `security invoker`, `set search_path = ''`; uprawnienie `execute` pozostaje (replace go nie odbiera). Zaktualizować `comment on function`.
- `comment on function public.normalize_pl(text)` uzupełniony o ostrzeżenie: zmiana funkcji wymaga `update public.gminas set name = name`, bo `search_name` jest kolumną `stored` i nie przeliczy się sama.
- Bez nowych polityk RLS i bez nowych grantów — kolumny dziedziczą istniejący `select` dla `anon`/`authenticated`.

### Success Criteria:

#### Automated Verification:

- `npm run lint` przechodzi
- `npx astro check` przechodzi bez błędów
- `npm run build` przechodzi
- CI job `smoke` przechodzi (migracje od zera, w tym nowa, i kroki wyszukiwarki gmin)

#### Manual Verification:

- `npx supabase db reset` lokalnie przechodzi, a `select count(*) from public.gminas where active` zwraca 2479
- Lokalny `npm run smoke` przechodzi (wyszukiwarka zwraca Łódź i Warszawę jak dotąd)
- Ręczne `update public.gminas set replaced_by = '0201022' where teryt = '0201011'` przy `active = true` jest odrzucane przez check, a po ustawieniu `active = false` dla `0201022` wyszukiwanie `?q=boleslawiec` nie zwraca `0201022` (po teście `db reset`)

**Implementation Note**: Po fazie i zielonej weryfikacji automatycznej zatrzymaj się na ręczne potwierdzenie od człowieka przed fazą 2.

---

## Phase 2: Generator — tryb sync

### Overview

Generator emituje migrację, która synchronizuje `public.gminas` z plikiem TERC: upsert, wycofanie brakujących gmin z automatycznym następcą przy zmianie RODZ, skrócenie łańcuchów następców i próg wycofań.

### Changes Required:

#### 1. Argumenty i nazwa migracji

**File**: `scripts/generate-gminas-migration.mjs`

**Intent**: Przyjąć opcjonalny próg wycofań i wyprowadzać nazwę migracji z nazwy pliku wyjściowego zamiast wpisywać `seed_gminas` na sztywno. Błędne argumenty kończą się czytelnym błędem przed czytaniem pliku TERC.

**Contract**:
- Użycie: `node scripts/generate-gminas-migration.mjs <TERC.csv> <output.sql> [--max-retired N]`; `N` — maksymalna liczba gmin wycofanych bez następcy, liczba całkowita ≥ 0, domyślnie `30`. Nieznana flaga, brak wartości lub wartość niebędąca liczbą całkowitą ≥ 0 → `fail` z komunikatem użycia.
- Nazwa pliku wyjściowego (basename) musi pasować do `^\d{14}_[a-z0-9_]+\.sql$` (konwencja AGENTS.md); w przeciwnym razie `fail`. Nazwa migracji = część po znaczniku czasu, bez `.sql` (np. `update_gminas`).
- Komentarz użycia na początku pliku (`:1-4`) opisuje jeden tryb sync, przykład z `_update_gminas.sql`, flagę `--max-retired` i to, że wynik działa na pustej i na zapełnionej tabeli.

#### 2. Kontrola unikalności prefiksu

**File**: `scripts/generate-gminas-migration.mjs`

**Intent**: Automatyczny następca opiera się na unikalnym 6-znakowym prefiksie WOJ+POW+GMI w pliku — generator ma odmówić, gdy to założenie nie zachodzi, zamiast wygenerować niejednoznaczne mapowanie.

**Contract**: Obok istniejącej kontroli duplikatów `teryt` (`:128`): dwie gminy z tym samym `teryt.slice(0, 6)` → `fail` z numerem linii i oboma kodami.

#### 2a. Kontrola STAN_NA względem istniejących migracji

**File**: `scripts/generate-gminas-migration.mjs`

**Intent**: Starszy plik TERC przeszedłby wszystkie kontrole i po cichu cofnął zmiany (reaktywacja starych kodów, wycofanie nowych z następcą, które nie liczą się do progu). Generator ma odmówić, zanim cokolwiek zapisze.

**Contract**: Generator czyta pliki `*.sql` w katalogu pliku wyjściowego (bez samego pliku wyjściowego, gdy jest nadpisywany) i zbiera wartości z linii `^-- STAN_NA: (\d{4}-\d{2}-\d{2})$`. Gdy STAN_NA nowego pliku jest wcześniejszy niż najnowsza znaleziona wartość → `fail` z obiema datami i nazwą migracji, z której pochodzi nowsza. Równy STAN_NA jest dozwolony. Brak takich linii → kontrola pomijana. Bez dostępu do bazy; zakłada, że migracje w repo odpowiadają bazie produkcyjnej.

#### 3. Kształt wygenerowanego SQL

**File**: `scripts/generate-gminas-migration.mjs`

**Intent**: Zastąpić zwykłe inserty migracją synchronizującą, która przechodzi na zapełnionej tabeli, nie usuwa żadnego wiersza i przerywa się bez zmian, gdy wycofań jest więcej niż próg.

**Contract** (kolejność sekcji w pliku wyjściowym):
1. Nagłówek: `-- Migration: <nazwa z pliku>`, linia „GENERATED FILE - do not edit by hand…”, źródło, `STAN_NA`, `Generated with:` (z `--max-retired N`, gdy różne od domyślnego), `Rows:`, oraz linia trybu, np. `-- Mode: sync (upsert from TERC, retire gminas missing from TERC; max retired without successor: 30)`.
2. `create temporary table gminas_terc (teryt text primary key, name text not null, kind text not null, powiat text not null, wojewodztwo text not null);` i paczki po `BATCH_SIZE` wierszy `insert into gminas_terc … values …`.
3. Upsert: `insert into public.gminas (teryt, name, kind, powiat, wojewodztwo) select … from gminas_terc on conflict (teryt) do update set name = excluded.name, kind = excluded.kind, powiat = excluded.powiat, wojewodztwo = excluded.wojewodztwo, active = true, replaced_by = null;`
4. Blok `do $$ … $$` (plpgsql):
   - zbiór do wycofania = aktywne gminy, których `teryt` nie ma w `gminas_terc`; dla każdej wyliczany jest następca = kod z `gminas_terc` o tym samym 6-znakowym prefiksie i innym `teryt` (lub `null`, gdy brak);
   - jeśli liczba wycofań **bez następcy** > próg → `raise exception` z liczbą, progiem i listą tych kodów (`string_agg`) oraz wskazówką o `--max-retired`; wycofania z następcą (zmiana RODZ, np. nadanie praw miejskich) nie liczą się do progu;
   - `update public.gminas` dla tego zbioru: `active = false`, `replaced_by` = wyliczony następca;
   - skrócenie łańcuchów: wycofane wcześniej gminy, których `replaced_by` wskazuje na gminę właśnie wycofaną z następcą, dostają tego następcę;
   - `raise notice` z liczbą wycofanych oraz listą „stary → nowy” i osobno listą wycofanych bez następcy (lub informacją, że nic nie wycofano).
5. `drop table gminas_terc;`

Wynik na pustej tabeli: wszystkie wiersze dodane, nic nie wycofane. Wynik na tabeli zgodnej z plikiem: same `update` bez zmian treści, nic nie wycofane.

#### 4. Raport w konsoli

**File**: `scripts/generate-gminas-migration.mjs`

**Intent**: Wyjście generatora mówi, jaką migrację utworzył.

**Contract**: Do istniejących linii (`STAN_NA`, liczby gmin, `written:`) dochodzi `migration: <nazwa>` i `max retired: <N>`.

### Success Criteria:

#### Automated Verification:

- `npm run lint` przechodzi
- `node scripts/generate-gminas-migration.mjs` bez argumentów kończy się kodem 1 i komunikatem użycia
- `node scripts/generate-gminas-migration.mjs x.csv supabase/migrations/update_gminas.sql` (nazwa bez znacznika czasu) kończy się kodem 1 i komunikatem o nazwie pliku
- `node scripts/generate-gminas-migration.mjs x.csv supabase/migrations/20270101000000_update_gminas.sql --max-retired abc` kończy się kodem 1 i komunikatem o `--max-retired`
- CI job `smoke` przechodzi (brak zmian w migracjach względem fazy 1)

#### Manual Verification:

- Scenariusz 1 (no-op): z aktualnego pliku TERC wygenerowana `supabase/migrations/<ts>_update_gminas.sql` stosuje się na zapełnionej bazie (`npx supabase migration up`), liczba gmin i aktywnych gmin bez zmian (2479), nic nie wycofane
- Scenariusz 2 (zmiana RODZ): w kopii CSV gmina `0201022` (Bolesławiec, wiejska) dostaje RODZ 3; po migracji `0201022` ma `active = false, replaced_by = '0201023'`, `0201023` jest aktywna jako miejsko-wiejska, a wyszukiwanie `?q=boleslawiec` zwraca `0201023`, nie `0201022`
- Scenariusz 3 (próg): kopia **oryginalnego** CSV bez 6 gmin i `--max-retired 5` — migracja kończy się błędem z listą 6 kodów bez następcy (`0201023` też byłaby wycofana, ale ma następcę `0201022`, więc nie liczy się do progu), a tabela pozostaje bez zmian (te 6 gmin nadal aktywnych); po potwierdzeniu błędu usunąć tę migrację, zanim zacznie się scenariusz 4
- Scenariusz 4 (reaktywacja): po scenariuszu 2 migracja z oryginalnego pliku przywraca `0201022` jako aktywną z `replaced_by = null`, a `0201023` staje się wycofana z `replaced_by = '0201022'`
- Scenariusz 5 (starszy plik): kopia CSV ze `STAN_NA` zmienionym na `2025-01-01` → generator kończy się kodem 1 z komunikatem o `STAN_NA` (wskazuje `20260924130000_seed_gminas.sql`) i nie tworzy pliku wyjściowego
- Nagłówek wygenerowanego pliku pokazuje `-- Migration: update_gminas` i linię trybu; po weryfikacji testowe migracje i kopie CSV są usunięte, a `npx supabase db reset` przechodzi

**Implementation Note**: Po fazie i zielonej weryfikacji automatycznej zatrzymaj się na ręczne potwierdzenie od człowieka przed fazą 3.

---

## Phase 3: Dokumentacja i przekazanie do S-01

### Overview

README opisuje działającą procedurę odświeżania gmin, a roadmapa zapisuje ograniczenia, które S-01 musi przyjąć.

### Changes Required:

#### 1. README — odświeżanie gmin

**File**: `README.md` (sekcja „Database migrations”, `:131-138`)

**Intent**: Zastąpić opis, który każe ręcznie edytować plik generowany, opisem działającej procedury.

**Contract**: Akapit + polecenie generatora z `_update_gminas.sql` oraz krótko:
- migracja aktualizuje istniejące gminy, dodaje nowe, a gminy nieobecne w TERC oznacza jako wycofane (`active = false`) — nigdy ich nie usuwa; wycofane znikają z wyszukiwarki;
- przy zmianie rodzaju gminy (ten sam WOJ+POW+GMI, inny RODZ) następca jest ustawiany automatycznie w `replaced_by`;
- generator odmawia, gdy `STAN_NA` pliku jest wcześniejszy niż w istniejących migracjach gmin (ochrona przed starszym plikiem TERC);
- migracja przerywa się, gdy wycofałaby więcej niż 30 gmin bez następcy (zmiany RODZ się nie liczą); przy prawdziwej dużej reformie wygenerować ponownie z `--max-retired N`;
- po zastosowaniu sprawdzić wycofane gminy zapytaniem `select teryt, name, replaced_by from public.gminas where not active order by teryt;`; dla połączeń/zniesień bez następcy napisać ręcznie osobną migrację ustawiającą `replaced_by` (nie edytować wygenerowanego pliku).
- Usunąć zdanie o „plain `insert` statements” i ręcznym zastępowaniu wierszy.

#### 2. Roadmapa — ograniczenia dla S-01

**File**: `context/foundation/roadmap.md` (blok `### S-01`)

**Intent**: Plan S-01 musi przyjąć wariant A z przeglądu F2; zapisujemy to tam, gdzie planujący S-01 będzie szukał.

**Contract**: Nowa linia w bloku S-01 (bez zmiany `Status` ani tabeli „At a glance”): `- **Constraints:** (z gminas-generator-upsert)` — FK z profili do `public.gminas(teryt)` z `on delete restrict`; w formularzu i walidacji wybór tylko gmin `active`; generator gmin musi dostać krok przepinający profile z kodu wycofanego na `replaced_by` wyłącznie na **aktywnego** następcę (np. `update … set teryt = n.teryt from public.gminas g join public.gminas n on n.teryt = g.replaced_by and n.active where … and not g.active`), bo `replaced_by` może wskazywać gminę później wycofaną bez następcy; profile wskazujące wycofaną gminę bez aktywnego następcy pozostają do ręcznego rozstrzygnięcia.

### Success Criteria:

#### Automated Verification:

- `npx prettier --check README.md` przechodzi (`context/` jest w `.prettierignore`, więc roadmapy prettier nie sprawdza)
- `grep -n "on delete restrict" context/foundation/roadmap.md` znajduje linię w bloku S-01
- `README.md` nie zawiera już frazy `plain \`insert\` statements`

#### Manual Verification:

- Procedura z README, wykonana krok po kroku na lokalnej bazie z aktualnym plikiem TERC, daje migrację, która się stosuje (jak scenariusz 1 z fazy 2)
- Wpis S-01 w roadmapie zawiera FK `on delete restrict`, filtrowanie gmin aktywnych i przepinanie przez `replaced_by`

**Implementation Note**: Po fazie i zielonej weryfikacji automatycznej zatrzymaj się na ręczne potwierdzenie od człowieka.

---

## Testing Strategy

### Unit Tests:

- Brak zestawu testów jednostkowych w projekcie (AGENTS.md); kontrole argumentów generatora są sprawdzane poleceniami z kodem wyjścia 1 (faza 2, Automated).

### Integration Tests:

- CI job `smoke` wykonuje migracje od zera i kroki wyszukiwarki gmin — potwierdza, że migracja schematu nie psuje istniejącego zachowania.

### Manual Testing Steps:

1. `npx supabase db reset`, potem pięć scenariuszy z fazy 2 na lokalnym pliku TERC i jego kopiach (zmiana RODZ, usunięcie 6 gmin, starszy `STAN_NA`).
2. Po każdym scenariuszu: `select count(*) filter (where active), count(*) filter (where not active) from public.gminas;` oraz zapytanie o wycofane gminy z README.
3. Sprzątanie: usunąć testowe migracje i kopie CSV, `npx supabase db reset`, `git status` bez plików `*_update_gminas.sql`.

## Performance Considerations

~2,5 tys. wierszy: tabela tymczasowa, upsert i `not exists` po kluczu głównym działają w ułamku sekundy. `search_gminas` dostaje jeden dodatkowy warunek na małej tabeli — bez indeksu.

## Migration Notes

Migracja schematu jest addytywna (nowe kolumny z wartością domyślną, `create or replace` funkcji), więc stosuje się na produkcji przez `npx supabase db push` bez przestojów. Wycofanie: nowa migracja usuwająca kolumny i przywracająca poprzednią treść `search_gminas` — możliwe, dopóki S-01 nie oprze się na `active`/`replaced_by`.

## References

- Wymagania: `context/changes/gminas-generator-upsert/change.md`
- Przegląd F-01 (F1, F2, F7): `context/archive/2026-09-24-gmina-and-service-dictionaries/reviews/impl-review.md`
- Plan F-01: `context/archive/2026-09-24-gmina-and-service-dictionaries/plan.md`
- Generator: `scripts/generate-gminas-migration.mjs:1-4`, `:61-63`, `:118-132`, `:144-160`
- Schemat i wyszukiwarka: `supabase/migrations/20260924120000_create_dictionaries.sql:15-25`, `:58-65`, `:92-111`
- Serwis: `src/lib/services/dictionary.service.ts:33-53`
- README: `README.md:131-138`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Schemat — gminy z wycofywaniem

#### Automated

- [x] 1.1 `npm run lint` przechodzi — c94b429
- [x] 1.2 `npx astro check` przechodzi bez błędów — c94b429
- [x] 1.3 `npm run build` przechodzi — c94b429
- [x] 1.4 CI job `smoke` przechodzi (migracje od zera, w tym nowa, i kroki wyszukiwarki gmin) — c94b429

#### Manual

- [x] 1.5 `npx supabase db reset` lokalnie przechodzi, a liczba aktywnych gmin wynosi 2479 — c94b429
- [x] 1.6 Lokalny `npm run smoke` przechodzi — c94b429
- [x] 1.7 Check odrzuca aktywną gminę z następcą, a wycofana gmina znika z wyszukiwarki — c94b429

### Phase 2: Generator — tryb sync

#### Automated

- [x] 2.1 `npm run lint` przechodzi — 9d2bc3a
- [x] 2.2 Generator bez argumentów kończy się kodem 1 i komunikatem użycia — 9d2bc3a
- [x] 2.3 Generator z nazwą pliku bez znacznika czasu kończy się kodem 1 — 9d2bc3a
- [x] 2.4 Generator z `--max-retired abc` kończy się kodem 1 — 9d2bc3a
- [x] 2.5 CI job `smoke` przechodzi — 9d2bc3a

#### Manual

- [x] 2.6 Scenariusz 1 (no-op) — migracja stosuje się na zapełnionej bazie, nic nie wycofane — 9d2bc3a
- [x] 2.7 Scenariusz 2 (zmiana RODZ) — `0201022` wycofana z następcą `0201023`, wyszukiwarka pokazuje tylko nową — 9d2bc3a
- [x] 2.8 Scenariusz 3 (próg) — migracja przerwana, tabela bez zmian, nieudana migracja usunięta — 9d2bc3a
- [x] 2.9 Scenariusz 4 (reaktywacja) — `0201022` znów aktywna, `0201023` wycofana z następcą `0201022` — 9d2bc3a
- [x] 2.10 Scenariusz 5 (starszy plik) — generator odmawia przy wcześniejszym `STAN_NA` — 9d2bc3a
- [x] 2.11 Nagłówek pokazuje nazwę migracji i tryb; testowe pliki usunięte, `db reset` przechodzi — 9d2bc3a

### Phase 3: Dokumentacja i przekazanie do S-01

#### Automated

- [x] 3.1 `npx prettier --check README.md` przechodzi — ecaa41e
- [x] 3.2 `grep` znajduje `on delete restrict` w roadmapie — ecaa41e
- [x] 3.3 `README.md` nie zawiera już frazy o „plain insert statements” — ecaa41e

#### Manual

- [x] 3.4 Procedura z README daje migrację, która się stosuje — ecaa41e
- [x] 3.5 Wpis S-01 w roadmapie zawiera FK `on delete restrict`, filtrowanie aktywnych gmin i przepinanie przez `replaced_by` — ecaa41e
