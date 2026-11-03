# Opiekun zakłada konto i publikuje profil — plan implementacji

## Overview

Wycinek S-01 z roadmapy: opiekun rejestruje się z rolą, od razu trafia do formularza profilu (imię, opis, telefon, e-mail, obsługiwane gminy, oferowane usługi), zapisuje go i widzi swój profil wraz z informacją, czego brakuje do kompletności. Dane kontaktowe trafiają do osobnej tabeli dostępnej wyłącznie właścicielowi, a publiczna część profilu jest od razu czytelna anonimowo — tak, aby rozdział danych był wymuszony w bazie i sprawdzany w CI, zanim S-02 zbuduje na nim publiczną listę. Generator gmin dostaje krok przepinający profile z wycofanych gmin na aktywnych następców (ograniczenie przekazane z `gminas-generator-upsert`).

## Current State Analysis

- Rejestracja zna tylko e-mail i hasło (`src/pages/api/auth/signup.ts:14`), bez walidacji i bez ról; po rejestracji zawsze `/auth/confirm-email`, po logowaniu zawsze `/` (`src/pages/api/auth/signin.ts:20`). Lokalnie potwierdzanie e-maila jest wyłączone (`supabase/config.toml:209`), więc `signUp` zwraca od razu sesję i `@supabase/ssr` zapisuje ją w ciasteczkach.
- W bazie istnieją tylko słowniki: `public.services` (13 usług, `slug` PK) i `public.gminas` (`teryt` PK, `active`, `replaced_by`) — `supabase/migrations/20260924120000_create_dictionaries.sql`, `supabase/migrations/20261103120000_retirable_gminas.sql`. Nic nie wskazuje jeszcze na `gminas(teryt)`.
- Gotowe API słowników: `GET /api/dictionaries/services`, `GET /api/dictionaries/gminas?q=&limit=` (autocomplete, tylko aktywne, bez diakrytyków) i serwis `src/lib/services/dictionary.service.ts`; etykieta gminy `formatGminaLabel` w `src/lib/gmina.ts:6`.
- UI startera jest po angielsku w stylu „cosmic” (`src/pages/auth/*.astro`, `src/components/auth/*`, `src/components/Topbar.astro`); `<html lang="en">` w `src/layouts/Layout.astro:14`. Z shadcn/ui jest tylko `button`.
- `PROTECTED_ROUTES = ["/dashboard"]` (`src/middleware.ts:4`); `App.Locals` ma tylko `user` (`src/env.d.ts`).
- Smoke (`scripts/smoke.mjs`) sprawdza status/`location`/JSON aplikacji przez `BASE_URL`; w CI job smoke zapisuje `.env` z `SUPABASE_URL`/`SUPABASE_KEY` (klucz anon) przed uruchomieniem (`.github/workflows/ci.yml`). Node 22.23 (`.nvmrc`) obsługuje `--env-file-if-exists`.
- Generator `scripts/generate-gminas-migration.mjs` emituje jeden blok `sync` (próg → upsert → wycofanie → skracanie łańcuchów), zakończony `drop table gminas_terc;`.

## Desired End State

- Formularz rejestracji (po polsku) wymaga wyboru roli „opiekun” / „koordynator”; rola trafia do `public.accounts` i użytkownik nie może jej zmienić.
- Opiekun po rejestracji ląduje na `/profil/edycja`, po logowaniu na `/profil`; koordynator na `/`; bez sesji (potwierdzanie e-maila włączone) — na `/auth/confirm-email`.
- Opiekun zapisuje profil (zapis częściowy dozwolony, imię zawsze wymagane) i na `/profil` widzi swoje dane, gminy (wycofane oznaczone), usługi, kontakt oraz listę braków albo informację, że profil jest kompletny.
- Anonimowy klient Supabase czyta `caregiver_profiles`, `caregiver_gminas`, `caregiver_services`, ale z `caregiver_contacts` i `accounts` dostaje zero wierszy; zalogowany koordynator też nie widzi cudzego kontaktu i nie może utworzyć profilu opiekuna.
- Migracja wygenerowana z nowego pliku TERC przepina profile z wycofanej gminy na aktywnego następcę bez naruszenia klucza głównego.
- `npm run smoke` w CI udowadnia przepływ profilu i rozdział danych przez RLS.

### Key Discoveries:

- Wzorzec endpointu: zod → `createClient` z obsługą `null` (503) → serwis → `Response.json`, błędy serwisu → 500 (`src/pages/api/dictionaries/gminas.ts:24-45`).
- Bez wygenerowanych typów bazy serwisy używają `.overrideTypes<…>()` lub rzutowania wyniku `rpc` na `PostgrestSingleResponse<…>` (`src/lib/services/dictionary.service.ts:22,36`).
- Konwencja migracji: nagłówek z celem, RLS w tej samej migracji, osobna polityka na operację i rolę, funkcje z `set search_path = ''`, jawne granty na końcu (`supabase/migrations/20260924120000_create_dictionaries.sql`).
- Ograniczenia z roadmapy (`context/foundation/roadmap.md`, blok S-01 „Constraints”): FK do `gminas(teryt)` z `on delete restrict`, wybór tylko gmin `active`, przepinanie wyłącznie na **aktywnego** następcę, profile bez aktywnego następcy zostają do ręcznego rozstrzygnięcia.
- `startsWith` w middleware: `/profil` chroni też `/profil/edycja`.

## What We're NOT Doing

- Publiczna lista i publiczna strona profilu opiekuna, filtry (S-02).
- Odsłonięcie kontaktu koordynatorom — w S-01 kontakt widzi tylko właściciel (S-03 doda politykę dla zalogowanych).
- Dostępność (S-04), ranking (S-05), usuwanie profilu (S-06) — brak polityk `delete` na `caregiver_profiles`.
- Profil koordynatora (FR-013) i jakiekolwiek dane koordynatora poza rolą.
- Zmiana konfiguracji potwierdzania e-maila (PRD Open Question 1) — obsługujemy oba warianty przekierowaniem.
- Uzupełnianie ról kontom założonym przed tą zmianą (brak wiersza w `accounts` = brak roli).
- Zmiana roli po rejestracji, panel administracyjny.
- Adres opiekuna w danych kontaktowych; numery zagraniczne.
- Nowy wygląd UI (zostaje styl startera; restyle przez `/10x-ui`), wygenerowane typy bazy, framework testów jednostkowych, nagłówek `noindex` dla `*.workers.dev`.

## Implementation Approach

Kolejność „baza → generator → auth → API → UI”. Model danych wymusza rozdział kontaktu w RLS, zanim powstanie jakakolwiek strona, a każda kolejna faza dokłada weryfikację w smoke. Rola jest ustalana przez trigger na `auth.users` (zaufana w RLS, bo użytkownik nie ma polityki zapisu do `accounts`). Zapis profilu idzie przez jedną funkcję SQL `security invoker`, żeby wymiana list gmin i usług była atomowa i podlegała RLS. Reguła kompletności istnieje w jednym miejscu — w funkcji SQL — i korzystają z niej strona profilu teraz oraz S-02 później.

Model danych (klucz profilu = `auth.users.id`, co upraszcza polityki do `= auth.uid()`):

| Tabela | Kolumny | anon | authenticated |
|---|---|---|---|
| `accounts` | `user_id` PK→`auth.users` cascade, `role` (`caregiver`/`coordinator`), `created_at` | — | select własnego wiersza |
| `caregiver_profiles` | `user_id` PK→`auth.users` cascade, `display_name` (2–60), `description` (≤1000, null), `created_at`, `updated_at` | select | select; insert/update własnego (insert tylko z rolą `caregiver`) |
| `caregiver_contacts` | `caregiver_id` PK→`caregiver_profiles` cascade, `phone` (`^\+48[0-9]{9}$`, null), `email` (≤254, null), `updated_at` | — | select/insert/update własnego |
| `caregiver_gminas` | `caregiver_id`→`caregiver_profiles` cascade, `teryt`→`gminas` **restrict**, PK (oba) | select | select; insert własnego (tylko gmina `active`); delete własnego |
| `caregiver_services` | `caregiver_id`→`caregiver_profiles` cascade, `service_slug`→`services` restrict, PK (oba) | select | select; insert/delete własnego |

## Critical Implementation Details

- **Uprawnienia domyślne Supabase**: nowe tabele w `public` dostają od razu `grant all` dla `anon`/`authenticated`, więc jedyną bramą jest RLS — każda tabela musi mieć `enable row level security` w tej samej migracji. Funkcje są domyślnie wykonywalne przez `PUBLIC`: `save_caregiver_profile` i `handle_new_user` wymagają jawnego `revoke execute … from public, anon` (a `handle_new_user` także `authenticated`).
- **Trigger na `auth.users`**: błąd w triggerze blokuje *każdą* rejestrację („Database error saving new user”) — funkcja musi być `security definer`, `set search_path = ''`, z w pełni kwalifikowanymi nazwami. Smoke łapie regresję krokiem rejestracji.
- **Upsert pod RLS**: `insert … on conflict do update` wymaga dla wywołującego polityk insert, update **i** select na tej tabeli.
- **PostgREST**: naruszenie RLS przy zapisie zwraca 401 dla `anon` i 403 dla `authenticated`; odczyt odfiltrowany przez RLS zwraca 200 z `[]`. Kroki smoke opierają się na tych kodach.

## Phase 1: Schemat profilu i ról

### Overview

Jedna migracja tworzy role, cztery tabele profilu z RLS, funkcję zapisu i funkcję kompletności. Po tej fazie baza wymusza rozdział kontaktu niezależnie od kodu aplikacji.

