# Odsłonięcie kontaktu opiekuna po zalogowaniu — Implementation Plan

## Overview

Wycinek S-03 (north star): koordynator z publicznej listy przechodzi do profilu opiekuna, loguje się albo zakłada konto i widzi telefon oraz e-mail opiekuna. Zamyka główne kryterium sukcesu PRD (kroki 3–4 przepływu) i FR-012, przy strażniku „kontakt nie trafia do niezalogowanych ani wyszukiwarek”.

## Current State Analysis

- `caregiver_contacts` ma jedną politykę SELECT dla `authenticated`: tylko właściciel (`supabase/migrations/20261103150000_caregiver_profiles.sql:101`). Anon nie ma żadnej. S-01 zostawiło otwarcie kontaktu zalogowanym temu wycinkowi.
- Rola w `public.accounts` jest zaufana — brak polityk zapisu, ustawia ją tylko trigger `handle_new_user()` (`…caregiver_profiles.sql:24-37`, `:213`).
- Reguła kompletności żyje w jednej funkcji `caregiver_profile_missing(uuid)` (`security definer`, grant dla `anon` i `authenticated`, `…caregiver_profiles.sql:345`); lista używa jej w `search_caregivers()` (`supabase/migrations/20261103200000_search_caregivers.sql:52`).
- Nie ma strony pojedynczego profilu; karty na `/opiekunowie` nie są linkami (`src/pages/opiekunowie/index.astro`, sekcja `caregivers.map`).
- `PROTECTED_ROUTES = ["/dashboard", "/profil"]` z dopasowaniem `startsWith` (`src/middleware.ts:6`, `:42`); przekierowanie na `/auth/signin` gubi adres docelowy.
- `POST /api/auth/signin` i `POST /api/auth/signup` przekierowują sztywno: opiekun → `/profil` / `/profil/edycja`, reszta → `/`; rejestracja bez sesji → `/auth/confirm-email` (`src/pages/api/auth/signin.ts:24`, `src/pages/api/auth/signup.ts:41-46`).
- Lokalnie potwierdzanie e-maila jest wyłączone (`supabase/config.toml:209`); trasy `/auth/callback` nie ma. PRD Open Question 1 pozostaje otwarte.
- `X-Robots-Tag: noindex` dokłada middleware do każdej odpowiedzi (`src/middleware.ts:10-20`).
- `formatPlPhone()` w `src/lib/phone.ts:12` formatuje `+48XXXXXXXXX` do wyświetlenia (używa go `src/pages/profil/index.astro:125`).
- Smoke ma krok „coordinator cannot read caregiver contact” dla **kompletnego** profilu (`scripts/smoke.mjs:361`) — ta zmiana celowo go odwraca. Asercje `location` porównują przez `startsWith`, chyba że `exact: true` (`scripts/smoke.mjs:382-383`).

## Desired End State

Anonim klika kartę na `/opiekunowie`, widzi pełną publiczną część profilu na `/opiekunowie/<id>` i przycisk „Pokaż dane kontaktowe”. Przycisk prowadzi na chroniony `/kontakt/<id>`; middleware odsyła na `/auth/signin?next=%2Fkontakt%2F<id>`. Po zalogowaniu albo rejestracji (rola „szukam opieki” zaznaczona domyślnie) koordynator ląduje z powrotem na `/kontakt/<id>` i widzi telefon (`tel:`) i e-mail (`mailto:`). Zalogowany opiekun lub konto bez roli widzi profil bez kontaktu i wyjaśnienie. Profil niekompletny, nieistniejący albo zły UUID daje 404 na obu stronach. Koordynator nie odczyta kontaktu niekompletnego profilu nawet bezpośrednio przez REST Supabase. Zewnętrzny `next` jest ignorowany. Wszystko potwierdza `npm run smoke`.

### Key Discoveries:

- Wiele polityk permisywnych dla tej samej operacji i roli łączy się przez OR; AGENTS.md wymaga „one policy per operation and role”, więc istniejącą politykę SELECT się **zastępuje** jedną polityką z warunkiem `właściciel OR (koordynator AND kompletny)`.
- `caregiver_profile_missing()` jest `security definer` (właściciel funkcji omija RLS), więc wywołanie jej w polityce `caregiver_contacts` nie wywołuje rekurencji RLS.
- `save_caregiver_profile()` robi `insert … on conflict do update` na `caregiver_contacts` — wymaga to, by istniejący wiersz przechodził politykę SELECT; właściciel nadal ją przechodzi.
- `/opiekunowie` nie może trafić do `PROTECTED_ROUTES` (zablokowałby listę) — dlatego kontakt ma osobny prefiks `/kontakt`.

