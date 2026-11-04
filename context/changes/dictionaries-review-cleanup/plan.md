# Domknięcie ustaleń z przeglądu F-01 i porządki w roadmapie — plan implementacji

## Overview

Zamykamy otwarte ustalenia F3–F8 z przeglądu implementacji F-01 (`context/archive/2026-09-24-gmina-and-service-dictionaries/reviews/impl-review.md`, wszystkie z `Decision: PENDING`):

- uprawnienia tabel mają odpowiadać politykom RLS, na wszystkich 7 tabelach aplikacji;
- endpointy słowników logują błędy bazy;
- middleware nie odpytuje Supabase Auth przy autocomplete gmin;
- smoke zgłasza FAIL zamiast rzucać wyjątek;
- README poprawnie opisuje smoke.

Zmiany trafiają na produkcję. Na koniec aktualizujemy decyzje F1–F8 w archiwalnym przeglądzie oraz tabelę Backlog Handoff w roadmapie.

## Current State Analysis

- **F3:** `src/pages/api/dictionaries/gminas.ts:41` i `src/pages/api/dictionaries/services.ts:14` mają `catch { … 500 }` i odrzucają błąd. Serwis (`src/lib/services/dictionary.service.ts`) opakowuje błąd komunikatem z bazy. W Workers Logs nie zostaje żaden ślad. W repo jest już wzorzec logowania: `console.error("Caregiver list failed to load", error)` w `src/pages/opiekunowie/index.astro:73`.
- **F4:** migracje nadają rolom tylko to, czego potrzebują: `20260924120000_create_dictionaries.sql:117-118` (słowniki: select), `20261103150000_caregiver_profiles.sql:398-405` (tabele S-01). Żadna nie odbiera jednak domyślnych uprawnień Supabase. W schemacie `public` `anon` i `authenticated` mają ALL, czyli także INSERT/UPDATE/DELETE/TRUNCATE na wszystkich 7 tabelach. Zapisy blokuje wyłącznie RLS. TRUNCATE nie podlega RLS (przez PostgREST jest nieosiągalny, ale to druga linia obrony). Komentarz w `20261103150000_caregiver_profiles.sql:393-396` mówi, że „grants mirror the policies”, co dziś nie jest prawdą.
- **F5:** `src/middleware.ts:24-33` woła `supabase.auth.getUser()` przy każdym żądaniu. Dla zalogowanego użytkownika każde naciśnięcie klawisza w autocomplete gmin to dodatkowy round-trip do Supabase Auth. Endpointy `/api/dictionaries/*` nie czytają `locals.user` ani `locals.getRole` (używa ich tylko `src/pages/api/caregiver/profile.ts:89`).
- **F6:** `README.md:58` („Smoke test the auth flow, the caregiver profile API and RLS”) i `README.md:221` („walks the whole auth flow…”) nie opisują kroków słownikowych ani reszty zakresu. `README.md:230` opisuje, że `anon` dostaje pustą listę z `caregiver_contacts` i `accounts`. Po F4 to się zmieni.
- **F8:** pętla kroków w `scripts/smoke.mjs:575` wywołuje `await run()` bez try/catch. Odrzucony `fetch` albo błędny JSON (`readResponse`, `:51-61`) przerywa skrypt nieobsłużonym wyjątkiem, bez linii FAIL i bez podsumowania.
- **F1, F2, F7:** już zrobione. F1/F2 zamknęła zmiana `gminas-generator-upsert` (archiwum `2026-09-24-gminas-generator-upsert`) i migracja `20261103120000_retirable_gminas.sql` (wycofywanie gmin, `replaced_by`). F7 załatwia komentarz ostrzegawczy w `20261103120000_retirable_gminas.sql:66-67`. W przeglądzie wszystkie trzy mają jednak nadal `PENDING`.
- **Roadmapa:** w `context/foundation/roadmap.md` tabela `## Backlog Handoff` pochodzi z pierwszego wygenerowania: tylko F-01 ma „yes”, a S-01…S-03, choć są `done`, figurują jako „Czeka na …”. Kamień milowy M-1 jest `open` (S-04…S-06 `proposed`). Przepływ PRD §Success Criteria (kroki 1–4) przeszedł na wdrożonym Workerze 2026-11-03, ale roadmapa tego nie odnotowuje.