### Changes Required:

#### 1. Migracja `caregiver_profiles`

**File**: `supabase/migrations/20261103150000_caregiver_profiles.sql`

**Intent**: Wprowadzić tabele z modelu danych powyżej wraz z politykami (po jednej na operację i rolę) oraz komentarzami `comment on table/column`, w konwencji istniejących migracji.

**Contract**:
- Tabele, kolumny, klucze i polityki dokładnie jak w tabeli „Model danych”. `display_name` z checkiem na długość 2–60 po `btrim` i brak białych znaków na brzegach; `email` z checkiem długości ≤254 i prostego wzorca `^[^@\s]+@[^@\s]+\.[^@\s]+$`.
- Polityka insert `caregiver_profiles` dla `authenticated`: `user_id = (select auth.uid())` **i** istnieje wiersz `public.accounts` z tym `user_id` i `role = 'caregiver'`.
- Polityka insert `caregiver_gminas`: `caregiver_id = (select auth.uid())` **i** wskazana gmina ma `active = true` (obrona w głębi; RPC daje przyjazny błąd wcześniej).

#### 2. Rola z rejestracji

**File**: ta sama migracja

**Intent**: Trigger `after insert on auth.users` kopiuje `raw_user_meta_data->>'role'` do `public.accounts`; nieprawidłowa lub brakująca rola odrzuca rejestrację (fail-closed).

**Contract**: funkcja `public.handle_new_user() returns trigger`, `security definer`, `set search_path = ''`; rzuca wyjątek z czytelnym komunikatem, gdy rola ∉ {`caregiver`, `coordinator`}. Trigger `on_auth_user_created`. Brak polityk insert/update/delete na `accounts`.

#### 3. Zapis profilu

**File**: ta sama migracja

**Intent**: Atomowy zapis całego profilu własnego użytkownika: profil, kontakt i wymiana list gmin i usług w jednej transakcji, pod RLS wywołującego.

**Contract**: `public.save_caregiver_profile(p_display_name text, p_description text, p_phone text, p_email text, p_gminas text[], p_services text[]) returns void`, `language plpgsql`, `security invoker`, `set search_path = ''`.
- `auth.uid()` null → wyjątek `errcode '28000'`.
- Walidacja przed zapisem, każda jako wyjątek `errcode '22023'` z komunikatem po polsku nadającym się do pokazania użytkownikowi: więcej niż 30 gmin; kod gminy nieistniejący lub nieaktywny (komunikat wymienia kody); slug usługi spoza katalogu.
- Upsert `caregiver_profiles` po `user_id` (ustawia `updated_at = now()`), upsert `caregiver_contacts`, potem dla obu list: usuń wiersze spoza nowej listy, wstaw brakujące (`on conflict do nothing`, duplikaty w tablicy ignorowane).
- Grant execute tylko `authenticated`.

#### 4. Reguła kompletności

**File**: ta sama migracja

**Intent**: Jedno źródło reguły „profil kompletny = imię + telefon + ≥1 aktywna gmina + ≥1 usługa”, używane przez stronę profilu teraz i listę S-02 później; ujawnia tylko, czego brakuje, nigdy treści kontaktu.

**Contract**: `public.caregiver_profile_missing(p_caregiver_id uuid) returns text[]`, `stable`, `security definer`, `set search_path = ''`. Zwraca podzbiór `{display_name, phone, gminas, services}` w tej stałej kolejności (pusta tablica = kompletny); dla nieistniejącego profilu zwraca wszystkie cztery. `gminas` liczy wyłącznie gminy `active`. Grant execute `anon`, `authenticated`.

### Success Criteria:

#### Automated Verification:

- Wszystkie migracje stosują się od zera: `npx supabase db reset`
- Lint bazy bez błędów: `npx supabase db lint --level error`
- Każda nowa tabela ma włączony RLS: `grep -c "enable row level security" supabase/migrations/20261103150000_caregiver_profiles.sql` zwraca 5

#### Manual Verification:

- `select tablename, policyname, cmd, roles from pg_policies where schemaname = 'public' order by 1, 3;` pokazuje dokładnie polityki z tabeli „Model danych” (brak jakiejkolwiek polityki `anon` na `caregiver_contacts` i `accounts`)
- `select public.caregiver_profile_missing(gen_random_uuid());` zwraca `{display_name,phone,gminas,services}`

**Implementation Note**: Po przejściu weryfikacji automatycznej zatrzymaj się na ręczne potwierdzenie przed kolejną fazą.

---

## Phase 2: Przepinanie profili w generatorze gmin

### Overview

Każda migracja wygenerowana z nowego pliku TERC przepina powiązania `caregiver_gminas` z wycofanych gmin na ich aktywnych następców i raportuje te, których nie da się przepiąć.

### Changes Required:

#### 1. Krok przepinania w generowanym SQL

**File**: `scripts/generate-gminas-migration.mjs`

**Intent**: Dopisać do stałej `sync` blok uruchamiany po wycofaniu gmin i skróceniu łańcuchów, a przed `drop table gminas_terc;`. Najpierw wstawić powiązanie z następcą, potem usunąć powiązanie z wycofaną gminą — dzięki temu ani opiekun mający już następcę, ani dwie wycofane gminy z tym samym następcą nie łamią klucza głównego. Zaktualizować komentarz nagłówkowy skryptu.

**Contract**: przepinanie tylko na następcę `active`; powiązania z wycofaną gminą bez aktywnego następcy zostają nietknięte i są wymienione w `raise notice` (liczba przepiętych, lista pozostawionych kodów). Rdzeń:

```sql
insert into public.caregiver_gminas (caregiver_id, teryt)
select distinct cg.caregiver_id, n.teryt
from public.caregiver_gminas as cg
join public.gminas as g on g.teryt = cg.teryt and not g.active
join public.gminas as n on n.teryt = g.replaced_by and n.active
on conflict do nothing;

delete from public.caregiver_gminas as cg
using public.gminas as g
join public.gminas as n on n.teryt = g.replaced_by and n.active
where cg.teryt = g.teryt and not g.active;
```

#### 2. Procedura odświeżania gmin

**File**: `README.md` (sekcja o odświeżaniu gmin)

**Intent**: Opisać, że migracja przepina profile automatycznie, co znaczy komunikat o pozostawionych powiązaniach i jak je znaleźć zapytaniem kontrolnym (powiązania `caregiver_gminas` z gminą `active = false`).

**Contract**: nowy akapit + zapytanie kontrolne w istniejącej sekcji procedury.

### Success Criteria:

#### Automated Verification:

- Skrypt parsuje się: `node --check scripts/generate-gminas-migration.mjs`
- Lint przechodzi: `npm run lint`

#### Manual Verification:

- Scenariusz na lokalnej bazie: opiekun z gminą `1465011`; kopia pliku TERC z RODZ Warszawy zmienionym z `1` na `3`; wygenerowana migracja zastosowana przez `npx supabase migration up` przepina opiekuna na `1465013` i wypisuje notice; ten sam scenariusz z opiekunem mającym już `1465013` kończy się jednym powiązaniem bez błędu. Po teście usuń testową migrację i wykonaj `npx supabase db reset`.

**Implementation Note**: Po przejściu weryfikacji automatycznej zatrzymaj się na ręczne potwierdzenie przed kolejną fazą.

---

## Phase 3: Role w rejestracji i logowaniu

### Overview

Rejestracja zbiera rolę i waliduje dane, przekierowania zależą od roli i obecności sesji, a strony auth i Topbar są po polsku.

### Changes Required:

#### 1. Komponenty shadcn

**File**: `src/components/ui/` (generowane)

**Intent**: Dodać komponenty potrzebne w fazach 3 i 5 zgodnie z zasadą repo (bez ręcznego pisania).

**Contract**: `npx shadcn@latest add radio-group label input textarea checkbox badge popover command`.

#### 2. Typy i serwis kont

**File**: `src/types.ts`, `src/lib/services/account.service.ts`

**Intent**: Wspólny typ roli i jedno miejsce odczytu roli zalogowanego użytkownika (logowanie, Topbar, strony i API profilu).

**Contract**: `export type AccountRole = "caregiver" | "coordinator"`; `getAccountRole(supabase: SupabaseClient, userId: string): Promise<AccountRole | null>` (brak wiersza → `null`, błąd zapytania → `Error`).

#### 3. Polskie komunikaty błędów auth

**File**: `src/lib/auth-errors.ts`

**Intent**: Czysta funkcja mapująca komunikaty Supabase Auth (m.in. błędne dane logowania, istniejący użytkownik, za krótkie hasło, niepotwierdzony e-mail) na polskie teksty, z ogólnym komunikatem dla nieznanych.

**Contract**: `toPolishAuthError(message: string): string`.

#### 4. Endpoint rejestracji

**File**: `src/pages/api/auth/signup.ts`

**Intent**: Walidacja zod (`email`, `password` ≥6, `role` z enumu), rola przekazana w `options.data.role`, przekierowanie zależne od wyniku.

**Contract**: niepoprawne dane lub błąd Supabase → `302 /auth/signup?error=<pl>`; sesja + `caregiver` → `302 /profil/edycja`; sesja + `coordinator` → `302 /`; brak sesji → `302 /auth/confirm-email`. Obsługa `createClient() === null` bez zmian.

#### 5. Endpoint logowania

**File**: `src/pages/api/auth/signin.ts`

**Intent**: Po udanym logowaniu opiekun trafia do swojego profilu.

