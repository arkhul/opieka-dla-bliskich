# Trwałe usunięcie profilu opiekuna — plan implementacji

## Overview

Opiekun po zalogowaniu usuwa z `/profil` swój profil na zawsze: część publiczną, dane kontaktowe, gminy, usługi i dostępność. Profil od razu znika z listy `/opiekunowie`, ze strony `/opiekunowie/<id>` i ze strony `/kontakt/<id>`. Konto logowania i rola zostają, więc opiekun może później założyć nowy profil. Realizuje to slice S-06 roadmapy i NFR z PRD: „Opiekun może trwale usunąć swój profil wraz z danymi kontaktowymi; po usunięciu profil nie pojawia się w żadnych wynikach” (`context/foundation/prd.md:134`, FR-003).

## Current State Analysis

- Każda tabela zależna ma `on delete cascade` od `caregiver_profiles.user_id`: `caregiver_contacts`, `caregiver_gminas`, `caregiver_services` (`supabase/migrations/20261103150000_caregiver_profiles.sql`) oraz `caregiver_availability` (`supabase/migrations/20261104120000_caregiver_availability.sql:39`). Usunięcie wiersza profilu usuwa więc wszystkie jego dane. Kaskada FK działa z uprawnieniami właściciela tabel, dlatego RLS i granty tabel zależnych (np. brak `delete` na `caregiver_contacts`) jej nie blokują.
- `caregiver_profiles` nie ma polityki ani grantu DELETE. Komentarz w `20261103150000_caregiver_profiles.sql` mówi wprost: „No delete policy (profile removal is a later slice)”. Obecna macierz grantów (`20261103230000_table_grants_mirror_policies.sql`): `authenticated` ma na `caregiver_profiles` tylko `select, insert, update`.
- Widoczność w wynikach jest liczona na żywo w SQL (`search_caregivers`, `get_public_caregiver`). Strony publiczne nie mają cache'u, a sitemap jest statyczny. Profil zniknie więc w chwili usunięcia wiersza. `/opiekunowie/[id].astro:29,40` i `/kontakt/[id].astro:33,54` już zwracają 404, gdy profil nie istnieje.
- API profilu (`src/pages/api/caregiver/profile.ts`) ma `guard()`: 401 bez sesji, 503 bez Supabase, 403 dla kogoś, kto nie jest opiekunem. Ma też helper `json()` z `Cache-Control: private, no-store`. Jest w nim `GET` i `PUT`, nie ma `DELETE`.
- `/profil` (`src/pages/profil/index.astro`) to strona `.astro`, która już ma pusty stan „Nie masz jeszcze profilu… Utwórz profil”. Komponent `src/components/ui/dialog.tsx` jest zainstalowany, ale nigdzie nie jest jeszcze używany. Wzorzec wywołania API z wyspy React to `fetch` + `window.location.assign` (`src/components/caregiver/CaregiverProfileForm.tsx:115-126`).
- Aplikacja zna tylko klucz `anon` (`astro.config.mjs:21-22`). Klucza service-role nie ma i ta zmiana go nie potrzebuje.

## Desired End State

Na `/profil` opiekun z profilem widzi przycisk „Usuń profil”. Przycisk otwiera okno dialogowe z ostrzeżeniem o nieodwracalności. Po potwierdzeniu opiekun trafia na `/profil?usunieto=1`, gdzie widzi komunikat „Profil został usunięty” nad pustym stanem „Utwórz profil”. W bazie nie ma już wiersza profilu ani żadnego wiersza zależnego. `search_caregivers` go nie zwraca, a `/opiekunowie/<id>` i `/kontakt/<id>` dają 404. Przez REST Supabase tylko właściciel może usunąć swój profil: inny opiekun i koordynator nie usuwają niczego, a `anon` nie ma uprawnienia do tabeli. Weryfikacja: `npm run smoke` z nowymi krokami bazy i API/stron oraz przejście tego przepływu na wdrożonym Workerze.

### Key Discoveries:

- Kaskady wszystkich tabel zależnych: `20261103150000_caregiver_profiles.sql` (contacts, gminas, services), `20261104120000_caregiver_availability.sql:39` (availability).
- Wzorzec polityk (jedna na operację i rolę, `(select auth.uid())`) i grantów (`revoke all` + jawne granty): `20261103150000_caregiver_profiles.sql`, `20261103230000_table_grants_mirror_policies.sql`.
- PostgREST z RLS: `DELETE` cudzego wiersza nie zwraca błędu, tylko 0 usuniętych wierszy. Serwis musi więc poprosić o zwrot usuniętych wierszy (`.select()`), żeby odróżnić „usunięto” od „nie było czego usunąć”. Wymaga to polityki SELECT, którą `authenticated` już ma (`using (true)`).
- Smoke trzyma jedną sesję aplikacji w `jar` (`scripts/smoke.mjs:35-58`). Konta testowe zakłada przez `/auth/v1/signup` z tokenem (`:396-403`) albo przez `/api/auth/signup` (sesja w `jar`, `:880-887`). `deniesTable()` (`:105`) rozpoznaje brak uprawnienia do tabeli.

## What We're NOT Doing

- Nie usuwamy konta logowania (`auth.users`, `public.accounts`). E-mail logowania zostaje i opiekun może założyć nowy profil. Usunięcie całego konta, także dla koordynatorów, to osobna zmiana.
- Nie robimy miękkiego usuwania (flaga `deleted_at`) ani okresu na cofnięcie. Usunięcie jest twarde i natychmiastowe.
- Nie czyścimy kopii zapasowych ani PITR Supabase. Dane wygasają z nich zgodnie z retencją planu Supabase.
- Nie wpisujemy słowa do potwierdzenia. Wystarcza okno dialogowe z dwoma przyciskami.
- Nie blokujemy ponownego zapisu z otwartej w innej karcie edycji profilu. `save_caregiver_profile()` po usunięciu założy profil od nowa i to jest świadoma akcja właściciela.
- Nie dodajemy logu usunięć ani powiadomień dla koordynatorów, którzy wcześniej widzieli kontakt.
- Nie dodajemy nowej trasy: `/profil` jest już w `PROTECTED_ROUTES`, a endpoint ma własny `guard()`.

## Implementation Approach

Baza robi całą pracę. Jedna polityka DELETE pod RLS i jeden grant pozwalają właścicielowi usunąć wiersz `caregiver_profiles`, a kaskady FK czyszczą resztę. Nie ma funkcji `SECURITY DEFINER` ani nowego sekretu. Aplikacja dostaje cienką warstwę: funkcję serwisu, `DELETE` w istniejącym endpoincie profilu i małą wyspę React z oknem dialogowym na `/profil`. Kolejność wdrożenia: baza → Worker. Stary Worker nie ma przycisku, więc nowa polityka bez nowego kodu niczego nie psuje.

## Phase 1: Usuwanie w bazie

### Overview

Migracja pozwala właścicielowi usunąć swój profil przez RLS. Smoke dowodzi na poziomie REST Supabase, że tylko właściciel może usunąć profil, że kaskada czyści wszystkie dane i że profil znika z obu funkcji wyszukiwania.

### Changes Required:

#### 1. Migracja

**File**: `supabase/migrations/20261104160000_caregiver_profile_delete.sql`

**Intent**: Otworzyć usuwanie profilu wyłącznie jego właścicielowi, zgodnie z regułą „jedna polityka na operację i rolę” i z grantami równymi politykom.

**Contract**:

- Nagłówek: cel (S-06), decyzja „tylko profil, konto zostaje”, informacja, że kaskady FK z `caregiver_contacts`, `caregiver_gminas`, `caregiver_services` i `caregiver_availability` usuwają dane zależne z uprawnieniami właściciela tabel (bez grantów `delete` na tych tabelach). Wynikowy wiersz macierzy: `caregiver_profiles` — `anon: select; authenticated: select, insert, update, delete`.
- `create policy caregiver_profiles_delete_authenticated on public.caregiver_profiles for delete to authenticated using (user_id = (select auth.uid()));`. Bez sprawdzania roli: wiersz profilu i tak może istnieć tylko dla opiekuna (polityka insert).
- `grant delete on public.caregiver_profiles to authenticated;`. Bez `revoke all`, bo tabela już ma jawne granty z `20261103230000`. Brak grantu dla `anon`.
- `comment on policy …`: tylko właściciel; kaskada usuwa kontakt, gminy, usługi i dostępność.