## Desired End State

- `has_table_privilege` dla `anon` i `authenticated` na 7 tabelach `public` zwraca dokładnie macierz z dotychczasowych grantów (20 par rola/tabela/uprawnienie, bez TRUNCATE, REFERENCES i TRIGGER), lokalnie i na produkcji.
- Smoke sprawdza, że zapis do słownika przez REST kończy się `permission denied for table …`, a nie tylko odmową RLS. Odczyt `caregiver_contacts` i `accounts` przez `anon` to teraz odmowa uprawnień zamiast pustej listy.
- Błąd bazy w endpointach słowników zostawia wpis w logach (`console.error`), a odpowiedź do klienta się nie zmienia.
- Żądania `/api/dictionaries/*` nie wywołują `getUser()`.
- Wyjątek w kroku smoke daje linię `FAIL <nazwa>` z komunikatem błędu i liczy się do podsumowania.
- README opisuje rzeczywisty zakres smoke.
- Migracja i kod są na produkcji.
- W archiwalnym przeglądzie F-01 F1–F8 mają decyzje zamiast `PENDING`, a roadmapa ma aktualną tabelę Backlog Handoff i notatkę o przejściu przepływu PRD.

### Key Discoveries:

- Funkcje SECURITY INVOKER używają wyłącznie operacji objętych jawnymi grantami. `save_caregiver_profile` (`20261103150000_caregiver_profiles.sql:312-342`) wykonuje insert/`on conflict do update` na `caregiver_profiles` i `caregiver_contacts` oraz delete/insert na `caregiver_gminas` i `caregiver_services`. `search_caregivers` i `get_public_caregiver` tylko czytają tabele publiczne. Polityka `caregiver_contacts_select_authenticated` (`20261103220000_coordinator_contact_access.sql:31-38`) czyta `accounts` jako `authenticated`, który ma select. `caregiver_profile_missing` i `handle_new_user` są SECURITY DEFINER. Dlatego „revoke all + te same granty” nie zmienia działania aplikacji. Wyjątek to przypadek brzegowy, gdy klient strony chronionej nie odświeży sesji i odpyta bazę jako `anon` (klient czyta oryginalny nagłówek Cookie, `src/lib/supabase.ts:12`). Wtedy odczyt `caregiver_contacts` w `src/pages/kontakt/[id].astro:31` oraz embed `caregiver_contacts(...)` w `src/lib/services/caregiver.service.ts:57` zwrócą 42501 zamiast pustego wyniku, a strona pokaże ogólny błąd zamiast komunikatu „tylko dla koordynatorów”. Tę zmianę akceptujemy: kontakt i tak się nie odsłania.
- PostgREST zwraca ten sam kod `42501` dla odmowy RLS i dla braku uprawnienia, ale komunikaty się różnią: `new row violates row-level security policy for table …` kontra `permission denied for table …`. Tylko po komunikacie smoke odróżni revoke od samego RLS.
- Dla `anon` PostgREST zamienia `42501` na HTTP 401, dla `authenticated` na 403.
- Dwa istniejące kroki smoke zmienią wynik: „anon cannot read caregiver contact” (`scripts/smoke.mjs:272-275`) i „anon cannot read account roles” (`:276`). Muszą zostać zmienione w tej samej fazie co migracja, inaczej CI padnie.
- `npx supabase db query --local "<sql>"` / `--linked` (CLI 2.117.0) wykonuje zapytanie bez psql, więc kontrolę uprawnień można uruchomić jednym poleceniem.
- Token `authenticated` w smoke jest dostępny od kroku logowania drugiego opiekuna (`secondCaregiverToken`, `scripts/smoke.mjs:320`).