## What We're NOT Doing

- Trasa `/auth/callback`, `emailRedirectTo` i konfiguracja redirect URLs w produkcyjnym Supabase — przy włączonym potwierdzaniu koordynator potwierdza e-mail i loguje się linkiem niosącym `next`. PRD Open Question 1 zostaje otwarte.
- Rejestr odsłonięć (`contact_reveals`), limity i wykrywanie scrapingu — PRD (Socratic do FR-012) akceptuje, że jedna rejestracja otwiera wszystkie numery. Przyjęte ryzyko: koordynator może pobrać wszystkie kontakty kompletnych profili jednym `GET /rest/v1/caregiver_contacts` bez filtra (RPC dla pojedynczego id nie pomogłoby — da się je wołać w pętli po wynikach `search_caregivers`); to adresuje przyszły wycinek limitów i scrapingu.
- Kontakt dla opiekunów (także dla innego opiekuna) i kont bez roli; zmiana roli; drugie konto w jednym loginie.
- Profil koordynatora i jego kontakt dla opiekunów (FR-013, FR-014).
- Dostępność (S-04), ranking (S-05), usuwanie profilu (S-06).
- Zachowanie filtrów listy w linku „Wróć do listy” (wraca wstecz przeglądarka); przyciski „Kopiuj”.
- Playwright / E2E — osobna zmiana przez `/10x-e2e-setup`.
- Restyle — styl startera bez zmian.

## Implementation Approach

Baza → auth → strony. Faza 1 przesuwa granicę dostępu do kontaktu w RLS (jedyna bramka, której nie da się obejść z poziomu aplikacji) i dodaje odczyt pojedynczego publicznego profilu z tą samą regułą widoczności co lista. Faza 2 wprowadza sprawdzony parametr `next` w całej ścieżce auth i jest testowalna na istniejących trasach chronionych (`/dashboard`, `/profil`). Faza 3 dokłada strony: publiczną bez kontaktu i chronioną, na której to RLS decyduje, czy kontakt wróci. Strona nie powiela reguły roli — o treści komunikatu decyduje dopiero wtedy, gdy kontaktu brak.

## Critical Implementation Details

- **Kolejność kroków smoke.** Smoke ma jeden słoik ciasteczek (sesja przechodzi z opiekuna na koordynatora po „signup sends coordinator home”). Kroki stron z sesją koordynatora muszą stać po tym kroku, a kroki anonima — po wylogowaniu albo przed pierwszym logowaniem. Odwrócony krok RLS dla koordynatora zmienia tytuł (nowy wiersz Progress), nie znaczenie innych kroków.
- **Walidacja `next`.** Ścieżka musi zaczynać się od jednego `/`; odrzucić `//…`, `/\…`, znaki kontrolne i cokolwiek, co po `new URL(value, "http://app.invalid")` ma inny origin. Odrzucić też cele w `/api/` i `/auth/` (pętle i POST-only). Jeden helper używany wszędzie — żadnej lokalnej walidacji w endpointach.

## Phase 1: Dostęp do kontaktu w bazie

### Overview

Koordynator może odczytać kontakt kompletnego profilu; nikt poza właścicielem nie odczyta kontaktu profilu niekompletnego. Pojedynczy publiczny profil ma funkcję SQL z tą samą regułą widoczności co lista.

### Changes Required:

#### 1. Migracja dostępu koordynatora

**File**: `supabase/migrations/20261103220000_coordinator_contact_access.sql`

**Intent**: Zastąpić politykę `caregiver_contacts_select_authenticated` jedną polityką: właściciel albo konto z rolą `coordinator`, gdy profil jest kompletny wg `caregiver_profile_missing()`. Dodać `get_public_caregiver()` dla strony profilu. Nagłówek migracji opisuje decyzje S-03 (tylko koordynator, tylko kompletne, bez rejestru odsłonięć) i przyjęte ryzyko: koordynator może jednym zapytaniem REST bez filtra pobrać kontakty wszystkich kompletnych profili.

