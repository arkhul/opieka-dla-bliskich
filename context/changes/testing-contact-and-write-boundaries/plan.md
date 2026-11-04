# Granice kontaktu i zapisów (test rollout Phase 3) — Implementation Plan

## Overview

Domykamy luki testowe dla ryzyk #3 (wyciek kontaktu), #4 (nadużycie zapisu, uprawnienia tabel) i #6 (utrata danych przy zapisie profilu) z `context/foundation/test-plan.md` §3 Phase 3. Zmiana jest **tylko testowa**: dwa nowe pliki pgTAP (macierz uprawnień i macierz odmów zapisu), nowe kroki w `scripts/smoke.mjs` (ścieżka embed PostgREST, `GET` koordynatora, dwie sondy 0-wierszy, cykl formularza dla każdego pola) oraz dowód czułości mutacjami i uzupełnienie cookbooka (§6.2, §6.4, §6.5). Żadnego pliku w `src/` ani migracji nie zmieniamy.

## Current State Analysis

- Smoke (`scripts/smoke.mjs`, 1164 linie, 112 kroków) pokrywa wyciek kontaktu dla anona, innego opiekuna i koordynatora na poziomie HTML i PostgREST (`hidesListContact`/`hidesProfileContact` skanują cały body, `scripts/smoke.mjs:159-163`) oraz usuwanie cudzego profilu wzorcem „200 + `[]` + wiersz nadal czytelny" (`scripts/smoke.mjs:949-975`).
- Brak testów: cudzy `UPDATE`/`INSERT` na `caregiver_contacts` i `caregiver_profiles`, cudzy `INSERT`/`DELETE` na `caregiver_gminas`/`caregiver_services`/`caregiver_availability`, jakikolwiek zapis do `accounts` (`accounts.role` bramkuje politykę odczytu kontaktu), wywołanie `save_caregiver_profile` przez anona/koordynatora, 31. gmina wstawiona bezpośrednio (wyzwalacz `enforce_caregiver_gminas_limit`).
- `scripts/check-table-grants.sql:9-16` dowodzi tylko braku `TRUNCATE`/`REFERENCES`/`TRIGGER` dla `anon`/`authenticated`. Nadmiarowy `grant delete … to anon`, widok, sekwencja ani `EXECUTE` na nowej funkcji nie są sprawdzane; macierz 25 wierszy żyje tylko w komentarzu migracji (`supabase/migrations/20261104160000_caregiver_profile_delete.sql:19-26`).
- `PUT /api/caregiver/profile` to pełne zastąpienie: pominięte `gminas`/`services`/`availability` → `[]`, pominięte `phone`/`email`/`description` → `null` (`src/pages/api/caregiver/profile.ts:31-38,74,81,91`). „Zmiana jednego pola" jest własnością cyklu formularza (`CaregiverProfileForm.tsx:101-111` wysyła całość), nie endpointu. Żaden krok smoke nie zmienia jednego pola i nie porównuje wszystkich pozostałych; krok `profile save normalizes phone and completes profile` (`scripts/smoke.mjs:318`) pomija gminy, usługi, e-mail.
- Embed PostgREST `caregiver_profiles?select=…,caregiver_contacts(phone,email)` jako anon dał ręcznie 401, ale nie jest w smoke; dla zalogowanego opiekuna-nie-właściciela nie sprawdzono go wcale. `GET /api/caregiver/profile` jako koordynator (oczekiwane 403) nie jest w smoke, choć `PUT` (`:853`) i `DELETE` (`:858`) są.
- pgTAP: dwa pliki z Phase 1 używają `set local role anon` (`supabase/tests/database/search_caregivers_gmina.test.sql:111`); żaden nie używa `authenticated` z JWT claims. CI uruchamia `supabase test db` po kontroli uprawnień tabel (`.github/workflows/ci.yml:55-59`), więc nowe pliki wchodzą do bramki bez zmian w workflow.