## What We're NOT Doing

- Nie dodajemy `alter default privileges` dla przyszłych tabel. Kolejne migracje (S-04, S-06) nadal same nadają granty. Tę lukę dla nowych tabel zamknąłby dopiero kolejny revoke.
- Nie zmieniamy polityk RLS, funkcji ani danych. Zmieniają się wyłącznie uprawnienia tabel.
- Nie ruszamy uprawnień `service_role` ani `postgres`, ani uprawnień `execute` na funkcjach (te są już odbierane jawnie).
- Nie cache'ujemy odpowiedzi słowników (świadomie poza zakresem F-01).
- Nie zmieniamy treści odpowiedzi 500 w endpointach słowników.
- Nie zamykamy kamienia milowego M-1 (S-04…S-06 nie są `done`) i nie zmieniamy statusów pozycji roadmapy.
- Nie zmieniamy notatki startera w `README.md:232`.

## Implementation Approach

Najpierw uprawnienia, bo zmieniają kontrakt widoczny przez REST: migracja i dostosowany smoke trafiają do jednej fazy, żeby CI pozostał zielony. Potem drobne poprawki aplikacji, smoke i README, które nie zależą od migracji. Następnie wdrożenie na produkcję. Na końcu dokumenty kontekstu, żeby decyzje w przeglądzie mogły powołać się na sprawdzony stan produkcji.

## Critical Implementation Details

- **Kolejność w migracji:** dla każdej tabeli najpierw `revoke all … from anon, authenticated`, potem `grant` z dokładnie tą macierzą co dziś. Całość w jednym pliku migracji, który Supabase CLI wykonuje w jednej transakcji, więc nie ma okna bez uprawnień.
- **Kontrola uprawnień (lokalnie i na produkcji):** to samo zapytanie, oczekiwany wynik to 20 wierszy w podanej macierzy i zero wierszy z `TRUNCATE`, `REFERENCES` lub `TRIGGER`:

  ```sql
  select c.relname, r.role, p.priv
  from pg_class c
  cross join (values ('anon'), ('authenticated')) as r(role)
  cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) as p(priv)
  where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
    and has_table_privilege(r.role, c.oid, p.priv)
  order by 1, 2, 3;
  ```

  Oczekiwana macierz: `services`, `gminas`: SELECT dla obu ról (4). `accounts`: SELECT dla `authenticated` (1). `caregiver_profiles`: SELECT dla `anon`; SELECT, INSERT, UPDATE dla `authenticated` (4). `caregiver_contacts`: SELECT, INSERT, UPDATE dla `authenticated` (3). `caregiver_gminas`, `caregiver_services`: SELECT dla `anon`; SELECT, INSERT, DELETE dla `authenticated` (po 4). Razem 20.

---

## Faza 1: Uprawnienia tabel (F4)

### Overview

Uprawnienia `anon` i `authenticated` na 7 tabelach `public` mają być równe jawnym grantom. Smoke ma pilnować tego przez REST.

### Changes Required:

#### 1. Migracja uprawnień

**File**: `supabase/migrations/20261103230000_table_grants_mirror_policies.sql`

**Intent**: Odebrać domyślne ALL od `anon` i `authenticated` na wszystkich tabelach aplikacji i nadać z powrotem dokładnie te uprawnienia, które dziś nadają migracje. TRUNCATE i zapisy bez polityki znikają, a działanie aplikacji pozostaje takie samo.

**Contract**:

- Nagłówek migracji wyjaśnia powód: domyślne uprawnienia Supabase, TRUNCATE poza RLS, ustalenie F4 z przeglądu F-01.
- Dla tabel `services`, `gminas`, `accounts`, `caregiver_profiles`, `caregiver_contacts`, `caregiver_gminas`, `caregiver_services`: `revoke all on public.<t> from anon, authenticated;`, a potem granty według macierzy z „Critical Implementation Details”.
- Bez zmian polityk, funkcji i danych. `service_role` pozostaje nietknięty.

#### 2. Smoke: kroki uprawnień

**File**: `scripts/smoke.mjs`

**Intent**: Kroki odczytu kontaktu i ról przez `anon` mają oczekiwać odmowy uprawnień zamiast pustej listy. Nowe kroki sprawdzają, że zapis do słowników jest odrzucany już na poziomie uprawnień, a nie tylko przez RLS.

**Contract**:

- „anon cannot read caregiver contact” (`:272-275`) i „anon cannot read account roles” (`:276`): status 401, body z `code === "42501"` i `message` zawierającym `permission denied for table caregiver_contacts` / `… accounts`.
- Nowy krok: `anon` robi `POST /rest/v1/gminas` z wierszem z istniejącymi kolumnami (`teryt`, `name`, `kind`, `powiat`, `wojewodztwo`; wartości fikcyjne). Oczekiwane: 401 i `message` zawierający `permission denied for table gminas`.
- Nowy krok: zalogowany użytkownik (`secondCaregiverToken`, więc krok stoi po `:320`) robi `POST /rest/v1/services` z wierszem `slug`, `label`, `sort_order`. Oczekiwane: 403 i `message` zawierający `permission denied for table services`.
- Body musi używać istniejących kolumn: na nieznaną kolumnę PostgREST odpowiada 400 `PGRST204` ze schema cache, zanim zapytanie dotrze do Postgresa. Odmowa uprawnień przychodzi przed constraintami, więc wartości nie muszą być poprawne.
- Pomocnicza funkcja do sprawdzania odmowy jest dopuszczalna, wzorem `isEmptyArray`/`hasOneRow` (`:93-94`).
- Komentarz nagłówka skryptu (`:1-8`) wspomina kontrolę uprawnień tabel.
- Statusy 401/403 potwierdzić na lokalnym stosie. Jeśli PostgREST zwróci inny kod HTTP, rozstrzyga sprawdzenie komunikatu, a plan dostaje notatkę o odstępstwie.

#### 3. Reguła dla nowych tabel

**File**: `AGENTS.md`

**Intent**: Bez `alter default privileges` każda nowa tabela (S-04, S-06) dostaje domyślne ALL. Reguła ma przetrwać archiwizację tego planu.

**Contract**: Hard Rule o nowych tabelach brzmi: „New tables go in `supabase/migrations/YYYYMMDDHHmmss_short_description.sql` with RLS enabled, `revoke all on public.<t> from anon, authenticated` followed by explicit grants (Supabase defaults grant ALL, including TRUNCATE), and one policy per operation and role.” Odwołanie do wzorca: `20261103230000_table_grants_mirror_policies.sql`.

### Success Criteria:

#### Automated Verification:

- Migracja stosuje się od zera: `npx supabase db reset`
- Kontrola uprawnień `npx supabase db query --local` (zapytanie z „Critical Implementation Details”) zwraca dokładnie 20 wierszy macierzy, bez TRUNCATE/REFERENCES/TRIGGER
- `npx supabase db lint` bez nowych błędów
- `npm run lint`, `npx astro check` i `npm run build` przechodzą
- `npm run smoke` na świeżym buildzie przechodzi w całości, łącznie z nowymi krokami uprawnień

#### Manual Verification:

- Na lokalnym preview opiekun zapisuje profil na `/profil/edycja`, lista `/opiekunowie` z filtrem gminy działa, a koordynator widzi kontakt na `/kontakt/<id>`. Brak błędów uprawnień w konsoli serwera

**Implementation Note**: Po zielonej weryfikacji automatycznej zatrzymaj się na potwierdzenie weryfikacji ręcznej przed fazą 2.