**Contract**:
- `drop policy caregiver_contacts_select_authenticated on public.caregiver_contacts;` i `create policy` o tej samej nazwie, `for select to authenticated using ( caregiver_id = (select auth.uid()) or ( exists (select 1 from public.accounts a where a.user_id = (select auth.uid()) and a.role = 'coordinator') and cardinality(public.caregiver_profile_missing(caregiver_id)) = 0 ) )`. Polityki insert/update i brak polityki dla `anon` bez zmian; grantów tabel nie zmieniamy.
- Zaktualizować `comment on table public.caregiver_contacts` (czytelny dla właściciela i koordynatorów przy kompletnym profilu; nigdy dla anon).
- `public.get_public_caregiver(p_caregiver_id uuid) returns table (user_id uuid, display_name text, description text, services jsonb, gminas jsonb)`, `language sql stable security invoker set search_path = ''`: zero wierszy, gdy profil nie istnieje albo `caregiver_profile_missing()` niepusta; `services`/`gminas` w kształcie i kolejności jak w `search_caregivers()` (tylko aktywne gminy). Nigdy nie czyta `caregiver_contacts`.
- `revoke execute … from public; grant execute … to anon, authenticated;`

#### 2. Smoke — RLS i funkcja profilu

**File**: `scripts/smoke.mjs`

**Intent**: Dowód w CI nowej granicy: tak dla koordynatora przy kompletnym profilu, nie dla profilu niekompletnego, innego opiekuna i anonima.

**Contract**:
- Krok „coordinator cannot read caregiver contact” zastąpiony przez „coordinator reads complete caregiver contact”: jeden wiersz z `phone === "+48600100200"` i `email === contactEmail`.
- Nowy aktor: trzeci opiekun przez `POST /auth/v1/signup` (`smoke-caregiver3-<stamp>@example.com`, rola `caregiver`; zapamiętać `user.id` jako `incompleteCaregiverId` i token), zapis `save_caregiver_profile` bez telefonu z e-mailem `kontakt3-<stamp>@example.com` (204).
- „coordinator cannot read incomplete caregiver contact” — `caregiver_contacts?caregiver_id=eq.<incompleteCaregiverId>` z `coordinatorToken`: pusta tablica.
- „second caregiver cannot read first caregiver contact” — z `secondCaregiverToken`: pusta tablica.
- „anon reads public caregiver” — `POST /rest/v1/rpc/get_public_caregiver` z `caregiverId`: jeden wiersz, bez kluczy z `CONTACT_KEYS`, serializacja bez `contactEmail` i `+48600100200`.
- „public caregiver hides incomplete profile” — to samo dla `incompleteCaregiverId`: pusta tablica.
- Istniejący krok „anon cannot read caregiver contact” zostaje bez zmian.

### Success Criteria:

#### Automated Verification:

- Wszystkie migracje stosują się od zera: `npx supabase db reset`
- Lint bazy bez błędów: `npx supabase db lint --level error`
- Lint przechodzi: `npm run lint`
- Smoke przechodzi z nowymi krokami RLS: `npm run smoke`

#### Manual Verification:

- W `psql` `select policyname, cmd, roles from pg_policies where tablename = 'caregiver_contacts'` pokazuje dokładnie jedną politykę SELECT (dla `authenticated`), a opiekun nadal zapisuje swój profil na `/profil/edycja` bez błędu

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Powrót po logowaniu (`next`)

### Overview

Każde wejście do logowania lub rejestracji niesie sprawdzony adres powrotu; po sukcesie użytkownik wraca tam, gdzie był. Zewnętrzne cele są ignorowane.

### Changes Required:

#### 1. Helper adresu powrotu

**File**: `src/lib/redirect.ts`

**Intent**: Jedno miejsce walidacji `next` (bez I/O) i budowania adresów auth z `next`.

**Contract**:
- `safeNextPath(value: unknown): string | null` — zwraca `pathname + search` lokalnej ścieżki albo `null` wg reguł z „Critical Implementation Details”.
- `withNext(path: string, next: string | null): string` — dokleja `next` (zakodowany) do `path`, zachowując istniejące parametry (np. `error`).

#### 2. Middleware

