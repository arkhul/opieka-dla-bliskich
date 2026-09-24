# Słowniki gmin i usług — Implementation Plan

## Overview

Wprowadzamy dwa słowniki referencyjne jako tabele Postgres: `gminas` (wszystkie gminy w Polsce z rejestru TERYT, klucz = 7-znakowy kod TERC) oraz `services` (zamknięty katalog 13 rodzajów usług). Oba są publicznie czytelne i niemodyfikowalne przez API, dostępne w aplikacji przez serwis `dictionary.service.ts` i dwa publiczne endpointy GET, a `npm run smoke` weryfikuje je end-to-end w CI. To fundament F-01, na którym S-01 (profil) i S-02 (filtry) oprą klucze obce i listy wyboru.

## Current State Analysis

- Brak jakichkolwiek tabel domenowych: nie istnieje `supabase/migrations/`, a README w sekcji „Supabase Configuration” twierdzi „No database tables or migrations are required”. To będzie pierwsza migracja projektu — ustala konwencję (RLS + jedna polityka na operację i rolę, AGENTS.md).
- `supabase/config.toml` ma `[db.seed] sql_paths = ["./seed.sql"]` — seed działa tylko przy lokalnym `db reset`, nigdy na produkcji.
- Klient Supabase: `createClient()` w `src/lib/supabase.ts:5-21` zwraca `null` bez env; wzorzec obsługi: `src/pages/api/auth/signin.ts:9-12`. Klient działa z kluczem anon + ciasteczkami, więc zapytania anonimowe przechodzą przez RLS jako rola `anon`.
- Brak `src/lib/services/`, `src/types.ts` i zależności `zod` — tworzymy przy pierwszym użyciu (AGENTS.md).
- `scripts/smoke.mjs:38-71` sprawdza tylko status i `location`; nie umie sprawdzić treści JSON.
- CI job `smoke` (`.github/workflows/ci.yml`) uruchamia `supabase start`, więc nowe migracje wykonują się w CI automatycznie przed smoke.
- `output: "server"` (`astro.config.mjs`) — trasy w `src/pages/api/` są dynamiczne; `@astrojs/sitemap` ich nie indeksuje.

## Desired End State

- `npx supabase db reset` tworzy `public.services` (13 wierszy) i `public.gminas` (~2477 wierszy, stan TERC z pliku źródłowego) z RLS: `select` dla `anon` i `authenticated`, brak polityk zapisu.
- `GET /api/dictionaries/services` → `200 { services: ServiceDto[] }` w ustalonej kolejności.
- `GET /api/dictionaries/gminas?q=lodz` → `200 { gminas: GminaDto[] }` z Łodzią (`1061011`) — dopasowanie bez polskich znaków, najpierw trafienia od początku nazwy; `q` krótsze niż 2 znaki → `400`.
- `npm run smoke` zawiera kroki słownikowe i przechodzi lokalnie oraz w CI.
- Na produkcji migracje wypchnięte (`supabase db push`) i endpointy odpowiadają na wdrożonym Workerze.

### Key Discoveries:

- `src/lib/supabase.ts:6-8` — `null` przy braku env; endpointy muszą zwrócić `503`.
- `src/pages/api/auth/signin.ts:4-20` — kształt `APIRoute` do skopiowania (tu jako `GET` zwracający JSON).
- `scripts/smoke.mjs:38-58` — lista `steps` jako `[name, run, expected]`; rozszerzamy `expected` o opcjonalny predykat na body.
- `supabase/config.toml:60-65` — seed nie trafia na produkcję → dane referencyjne muszą być w migracjach.
- TERYT ma pary gmin o tej samej nazwie w tym samym powiecie (np. „Łowicz” miejska i „Łowicz” wiejska) — rodzaj gminy musi być częścią etykiety.

## What We're NOT Doing