**Contract**: rola `caregiver` → `302 /profil`; inna rola, brak roli lub błąd odczytu roli → `302 /`. Błędy logowania mapowane przez `toPolishAuthError`.

#### 6. Formularze i strony auth po polsku

**File**: `src/components/auth/SignUpForm.tsx`, `src/components/auth/SignInForm.tsx`, `src/pages/auth/signup.astro`, `src/pages/auth/signin.astro`, `src/pages/auth/confirm-email.astro`, `src/components/auth/SubmitButton.tsx` (jeśli zawiera teksty), `src/layouts/Layout.astro`

**Intent**: Przetłumaczyć teksty na polski, dodać do rejestracji wymagany wybór roli („Oferuję opiekę — jestem opiekunem” / „Szukam opieki dla bliskiej osoby — koordynator”) z walidacją po stronie klienta, ustawić `<html lang="pl">`.

**Contract**: pole formularza `role` z wartościami `caregiver` / `coordinator` (shadcn `RadioGroup`); brak domyślnie zaznaczonej roli.

#### 7. Topbar

**File**: `src/components/Topbar.astro`

**Intent**: Polskie teksty; zalogowany opiekun widzi link „Mój profil” (`/profil`) zamiast „Dashboard”.

**Contract**: rola odczytana przez `getAccountRole`; `createClient() === null` → zachowanie jak dla braku roli.

#### 8. Smoke — rejestracja z rolą

**File**: `scripts/smoke.mjs`

**Intent**: Dostosować istniejące kroki do nowego przepływu i dodać odrzucenie rejestracji bez roli.

**Contract**: rejestracja bez `role` → `302 /auth/signup?error=`; rejestracja opiekuna → `302 /profil/edycja`; logowanie opiekuna → `302 /profil`; pozostałe kroki bez zmian.

### Success Criteria:

#### Automated Verification:

- Lint przechodzi: `npm run lint`
- Typy przechodzą: `npx astro check`
- Build przechodzi: `npm run build`
- Smoke przechodzi na lokalnym Supabase: `npm run smoke`

#### Manual Verification:

- Strona `/auth/signup` jest po polsku, nie da się wysłać formularza bez wybranej roli, a błąd z serwera (np. zajęty e-mail) wyświetla się po polsku
- Rejestracja opiekuna przekierowuje na `/profil/edycja` (404 do czasu fazy 5), rejestracja koordynatora na `/`
- Topbar na `/` pokazuje „Mój profil” tylko zalogowanemu opiekunowi

**Implementation Note**: Po przejściu weryfikacji automatycznej zatrzymaj się na ręczne potwierdzenie przed kolejną fazą.

---

## Phase 4: API profilu

### Overview

Serwis i endpoint `GET`/`PUT /api/caregiver/profile` dla właściciela profilu oraz smoke, który dowodzi przepływu i rozdziału danych przez RLS.

### Changes Required:

#### 1. Typy profilu

**File**: `src/types.ts`

**Intent**: Kształt danych profilu właściciela i komendy zapisu, wspólny dla API, stron i formularza.

**Contract**:
- `CaregiverMissingItem = "display_name" | "phone" | "gminas" | "services"`
- `OwnCaregiverProfileDto { id: string; displayName: string; description: string | null; contact: { phone: string | null; email: string | null }; gminas: (GminaDto & { active: boolean })[]; services: ServiceDto[]; missing: CaregiverMissingItem[] }` — `services` w kolejności `sort_order`, `gminas` po etykiecie.
- `SaveCaregiverProfileCommand { displayName: string; description: string | null; phone: string | null; email: string | null; gminas: string[]; services: string[] }`

#### 2. Helper telefonu

**File**: `src/lib/phone.ts`

**Intent**: Czysta normalizacja polskiego numeru (używana w zod i w formularzu po stronie klienta) i formatowanie do wyświetlania.

**Contract**: `normalizePlPhone(input: string): string | null` — usuwa spacje, myślniki, nawiasy; akceptuje 9 cyfr z opcjonalnym prefiksem `+48` lub `0048`; zwraca `+48XXXXXXXXX` albo `null`. `formatPlPhone(phone: string): string` → `+48 600 100 200`.

#### 3. Serwis profilu opiekuna

**File**: `src/lib/services/caregiver.service.ts`

**Intent**: Odczyt własnego profilu jednym zapytaniem z osadzeniami PostgREST (kontakt, gminy z `active`, usługi) plus RPC kompletności; zapis przez RPC z mapowaniem błędów walidacji z bazy.

**Contract**: `getOwnProfile(supabase, userId): Promise<OwnCaregiverProfileDto | null>`; `saveOwnProfile(supabase, cmd: SaveCaregiverProfileCommand): Promise<void>`; `export class CaregiverProfileValidationError extends Error` rzucany dla `errcode 22023` (komunikat z bazy przekazany dalej); inne błędy → `Error`.