---

## Faza 2: Kod aplikacji, smoke i README (F3, F5, F8, F6)

### Overview

Logowanie błędów w endpointach słowników, pominięcie `getUser()` dla słowników w middleware, odporna pętla smoke i aktualne opisy smoke w README.

### Changes Required:

#### 1. Logowanie błędów słowników (F3)

**File**: `src/pages/api/dictionaries/gminas.ts`, `src/pages/api/dictionaries/services.ts`

**Intent**: Błąd zgłoszony przez serwis ma trafić do Workers Logs.

**Contract**: `catch (error)` z `console.error("<opis> failed", error)` według wzoru z `src/pages/opiekunowie/index.astro:73`, np. „Gmina search failed”, „Services failed to load”. Status 500 i treść odpowiedzi bez zmian.

#### 2. Middleware bez `getUser()` dla słowników (F5)

**File**: `src/middleware.ts`

**Intent**: Żądania pod `/api/dictionaries/` nie potrzebują tożsamości użytkownika, więc nie powinny odpytywać Supabase Auth.

**Contract**:

- Dla `context.url.pathname.startsWith("/api/dictionaries/")`: `locals.user = null` bez wywołania `getUser()`, a `locals.getRole()` zwraca `null`.
- Reszta bez zmian: nagłówek `X-Robots-Tag: noindex`, `PROTECTED_ROUTES`, leniwy `getRole` dla innych ścieżek.
- Krótki komentarz z uzasadnieniem: autocomplete, każde naciśnięcie klawisza, endpointy nie czytają `locals.user`.

#### 3. Odporna pętla smoke (F8)

**File**: `scripts/smoke.mjs`

**Intent**: Wyjątek w kroku (odrzucony `fetch`, błędny JSON) ma być FAILem z nazwą kroku, a nie przerwaniem skryptu.

**Contract**:

- Wywołanie `run()` i ocena wyniku w pętli (`:575-598`) owinięte w try/catch.
- W catch: `FAIL  <nazwa>  -> error <message>`, `failed++`, przejście do następnego kroku.
- Podsumowanie i kod wyjścia jak dotąd.

#### 4. README: opis smoke (F6, oraz skutek F4)

**File**: `README.md`

**Intent**: Opisy smoke mają odpowiadać rzeczywistemu zakresowi i nowemu zachowaniu uprawnień.

**Contract**:

- `:58`: lista skryptów wymienia słowniki, API profilu, publiczną listę, odsłonięcie kontaktu oraz RLS i uprawnienia.
- `:221`: pierwsze zdanie sekcji nie twierdzi, że skrypt sprawdza wyłącznie auth flow. Wymienia krótko kroki słownikowe (lista usług, wyszukiwanie gmin, walidacja `q`) obok auth.
- `:230`: `anon` dostaje z `caregiver_contacts` i `accounts` odmowę uprawnień (`permission denied`), a nie pustą listę. Do tego zdanie o krokach uprawnień: zapis do `gminas`/`services` przez REST odrzucony brakiem uprawnienia tabeli.
- Notatka `:232` bez zmian.

### Success Criteria:

#### Automated Verification:

- `npm run lint`, `npx astro check` i `npm run build` przechodzą
- `npm run smoke` na świeżym buildzie przechodzi w całości
- Smoke przy zatrzymanym serwerze (`BASE_URL=http://localhost:4399 npm run smoke`) wypisuje linie FAIL z komunikatem błędu i podsumowanie „N step(s) failed” z kodem wyjścia 1, bez nieobsłużonego wyjątku

#### Manual Verification:

- Przy zatrzymanym lokalnym Supabase (`npx supabase stop`) `GET /api/dictionaries/services` na preview zwraca 500, a log serwera zawiera wpis `console.error` z błędem. Potem `npx supabase start`
- Zalogowany opiekun na `/profil/edycja` wyszukuje gminy w autocomplete bez błędów. `/profil` dla anonima nadal przekierowuje na `/auth/signin`