- Tabel profili opiekunów ani kluczy obcych z profili (S-01).
- Komponentu UI wyboru gminy/usług (combobox) ani żadnej strony — powstaną w S-01/S-02.
- Podziału dużych miast na dzielnice/delegatury (TERYT rodzaje 8/9) — Warszawa, Kraków, Łódź itd. to jedna gmina.
- Części gmin miejsko-wiejskich (TERYT rodzaje 4/5) jako osobnych pozycji.
- Weryfikacji uprawnień opiekunów deklarujących usługi pielęgniarskie (PRD Non-Goal).
- Endpointu „gminy po liście kodów” ani filtrowania po województwie — dopisze konsument, gdy będzie potrzebny.
- Cache'owania odpowiedzi (`Cache-Control: public`) — klient Supabase może ustawiać ciasteczka sesji w odpowiedzi.
- Automatycznej aktualizacji słownika gmin z TERYT (zmiany administracyjne = nowa migracja wygenerowana tym samym skryptem).
- Generowania typów bazy (`supabase gen types`).

## Implementation Approach

Schemat najpierw, dane gmin osobno: pierwsza migracja (ręcznie pisana, krótka, łatwa do review) tworzy obie tabele, RLS, funkcję normalizującą i funkcję wyszukiwania oraz wstawia 13 usług. Druga migracja zawiera wyłącznie dane gmin, wygenerowane powtarzalnie z oficjalnego pliku TERC przez skrypt bez zależności (jak `smoke.mjs`). Normalizacja „bez polskich znaków” żyje w jednym miejscu — w SQL — i jest używana zarówno przez kolumnę generowaną, jak i przez wyszukiwanie; TypeScript tylko waliduje `q` i mapuje wiersze na DTO. Dostęp z aplikacji wyłącznie przez `dictionary.service.ts`, endpointy go wołają (AGENTS.md).

## Critical Implementation Details

**Dane referencyjne w migracjach, nie w `seed.sql`.** `seed.sql` wykonuje się tylko przy lokalnym `db reset`; produkcja dostaje wyłącznie migracje. Migracja danych gmin musi mieć timestamp późniejszy niż migracja schematu.

**Normalizacja musi być `IMMUTABLE`.** `unaccent()` nie jest immutable, więc nie nadaje się do kolumny generowanej. Użyć własnej funkcji SQL `IMMUTABLE` opartej na `lower(translate(...))` z mapą `ĄĆĘŁŃÓŚŹŻąćęłńóśźż → ACELNOSZZacelnoszz`, wspólnej dla `gminas.search_name` i `search_gminas`.

**Filtr rodzajów TERC.** Plik TERC zawiera wiersze województw (puste POW), powiatów (puste GMI) i jednostek gminnych z RODZ 1–5, 8, 9. Do słownika trafiają tylko RODZ 1 (miejska), 2 (wiejska), 3 (miejsko-wiejska); nazwy powiatu i województwa pobiera się z wierszy nadrzędnych po kodach WOJ/POW; nazwa województwa w TERC jest wielkimi literami → `toLocaleLowerCase("pl")`. Czytać kolumny po nagłówku (`WOJ;POW;GMI;RODZ;NAZWA;NAZWA_DOD;STAN_NA`), usunąć BOM.

## Phase 1: Schemat słowników i katalog usług

### Overview

Pierwsza migracja projektu: tabele `services` i `gminas`, RLS tylko-do-odczytu, funkcje normalizacji i wyszukiwania oraz 13 usług. Gminy pozostają puste do fazy 2.

### Changes Required:

#### 1. Migracja schematu

**File**: `supabase/migrations/<YYYYMMDDHHmmss>_create_dictionaries.sql`

**Intent**: Utworzyć oba słowniki jako tabele referencyjne czytelne publicznie, z integralnością wymuszoną w bazie, tak by przyszłe profile mogły wskazać je kluczami obcymi, a ranking S-05 liczyć się w SQL.