## Desired End State

`supabase test db` zawiera dwa nowe pliki zielone na lokalnej bazie: `grants_matrix.test.sql` (dokładna macierz 25 uprawnień `anon`/`authenticated`, RLS włączone na każdej tabeli `public`, allowlista `EXECUTE` na funkcjach `public`) i `write_boundaries.test.sql` (odmowy zapisu innego opiekuna, koordynatora i anona z odczytem wiersza ofiary po każdej próbie). `npm run smoke` zawiera nowe kroki #3/#4/#6 i przechodzi dwa razy z rzędu na tej samej bazie. Każdy nowy test ma udokumentowaną mutację, która go czerwieni. `test-plan.md` §3 pokazuje Phase 3 jako `done`, a §6.2/§6.4/§6.5 opisują, jak dodać kolejny krok smoke i test nowej tabeli/polityki.

### Key Discoveries:

- Wyzwalacz limitu gmin wraca bez błędu, gdy `auth.uid()` jest puste (`supabase/migrations/20261103170000_caregiver_gminas_limit.sql:19-22`): test 31. gminy w pgTAP wymaga JWT claims, samo `set local role authenticated` go nie dotknie.
- Macierz uprawnień z migracji (suma 25): słowniki `gminas`/`services` po 2 (select: anon, authenticated); `accounts` 1 (select: authenticated); `caregiver_profiles` 5 (anon: select; authenticated: select, insert, update, delete); `caregiver_contacts` 3 (authenticated: select, insert, update); `caregiver_gminas`, `caregiver_services`, `caregiver_availability` po 4 (anon: select; authenticated: select, insert, delete). Źródła: `20261103230000_table_grants_mirror_policies.sql:19-56`, `20261104160000_caregiver_profile_delete.sql:19-26`, `20261104120000_caregiver_availability.sql:70-72`.
- Funkcje wywoływalne przez anona wg migracji: `caregiver_profile_missing`, `count_caregivers_relaxed`, `get_public_caregiver`, `search_caregivers` (i `normalize_pl`); `save_caregiver_profile` tylko `authenticated`; funkcje wyzwalaczy (`handle_new_user`, `enforce_caregiver_gminas_limit`) nikt (`20261103150000_caregiver_profiles.sql:407-413`, `20261104120000_caregiver_availability.sql:416-423`).
- PostgREST i RLS odpowiadają na `UPDATE`/`DELETE` cudzego wiersza 200 z zerem wierszy, a nie błędem; odmowa braku uprawnienia daje 42501 `permission denied for table …` (wzorzec: `deniesTable`, `scripts/smoke.mjs:120-123`). Sam status nie wystarcza: test musi odczytać wiersz ofiary.
- Akceptowane ryzyko, którego **nie** testujemy jako wycieku: każdy koordynator może jednym `GET /rest/v1/caregiver_contacts` pobrać kontakty wszystkich kompletnych profili (`20261103220000_coordinator_contact_access.sql:16-19`). Granica (tylko kompletne) jest już pokryta (`scripts/smoke.mjs:877,885`).

## What We're NOT Doing

- Nie zmieniamy `src/pages/api/caregiver/profile.ts` ani żadnego kodu aplikacji: omitowane tablice nadal czyszczą listy, a testu „PUT z jednym polem zachowuje resztę" ani „czyści resztę" **nie** piszemy (decyzja: blokujemy cykl formularza, nie kontrakt częściowego body).
- Nie zmieniamy `scripts/check-table-grants.sql` (zostaje jako ogólny strażnik); macierz i `EXECUTE` idą do pgTAP.
- Nie testujemy masowego odczytu kontaktów przez koordynatora (akceptowane ryzyko).
- Nie dodajemy asercji nagłówków (`Cache-Control`, `noindex` na dodatkowych stronach) ani strażnika sitemap/robots (nie wybrane; `noindex` na trzech stronach z kontaktem jest już w smoke).
- Nie weryfikujemy produkcji (grants, `pg_graphql`, sitemap): tylko lokalna baza; smoke na wdrożonym Workerze zostaje ręczny i opcjonalny (test-plan §5).
- Nie testujemy współbieżnych zapisów (dwie karty, last-write-wins) ani `service_role`.
- Nie sprzątamy użytkowników i profili smoke z lokalnej bazy (jak dotąd; unikalne znaczniki `stamp`).
- Nie zmieniamy workflow CI: `supabase test db` i `npm run smoke` już biegną w jobie `smoke`.