**Implementation Note**: Po zielonej weryfikacji automatycznej zatrzymaj się na potwierdzenie weryfikacji ręcznej przed fazą 3.

---

## Faza 3: Wdrożenie produkcyjne

### Overview

Migracja uprawnień i kod z faz 1–2 trafiają na produkcję. Sprawdzamy je tam bez zapisów danych testowych.

### Changes Required:

#### 1. Migracja na produkcji

**File**: brak zmian w repo (operacja)

**Intent**: Uprawnienia produkcyjne mają być równe lokalnym.

**Contract**: Z commita scalonego do `master`: `npx supabase db push` na zlinkowany projekt produkcyjny. Przed wykonaniem pytam użytkownika o zgodę.

#### 2. Wdrożenie Workera

**File**: brak zmian w repo (operacja)

**Intent**: Logowanie błędów i lżejszy middleware działają na wdrożonym Workerze.

**Contract**: `npm run build` i `npx wrangler deploy` (procedura z `context/foundation/infrastructure.md` i `README.md:214`). Przed wykonaniem pytam użytkownika o zgodę. Potwierdzenie przez `npx wrangler deployments list`.

### Success Criteria:

#### Manual Verification:

- `npx supabase db push` zastosował `20261103230000_table_grants_mirror_policies.sql` na produkcji
- Kontrola uprawnień na produkcji (`npx supabase db query --linked` albo SQL Editor w panelu Supabase) zwraca te same 20 wierszy co lokalnie
- Na produkcji `anon` `POST /rest/v1/gminas` dostaje `permission denied for table gminas`, a `GET /rest/v1/caregiver_contacts` dostaje `permission denied for table caregiver_contacts`. Nic nie zostaje zapisane
- `npx wrangler deploy` zakończony, nowe wdrożenie widoczne w `npx wrangler deployments list`
- Na wdrożonym Workerze `GET /api/dictionaries/services` zwraca usługi, `GET /api/dictionaries/gminas?q=warszawa` zwraca gminy, a `/opiekunowie` renderuje listę z nagłówkiem `X-Robots-Tag: noindex`

**Implementation Note**: Faza wyłącznie ręczna, z akceptacją użytkownika przed każdym `db push` i `deploy`.

---

## Faza 4: Dokumenty kontekstu

### Overview

Archiwalny przegląd F-01 dostaje decyzje F1–F8. Roadmapa dostaje aktualną tabelę Backlog Handoff i notatkę o stanie kamienia milowego.

### Changes Required:

#### 1. Decyzje w przeglądzie F-01

**File**: `context/archive/2026-09-24-gmina-and-service-dictionaries/reviews/impl-review.md`

**Intent**: Każde ustalenie ma decyzję i wskazanie, gdzie zostało zamknięte. To wyjątek od nieruszania archiwum, wymagany w `change.md` tej zmiany.

**Contract**: Wiersze `- **Decision**: PENDING` zastąpione w stylu pozostałych przeglądów (`FIXED — …`):

- F1: FIXED (Fix A), follow-up `gminas-generator-upsert` zrealizowany, archiwum `context/archive/2026-09-24-gminas-generator-upsert/`.
- F2: FIXED (Fix A): `20261103120000_retirable_gminas.sql` (wycofywanie, `replaced_by`) oraz ograniczenia S-01 w roadmapie.
- F7: FIXED, komentarz w `20261103120000_retirable_gminas.sql:66-67`.
- F3, F4, F5, F6, F8: FIXED w `dictionaries-review-cleanup`, z nazwą pliku/migracji, krótkim dowodem (smoke, kontrola uprawnień lokalnie i na produkcji) i skrótem commita.
- F4 zaznacza rozszerzenie zakresu na wszystkie 7 tabel.
- Reszta raportu (werdykty, liczby, treść ustaleń) bez zmian.