#### 4. Endpoint profilu

**File**: `src/pages/api/caregiver/profile.ts`

**Intent**: `GET` zwraca profil właściciela, `PUT` waliduje i zapisuje profil, po czym zwraca jego świeży stan.

**Contract**:
- Kolejność kontroli: brak `locals.user` → 401; `createClient() === null` → 503; rola ≠ `caregiver` → 403; potem logika.
- `GET` → `200 { profile: OwnCaregiverProfileDto | null }`.
- `PUT` body JSON: `displayName` (trim, 2–60), `description` (trim, ≤1000, pusty → `null`), `phone` (pusty → `null`, inaczej `normalizePlPhone`, błąd „Podaj polski numer telefonu (9 cyfr)”), `email` (pusty → `null`, inaczej poprawny e-mail ≤254), `gminas` (≤30 kodów `^[0-9]{6}[123]$`, deduplikacja), `services` (≤13 slugów, deduplikacja). Nieczytelny JSON lub błąd zod → `400 { error, fieldErrors: Record<string, string> }` z polskimi komunikatami; `CaregiverProfileValidationError` → `400 { error }`; inny błąd → 500.
- Sukces → `200 { profile }`.
- Każda odpowiedź z danymi kontaktowymi ma nagłówek `Cache-Control: private, no-store`.

#### 5. Smoke — przepływ profilu i dowód RLS

**File**: `scripts/smoke.mjs`, `package.json`, `README.md` (sekcja smoke)

**Intent**: Smoke czyta `SUPABASE_URL`/`SUPABASE_KEY` z `.env` (w CI plik już istnieje) i dodaje kroki API oraz bezpośrednie wywołania REST Supabase jako `anon` i jako zalogowany koordynator. Bez tych zmiennych kończy się czytelnym błędem.

**Contract**: skrypt `"smoke": "node --env-file-if-exists=.env scripts/smoke.mjs"`. Nowe kroki (po zalogowaniu opiekuna):
- `GET /api/caregiver/profile` → 200, `profile === null`
- `PUT` z telefonem `12345` → 400 z `fieldErrors.phone`
- `PUT` z `displayName "Anna Smoke"`, telefonem `600 100 200`, gminą `1465011`, usługą `towarzystwo` → 200, `contact.phone === "+48600100200"`, `missing` puste
- REST jako anon: `caregiver_profiles?user_id=eq.<id>` → 1 wiersz; `caregiver_gminas?caregiver_id=eq.<id>` → 1 wiersz; `caregiver_contacts?caregiver_id=eq.<id>` → `[]`; `accounts` → `[]`; `rpc/caregiver_profile_missing` → `[]`
- `GET /api/caregiver/profile` bez sesji (po wylogowaniu) → 401
- rejestracja koordynatora → `302 /`; `PUT /api/caregiver/profile` → 403
- REST z tokenem koordynatora (`/auth/v1/token?grant_type=password`): `caregiver_contacts?caregiver_id=eq.<id opiekuna>` → `[]`; `POST caregiver_profiles` z własnym `user_id` → 403

### Success Criteria:

#### Automated Verification:

- Lint przechodzi: `npm run lint`
- Typy przechodzą: `npx astro check`
- Build przechodzi: `npm run build`
- Smoke z krokami profilu i RLS przechodzi: `npm run smoke`

#### Manual Verification:

- Po ręcznym ustawieniu w lokalnej bazie `active = false` dla gminy przypisanej opiekunowi, `PUT` z tą gminą zwraca 400 z polskim komunikatem wymieniającym jej kod, a `GET` pokazuje ją z `active: false` i `missing` zawierającym `gminas` (jeśli była jedyna)

**Implementation Note**: Po przejściu weryfikacji automatycznej zatrzymaj się na ręczne potwierdzenie przed kolejną fazą.

---

## Phase 5: Strony profilu

### Overview

Chronione strony `/profil` (podgląd z brakami) i `/profil/edycja` (formularz z wyborem gmin), dostępne tylko dla opiekunów.

### Changes Required:

#### 1. Ochrona tras

**File**: `src/middleware.ts`

**Intent**: Strony profilu wymagają zalogowania.

**Contract**: `PROTECTED_ROUTES` zawiera `"/profil"` (obejmuje `/profil/edycja`).

#### 2. Etykiety braków

**File**: `src/lib/caregiver-profile.ts`

**Intent**: Czyste mapowanie `CaregiverMissingItem` na polskie teksty („imię”, „numer telefonu”, „co najmniej jedna gmina”, „co najmniej jedna usługa”) dla strony podglądu.

**Contract**: `missingItemLabel(item: CaregiverMissingItem): string`.

#### 3. Podgląd profilu

**File**: `src/pages/profil/index.astro`