## Implementation Approach

Pięć faz, każda zielona i weryfikowalna osobno. Najpierw tanie, deterministyczne pgTAP (macierz uprawnień z literalnym oracle z migracji, bez impersonacji), potem najbardziej niepewny element, czyli impersonacja `authenticated` z JWT claims w pgTAP (faza 2, z asercją, że `auth.uid()` zwraca podany `sub`). Dalej kroki smoke tam, gdzie liczy się pełny stos (HTTP + Zod + RPC + PostgREST). Na końcu dowód czułości mutacjami i dokumentacja, wzorzec z test-plan §6.1/§6.3.

Reguły wspólne dla nowych testów:

- **Oracle z deklaracji, nie z wyniku.** Macierz uprawnień i allowlista funkcji są literalne w pliku i wyprowadzone z migracji (komentarz z odwołaniem do pliku migracji), nigdy z zapytania o stan bazy. Oczekiwane wartości pól w smoke #6 to stałe fikstury.
- **Pozytywna kontrola przy każdej odmowie.** Ten sam użytkownik wykonuje analogiczną operację na własnym wierszu i ona się udaje, żeby odmowa dowodziła własności wiersza, a nie ogólnego zakazu.
- **Odmowa = odczyt ofiary.** Po każdej próbie zapisu na cudzym wierszu wiersz ofiary jest czytany niezależnie (jako `postgres` w pgTAP, jako właściciel lub przez publiczne RPC w smoke) i musi być bez zmian.
- **Rozróżniaj błąd RLS od błędu uprawnienia.** Błąd uprawnień: `permission denied for table …`; błąd RLS na `INSERT`: `new row violates row-level security policy …`; `UPDATE`/`DELETE` bez dostępu do wiersza: zero wierszy.

## Critical Implementation Details

- **Impersonacja w pgTAP.** `auth.uid()` w lokalnym Supabase czyta `request.jwt.claims`; plik ustawia `set local role authenticated` i `set_config('request.jwt.claims', …, true)` z `sub` i `role`, a między sekcjami wraca `reset role`. Pierwsza asercja pliku sprawdza, że `auth.uid()` zwraca podany `sub`; bez niej cały plik mógłby zielenieć na `uid = null`.
- **Katalog uprawnień.** Macierz czytaj z `pg_class.relacl` przez `aclexplode` (nie z `information_schema.role_table_grants`, które filtruje po bieżącej roli). Funkcje bierz z `pg_proc` w `public`, pomijając obiekty rozszerzeń (`pg_depend`, `deptype = 'e'`).
- **Kolejność kroków smoke.** Smoke dzieli jedną sesję cookie (`jar`); nowe kroki z sesją koordynatora/opiekuna stawiaj obok istniejących kroków z tym samym użytkownikiem (koordynator: ok. `scripts/smoke.mjs:853`), a nowe konto dla #6 zakładaj na samym końcu tablicy `steps`, bo zmienia sesję w `jar`.

## Faza 1: Macierz uprawnień i allowlista EXECUTE (pgTAP)

### Overview

Plik pgTAP dowodzący, że uprawnienia `anon`/`authenticated` na tabelach `public` są **równe** udokumentowanej macierzy, że RLS jest włączone na każdej tabeli `public`, oraz że `EXECUTE` na funkcjach `public` ma tylko zamierzone role. Nie wymaga impersonacji.