**File**: `src/middleware.ts`

**Intent**: Przekierowanie z trasy chronionej niesie adres, z którego przyszedł anonim.

**Contract**: `context.redirect(withNext("/auth/signin", context.url.pathname + context.url.search))`; reszta bez zmian.

#### 3. Logowanie

**Files**: `src/pages/auth/signin.astro`, `src/components/auth/SignInForm.tsx`, `src/pages/api/auth/signin.ts`

**Intent**: Strona czyta `next` (przez `safeNextPath`), formularz wysyła go ukrytym polem, link „Załóż konto” go przenosi. Endpoint po sukcesie wraca na `next`, a bez niego zachowuje dzisiejszą regułę (opiekun → `/profil`, reszta → `/`); błędy wracają na `/auth/signin?error=…&next=…`.

**Contract**: prop `next?: string | null` w `SignInForm`; pole `<input type="hidden" name="next">` tylko gdy ustawione; endpoint czyta `form.get("next")` przez `safeNextPath`.

#### 4. Rejestracja i potwierdzenie e-maila

**Files**: `src/pages/auth/signup.astro`, `src/components/auth/SignUpForm.tsx`, `src/pages/api/auth/signup.ts`, `src/pages/auth/confirm-email.astro`

**Intent**: Jak w logowaniu, plus: przy `next` zaczynającym się od `/kontakt/` rola „Szukam opieki…” jest zaznaczona domyślnie (użytkownik może ją zmienić). Rejestracja z sesją → `next` albo dzisiejsza reguła; bez sesji → `/auth/confirm-email?next=…`, a link „logowanie” na tej stronie przenosi `next`. Wyjątek: nowe konto opiekuna zawsze idzie na `/profil/edycja` (onboarding ma pierwszeństwo), a bez sesji na `/auth/confirm-email` bez `next` — `next` przy rejestracji dotyczy tylko koordynatora. W logowaniu `next` wygrywa dla każdej roli.

**Contract**: props `next?: string | null` i `initialRole?: AccountRole` w `SignUpForm`; `next` dodany do schematu zod jako opcjonalny string, walidowany `safeNextPath` (zły `next` nie jest błędem rejestracji — jest pomijany).

#### 5. Smoke — `next`

**File**: `scripts/smoke.mjs`

**Intent**: Pilnować w CI powrotu i odrzucania zewnętrznych celów.

**Contract**:
- „dashboard redirects anonymous user” → `exact` `/auth/signin?next=%2Fdashboard`.
- „signin returns to next” — logowanie opiekuna z `next=/dashboard`: `exact` `/dashboard`.
- „signin ignores external next” — po jednym kroku dla `//evil.example`, `/\evil.example` i `https://evil.example`: `exact` `/profil` (dzisiejsza reguła dla opiekuna).
- „signin error keeps next” — złe hasło z `next=/dashboard`: `location` zaczyna się od `/auth/signin?error=` i zawiera `next=%2Fdashboard`.
- „signin page carries next” — `GET /auth/signin?next=%2Fdashboard`: HTML zawiera `name="next"` i `/auth/signup?next=%2Fdashboard`.
- Istniejące kroki bez `next` (`exact: true` dla `/profil`, `/profil/edycja`, `/`) przechodzą bez zmian.
- Miejsce kroków: „dashboard redirects anonymous user” zostaje na swoim miejscu (przed pierwszym logowaniem); kroki logowania z `next` stoją zaraz po „signin sends caregiver to profile”, w oknie, w którym Anna i tak jest zalogowana — nie po „signout clears session”, bo zalogowałyby ją w oknie kroków anonima.

### Success Criteria:

#### Automated Verification:

- Lint przechodzi: `npm run lint`
- Typy przechodzą: `npx astro check`
- Build przechodzi: `npm run build`
- Smoke przechodzi z krokami `next`: `npm run smoke`

#### Manual Verification:

- Jako anonim wejście na `/dashboard` prowadzi do logowania, link „Załóż konto” zachowuje `next`, a po zalogowaniu opiekun wraca na `/dashboard` (nie na domyślny `/profil`)
- Ręcznie wpisany `/auth/signin?next=https://example.com` po zalogowaniu prowadzi na trasę domyślną, nie na zewnętrzną domenę

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Strony profilu i kontaktu

### Overview