**Intent**: Statyczny widok `.astro` własnego profilu: imię, opis, usługi, gminy (wycofane oznaczone „gmina wycofana — usuń ją w edycji”), kontakt (telefon przez `formatPlPhone`, e-mail), status kompletności („Profil jest kompletny” albo „Profil nie będzie widoczny dla koordynatorów, dopóki nie uzupełnisz: …”), link „Edytuj profil”. Bez profilu: wezwanie „Utwórz profil” → `/profil/edycja`.

**Contract**: rola ≠ `caregiver` → `302 /`; `createClient() === null` → komunikat o braku konfiguracji; dane przez `getOwnProfile`.

#### 4. Edycja profilu

**File**: `src/pages/profil/edycja.astro`

**Intent**: Ładuje profil i katalog usług po stronie serwera i montuje formularz; dla nowego profilu wstępnie wypełnia e-mail kontaktowy adresem konta.

**Contract**: ta sama kontrola roli co podgląd; `CaregiverProfileForm` z `client:load`, propsy: `initialProfile: OwnCaregiverProfileDto | null`, `services: ServiceDto[]`, `accountEmail: string`.

#### 5. Formularz profilu

**File**: `src/components/caregiver/CaregiverProfileForm.tsx`

**Intent**: Wyspa React z polami: imię, opis, telefon, e-mail, usługi (lista checkboxów), gminy (`GminaPicker`). Lekka walidacja po stronie klienta (wymagane imię, format telefonu przez `normalizePlPhone`, blokada zapisu z wycofaną gminą), wysyłka `PUT` JSON, stan wysyłania.

**Contract**: 200 → `window.location.assign("/profil")`; 400 → `fieldErrors` przy polach i `error` nad przyciskiem; 401 → `/auth/signin`; inne → ogólny komunikat. Klasy warunkowe przez `cn()`.

#### 6. Wybór gmin

**File**: `src/components/caregiver/GminaPicker.tsx`

**Intent**: Combobox na shadcn `Popover` + `Command`: zapytania do `GET /api/dictionaries/gminas?q=` od 2 znaków z opóźnieniem ~250 ms, wybrane gminy jako `Badge` z przyciskiem usunięcia, limit 30 z komunikatem, wycofane gminy z danych początkowych oznaczone.

**Contract**: `value: (GminaDto & { active: boolean })[]`, `onChange(next)`; wyniki z API traktowane jako `active: true`; bez duplikatów.

#### 7. Smoke — strony profilu

**File**: `scripts/smoke.mjs`

**Intent**: Pilnować ochrony i blokady ról na stronach.

**Contract**: opiekun: `GET /profil` → 200, `GET /profil/edycja` → 200; bez sesji: `GET /profil` → `302 /auth/signin`; koordynator: `GET /profil` → `302 /`.

### Success Criteria:

#### Automated Verification:

- Lint przechodzi: `npm run lint`
- Typy przechodzą: `npx astro check`
- Build przechodzi: `npm run build`
- Smoke ze stronami profilu przechodzi: `npm run smoke`

#### Manual Verification:

- Pełny przepływ w przeglądarce: rejestracja opiekuna → formularz → zapis częściowy (samo imię) → podgląd z listą braków → uzupełnienie → „Profil jest kompletny”
- Wyszukiwanie „lodz” znajduje Łódź; nie da się dodać 31. gminy ani dwa razy tej samej
- Formularz i podgląd są w pełni używalne przy szerokości 375 px
- Jako anonim: źródło strony `/` i odpowiedź `/api/dictionaries/*` nie zawierają telefonu ani e-maila zapisanego opiekuna

**Implementation Note**: Po przejściu weryfikacji automatycznej zatrzymaj się na ręczne potwierdzenie przed zamknięciem zmiany.

---

## Testing Strategy

### Unit Tests:

- Brak frameworka testów jednostkowych w repo (AGENTS.md) — nie dodajemy go. Czyste helpery (`normalizePlPhone`, `toPolishAuthError`, `missingItemLabel`) są pokryte pośrednio przez smoke (normalizacja telefonu, błąd walidacji).

### Integration Tests:

- `npm run smoke` w CI: rejestracja z rolą i bez, przekierowania, zapis i odczyt profilu, walidacja 400, 401/403 na API, ochrona stron, oraz bezpośredni dowód RLS przez REST Supabase (anon i koordynator nie czytają kontaktu, koordynator nie tworzy profilu).

### Manual Testing Steps:

1. Rejestracja opiekuna i koordynatora w UI; komunikaty po polsku.
2. Profil częściowy → braki → profil kompletny.
3. Scenariusz przepinania gmin z fazy 2 na lokalnej bazie.
4. Wycofana gmina w profilu: oznaczenie w podglądzie, blokada zapisu, komunikat z API.
5. Widok mobilny 375 px.

## Performance Considerations