#### 2. Smoke: baza

**File**: `scripts/smoke.mjs`

**Intent**: Dowieść na REST Supabase reguł dostępu, kaskady i zniknięcia profilu z wyników, na osobnym profilu, żeby nie ruszać profili używanych przez inne kroki.

**Contract**:

- Nowe konto `smoke-caregiver4-${stamp}@example.com` (zmienne `deletableCaregiverId`, `deletableCaregiverToken`) zakładane przez `/auth/v1/signup` z `role: "caregiver"`, jak drugi opiekun (`:396-403`). Kompletny profil „Dorota Smoke” zapisany przez RPC `save_caregiver_profile` (telefon, gmina `1465011`, co najmniej jedna usługa i jeden termin).
- Kroki, w tej kolejności, dodane po krokach dostępności (przed sekcją stron):
  - „deletable profile is listed”: `search_caregivers` z `p_teryt: "1465011", p_limit: 50` (jak w istniejących krokach) jako anon zawiera `deletableCaregiverId`.
  - „anon cannot delete a caregiver profile”: `DELETE /rest/v1/caregiver_profiles?user_id=eq.<id>` bez tokenu → 401, `deniesTable("caregiver_profiles")`.
  - „other caregiver cannot delete a profile”: ten sam `DELETE` z `secondCaregiverToken` i `Prefer: return=representation` → 200 z pustą tablicą. Potem `get_public_caregiver(<id>)` nadal ma jeden wiersz.
  - „coordinator cannot delete a profile”: to samo z `coordinatorToken`.
  - „caregiver deletes own profile”: `DELETE` z `deletableCaregiverToken` i `Prefer: return=representation` → 200, jeden wiersz z `user_id = <id>`.
  - „deleted profile leaves no data”: z tokenem właściciela `caregiver_contacts?caregiver_id=eq.<id>` pusty. Jako anon `caregiver_gminas`, `caregiver_services` i `caregiver_availability` z `caregiver_id=eq.<id>` puste. `caregiver_profiles?user_id=eq.<id>` pusty.
  - „deleted profile is gone from search”: `search_caregivers` z `p_teryt: "1465011", p_limit: 50` nie zawiera `<id>`, a `get_public_caregiver(<id>)` zwraca pustą tablicę.
- Helper `supabase()` (`:89`) dostaje opcjonalne nagłówki (np. `prefer`), jeśli dziś ich nie przyjmuje. Pozostałe wywołania bez zmian.
- Komentarz nagłówka (`:1-16`): usunięcie profilu przez właściciela, kaskada, zniknięcie z wyników, odmowa dla innych.

### Success Criteria:

#### Automated Verification:

- Wszystkie migracje stosują się od zera: `npx supabase db reset`
- Lint bazy bez błędów: `npx supabase db lint --level error`
- Kontrola grantów przechodzi: `npx supabase db query --local -f scripts/check-table-grants.sql`
- Lint i typy: `npm run lint` i `npx astro check`
- Smoke przechodzi z nowymi krokami bazy: `npm run smoke` (na świeżym `npm run build` + `npm run preview`)

#### Manual Verification:

- W psql lokalnie `select grantee, privilege_type from information_schema.role_table_grants where table_name = 'caregiver_profiles' and grantee in ('anon','authenticated') order by 1, 2` pokazuje `anon: SELECT` i `authenticated: DELETE, INSERT, SELECT, UPDATE`
- `select policyname, cmd, roles from pg_policies where tablename = 'caregiver_profiles'` pokazuje jedną politykę `DELETE` dla `{authenticated}`

**Implementation Note**: Po przejściu weryfikacji automatycznej zatrzymaj się na ręczne potwierdzenie, zanim przejdziesz do fazy 2.

---

## Phase 2: Przycisk i API

### Overview

Opiekun usuwa profil z `/profil` przez okno dialogowe, a endpoint `DELETE /api/caregiver/profile` wywołuje serwis. Po usunięciu strona potwierdza wynik. Smoke przechodzi ten przepływ przez aplikację.