Publiczna strona profilu bez kontaktu, chroniona strona z kontaktem i linki z kart listy — pełna ścieżka north star.

### Changes Required:

#### 1. Typy

**File**: `src/types.ts`

**Intent**: Osobny typ kontaktu, z komentarzem, że trafia tylko na trasy chronione; `OwnCaregiverProfileDto.contact` go używa.

**Contract**: `export interface CaregiverContactDto { phone: string | null; email: string | null }`. `PublicCaregiverDto` bez zmian (bez pól kontaktu).

#### 2. Serwis

**File**: `src/lib/services/caregiver.service.ts`

**Intent**: Odczyt pojedynczego publicznego profilu i kontaktu; mapowanie wiersza publicznego wspólne z listą.

**Contract**:
- Wydzielony mapper wiersza publicznego (używany przez `searchCaregivers` i nową funkcję).
- `getPublicCaregiver(supabase, id): Promise<PublicCaregiverDto | null>` — RPC `get_public_caregiver`; brak wiersza → `null`.
- `getCaregiverContact(supabase, id): Promise<CaregiverContactDto | null>` — `from("caregiver_contacts").select("phone, email").eq("caregiver_id", id).maybeSingle()`; `null`, gdy RLS nic nie zwróci. Błąd zapytania → wyjątek (jak reszta serwisu).

#### 3. Wspólna część publiczna

**File**: `src/components/caregiver/CaregiverPublicDetails.astro`

**Intent**: Imię, pełny opis, usługi i wszystkie aktywne gminy — renderowane identycznie na obu stronach; komponent przyjmuje tylko `PublicCaregiverDto`, więc nie da się do niego podać kontaktu.

**Contract**: prop `caregiver: PublicCaregiverDto`; style kart z listy.

#### 4. Publiczny profil

**File**: `src/pages/opiekunowie/[id].astro`

**Intent**: Strona dla wszystkich. Zły UUID (zod `uuid`) albo `getPublicCaregiver` → `null` daje status 404 z komunikatem „Nie znaleziono opiekuna” i linkiem do listy. Poniżej szczegółów przycisk-link „Pokaż dane kontaktowe” na `/kontakt/<id>`, dla anonima z dopiskiem, że wymaga darmowego konta koordynatora. Link „Wróć do listy”.

**Contract**: `Cache-Control: private, no-store` (Topbar pokazuje e-mail zalogowanego); `createClient` → `null` daje komunikat jak na liście; błąd odczytu → `console.error` + ogólny komunikat (wzorzec z `src/pages/opiekunowie/index.astro`). Strona nie woła `getCaregiverContact`.

#### 5. Chroniona strona kontaktu

**Files**: `src/pages/kontakt/[id].astro`, `src/middleware.ts`

**Intent**: `/kontakt` w `PROTECTED_ROUTES`. Strona: 404 jak wyżej; równolegle `getPublicCaregiver` i `getCaregiverContact`; renderuje `CaregiverPublicDetails` i sekcję kontaktu. Kontakt jest → telefon jako `tel:` z `formatPlPhone`, e-mail jako `mailto:` albo „Opiekun nie podał e-maila”. Kontaktu brak → komunikat zależny od `getRole()`: opiekun lub brak roli — „Dane kontaktowe opiekunów widzą tylko konta koordynatorów”; koordynator — „Dane kontaktowe są chwilowo niedostępne”. Link powrotny do `/opiekunowie/<id>`.

**Contract**: `PROTECTED_ROUTES = ["/dashboard", "/profil", "/kontakt"]`; `Cache-Control: private, no-store`; o tym, czy kontakt wraca, decyduje wyłącznie RLS — strona nie sprawdza roli przed odczytem.

#### 6. Linki z listy

**File**: `src/pages/opiekunowie/index.astro`

**Intent**: Imię na karcie staje się linkiem do `/opiekunowie/<id>`.

**Contract**: `<a href={`/opiekunowie/${caregiver.id}`}>` wewnątrz `h3`; reszta karty bez zmian.

#### 7. Smoke — strony i pełny przepływ

**File**: `scripts/smoke.mjs`

**Intent**: Dowód braku wycieku w HTML, ochrony trasy i pełnej ścieżki nowego koordynatora.