Odczyt własnego profilu to jedno zapytanie z osadzeniami plus jedno RPC; zapis to jedno RPC. Autocomplete gmin używa istniejącego endpointu z limitem wyników i opóźnieniem po stronie klienta. Nie są potrzebne dodatkowe indeksy poza kluczami głównymi (wyszukiwanie po `teryt` dla przepinania obsłuży indeks z PK `(caregiver_id, teryt)` w skali MVP).

## Migration Notes

- Migracja jest addytywna i wchodzi na produkcję przez `npx supabase db push`. Konta założone przed nią nie mają wiersza w `accounts` — nie mogą utworzyć profilu, a logowanie przekierowuje je na `/`.
- Po wdrożeniu każda rejestracja bez roli (np. utworzenie użytkownika w panelu Supabase bez metadanych) zostanie odrzucona przez trigger — świadome fail-closed.
- Wycofanie: nowa migracja usuwająca trigger, funkcje i tabele — bezpieczne, dopóki nie ma prawdziwych profili; potem wymaga eksportu danych.

## References

- Roadmapa, blok S-01 (ograniczenia gmin): `context/foundation/roadmap.md`
- PRD: FR-001, FR-003–FR-006, US-01, Access Control, Non-Functional Requirements: `context/foundation/prd.md`
- Poprzednia zmiana (wycofywanie gmin, generator): `context/archive/2026-09-24-gminas-generator-upsert/plan.md`
- Wzorzec endpointu: `src/pages/api/dictionaries/gminas.ts:24`
- Wzorzec serwisu i RPC bez typów: `src/lib/services/dictionary.service.ts:36`
- Konwencja migracji z RLS: `supabase/migrations/20260924120000_create_dictionaries.sql`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Schemat profilu i ról

#### Automated

- [x] 1.1 Wszystkie migracje stosują się od zera: `npx supabase db reset` — 0ad6859
- [x] 1.2 Lint bazy bez błędów: `npx supabase db lint --level error` — 0ad6859
- [x] 1.3 Każda nowa tabela ma włączony RLS (5 wystąpień `enable row level security`) — 0ad6859

#### Manual

- [x] 1.4 `pg_policies` pokazuje dokładnie polityki z tabeli „Model danych” (brak `anon` na `caregiver_contacts` i `accounts`) — 0ad6859
- [x] 1.5 `caregiver_profile_missing(gen_random_uuid())` zwraca wszystkie cztery braki — 0ad6859

### Phase 2: Przepinanie profili w generatorze gmin

#### Automated

- [x] 2.1 Skrypt parsuje się: `node --check scripts/generate-gminas-migration.mjs` — 09d9f59
- [x] 2.2 Lint przechodzi: `npm run lint` — 09d9f59

#### Manual

- [x] 2.3 Scenariusz RODZ 1→3 dla Warszawy przepina opiekuna na `1465013`, także gdy ma już następcę — 09d9f59

### Phase 3: Role w rejestracji i logowaniu

#### Automated

- [x] 3.1 Lint przechodzi: `npm run lint` — e998f40
- [x] 3.2 Typy przechodzą: `npx astro check` — e998f40
- [x] 3.3 Build przechodzi: `npm run build` — e998f40
- [x] 3.4 Smoke przechodzi na lokalnym Supabase: `npm run smoke` — e998f40

#### Manual

- [x] 3.5 Rejestracja po polsku, wymagana rola, polskie błędy serwera — e998f40
- [x] 3.6 Opiekun po rejestracji na `/profil/edycja`, koordynator na `/` — e998f40
- [x] 3.7 Topbar pokazuje „Mój profil” tylko opiekunowi — e998f40

### Phase 4: API profilu

#### Automated

- [x] 4.1 Lint przechodzi: `npm run lint` — 53bb039
- [x] 4.2 Typy przechodzą: `npx astro check` — 53bb039
- [x] 4.3 Build przechodzi: `npm run build` — 53bb039
- [x] 4.4 Smoke z krokami profilu i RLS przechodzi: `npm run smoke` — 53bb039

#### Manual

- [x] 4.5 Wycofana gmina: `PUT` zwraca 400 z kodem gminy, `GET` pokazuje `active: false` i brak `gminas` — 53bb039

### Phase 5: Strony profilu

#### Automated

- [x] 5.1 Lint przechodzi: `npm run lint`
- [x] 5.2 Typy przechodzą: `npx astro check`
- [x] 5.3 Build przechodzi: `npm run build`
- [x] 5.4 Smoke ze stronami profilu przechodzi: `npm run smoke`

#### Manual

- [x] 5.5 Pełny przepływ w przeglądarce od rejestracji do „Profil jest kompletny”
- [x] 5.6 Autocomplete bez diakrytyków, limit 30 gmin, brak duplikatów
- [x] 5.7 Formularz i podgląd używalne przy 375 px
- [x] 5.8 Strony publiczne i API słowników nie zawierają kontaktu opiekuna