### Changes Required:

#### 1. Test macierzy uprawnień

**File**: `supabase/tests/database/grants_matrix.test.sql` (nowy)

**Intent**: Jeden plik w jednej transakcji z `rollback` (konwencja test-plan §6.1), który zamyka lukę „check-table-grants dowodzi tylko braku TRUNCATE/REFERENCES/TRIGGER" i wykrywa nadmiarowy grant, tabelę bez RLS oraz funkcję z domyślnym `EXECUTE`.

**Contract**: Trzy grupy asercji.
(a) `set_eq` zbioru `(tabela, rola, uprawnienie)` dla `anon`/`authenticated` na tabelach `public` z literalną listą 25 wierszy (rozbicie w Key Discoveries), komentarz nad listą cytuje migracje źródłowe.
(b) Każda zwykła tabela `public` ma `relrowsecurity = true` (lista tabel porównana do literalnych 8 nazw, żeby nowa tabela wymusiła aktualizację testu).
(c) `set_eq` funkcji z `EXECUTE` dla `anon` i osobno dla `authenticated` względem literalnych allowlist; `PUBLIC` nie ma `EXECUTE` na żadnej funkcji `public`. Allowlistę uzgodnić z żywą bazą przed zapisem (m.in. czy `search_gminas` i `normalize_pl` istnieją i dla kogo), ale oracle pozostaje wyprowadzony z `revoke`/`grant` w migracjach, nie z wyniku zapytania.

### Success Criteria:

#### Automated Verification:

- Nowy plik przechodzi razem z istniejącymi testami bazy: `supabase test db`
- Kontrola uprawnień nadal zielona: `supabase db query --local -f scripts/check-table-grants.sql`

#### Manual Verification:

- Po przebiegu w bazie nie ma żadnych śladów fikstur (sanity transakcji wycofanej)

**Implementation Note**: Po fazie i zielonych kontrolach automatycznych zatrzymaj się na potwierdzenie weryfikacji ręcznej przed następną fazą. Pola wyboru dla tych punktów są w sekcji `## Progress`.

---

## Faza 2: Macierz odmów zapisu z impersonacją (pgTAP)

### Overview

Plik pgTAP dowodzący, że inny opiekun, koordynator i anon nie zmieniają, nie usuwają ani nie wstawiają cudzych danych bezpośrednio przez rolę bazy, oraz że rola konta nie jest zapisywalna.

### Changes Required:

#### 1. Test odmów zapisu

**File**: `supabase/tests/database/write_boundaries.test.sql` (nowy)

**Intent**: Pierwsze użycie `authenticated` z JWT claims w tym repo. Ofiara V (opiekun z kompletnym profilem, kontaktem, gminą, usługą, dostępnością), atakujący M (inny opiekun z własnym profilem), koordynator C i anon próbują zapisów, których macierz nie przewiduje. Po każdej próbie wiersz ofiary jest czytany jako `postgres` i musi być bez zmian.

**Contract**: Fikstury jako `postgres`: stałe UUID w zakresie `b0000000-…` (osobnym od `a0000000-…` z Phase 1), gminy pod prefiksem `9999`, jawny `updated_at`. Pierwsza asercja: `auth.uid()` pod claims M równe `sub` M. Grupy (oracle w komentarzu nad każdą, wyprowadzony z macierzy zapisu w research.md i polityk migracji):