**Contract** (anonim — między „signout clears session” a „signup sends coordinator home”):
- „public profile page hides contact” — `GET /opiekunowie/<caregiverId>`: 200, `noindex`, HTML zawiera „Anna Smoke” i `href="/kontakt/<caregiverId>"`, nie zawiera `contactEmail`, `+48600100200`, `600100200` ani `600 100 200`.
- „public profile page 404 for incomplete profile” — `/opiekunowie/<incompleteCaregiverId>`: 404; „public profile page 404 for malformed id” — `/opiekunowie/nie-uuid`: 404.
- „list links to profile page” — `GET /opiekunowie?gmina=1465011`: HTML zawiera `href="/opiekunowie/<caregiverId>"`.
- „contact page redirects anonymous user” — `/kontakt/<caregiverId>`: `exact` `/auth/signin?next=%2Fkontakt%2F<caregiverId>`.

Contract (z sesją, po „signup sends coordinator home”, w tej kolejności):
- „contact page shows contact to coordinator” — sesja koordynatora: 200, HTML zawiera `tel:+48600100200` i `contactEmail`.
- „contact page 404 for incomplete profile” — sesja koordynatora, `/kontakt/<incompleteCaregiverId>`: 404.
- „signin caregiver again” — `POST /api/auth/signin` jako Anna (bez `next`): `exact` `/profil`; słoik przechodzi z koordynatora na Annę.
- „contact page hides contact from caregiver” — sesja opiekuna (Anna) na `/kontakt/<secondCaregiverId>`: 200, bez `+48600100300`, z komunikatem dla kont koordynatorów. `secondCaregiverId` zapamiętuje krok „second caregiver gets Supabase access token” z `json.user.id` odpowiedzi signup.
- „new coordinator returns to contact after signup” — nowy koordynator (`smoke-coordinator2-<stamp>@example.com`) rejestruje się z `next=/kontakt/<caregiverId>`: `exact` `/kontakt/<caregiverId>`; następny `GET` tej strony zawiera `tel:+48600100200`.

#### 8. README

**File**: `README.md`

**Intent**: Tabela tras: `/opiekunowie/[id]` (publiczny profil), `/kontakt/[id]` (chroniony, kontakt dla koordynatorów); zdanie o `next` przy `PROTECTED_ROUTES`; opis smoke uzupełniony o odsłonięcie kontaktu.

**Contract**: sekcja „Auth routes” i opis `npm run smoke`.

### Success Criteria:

#### Automated Verification:

- Lint przechodzi: `npm run lint`
- Typy przechodzą: `npx astro check`
- Build przechodzi: `npm run build`
- Smoke przechodzi z krokami stron i pełnego przepływu: `npm run smoke`

#### Manual Verification:

- Na ekranie 375 px anonim przechodzi: lista → karta → profil → „Pokaż dane kontaktowe” → „Załóż konto” (rola koordynatora zaznaczona) → rejestracja → `/kontakt/<id>` z klikalnym numerem i e-mailem
- W źródle strony `/opiekunowie/<id>` oglądanej jako anonim nie ma telefonu ani e-maila opiekuna, a odpowiedzi obu stron mają `X-Robots-Tag: noindex` i `Cache-Control: private, no-store`
- Zalogowany opiekun na `/kontakt/<id>` innego opiekuna widzi profil bez kontaktu i komunikat dla kont koordynatorów

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- Brak zestawu testów jednostkowych w repozytorium; `safeNextPath` jest pokryty pośrednio przez kroki smoke dla `//`, `/\` i `https://`.

### Integration Tests:

- `npm run smoke`: RLS przez REST jako koordynator, drugi opiekun i anon (kompletny i niekompletny profil); `get_public_caregiver` jako anon; `next` w logowaniu i rejestracji; strony publiczna i chroniona (HTML, statusy, nagłówki); pełna ścieżka nowego koordynatora od rejestracji z `next` do numeru.

### Manual Testing Steps:

1. Anonim na telefonie: lista → profil → „Pokaż dane kontaktowe” → rejestracja koordynatora → numer i e-mail jako linki.
2. Anonim: źródło `/opiekunowie/<id>` bez kontaktu; nagłówki `noindex` i `no-store`.
3. Opiekun zalogowany: `/kontakt/<id>` innego opiekuna bez kontaktu; własny profil nadal zapisuje się bez błędu.
4. `/auth/signin?next=https://example.com` → po zalogowaniu trasa domyślna.