#### 2. Roadmapa

**File**: `context/foundation/roadmap.md`

**Intent**: Tabela Backlog Handoff ma pokazywać, co da się teraz planować. Roadmapa ma odnotować, że kryterium przepływu z PRD przeszło na produkcji.

**Contract**:

- `## Backlog Handoff`: F-01, S-01, S-02, S-03 w kolumnie „Ready for `/10x-plan`” mają `done`, w Notes „Zarchiwizowane 2026-11-03”. S-04: `yes`, „Run `/10x-plan caregiver-availability-filter`”. S-06: `yes`, „Run `/10x-plan caregiver-profile-deletion`”. S-05: `no`, „Czeka na S-04”.
- W `## Milestone` pod „Done when” nowy punkt: 2026-11-03 przepływ PRD §Success Criteria → Primary (kroki 1–4) przeszedł na wdrożonym Workerze. M-1 pozostaje `open` do zakończenia S-04…S-06.
- `## Done`: placeholder „(Empty on first generation…)” zastąpiony wpisami dla F-01, S-01, S-02, S-03 (po jednym na pozycję). Każdy wpis ma datę archiwizacji z `archived_at` w `change.md` (wszystkie 2026-11-03) i ścieżkę archiwum: `context/archive/2026-09-24-gmina-and-service-dictionaries/`, `context/archive/2026-11-03-caregiver-profile-setup/`, `context/archive/2026-11-03-public-caregiver-search/`, `context/archive/2026-11-03-contact-reveal-after-signin/`.
- Frontmatter `updated:` na datę edycji.
- Statusy pozycji i reszta dokumentu bez zmian.

### Success Criteria:

#### Automated Verification:

- W przeglądzie F-01 nie ma już `Decision**: PENDING`: `grep -c "Decision\*\*: PENDING" context/archive/2026-09-24-gmina-and-service-dictionaries/reviews/impl-review.md` zwraca 0
- `npx prettier --check context/foundation/roadmap.md context/archive/2026-09-24-gmina-and-service-dictionaries/reviews/impl-review.md` przechodzi

#### Manual Verification:

- Tabela Backlog Handoff wskazuje S-04 i S-06 jako gotowe do `/10x-plan`, a S-05 jako czekające na S-04. Notatka o przepływie PRD jest pod kamieniem milowym, a `## Done` ma wpisy F-01, S-01…S-03

---

## Testing Strategy

### Unit Tests:

- Brak zestawu testów jednostkowych w projekcie (AGENTS.md: jedynym testem automatycznym jest smoke).

### Integration Tests:

- `npm run smoke` lokalnie i w CI: nowe kroki uprawnień (`anon` zapis do `gminas`, `authenticated` zapis do `services`), zmienione kroki odczytu `caregiver_contacts` i `accounts` przez `anon` oraz wszystkie istniejące kroki zapisów i odczytów, które dowodzą, że nowe granty wystarczają aplikacji.
- Kontrola macierzy uprawnień zapytaniem `has_table_privilege` (lokalnie automatycznie, na produkcji ręcznie).

### Manual Testing Steps:

1. Lokalnie: zapis profilu opiekuna, filtr listy po gminie, kontakt u koordynatora (faza 1).
2. Lokalnie: zatrzymany Supabase → 500 i wpis w logu dla `/api/dictionaries/services` (faza 2).
3. Produkcja: kontrola uprawnień, odmowa zapisu przez REST, słowniki i lista na Workerze (faza 3).

## Performance Considerations

F5 usuwa jeden round-trip do Supabase Auth na każde zapytanie autocomplete zalogowanego użytkownika. Zmiana uprawnień nie wpływa na wydajność.

## Migration Notes