### Changes Required:

#### 1. Serwis

**File**: `src/lib/services/caregiver.service.ts`

**Intent**: Jedna funkcja, która usuwa profil wywołującego i mówi, czy było co usunąć.

**Contract**: `deleteOwnProfile(supabase: SupabaseClient, userId: string): Promise<boolean>`. Wykonuje `from("caregiver_profiles").delete().eq("user_id", userId).select("user_id")`. Zwraca `true`, gdy wrócił co najmniej jeden wiersz, a `false`, gdy żaden (brak profilu). Błąd → `Error("Failed to delete caregiver profile: …")`, jak w pozostałych funkcjach. Komentarz: kaskada w bazie usuwa kontakt, gminy, usługi i dostępność; RLS pozwala usunąć tylko własny wiersz.

#### 2. Endpoint

**File**: `src/pages/api/caregiver/profile.ts`

**Intent**: Usuwanie przez ten sam endpoint i tę samą bramkę co odczyt i zapis profilu.

**Contract**: `export const DELETE: APIRoute`: `guard()` (401/503/403 bez zmian) → `deleteOwnProfile(access.supabase, access.userId)`. Wynik `true` → `json({ deleted: true })` (200). Wynik `false` → `json({ error: "Nie masz profilu do usunięcia." }, 404)`. Wyjątek → `json({ error: "Nie udało się usunąć profilu." }, 500)`. Bez ciała żądania i bez zoda (nie ma wejścia do walidacji).

#### 3. Okno dialogowe

**File**: `src/components/caregiver/DeleteProfileDialog.tsx` (nowy)

**Intent**: Nieodwracalna akcja wymaga świadomego potwierdzenia, a komponent potrzebuje stanu klienta, więc to wyspa React.

**Contract**:

- `Dialog` z `@/components/ui/dialog` i `Button` z `@/components/ui/button`. Wyzwalacz: przycisk „Usuń profil” w wariancie destrukcyjnym albo obrysowanym na czerwono. Tytuł: „Usunąć profil na zawsze?”. Opis: profil, dane kontaktowe, gminy, usługi i dostępność zostaną trwale usunięte, koordynatorzy przestaną widzieć profil, tej operacji nie można cofnąć, konto logowania zostaje i można później założyć nowy profil. Przyciski: „Anuluj” (zamyka) i „Usuń na zawsze”.
- Potwierdzenie: `fetch("/api/caregiver/profile", { method: "DELETE" })`. Podczas żądania oba przyciski są nieaktywne, a przycisk potwierdzenia ma tekst „Usuwanie…”. 200 → `window.location.assign("/profil?usunieto=1")`. 404 → `window.location.assign("/profil")` (profil zniknął już wcześniej, np. w innej karcie). 401 → `window.location.assign("/auth/signin")`. Inny status albo błąd sieci → komunikat w oknie (`error` z odpowiedzi albo „Nie udało się usunąć profilu. Spróbuj ponownie.”) przez `ServerError` z `@/components/auth/ServerError` i odblokowane przyciski.
- Warunkowe klasy przez `cn()`.

#### 4. Strona profilu

**File**: `src/pages/profil/index.astro`

**Intent**: Akcja jest dostępna z widoku własnego profilu (FR-003), a po usunięciu strona to potwierdza.

**Contract**:

- `<DeleteProfileDialog client:load />` w gałęzi z profilem, pod „Edytuj profil”, oddzielony wizualnie (np. sekcja „Usuwanie profilu” z górną krawędzią), żeby nie stał tuż obok edycji.
- `const deleted = Astro.url.searchParams.get("usunieto") === "1"`. Gdy `deleted` i `!profile` i `!pageError`: zielony komunikat „Profil został usunięty. Koordynatorzy już go nie widzą.” (styl jak „Profil jest kompletny”) nad pustym stanem. Gdy profil istnieje (założony od nowa), parametr jest ignorowany.

#### 5. Smoke: API i strony

**File**: `scripts/smoke.mjs`

**Intent**: Dowieść przepływu z aplikacji: bramki, usunięcia, komunikatu i 404 na stronach publicznych.

**Contract**:

- Nowe kroki w sekcji opiekuna, gdzie `jar` trzyma sesję pierwszego opiekuna:
  - „profile delete requires a caregiver”: tam, gdzie `jar` trzyma sesję koordynatora (obok `:812`), `DELETE /api/caregiver/profile` → 403.
  - „profile delete requires a session”: obok `:789` (bez sesji) → 401.
- Na końcu listy kroków, po krokach nowego koordynatora (`:880-893`): rejestracja `smoke-caregiver5-${stamp}@example.com` przez `/api/auth/signup` z `role: "caregiver"`, czyli sesja w `jar`. Zmienna `appDeletableCaregiverId` z `GET /api/caregiver/profile` po zapisie albo z odpowiedzi `PUT`. Kroki:
  - „caregiver saves profile to delete”: `PUT /api/caregiver/profile` z kompletnym profilem „Ewa Smoke” (gmina `1465011`) → 200.
  - „profile page offers deletion”: `/profil` → 200, HTML zawiera „Usuń profil”.
  - „caregiver deletes profile via API”: `DELETE /api/caregiver/profile` → 200, `{ deleted: true }`.
  - „second delete finds no profile”: `DELETE /api/caregiver/profile` → 404.
  - „profile page confirms deletion”: `/profil?usunieto=1` → 200, HTML zawiera „Profil został usunięty” i „Utwórz profil”, nie zawiera „Usuń profil”.
  - „deleted profile page is 404”: `/opiekunowie/<id>` → 404.
  - „deleted profile is not on the list”: `/opiekunowie?gmina=1465011` → 200, HTML nie zawiera `/opiekunowie/${appDeletableCaregiverId}`. Sprawdzenie idzie po id, nie po nazwie: lokalna baza zbiera profile ze wszystkich przebiegów, więc „Ewa Smoke” pozostawiona przez przerwany przebieg psułaby ten krok aż do `db reset`.
- Komentarz nagłówka uzupełniony o kroki aplikacji.

#### 6. README

**File**: `README.md`

**Intent**: Opis smoke odpowiada nowym krokom.

**Contract**: W akapicie „Smoke sprawdza też…” (`## Smoke test`) dodać: `DELETE /api/caregiver/profile` (401 bez sesji, 403 dla koordynatora, 200 i 404 przy drugim wywołaniu), komunikat na `/profil?usunieto=1`, 404 strony `/opiekunowie/<id>` i brak na liście po usunięciu oraz kroki REST (usuwa tylko właściciel, `anon` bez uprawnienia, kaskada czyści kontakt, gminy, usługi i dostępność). Zdanie o kontach: „siedem kont `smoke-*@example.com` (pięciu opiekunów i dwóch koordynatorów)”, a profile „Dorota Smoke” i „Ewa Smoke” są usuwane w trakcie przebiegu.

### Success Criteria:

#### Automated Verification:

- Lint i typy: `npm run lint` i `npx astro check`
- Build: `npm run build`
- Smoke przechodzi z krokami API i stron: `npm run smoke`

#### Manual Verification:

- Opiekun z kompletnym profilem na `/profil` klika „Usuń profil”: okno pokazuje ostrzeżenie, „Anuluj” zamyka je bez zmian, a „Usuń na zawsze” przenosi na `/profil?usunieto=1` z komunikatem i przyciskiem „Utwórz profil”
- Po usunięciu profil nie jest widoczny na `/opiekunowie` z jego gminą, `/opiekunowie/<id>` daje 404, a zalogowany koordynator na `/kontakt/<id>` widzi stronę 404 bez telefonu
- W psql lokalnie po usunięciu nie ma wierszy z tym `user_id`/`caregiver_id` w `caregiver_profiles`, `caregiver_contacts`, `caregiver_gminas`, `caregiver_services` i `caregiver_availability`, a wiersz w `accounts` i `auth.users` zostaje
- Na 375 px okno dialogowe mieści się na ekranie, przyciski są osiągalne, a fokus wraca na przycisk po „Anuluj” i działa klawiszem Esc

**Implementation Note**: Po przejściu weryfikacji automatycznej zatrzymaj się na ręczne potwierdzenie, zanim przejdziesz do fazy 3.

---

## Phase 3: Wdrożenie produkcyjne