## Performance Considerations

Polityka wywołuje `caregiver_profile_missing()` i podzapytanie do `accounts` na każdy wiersz `caregiver_contacts` widziany przez koordynatora; strony czytają zawsze jeden wiersz (`eq caregiver_id`), więc koszt jest stały. Zapytanie bez filtra przez REST jest wolniejsze, ale nie leży na ścieżce aplikacji.

## Migration Notes

Migracja tylko zmienia politykę i dodaje funkcję — bez zmian danych. Wycofanie: przywrócić poprzednią politykę „tylko właściciel” i usunąć `get_public_caregiver()` nową migracją. Na produkcji koordynatorzy zarejestrowani przed S-03 od razu zyskują dostęp; konta bez roli (sprzed S-01) — nie.

## References

- Roadmap: `context/foundation/roadmap.md` (S-03)
- PRD: `context/foundation/prd.md` (US-01, FR-002, FR-012, Guardrails, Access Control, Open Question 1)
- Poprzednie wycinki: `context/archive/2026-11-03-caregiver-profile-setup/plan.md`, `context/archive/2026-11-03-public-caregiver-search/plan.md`
- Polityka kontaktu dziś: `supabase/migrations/20261103150000_caregiver_profiles.sql:101`
- Wzorzec funkcji publicznej: `supabase/migrations/20261103200000_search_caregivers.sql`
- Wzorzec strony SSR z serwisem: `src/pages/opiekunowie/index.astro`
- Smoke: `scripts/smoke.mjs:361`, `:382-383`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Dostęp do kontaktu w bazie

#### Automated

- [x] 1.1 Wszystkie migracje stosują się od zera: `npx supabase db reset` — 498508b
- [x] 1.2 Lint bazy bez błędów: `npx supabase db lint --level error` — 498508b
- [x] 1.3 Lint przechodzi: `npm run lint` — 498508b
- [x] 1.4 Smoke przechodzi z nowymi krokami RLS: `npm run smoke` — 498508b

#### Manual

- [x] 1.5 W `psql` `select policyname, cmd, roles from pg_policies where tablename = 'caregiver_contacts'` pokazuje dokładnie jedną politykę SELECT (dla `authenticated`), a opiekun nadal zapisuje swój profil na `/profil/edycja` bez błędu — 498508b

### Phase 2: Powrót po logowaniu (`next`)

#### Automated

- [x] 2.1 Lint przechodzi: `npm run lint`
- [x] 2.2 Typy przechodzą: `npx astro check`
- [x] 2.3 Build przechodzi: `npm run build`
- [x] 2.4 Smoke przechodzi z krokami `next`: `npm run smoke`

#### Manual

- [x] 2.5 Jako anonim wejście na `/dashboard` prowadzi do logowania, link „Załóż konto” zachowuje `next`, a po zalogowaniu opiekun wraca na `/dashboard` (nie na domyślny `/profil`)
- [x] 2.6 Ręcznie wpisany `/auth/signin?next=https://example.com` po zalogowaniu prowadzi na trasę domyślną, nie na zewnętrzną domenę

### Phase 3: Strony profilu i kontaktu

#### Automated

- [ ] 3.1 Lint przechodzi: `npm run lint`
- [ ] 3.2 Typy przechodzą: `npx astro check`
- [ ] 3.3 Build przechodzi: `npm run build`
- [ ] 3.4 Smoke przechodzi z krokami stron i pełnego przepływu: `npm run smoke`

#### Manual

- [ ] 3.5 Na ekranie 375 px anonim przechodzi: lista → karta → profil → „Pokaż dane kontaktowe” → „Załóż konto” (rola koordynatora zaznaczona) → rejestracja → `/kontakt/<id>` z klikalnym numerem i e-mailem
- [ ] 3.6 W źródle strony `/opiekunowie/<id>` oglądanej jako anonim nie ma telefonu ani e-maila opiekuna, a odpowiedzi obu stron mają `X-Robots-Tag: noindex` i `Cache-Control: private, no-store`
- [ ] 3.7 Zalogowany opiekun na `/kontakt/<id>` innego opiekuna widzi profil bez kontaktu i komunikat dla kont koordynatorów