**Contract**:
- `public.services(slug text PK, label text not null unique, sort_order smallint not null unique)`; `slug` sprawdzany wzorcem kebab-case.
- `public.gminas(teryt text PK — dokładnie 7 cyfr, ostatnia ∈ {1,2,3}; name text not null; kind text not null check in ('miejska','wiejska','miejsko-wiejska'); powiat text not null; wojewodztwo text not null; search_name text generated always as (public.normalize_pl(name)) stored)`.
- `public.normalize_pl(text) returns text` — `language sql immutable`, jak w Critical Implementation Details.
- `public.search_gminas(q text, max_results int default 20) returns setof public.gminas` — `language sql stable security invoker`; dopasowanie `search_name` zawiera `normalize_pl(trim(q))`; sortowanie: najpierw nazwy zaczynające się od zapytania, potem `name`, `powiat`; limit obcięty do przedziału 1–50.
- RLS włączony na obu tabelach; polityki: `services_select_anon`, `services_select_authenticated`, `gminas_select_anon`, `gminas_select_authenticated` (`for select using (true)`); brak polityk insert/update/delete.
- Wstawienie 13 usług (slug — etykieta — sort_order):
  1. `towarzystwo` — Towarzystwo i rozmowa
  2. `higiena-osobista` — Pomoc w higienie osobistej
  3. `ubieranie-i-przemieszczanie` — Pomoc przy ubieraniu i przemieszczaniu się
  4. `posilki-i-karmienie` — Przygotowanie posiłków i karmienie
  5. `pilnowanie-lekow` — Pilnowanie przyjmowania leków
  6. `zakupy-i-sprawy` — Zakupy i załatwianie spraw
  7. `prace-domowe` — Sprzątanie i prace domowe
  8. `wizyty-lekarskie` — Towarzyszenie w wizytach lekarskich
  9. `spacery-i-aktywizacja` — Spacery i aktywizacja
  10. `osoba-lezaca` — Opieka nad osobą leżącą
  11. `demencja` — Opieka nad osobą z demencją
  12. `czynnosci-pielegniarskie` — Czynności pielęgniarskie (zastrzyki, opatrunki)
  13. `cwiczenia-usprawniajace` — Ćwiczenia usprawniające

### Success Criteria:

#### Automated Verification:

- Migracja aplikuje się od zera: `npx supabase db reset`
- Anon czyta 13 usług przez PostgREST: `curl "$SUPABASE_URL/rest/v1/services?select=slug&order=sort_order" -H "apikey: $SUPABASE_KEY"` zwraca 13 wierszy, pierwszy `towarzystwo`
- Anon nie może zapisać: `POST $SUPABASE_URL/rest/v1/services` z kluczem anon kończy się błędem RLS (401/403), liczba wierszy bez zmian
- Funkcja wyszukiwania jest dostępna dla anon: `POST $SUPABASE_URL/rest/v1/rpc/search_gminas` z `{"q":"lodz"}` zwraca `200` i pustą tablicę

#### Manual Verification:

- W Supabase Studio obie tabele mają włączony RLS i dokładnie po dwie polityki `SELECT`
- Etykiety usług przeczytane i zaakceptowane (pisownia, kolejność)

**Implementation Note**: Po przejściu automatycznej weryfikacji zatrzymać się na ręczne potwierdzenie przed fazą 2.

---

## Phase 2: Import gmin z TERYT

### Overview

Powtarzalny generator danych gmin z oficjalnego pliku TERC oraz wygenerowana nim druga migracja.

### Changes Required:

#### 1. Generator migracji gmin

**File**: `scripts/generate-gminas-migration.mjs`

**Intent**: Zamienić plik TERC (wersja urzędowa, CSV) na migrację SQL z danymi gmin, tak by przyszłe zmiany administracyjne dało się wprowadzić tym samym poleceniem. Zero zależności, styl jak `scripts/smoke.mjs`.

**Contract**: `node scripts/generate-gminas-migration.mjs <ścieżka-do-TERC.csv> <plik-wyjściowy.sql>`. Parsowanie wg Critical Implementation Details. Przed zapisem kontrole kończące się błędem: dokładnie 16 województw; każda gmina ma powiat i województwo; kody `teryt` unikalne; liczba gmin w przedziale 2470–2490 (drukowana). Wynik: nagłówek-komentarz (źródło, `STAN_NA` z pliku, polecenie generatora), potem `insert into public.gminas (teryt, name, kind, powiat, wojewodztwo) values ...` w paczkach po ≤500 wierszy, apostrofy w nazwach escapowane. Surowy CSV nie jest commitowany.