- `caregiver_contacts`: M `UPDATE` kontaktu V → 0 wierszy; M `INSERT` kontaktu dla V → RLS; C `UPDATE` → 0 wierszy; M `DELETE` → brak uprawnienia; anon → brak uprawnienia. Kontrola pozytywna: M zmienia własny kontakt (1 wiersz).
- `caregiver_profiles`: M `UPDATE` cudzego → 0 wierszy; M `UPDATE` własnego z `user_id := V` → RLS (with check); M `INSERT` z `user_id` V → RLS; C `INSERT` własnego profilu → RLS (rola); anon `UPDATE` → brak uprawnienia.
- `caregiver_gminas`, `caregiver_services`, `caregiver_availability`: M `INSERT` wiersza dla V → RLS; M i C `DELETE` wiersza V → 0 wierszy; anon `INSERT`/`DELETE` → brak uprawnienia; `UPDATE` na tych trzech → brak uprawnienia (brak grantu). Kontrola pozytywna: M wstawia i usuwa własny wiersz.
- Limit gmin: M jako `authenticated` z claims wstawia 30 gmin (OK) i 31. → błąd 22023 „Możesz wybrać najwyżej 30 gmin."; 31 gmin fikstur zgodnych z ograniczeniami tabeli `gminas` (sprawdzić constraint przed doborem kodów).
- `accounts`: M, C i anon `INSERT`/`UPDATE`/`DELETE` → brak uprawnienia; po próbie `UPDATE … set role = 'coordinator'` przez M rola M odczytana jako `postgres` nadal `caregiver`, a M nadal nie czyta kontaktu V (łańcuch dowodu integralności roli).
- `save_caregiver_profile`: anon → brak `EXECUTE`; C wywołuje funkcję (ma `EXECUTE` jako `authenticated`) → błąd z polityki roli, profil nie powstaje.

### Success Criteria:

#### Automated Verification:

- Wszystkie pliki bazy zielone: `supabase test db`
- Pierwsza asercja pliku potwierdza działającą impersonację (`auth.uid()` = podany `sub`), widoczna w wyjściu `supabase test db`

#### Manual Verification:

- Po przebiegu w bazie brak gmin `9999%`, użytkowników `b0000000-…` i innych śladów fikstur

**Implementation Note**: Po fazie i zielonych kontrolach automatycznych zatrzymaj się na potwierdzenie weryfikacji ręcznej przed następną fazą.

---

## Faza 3: Smoke — luki #3 i sondy #4

### Overview

Kroki w `scripts/smoke.mjs`, które pokrywają ścieżkę embed PostgREST (omija aplikację), `GET` koordynatora na API profilu oraz dwie sondy semantyki PostgREST (0 wierszy zamiast błędu, zapis do `accounts`).

### Changes Required:

#### 1. Kroki smoke dla #3 i #4

**File**: `scripts/smoke.mjs`

**Intent**: Dodać kroki obok istniejących kroków tego samego użytkownika, bez zmiany istniejących. Oracle: sekrety z fikstur (`contactEmail`, `+48600100200`, `+48600100300`), nigdy z odpowiedzi.

**Contract**: Nowe kroki (nazwy po angielsku jak reszta):

- `anon cannot embed caregiver contacts`: `GET /rest/v1/caregiver_profiles?select=user_id,caregiver_contacts(phone,email)` bez tokenu → 401 + `deniesTable("caregiver_contacts")`.
- `caregiver embed shows no foreign contacts`: ten sam zapytanie z `secondCaregiverToken` → 200; w `JSON.stringify` odpowiedzi nie ma `contactEmail`, `+48600100200` ani `600100200`, a kontrola pozytywna: wiersz drugiego opiekuna zawiera jego własny `+48600100300`.
- `coordinator cannot read profile API`: `GET /api/caregiver/profile` w sesji koordynatora → 403 (obok kroku `PUT` ok. `:853`).
- `other caregiver cannot update a contact`: `PATCH /rest/v1/caregiver_contacts?caregiver_id=eq.<caregiverId>` z `secondCaregiverToken` i `return=representation` → 200 + `[]`; potem odczyt kontaktu pierwszego opiekuna tokenem koordynatora (kompletny profil) nadal zwraca oryginalny telefon i e-mail (wzorzec `:949-975`).
- `caregiver cannot change account role`: `PATCH /rest/v1/accounts?user_id=eq.<secondCaregiverId>` `{role: "coordinator"}` z tokenem drugiego opiekuna → 403 + `deniesTable("accounts")`; oraz krok z `PUT /auth/v1/user` `{data: {role: "coordinator"}}`, po którym odczyt własnego wiersza `accounts` nadal zwraca `caregiver`, a odczyt kontaktu pierwszego opiekuna tym tokenem dalej zwraca `[]`.