### Overview

Migracja i kod z faz 1–2 trafiają na produkcję w kolejności baza → Worker. Potem przepływ jest weryfikowany na wdrożonym Workerze na tymczasowym koncie opiekuna, które na koniec jest sprzątane.

### Changes Required:

#### 1. Migracja na produkcji

**File**: brak zmian w repo (operacja)

**Intent**: Produkcyjna baza pozwala właścicielowi usunąć profil, zanim pojawi się przycisk.

**Contract**: Najpierw zanotować „Wyniki: N” z produkcyjnego `/opiekunowie` bez filtrów (punkt odniesienia). Potem, z commita scalonego do `master`: `npx supabase db push`. Przed wykonaniem pytam użytkownika o zgodę.

#### 2. Wdrożenie Workera

**File**: brak zmian w repo (operacja)

**Intent**: Przycisk i endpoint działają na wdrożonym Workerze.

**Contract**: `npm run build` i `npx wrangler deploy` (procedura z `README.md` §Deployment). Przed wykonaniem pytam użytkownika o zgodę. Potwierdzenie przez `npx wrangler deployments list`.

#### 3. Weryfikacja na produkcji i sprzątanie

**File**: brak zmian w repo (operacja)

**Intent**: Potwierdzić outcome S-06 na prawdziwym środowisku, bez zostawiania danych testowych.

**Contract**: Najpierw sprawdzić, czy produkcja wymaga potwierdzenia e-maila (PRD Open Question 1, lokalnie jest wyłączone w `supabase/config.toml:209`): `GET <SUPABASE_URL produkcji>/auth/v1/settings` z nagłówkiem `apikey` (klucz anon) i odczytać `mailer_autoconfirm`. Gdy `true`, adres konta testowego to `s06-check-<data>@example.com`. Gdy `false` (domyślny SMTP Supabase i tak nie wyśle maila na `example.com`), adresem jest plus-adres użytkownika (np. `<login>+s06-<data>@<domena>`), uzgodniony z użytkownikiem, który potwierdza konto linkiem z poczty. Za zgodą użytkownika założyć na produkcji konto opiekuna z tym adresem, zapisać kompletny profil, potwierdzić go na `/opiekunowie` z jego gminą, usunąć go przyciskiem na `/profil` i potwierdzić komunikat, 404 na `/opiekunowie/<id>` i brak na liście. Potem usunąć pozostałe konto logowania: `npx supabase db query --linked "delete from auth.users where email = '<adres konta testowego>'"` (kaskada usuwa `accounts`), także za zgodą użytkownika.

### Success Criteria:

#### Manual Verification:

- `npx supabase db push` zastosował `20261104160000_caregiver_profile_delete.sql` na produkcji
- `npx wrangler deploy` zakończony, nowe wdrożenie widoczne w `npx wrangler deployments list`
- Na produkcji tymczasowy profil po usunięciu znika z `/opiekunowie`, a `/opiekunowie/<id>` daje 404
- Konto testowe usunięte z `auth.users`, a `/opiekunowie` bez filtrów ma tę samą liczbę wyników co przed wdrożeniem

**Implementation Note**: Faza wyłącznie ręczna, z akceptacją użytkownika przed każdym `db push`, `deploy` i każdym zapisem na produkcji.

---

## Testing Strategy

### Unit Tests:

- Brak zestawu testów jednostkowych w repo (AGENTS.md). Reguły są sprawdzane smoke'iem przeciw bazie i aplikacji.

### Integration Tests:

- `npm run smoke`, kroki REST: odmowa dla `anon` (brak grantu), dla innego opiekuna i dla koordynatora (0 usuniętych wierszy, profil nadal publiczny), usunięcie przez właściciela, kaskada w pięciu tabelach, zniknięcie z `search_caregivers` i `get_public_caregiver`.
- `npm run smoke`, kroki aplikacji: 401/403/200/404 `DELETE /api/caregiver/profile`, przycisk na `/profil`, komunikat na `/profil?usunieto=1`, 404 `/opiekunowie/<id>`, brak na liście.

### Manual Testing Steps:

1. Jako opiekun z kompletnym profilem otworzyć `/profil`, kliknąć „Usuń profil”, potem „Anuluj”: profil bez zmian.
2. Ponownie otworzyć okno i kliknąć „Usuń na zawsze”: przekierowanie, komunikat, pusty stan.
3. Jako koordynator otworzyć zapamiętany `/kontakt/<id>`: 404 bez telefonu.
4. Jako ten sam opiekun kliknąć „Utwórz profil” i zapisać nowy profil: pojawia się na liście, a komunikat o usunięciu na `/profil` już się nie pokazuje.

## Performance Considerations

Jedno `DELETE` po kluczu głównym i kaskada po indeksowanych FK (klucze główne tabel zależnych zaczynają się od `caregiver_id`). Profil ma najwyżej 30 gmin, 13 usług i 28 terminów. Bez wpływu na NFR wyszukiwania.

## Migration Notes

Migracja tylko dodaje politykę i grant, bez zmian danych. Wycofanie: `drop policy caregiver_profiles_delete_authenticated on public.caregiver_profiles; revoke delete on public.caregiver_profiles from authenticated;`. Usuniętych profili nie da się odtworzyć (poza PITR Supabase).

## References

- Roadmap: `context/foundation/roadmap.md` (S-06)
- PRD: `context/foundation/prd.md:94` (FR-003), `:134` (NFR trwałe usunięcie)
- Schemat i kaskady: `supabase/migrations/20261103150000_caregiver_profiles.sql`, `supabase/migrations/20261104120000_caregiver_availability.sql:39`
- Wzorzec grantów: `supabase/migrations/20261103230000_table_grants_mirror_policies.sql`
- Endpoint i bramka: `src/pages/api/caregiver/profile.ts`
- Wzorzec wyspy z `fetch`: `src/components/caregiver/CaregiverProfileForm.tsx:115-126`
- Poprzedni plan (format i faza wdrożenia): `context/archive/2026-11-04-ranked-match-results/plan.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Usuwanie w bazie

#### Automated

- [x] 1.1 Wszystkie migracje stosują się od zera: `npx supabase db reset`
- [x] 1.2 Lint bazy bez błędów: `npx supabase db lint --level error`
- [x] 1.3 Kontrola grantów przechodzi: `npx supabase db query --local -f scripts/check-table-grants.sql`
- [x] 1.4 Lint i typy: `npm run lint` i `npx astro check`
- [x] 1.5 Smoke przechodzi z nowymi krokami bazy: `npm run smoke`

#### Manual

- [x] 1.6 Granty `caregiver_profiles`: `anon: SELECT`, `authenticated: DELETE, INSERT, SELECT, UPDATE`
- [x] 1.7 Jedna polityka `DELETE` dla `{authenticated}` na `caregiver_profiles`

### Phase 2: Przycisk i API

#### Automated

- [ ] 2.1 Lint i typy: `npm run lint` i `npx astro check`
- [ ] 2.2 Build: `npm run build`
- [ ] 2.3 Smoke przechodzi z krokami API i stron: `npm run smoke`

#### Manual

- [ ] 2.4 Okno dialogowe: „Anuluj” bez zmian, „Usuń na zawsze” → `/profil?usunieto=1` z komunikatem i „Utwórz profil”
- [ ] 2.5 Usunięty profil: brak na `/opiekunowie`, 404 na `/opiekunowie/<id>` i `/kontakt/<id>` dla koordynatora
- [ ] 2.6 psql: brak wierszy w pięciu tabelach profilu, `accounts` i `auth.users` zostają
- [ ] 2.7 375 px: okno mieści się na ekranie, fokus i Esc działają

### Phase 3: Wdrożenie produkcyjne

#### Manual

- [ ] 3.1 `npx supabase db push` zastosował `20261104160000_caregiver_profile_delete.sql` na produkcji
- [ ] 3.2 `npx wrangler deploy` zakończony, nowe wdrożenie widoczne w `npx wrangler deployments list`
- [ ] 3.3 Na produkcji tymczasowy profil po usunięciu znika z `/opiekunowie`, a `/opiekunowie/<id>` daje 404
- [ ] 3.4 Konto testowe usunięte z `auth.users`, liczba wyników `/opiekunowie` bez zmian