#### 2. Migracja danych gmin

**File**: `supabase/migrations/<YYYYMMDDHHmmss>_seed_gminas.sql` (timestamp późniejszy niż migracja z fazy 1)

**Intent**: Dostarczyć komplet gmin na każde środowisko (lokalne, CI, produkcja) przez ścieżkę migracji.

**Contract**: Plik w całości wygenerowany przez generator; nie edytować ręcznie.

### Success Criteria:

#### Automated Verification:

- Generator kończy się sukcesem na pliku TERC i drukuje liczbę gmin oraz `STAN_NA`
- `npx supabase db reset` aplikuje obie migracje bez błędów
- Liczba wierszy `gminas` przez PostgREST (`Prefer: count=exact`) równa liczbie wydrukowanej przez generator
- `rpc/search_gminas` z `{"q":"lodz"}` zawiera `1061011` (Łódź); z `{"q":"warszawa"}` zwraca `1465011` jako pierwszy wynik
- `rpc/search_gminas` z `{"q":"lowicz"}` zwraca dwie pozycje „Łowicz” różniące się `kind` (miejska, wiejska)

#### Manual Verification:

- Wyrywkowo 3 znane gminy (np. własna okolica) mają poprawny powiat, województwo i rodzaj
- Nagłówek migracji wskazuje źródło i datę stanu danych

**Implementation Note**: Plik TERC pobiera się z eteryt.stat.gov.pl → „Pobieranie plików” → TERC, wersja urzędowa, CSV. Jeśli agent nie zdoła go pobrać (formularz strony), prosi użytkownika o ręczne pobranie i podanie ścieżki. Po automatycznej weryfikacji zatrzymać się na ręczne potwierdzenie.

---

## Phase 3: Serwis, publiczne API i smoke

### Overview

Warstwa aplikacji nad słownikami: typy DTO, formatowanie etykiety gminy, serwis, dwa publiczne endpointy JSON, kroki smoke oraz dokumentacja migracji w README. Na końcu wypchnięcie migracji na produkcję.

### Changes Required:

#### 1. Typy współdzielone

**File**: `src/types.ts` (nowy)

**Intent**: Jedno źródło kształtu słowników dla endpointów teraz oraz formularzy i filtrów w S-01/S-02.

**Contract**: `GminaKind = "miejska" | "wiejska" | "miejsko-wiejska"`; `ServiceDto { slug: string; label: string }`; `GminaDto { teryt: string; name: string; kind: GminaKind; powiat: string; wojewodztwo: string; label: string }`.

#### 2. Etykieta gminy

**File**: `src/lib/gmina.ts` (nowy, czysta funkcja bez I/O)

**Intent**: Jednoznaczna etykieta mimo powtarzających się nazw.

**Contract**: `formatGminaLabel(g: { name; kind; powiat; wojewodztwo }): string` → `"Łowicz (gm. miejska, pow. łowicki, woj. łódzkie)"`.

#### 3. Serwis słowników

**File**: `src/lib/services/dictionary.service.ts` (nowy)

**Intent**: Jedyny punkt odczytu słowników z Supabase; mapuje wiersze na DTO (bez `search_name`, `sort_order`).

**Contract**: `listServices(supabase: SupabaseClient): Promise<ServiceDto[]>` (kolejność `sort_order`); `searchGminas(supabase: SupabaseClient, query: string, limit: number): Promise<GminaDto[]>` (przez `rpc("search_gminas", { q, max_results })`, zachowuje kolejność z SQL). Błąd bazy → rzucony `Error`.

#### 4. Zależność zod

**File**: `package.json`

**Intent**: Walidacja wejścia API zgodnie z AGENTS.md — pierwszy endpoint z parametrem.