### Success Criteria:

#### Automated Verification:

- Lint przechodzi: `npm run lint`
- Typy przechodzą: `npx astro check`
- Budowa i smoke na świeżym preview: `npm run build` oraz `npm run smoke` (po zatrzymaniu nieaktualnego preview na :4321)

#### Manual Verification:

- Drugi przebieg `npm run smoke` na tej samej bazie też przechodzi (stan kumuluje się między uruchomieniami)

**Implementation Note**: Po fazie i zielonych kontrolach automatycznych zatrzymaj się na potwierdzenie weryfikacji ręcznej przed następną fazą.

---

## Faza 4: Smoke — cykl formularza #6

### Overview

Dowód, że cykl, który wykonuje formularz (odczyt profilu, zmiana jednego pola, zapis całości), zostawia wszystkie pozostałe pola bez zmian, sprawdzony niezależnym odczytem. Dotyczy każdego pola: nazwy, opisu, telefonu, e-maila, gmin, usług, terminów.

### Changes Required:

#### 1. Kroki cyklu zapisu

**File**: `scripts/smoke.mjs`

**Intent**: Szósty opiekun (nowe konto przez aplikację) zakładany na końcu tablicy `steps`; zapis pełnego profilu z wartościami różnymi od fikstur innych kroków, potem po jednym kroku na pole: `GET /api/caregiver/profile`, zmiana dokładnie jednego pola, `PUT` pełnego polecenia zbudowanego z `GET`, następnie porównanie **wszystkich** pól z oczekiwaniem.

**Contract**: Lokalny obiekt `expected` (stałe fikstury plus kumulatywnie zastosowane zmiany z kolejnych kroków) jest oracle. Każdy krok sprawdza pełną równość z `expected` w dwóch niezależnych źródłach: (1) odpowiedź `GET` API, (2) odczyt przez PostgREST: `get_public_caregiver` (nazwa, opis, gminy, usługi, terminy) oraz kontakt tokenem właściciela (telefon, e-mail). Edycje: nazwa, opis, telefon (normalizacja do `+48…`), e-mail, gminy (inny zestaw), usługi, terminy oraz wyczyszczenie opisu pustym ciągiem (→ brak opisu, reszta bez zmian). Dodatkowo rozszerzyć asercję istniejącego kroku `profile save normalizes phone and completes profile` (`scripts/smoke.mjs:318`) o gminy, usługi, e-mail i opis.

### Success Criteria:

#### Automated Verification:

- Lint przechodzi: `npm run lint`
- Smoke na świeżym preview przechodzi: `npm run build` oraz `npm run smoke`

#### Manual Verification:

- Drugi przebieg `npm run smoke` na tej samej bazie też przechodzi

**Implementation Note**: Po fazie i zielonych kontrolach automatycznych zatrzymaj się na potwierdzenie weryfikacji ręcznej przed następną fazą.

---

## Faza 5: Dowód czułości i cookbook

### Overview

Dowód mutacjami dla każdego nowego testu (wzorzec test-plan §6.1/§6.3) oraz uzupełnienie dokumentacji testów.

### Changes Required:

#### 1. Dowód mutacjami

**File**: `context/foundation/test-plan.md` (wynik w §6.5), mutacje wykonywane w scratchpadzie lub na lokalnej bazie i cofane

**Intent**: Dla każdego nowego pliku/grupy kroków jedna realistyczna mutacja, czerwony przebieg, przywrócenie i zielony przebieg.