Migracja zmienia wyłącznie uprawnienia, bez danych i bez przestojów. Wycofanie to nowa migracja przywracająca poprzedni stan: `grant all on public.<t> to anon, authenticated;` dla 7 tabel. Kolejne migracje tworzące tabele (S-04, S-06) powinny same robić `revoke all` przed grantami. To wzorzec do skopiowania z tej migracji, zapisany jako Hard Rule w `AGENTS.md` (faza 1 §3).

## References

- Przegląd źródłowy: `context/archive/2026-09-24-gmina-and-service-dictionaries/reviews/impl-review.md`
- Zakres zmiany: `context/changes/dictionaries-review-cleanup/change.md`
- Granty: `supabase/migrations/20260924120000_create_dictionaries.sql:117-120`, `supabase/migrations/20261103150000_caregiver_profiles.sql:393-405`
- Wzorzec logowania: `src/pages/opiekunowie/index.astro:73`
- Wcześniejsze wdrożenie migracji: `context/archive/2026-09-24-gmina-and-service-dictionaries/plan.md:223`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Uprawnienia tabel (F4)

#### Automated

- [x] 1.1 Migracja stosuje się od zera: `npx supabase db reset`
- [x] 1.2 Kontrola uprawnień `npx supabase db query --local` zwraca dokładnie 20 wierszy macierzy, bez TRUNCATE/REFERENCES/TRIGGER
- [x] 1.3 `npx supabase db lint` bez nowych błędów
- [x] 1.4 `npm run lint`, `npx astro check` i `npm run build` przechodzą
- [x] 1.5 `npm run smoke` na świeżym buildzie przechodzi w całości, łącznie z nowymi krokami uprawnień

#### Manual

- [x] 1.6 Na lokalnym preview opiekun zapisuje profil, lista z filtrem gminy działa, koordynator widzi kontakt; brak błędów uprawnień

### Phase 2: Kod aplikacji, smoke i README (F3, F5, F8, F6)

#### Automated

- [ ] 2.1 `npm run lint`, `npx astro check` i `npm run build` przechodzą
- [ ] 2.2 `npm run smoke` na świeżym buildzie przechodzi w całości
- [ ] 2.3 Smoke przy zatrzymanym serwerze wypisuje linie FAIL i podsumowanie z kodem wyjścia 1, bez nieobsłużonego wyjątku

#### Manual

- [ ] 2.4 Przy zatrzymanym lokalnym Supabase `GET /api/dictionaries/services` zwraca 500, a log serwera zawiera wpis `console.error`
- [ ] 2.5 Zalogowany opiekun wyszukuje gminy w autocomplete bez błędów; `/profil` dla anonima przekierowuje na `/auth/signin`

### Phase 3: Wdrożenie produkcyjne

#### Manual

- [ ] 3.1 `npx supabase db push` zastosował migrację uprawnień na produkcji
- [ ] 3.2 Kontrola uprawnień na produkcji zwraca te same 20 wierszy co lokalnie
- [ ] 3.3 Na produkcji `anon` dostaje `permission denied` dla zapisu do `gminas` i odczytu `caregiver_contacts`; nic nie zostaje zapisane
- [ ] 3.4 `npx wrangler deploy` zakończony, nowe wdrożenie widoczne w `npx wrangler deployments list`
- [ ] 3.5 Na wdrożonym Workerze słowniki zwracają dane, a `/opiekunowie` renderuje listę z `X-Robots-Tag: noindex`

### Phase 4: Dokumenty kontekstu

#### Automated

- [ ] 4.1 W przeglądzie F-01 nie ma już `Decision**: PENDING`
- [ ] 4.2 `npx prettier --check` przechodzi dla roadmapy i przeglądu F-01

#### Manual

- [ ] 4.3 Backlog Handoff wskazuje S-04 i S-06 jako gotowe, S-05 jako czekające na S-04; notatka o przepływie PRD pod kamieniem milowym; `## Done` ma wpisy F-01, S-01…S-03