**Contract**: `npm install zod` (dependency).

#### 5. Endpoint listy usług

**File**: `src/pages/api/dictionaries/services.ts` (nowy)

**Intent**: Publiczne źródło listy usług dla formularza profilu i filtra.

**Contract**: `GET` → `200 { services: ServiceDto[] }`; `createClient()` = `null` → `503 { error }`; błąd serwisu → `500 { error }`. Wzorzec obsługi `null`: `src/pages/api/auth/signin.ts:9-12`.

#### 6. Endpoint wyszukiwania gmin

**File**: `src/pages/api/dictionaries/gminas.ts` (nowy)

**Intent**: Źródło autocomplete gmin dla S-01 i S-02 (~2477 pozycji nie nadaje się do listy rozwijanej).

**Contract**: `GET ?q=&limit=`; zod: `q` po `trim` 2–50 znaków, tylko litery (Unicode), spacje, `-` i `.` (wyklucza symbole `%`/`_` z LIKE); `limit` liczba całkowita 1–50, domyślnie 20. Odpowiedzi: `200 { gminas: GminaDto[] }`, `400 { error }` przy złym wejściu, `503`/`500` jak wyżej.

#### 7. Kroki smoke

**File**: `scripts/smoke.mjs`

**Intent**: Wykrywać w CI regresje słowników (migracje → RLS anon → endpoint) bez dodawania frameworka testowego.

**Contract**: `expected` dostaje opcjonalny predykat `body(json) => boolean`; `request()` zwraca sparsowane JSON, gdy odpowiedź ma `content-type: application/json`. Nowe kroki na początku listy (użytkownik anonimowy): usługi → `200` i 13 pozycji z pierwszą `towarzystwo`; `gminas?q=lodz` → `200` i zawiera `1061011`; `gminas?q=warszawa` → pierwszy wynik `1465011`; `gminas?q=a` → `400`.

#### 8. README

**File**: `README.md` (sekcja „Supabase Configuration”)

**Intent**: Usunąć nieaktualne „No database tables or migrations are required” i opisać nowy obieg.

**Contract**: Lokalnie `npx supabase db reset`; produkcja `npx supabase link --project-ref <ref>` + `npx supabase db push`; odświeżenie gmin: `node scripts/generate-gminas-migration.mjs <TERC.csv> supabase/migrations/<ts>_update_gminas.sql`.

### Success Criteria:

#### Automated Verification:

- Lint przechodzi: `npm run lint`
- Typy przechodzą: `npx astro check`
- Build przechodzi: `npm run build`
- Smoke przechodzi lokalnie na preview z lokalnym Supabase: `npm run preview` + `BASE_URL=http://localhost:4321 npm run smoke`
- Job `smoke` w CI przechodzi na PR

#### Manual Verification:

- `curl "http://localhost:4321/api/dictionaries/gminas?q=brzez"` zwraca czytelne, jednoznaczne etykiety
- Odpowiedzi endpointów nie zawierają pól spoza DTO
- Migracje wypchnięte na produkcję (`npx supabase db push`) i po wdrożeniu Workera `GET /api/dictionaries/services` na produkcji zwraca 13 usług

**Implementation Note**: Wypchnięcie migracji i wdrożenie na produkcję wykonuje człowiek (infrastructure.md § Operational Story → Approval).

---

## Testing Strategy

### Unit Tests:

- Brak zestawu testów jednostkowych w repo (AGENTS.md); nie wprowadzamy frameworka w tej zmianie. Logika normalizacji i sortowania żyje w SQL i jest sprawdzana przez PostgREST/smoke.

### Integration Tests:

- `npm run smoke` (lokalnie i w CI): anonimowy odczyt usług, wyszukiwanie bez znaków diakrytycznych, pierwszeństwo dopasowania od początku nazwy, walidacja `q`.

### Manual Testing Steps:

1. `npx supabase db reset`, potem zapytania `curl` z kryteriów faz 1–2.
2. `npm run build && npm run preview`, wywołać oba endpointy, w tym `q` z polskimi znakami („Łódź”) i bez („lodz”) — ten sam wynik.
3. Próba zapisu do `services` kluczem anon — odrzucona.

## Performance Considerations

~2477 wierszy — pełny skan przy wyszukiwaniu `LIKE '%…%'` jest poniżej milisekund; indeks trigramowy zbędny. Limit wyników ≤50 ogranicza rozmiar odpowiedzi. Brak pracy CPU po stronie Workera poza walidacją i mapowaniem.

## Migration Notes

- Dwie nowe migracje, wyłącznie addytywne; brak istniejących danych do migracji.
- Preview Workera używa produkcyjnego projektu Supabase (roadmap, Open Roadmap Question 2) — nowe tabele są tylko do odczytu, więc nie ma ryzyka zapisów testowych.
- Wycofanie: nowa migracja `drop function`/`drop table` (brak zależnych tabel do czasu S-01).

## References

- Roadmap: `context/foundation/roadmap.md` (F-01)
- PRD: `context/foundation/prd.md` (FR-005, FR-006, FR-009, FR-010; Business Logic; Non-Goals)
- Obsługa `null` klienta: `src/pages/api/auth/signin.ts:9-12`
- Klient Supabase: `src/lib/supabase.ts:5-21`
- Smoke: `scripts/smoke.mjs:38-71`; CI: `.github/workflows/ci.yml`
- Seed tylko lokalnie: `supabase/config.toml:60-65`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Schemat słowników i katalog usług

#### Automated

- [x] 1.1 Migracja aplikuje się od zera: `npx supabase db reset` — c7fda9f
- [x] 1.2 Anon czyta 13 usług przez PostgREST, pierwszy `towarzystwo` — c7fda9f
- [x] 1.3 Anon nie może zapisać do `services` (błąd RLS) — c7fda9f
- [x] 1.4 Funkcja `search_gminas` dostępna dla anon, zwraca pustą tablicę — c7fda9f

#### Manual

- [x] 1.5 Obie tabele mają RLS i po dwie polityki `SELECT` — c7fda9f
- [x] 1.6 Etykiety usług przeczytane i zaakceptowane — c7fda9f

### Phase 2: Import gmin z TERYT

#### Automated

- [x] 2.1 Generator kończy się sukcesem i drukuje liczbę gmin oraz `STAN_NA` — 60d6485
- [x] 2.2 `npx supabase db reset` aplikuje obie migracje — 60d6485
- [x] 2.3 Liczba wierszy `gminas` równa liczbie z generatora — 60d6485
- [x] 2.4 `search_gminas`: `lodz` zawiera `1061011`, `warszawa` zwraca `1465011` jako pierwszy — 60d6485
- [x] 2.5 `search_gminas`: `lowicz` zwraca dwie pozycje różniące się `kind` — 60d6485

#### Manual

- [x] 2.6 Wyrywkowo 3 znane gminy mają poprawny powiat, województwo i rodzaj — 60d6485
- [x] 2.7 Nagłówek migracji wskazuje źródło i datę stanu danych — 60d6485

### Phase 3: Serwis, publiczne API i smoke

#### Automated

- [x] 3.1 Lint przechodzi: `npm run lint` — 30447ec
- [x] 3.2 Typy przechodzą: `npx astro check` — 30447ec
- [x] 3.3 Build przechodzi: `npm run build` — 30447ec
- [x] 3.4 Smoke przechodzi lokalnie na preview z lokalnym Supabase — 30447ec
- [x] 3.5 Job `smoke` w CI przechodzi na PR — 30447ec

#### Manual

- [x] 3.6 Wyszukiwanie `brzez` zwraca czytelne, jednoznaczne etykiety — 30447ec
- [x] 3.7 Odpowiedzi endpointów nie zawierają pól spoza DTO — 30447ec
- [x] 3.8 Migracje wypchnięte na produkcję, produkcyjny endpoint usług zwraca 13 pozycji — 30447ec