**Contract**: Mutacje (każda cofnięta; po cofnięciu migawka `pg_policies` i `pg_get_functiondef` identyczna, `git diff --stat src/ supabase/migrations` puste):

- `grants_matrix`: `grant delete on public.caregiver_contacts to authenticated` oraz nowa funkcja `public` bez `revoke execute` → czerwone.
- `write_boundaries`: polityka `update` na `caregiver_contacts` z `using (true)`; usunięcie warunku roli z polityki `insert` profilu; usunięcie wyzwalacza limitu; `grant update on public.accounts to authenticated` z permisywną polityką → czerwone.
- Smoke #3/#4: `grant select on public.caregiver_contacts to anon` (embed); zdjęcie sprawdzenia roli w `guard()` (`GET` koordynatora); poluzowana polityka update kontaktu (sonda PATCH).
- Smoke #6: mutacja w ścieżce zapisu gubiąca jedno pole (np. e-mail ignorowany przy upsercie kontaktu w RPC lub pominięty opis w `saveOwnProfile`) → czerwony krok tego pola.

#### 2. Cookbook, status i komentarze

**File**: `context/foundation/test-plan.md`, `scripts/smoke.mjs` (komentarz nagłówkowy), `.github/workflows/ci.yml` (komentarz kroku „Run database tests")

**Intent**: Wypełnić §6.2 (jak dodać krok smoke: wzorzec nieobecności kontaktu po pełnym body, wzorzec „0 wierszy + odczyt ofiary"), §6.4 (jak testować nową tabelę/politykę: macierz w `grants_matrix`, odmowy w `write_boundaries`, impersonacja), §6.5 (notatki Phase 3 z wynikami mutacji), ustawić wiersz Phase 3 w §3 na `done`, odświeżyć §5 (bramki pgTAP: macierz i odmowy) oraz §8; zaktualizować komentarz nagłówkowy smoke i opis kroku CI, żeby wymieniały nowe pliki pgTAP.

### Success Criteria:

#### Automated Verification:

- Wszystkie mutacje dały czerwony wynik, a po cofnięciu `git diff --stat src/ supabase/migrations` jest puste
- Pełny zestaw przed pushem: `npm run lint`, `npx astro check`, `npm run build`, `supabase test db`, `npm run smoke`, `npm run e2e`

#### Manual Verification:

- §6.2, §6.4, §6.5, §3, §5 i §8 w `test-plan.md` są spójne ze sobą i z faktycznymi plikami testów
- Wyniki mutacji w §6.5 podają dla każdego testu mutację i czerwony/zielony wynik

**Implementation Note**: Po fazie i zielonych kontrolach automatycznych zatrzymaj się na potwierdzenie weryfikacji ręcznej.

---

## Testing Strategy

### Unit Tests:

- Nie dotyczy: logika zapisu żyje w bazie (RLS, RPC), więc najtańszy realny sygnał to pgTAP i smoke (test-plan §4).

### Integration Tests:

- pgTAP: macierz uprawnień i RLS (faza 1), odmowy zapisu z impersonacją (faza 2).
- Smoke: embed, `GET` koordynatora, sondy PostgREST (faza 3), cykl formularza dla siedmiu pól (faza 4).
- Przypadki brzegowe nazwane wprost: 31. gmina przy `auth.uid()` ustawionym i 30. akceptowana; `UPDATE` zmieniający `user_id` na ofiarę (with check); `UPDATE accounts.role`; wyczyszczenie opisu pustym ciągiem; embed jako opiekun nie-właściciel.

### Manual Testing Steps:

1. Po fazach 1–2: `supabase test db`, potem `supabase db query --local` na zapytanie o `b0000000-%` i gminy `9999%` (brak śladów).
2. Po fazach 3–4: dwa przebiegi `npm run smoke` z rzędu na tym samym lokalnym Supabase (po restarcie nieaktualnego preview na :4321).
3. Po fazie 5: przeczytać §6 w `test-plan.md` jako nowy współpracownik i sprawdzić, czy wystarczy do dodania kroku smoke i testu nowej tabeli.

## Performance Considerations

`supabase test db` rośnie o dwa pliki w jednej transakcji każdy (sekundy). Smoke rośnie o około 20 kroków i jedno konto; lokalna baza kumuluje użytkowników, jak dotychczas. Brak wpływu na produkcję.

## Migration Notes

Brak migracji i zmian schematu. Mutacje z fazy 5 robić tylko na lokalnej bazie i zawsze cofać; produkcyjnej bazy nie dotykamy.

## References

- Related research: `context/changes/testing-contact-and-write-boundaries/research.md`
- Test plan: `context/foundation/test-plan.md` §2 (ryzyka #3, #4, #6), §3 Phase 3, §6.1 (wzorzec pgTAP), §6.3 (dowód mutacjami)
- Wzorzec pgTAP: `supabase/tests/database/search_caregivers_gmina.test.sql`
- Wzorzec „0 wierszy + odczyt ofiary": `scripts/smoke.mjs:949-975`
- Macierz uprawnień: `supabase/migrations/20261104160000_caregiver_profile_delete.sql:19-26`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Macierz uprawnień i allowlista EXECUTE (pgTAP)

#### Automated

- [x] 1.1 Nowy plik przechodzi razem z istniejącymi testami bazy: `supabase test db` — 2fa86e9
- [x] 1.2 Kontrola uprawnień nadal zielona: `supabase db query --local -f scripts/check-table-grants.sql` — 2fa86e9

#### Manual

- [x] 1.3 Po przebiegu w bazie nie ma żadnych śladów fikstur (sanity transakcji wycofanej) — 2fa86e9

### Phase 2: Macierz odmów zapisu z impersonacją (pgTAP)

#### Automated

- [x] 2.1 Wszystkie pliki bazy zielone: `supabase test db` — d795242
- [x] 2.2 Pierwsza asercja pliku potwierdza działającą impersonację (`auth.uid()` = podany `sub`), widoczna w wyjściu `supabase test db` — d795242

#### Manual

- [x] 2.3 Po przebiegu w bazie brak gmin `9999%`, użytkowników `b0000000-…` i innych śladów fikstur — d795242

### Phase 3: Smoke — luki #3 i sondy #4

#### Automated

- [x] 3.1 Lint przechodzi: `npm run lint` — 6d8234a
- [x] 3.2 Typy przechodzą: `npx astro check` — 6d8234a
- [x] 3.3 Budowa i smoke na świeżym preview: `npm run build` oraz `npm run smoke` (po zatrzymaniu nieaktualnego preview na :4321) — 6d8234a

#### Manual

- [x] 3.4 Drugi przebieg `npm run smoke` na tej samej bazie też przechodzi (stan kumuluje się między uruchomieniami) — 6d8234a

### Phase 4: Smoke — cykl formularza #6

#### Automated

- [ ] 4.1 Lint przechodzi: `npm run lint`
- [ ] 4.2 Smoke na świeżym preview przechodzi: `npm run build` oraz `npm run smoke`

#### Manual

- [ ] 4.3 Drugi przebieg `npm run smoke` na tej samej bazie też przechodzi

### Phase 5: Dowód czułości i cookbook

#### Automated

- [ ] 5.1 Wszystkie mutacje dały czerwony wynik, a po cofnięciu `git diff --stat src/ supabase/migrations` jest puste
- [ ] 5.2 Pełny zestaw przed pushem: `npm run lint`, `npx astro check`, `npm run build`, `supabase test db`, `npm run smoke`, `npm run e2e`

#### Manual

- [ ] 5.3 §6.2, §6.4, §6.5, §3, §5 i §8 w `test-plan.md` są spójne ze sobą i z faktycznymi plikami testów
- [ ] 5.4 Wyniki mutacji w §6.5 podają dla każdego testu mutację i czerwony/zielony wynik
