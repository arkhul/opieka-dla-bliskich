# Publiczna lista opiekunów z filtrami gminy i usługi — Implementation Plan

## Overview

Wycinek S-02 (US-01, FR-008, FR-009, FR-010): każdy — także bez logowania — przegląda na `/opiekunowie` listę kompletnych profili opiekunów i zawęża ją po gminie (warunek twardy) i rodzaju usług (profil musi mieć wszystkie wybrane). Lista nie zawiera żadnych danych kontaktowych, a cała aplikacja dostaje `X-Robots-Tag: noindex`, bo to pierwsza strona publiczna na indeksowalnym hoście `*.workers.dev`.

## Current State Analysis

- Schemat z S-01 już dzieli profil: `caregiver_profiles`, `caregiver_gminas`, `caregiver_services` są czytelne dla `anon`, a `caregiver_contacts` tylko dla właściciela (`supabase/migrations/20261103150000_caregiver_profiles.sql:64-196`). S-02 nie zmienia RLS.
- Reguła kompletności (imię + telefon + ≥1 aktywna gmina + ≥1 usługa) żyje w jednej funkcji `public.caregiver_profile_missing(uuid)` (`security definer`, grant dla `anon`; `20261103150000_caregiver_profiles.sql:356-413`). Strona `/profil` obiecuje opiekunowi: „Profil nie będzie widoczny dla koordynatorów, dopóki nie uzupełnisz…” (`src/pages/profil/index.astro`), więc lista musi pokazywać wyłącznie profile kompletne.
- Follow-up F7 z przeglądu S-01 (`context/archive/2026-11-03-caregiver-profile-setup/follow-ups/review-fixes.md`) wymaga, by plan S-02 określił, jak lista stosuje regułę kompletności (bez N+1) i czy grant `anon` zostaje.
- `search_gminas()` zwraca tylko aktywne gminy (`20261103120000_retirable_gminas.sql:30-60`); `GminaPicker.tsx` to wyspa wielokrotnego wyboru z logiką wyszukiwania wpisaną w komponent — S-02 potrzebuje wariantu pojedynczego wyboru.
- Wzorzec stron: `.astro` z `createClient()` (obsługa `null`), wywołanie serwisu, `Topbar`, styl `bg-cosmic` (`src/pages/profil/index.astro`). Serwisy zwracają DTO z `src/types.ts`; etykiety gmin przez `formatGminaLabel` (`src/lib/gmina.ts`).
- Strona główna to nadal starter („10x Astro Starter”, `src/components/Welcome.astro`), a `Layout.astro` ma domyślny tytuł startera.
- Host `*.workers.dev` jest indeksowalny, a aplikacja nie wysyła `noindex` (`context/foundation/infrastructure.md:151,198`). `@astrojs/sitemap` jest włączony, ale bez `site` w `astro.config.mjs` nie generuje mapy.
- Smoke (`scripts/smoke.mjs`) parsuje wyłącznie JSON i nie widzi nagłówków ani HTML; ma już fazę „po wylogowaniu”, w której żądania idą jako anonim.

## Desired End State

Anonim wchodzi na `/`, klika „Znajdź opiekuna” i na `/opiekunowie` widzi kompletne profile (imię, opis, usługi, gminy) od ostatnio aktualizowanych, po 20 na stronę. Wybiera gminę z autocomplete i zaznacza usługi; adres URL (`/opiekunowie?gmina=1465011&usluga=towarzystwo&strona=2`) w pełni opisuje stan, więc da się go odświeżyć i udostępnić. Każdy aktywny filtr ma chip „×”, który zdejmuje tylko ten filtr. Przy braku wyników strona wyjaśnia, że żaden profil nie spełnia wszystkich warunków, i podaje linki „Usuń filtr usług (wyniki: N)” / „Usuń filtr gminy (wyniki: M)”. W HTML-u ani w odpowiedzi RPC nie ma telefonu ani e-maila, a każda odpowiedź aplikacji ma `X-Robots-Tag: noindex`. Weryfikacja: `npm run smoke` (kroki RPC jako anon + kroki strony po wylogowaniu) oraz ręczny przegląd na 375 px.

### Key Discoveries:

- `caregiver_profile_missing()` jest `security definer`, więc funkcja `security invoker` wywołana przez `anon` może go użyć do filtrowania bez dostępu do `caregiver_contacts` — reguła zostaje w jednym miejscu (`20261103150000_caregiver_profiles.sql:356`).
- Sama lista ujawnia „profil jest kompletny”, więc grant `anon` na `caregiver_profile_missing()` nie odsłania niczego ponad listę — zostaje (zamyka F7).
- `save_caregiver_profile()` ustawia `updated_at = now()` przy każdym zapisie (`20261103150000_caregiver_profiles.sql:312-317`) — to podstawa kolejności.
- `PROTECTED_ROUTES` dopasowuje przez `startsWith` (`src/middleware.ts:6`) — `/opiekunowie` nie może tam trafić, bo zablokowałby publiczną listę (ważne dla S-03).
- Middleware nie obsługuje plików statycznych z bindingu `ASSETS` (`wrangler.jsonc`), więc `noindex` dotyczy odpowiedzi SSR — wystarczy, bo tylko one niosą treść profili.

## What We're NOT Doing

- Publiczna strona pojedynczego profilu (`/opiekunowie/[id]`) i odsłonięcie kontaktu — S-03.
- Filtr dostępności — S-04. Ranking dopasowania i oznaczenie braków — S-05 (do tego czasu usługi filtrują twardo: „ma wszystkie wybrane”).
- Publiczny endpoint JSON listy w `src/pages/api/` — strona SSR woła serwis bezpośrednio; mniejsza powierzchnia publiczna.
- `robots.txt` z `Disallow` — zablokowałby crawlerowi odczyt nagłówka `noindex`; wystarczy `X-Robots-Tag`. Indeksowanie wraca do decyzji przy własnej domenie/starcie.
- Zmiany w `@astrojs/sitemap` i konfiguracji `site`.
- Zmiany RLS, cofnięcie grantu `anon` na `caregiver_profile_missing()`.
- Sortowanie wybierane przez użytkownika, wyszukiwanie po imieniu, filtr po wielu gminach.
- Nowy wygląd (restyle przez `/10x-ui`) — styl startera bez zmian.

## Implementation Approach

Kolejność baza → serwis/strona → wejścia. Całe filtrowanie, reguła kompletności, kolejność, stronicowanie i liczba wyników liczą się w jednej funkcji SQL `search_caregivers()` (`security invoker`, czyta tabele pod RLS wywołującego), która z założenia zwraca tylko kolumny publiczne. Strona `/opiekunowie` trzyma stan filtrów w parametrach URL i formularzu `GET`, więc działa bez JS (poza autocomplete gminy), a „zdjęcie jednego filtra” to zwykły link bez tego parametru. Podpowiedzi przy pustym wyniku to dodatkowe wywołania tej samej funkcji z jednym wymiarem zdjętym i `p_limit => 1` — bez osobnej funkcji liczącej, więc predykat nie może się rozjechać.

## Critical Implementation Details

- **Performance constraints** — `count(*) over ()` musi liczyć się na zbiorze przefiltrowanym przed `limit/offset` (CTE z dopasowaniami, potem okno, sortowanie i limit). `caregiver_profile_missing()` wykonuje się per kandydat (4× `exists`) — przy docelowej skali (dziesiątki–setki profili) mieści się w NFR < 1 s; filtry gminy i usług stawiamy w tym samym `where`, by planista mógł je zastosować przed regułą.
- **User experience spec** — każda zmiana filtra (submit formularza, chip, link podpowiedzi) zeruje stronę do 1 (parametr `strona` pomijany). Numer strony poza zakresem przy `total > 0` daje komunikat „Nie ma takiej strony wyników” z linkiem do strony 1, a nie pusty stan filtrów.

## Phase 1: Zapytanie wyszukiwania w bazie

### Overview

Funkcja `search_caregivers()` realizuje regułę widoczności, filtry, kolejność i stronicowanie po stronie bazy; smoke dowodzi jej zachowania bezpośrednio przez PostgREST jako anon.

### Changes Required:

#### 1. Migracja `search_caregivers`

**File**: `supabase/migrations/20261103200000_search_caregivers.sql`

**Intent**: Jedno źródło publicznej listy: tylko profile kompletne wg `caregiver_profile_missing()`, opcjonalny filtr aktywnej gminy, opcjonalny filtr usług w semantyce „ma wszystkie wybrane”, kolejność od ostatnio aktualizowanych, stronicowanie i łączna liczba dopasowań. Komentarz nagłówka migracji odnotowuje decyzję F7 (reguła reużyta, grant `anon` zostaje, bo lista i tak ujawnia kompletność).

**Contract**:
- `public.search_caregivers(p_teryt text default null, p_services text[] default null, p_limit int default 20, p_offset int default 0)`
  `returns table (user_id uuid, display_name text, description text, updated_at timestamptz, services jsonb, gminas jsonb, total_count bigint)`, `language sql stable security invoker set search_path = ''`.
- Predykat: `cardinality(public.caregiver_profile_missing(p.user_id)) = 0`; `p_teryt is null` albo istnieje powiązanie `caregiver_gminas` z tą gminą **i** gmina jest `active`; `p_services` `null`/pusta albo nie istnieje wybrany slug, którego profil nie ma (`null` w tablicy ignorowane). Nieznany slug → brak dopasowań (aplikacja odfiltrowuje je wcześniej).
- `services`: `[{slug, label}]` w `services.sort_order`; `gminas`: tylko aktywne, `[{teryt, name, kind, powiat, wojewodztwo}]` sortowane po `name, teryt`.
- Kolejność `updated_at desc, user_id`; `p_limit` przycięty do 1..50, `p_offset` do ≥ 0; `total_count` = liczba wszystkich dopasowań (ta sama w każdym wierszu; brak wierszy ⇒ brak liczby, co serwis traktuje jako 0 tylko przy `offset = 0`).
- Zwracane kolumny nigdy nie obejmują `caregiver_contacts` (komentarz `comment on function` to zaznacza).
- `revoke execute … from public; grant execute … to anon, authenticated;`

#### 2. Smoke — kroki RPC jako anon

**File**: `scripts/smoke.mjs`

**Intent**: Dowód w CI, że lista ukrywa profil niekompletny, filtruje twardo po gminie, wymaga wszystkich usług i nie zwraca danych kontaktowych.

**Contract**:
- Nowy krok przed „profile save normalizes phone and completes profile”: zapis profilu bez telefonu (`{ ...completeProfile, phone: "" }`), który ustawia `caregiverId`; po nim „search hides incomplete profile” (`POST /rest/v1/rpc/search_caregivers` z `{ p_teryt: "1465011", p_limit: 50 }` — brak wiersza z `caregiverId`).
- Po kompletnym zapisie (anon, `supabase()` bez tokenu, `p_limit: 50`):
  - „search lists complete profile in its gmina” — wiersz z `caregiverId` jest, a żaden wiersz nie ma kluczy `phone`, `email`, `caregiver_contacts`;
  - „search hides profile in other gmina” — `p_teryt: "1061011"`, brak `caregiverId`;
  - „search requires all selected services” — `p_services: ["towarzystwo", "demencja"]` z gminą 1465011, brak `caregiverId`;
  - „search matches selected service” — `p_services: ["towarzystwo"]`, `caregiverId` jest;
  - „second caregiver gets Supabase access token” — `POST /auth/v1/signup` z `smoke-caregiver2-<stamp>@example.com`, `data: { role: "caregiver" }`: 200 i `access_token` (zapamiętany jako `secondCaregiverToken`);
  - „second caregiver saves complete profile” — `POST /rest/v1/rpc/save_caregiver_profile` z `secondCaregiverToken` (imię „Bartek Smoke”, telefon `+48600100300`, gmina 1465011, usługa `towarzystwo`): 204;
  - „search counts matches before the limit” — `p_teryt: "1465011"`, `p_limit: 1`: dokładnie jeden wiersz i `total_count >= 2` (na czystej bazie w CI są tu co najmniej dwa kompletne profile, więc liczenie po limicie dałoby 1).
- `completeProfile.email` = `kontakt-<stamp>@example.com` (kontaktowy, różny od loginu), żeby asercje braku e-maila sprawdzały prawdziwą wartość z `caregiver_contacts`; „search lists complete profile in its gmina” dodatkowo sprawdza, że serializowana odpowiedź nie zawiera tego adresu ani `+48600100200`.
- Komentarz nagłówka skryptu wspomina listę opiekunów.

### Success Criteria:

#### Automated Verification:

- Wszystkie migracje stosują się od zera: `npx supabase db reset`
- Lint bazy bez błędów: `npx supabase db lint --level error`
- Lint przechodzi: `npm run lint`
- Smoke przechodzi z nowymi krokami RPC: `npm run smoke`

#### Manual Verification:

- W `psql` jako `set role anon` wywołanie `select * from public.search_caregivers('1465011')` zwraca tylko kolumny publiczne, a `explain analyze` pokazuje czas wykonania wyraźnie poniżej 100 ms na lokalnych danych

**Implementation Note**: Po przejściu weryfikacji automatycznej zatrzymaj się na ręczne potwierdzenie przed kolejną fazą.

---

## Phase 2: Publiczna lista z filtrami

### Overview

Strona `/opiekunowie` z formularzem filtrów, chipami, kartami, stronicowaniem i pustym stanem z podpowiedziami; `noindex` dla całej aplikacji; smoke sprawdza stronę jako anonim.

### Changes Required:

#### 1. Typy

**File**: `src/types.ts`

**Intent**: DTO bezpieczne dla stron publicznych i opis filtra, współdzielone przez serwis i stronę.

**Contract**: `PublicCaregiverDto { id; displayName; description: string | null; services: ServiceDto[]; gminas: GminaDto[] }` — z komentarzem, że nie ma i nie może mieć pól kontaktowych; `CaregiverSearchFilter { teryt: string | null; services: string[] }`.

#### 2. Serwisy

**File**: `src/lib/services/caregiver.service.ts`, `src/lib/services/dictionary.service.ts`

**Intent**: Wywołanie `search_caregivers` i mapowanie na DTO (z `formatGminaLabel`) oraz odczyt pojedynczej aktywnej gminy dla chipa filtra.

**Contract**:
- `CAREGIVER_PAGE_SIZE = 20`; `searchCaregivers(supabase, filter: CaregiverSearchFilter, page: number): Promise<{ caregivers: PublicCaregiverDto[]; total: number }>` (offset `(page-1)*20`; `total` z `total_count`; brak wierszy przy `page = 1` ⇒ `total = 0`, brak wierszy przy `page > 1` ⇒ `total` z `countCaregivers(supabase, filter)`, żeby strona mogła odróżnić „strona poza zakresem” od pustego wyniku);
- `countCaregivers(supabase, filter): Promise<number>` — to samo RPC z `p_limit: 1, p_offset: 0`;
- `getActiveGmina(supabase, teryt): Promise<GminaDto | null>` w `dictionary.service.ts` (tylko `active`).
- Błędy jak w istniejących serwisach: `throw new Error("Failed to … : " + message)`.

#### 3. Parsowanie i adresy filtrów

**File**: `src/lib/caregiver-search.ts`

**Intent**: Czyste helpery bez I/O: odczyt parametrów URL odporny na śmieci i budowanie linków, które zachowują pozostałe filtry.

**Contract**:
- `parseCaregiverSearch(params: URLSearchParams, knownServiceSlugs: string[]): { filter: CaregiverSearchFilter; page: number }` — zod: `gmina` pasuje do `^[0-9]{6}[123]$`, inaczej `null`; `usluga` (wielokrotny) — deduplikacja, tylko slugi z katalogu, w kolejności katalogu; `strona` — liczba całkowita ≥ 1, inaczej 1. Błędne parametry są ignorowane, nigdy nie dają błędu strony.
- `buildCaregiverSearchHref(filter, page = 1): string` — `/opiekunowie` + parametry w stałej kolejności (`gmina`, `usluga`…, `strona` tylko gdy > 1).

#### 4. Wybór gminy (pojedynczy) i wspólny hook

**File**: `src/hooks/useGminaSearch.ts`, `src/components/caregiver/GminaPicker.tsx`, `src/components/search/GminaSelect.tsx`

**Intent**: Logika wyszukiwania gmin (debounce, abort, statusy, min. 2 znaki) przenosi się do hooka używanego przez istniejący `GminaPicker` (bez zmiany zachowania) i nowy `GminaSelect` — combobox pojedynczego wyboru wpisujący TERC do ukrytego pola formularza `GET`.

**Contract**:
- `useGminaSearch(query: string): { status: "too-short" | "loading" | "done" | "invalid" | "error"; gminas: GminaDto[] }`.
- `GminaSelect({ name: string; initial: GminaDto | null })` — renderuje `<input type="hidden" name={name}>` z wybranym `teryt` (puste, gdy brak), przycisk z etykietą wybranej gminy lub „Wybierz gminę”, przycisk „Usuń gminę” (`aria-label`); te same komunikaty statusu co `GminaPicker`. Bez automatycznego wysyłania formularza: komponent leży w natywnym `<form method="get">`, więc każdy jego przycisk ma `type="button"` (jak `GminaPicker.tsx:124,143`), a formularz wysyła wyłącznie „Pokaż wyniki”.

#### 5. Strona listy

**File**: `src/pages/opiekunowie/index.astro`

**Intent**: Publiczna lista zgodna z US-01: filtry łączone, zdejmowane pojedynczo, pusty stan z wyjaśnieniem i podpowiedzią, bez danych kontaktowych.

**Contract**:
- Trasa publiczna (nie dodawać do `PROTECTED_ROUTES`); `Cache-Control: private, no-store` (Topbar zawiera e-mail zalogowanego); `Layout title="Opiekunowie"`, `Topbar`.
- `createClient()` → `null` ⇒ komunikat „Supabase nie jest skonfigurowany — lista jest niedostępna.”; wyjątek serwisu ⇒ „Nie udało się wczytać listy opiekunów. Odśwież stronę za chwilę.”
- Kolejność: katalog usług (`listServices`) → `parseCaregiverSearch` → przy `gmina` `getActiveGmina`; brak/wycofana ⇒ filtr zdjęty + notka „Wybrana gmina nie istnieje lub została wycofana — wybierz ją ponownie.” → `searchCaregivers`.
- Formularz `method="get" action="/opiekunowie"`: `GminaSelect` (`client:load`, `name="gmina"`), 13 natywnych checkboxów `name="usluga"`, przycisk „Pokaż wyniki”, link „Wyczyść filtry” (`/opiekunowie`). Na 375 px bez poziomego przewijania.
- Chipy aktywnych filtrów: „Gmina: <etykieta> ×” i po jednym na usługę; każdy to link `buildCaregiverSearchHref` bez tego jednego elementu.
- Nagłówek wyników „Wyniki: N” (forma bez odmiany liczebnika).
- Karta: imię (`h2`), opis przycięty do 3 linii (`line-clamp-3`, `break-words`), usługi jako chipy, gminy — dopasowana (z filtra) pierwsza, maks. 3 etykiety, reszta jako „+N”. Żadnego telefonu, e-maila ani linku do kontaktu.
- Stronicowanie: „Poprzednia” / „Strona X z Y” / „Następna” w `<nav aria-label="Stronicowanie">`, tylko gdy `total > 20`.
- Puste stany:
  - bez filtrów i `total = 0`: „Nie ma jeszcze opiekunów z uzupełnionym profilem.”;
  - z filtrami i `total = 0`: „Żaden opiekun nie spełnia wszystkich wybranych warunków.” oraz dla każdego aktywnego wymiaru link z liczbą wyników po jego zdjęciu (`countCaregivers`): „Usuń filtr usług (wyniki: N)”, „Usuń filtr gminy (wyniki: M)”; przy obu zerowych dopisek „Spróbuj sąsiedniej gminy.”;
  - `page` poza zakresem przy `total > 0`: „Nie ma takiej strony wyników.” + link do strony 1.

#### 6. `noindex` w middleware

**File**: `src/middleware.ts`

**Intent**: Strażnik PRD (kontakt i profile poza wyszukiwarkami) na indeksowalnym `*.workers.dev` i hostach preview, do czasu decyzji o indeksowaniu przy starcie.

**Contract**: Każda odpowiedź przechodząca przez middleware (także przekierowania z ochrony tras) ma nagłówek `X-Robots-Tag: noindex`. Jeśli nagłówki odpowiedzi z `next()` są niemodyfikowalne, odpowiedź jest klonowana przez `new Response(body, response)`.

#### 7. Smoke — strona jako anonim

**File**: `scripts/smoke.mjs`

**Intent**: Dowód, że strona działa bez sesji, nie wypuszcza kontaktu w HTML i wysyła `noindex`.

**Contract**:
- `readResponse` zwraca dodatkowo `text` (dla nie-JSON) i `headers`; oczekiwania obsługują `html: (text) => boolean` i `headers: (headers) => boolean` obok `body`.
- Kroki po „signout clears session”:
  - „caregiver list renders for anonymous user” — `GET /opiekunowie?gmina=1465011`: 200, HTML zawiera „Anna Smoke”, nie zawiera `600 100 200`, `600100200`, `+48600100200`, kontaktowego e-maila (`completeProfile.email`) ani loginu opiekuna (`email`); nagłówek `x-robots-tag` zawiera `noindex`;
  - „caregiver list shows relax hints when nothing matches” — gmina 1465011 i wszystkie 13 usług: 200, HTML zawiera „Usuń filtr usług”;
  - „caregiver list ignores malformed filters” — `?gmina=abc&usluga=nieznana&strona=-1`: 200;
  - „caregiver list reports unknown gmina” — `?gmina=9999991`: 200, HTML zawiera „nie istnieje lub została wycofana”;
  - „caregiver list reports page out of range” — `?gmina=1465011&strona=999`: 200, HTML zawiera „Nie ma takiej strony wyników”.
- Krok „home renders” sprawdza też `noindex` w nagłówku.

### Success Criteria:

#### Automated Verification:

- Lint przechodzi: `npm run lint`
- Typy przechodzą: `npx astro check`
- Build przechodzi: `npm run build`
- Smoke przechodzi z krokami strony: `npm run smoke`

#### Manual Verification:

- Jako anonim na `/opiekunowie` wybór gminy i dwóch usług, potem zdjęcie chipem jednej usługi — gmina i druga usługa zostają, a wynik się zgadza
- Pusty wynik pokazuje wyjaśnienie i linki z liczbami; kliknięcie linku daje dokładnie podaną liczbę wyników
- Profil opiekuna bez telefonu albo bez gminy nie pojawia się na liście, a po uzupełnieniu się pojawia
- Przy ponad 20 kompletnych profilach (np. po kilku przebiegach smoke) działa przejście na stronę 2 z zachowaniem filtrów
- Na 375 px formularz, chipy, karty i stronicowanie są używalne bez poziomego przewijania; `GminaPicker` w `/profil/edycja` działa jak wcześniej
- Źródło strony i zakładka sieci nie zawierają telefonu ani e-maila żadnego opiekuna

**Implementation Note**: Po przejściu weryfikacji automatycznej zatrzymaj się na ręczne potwierdzenie przed kolejną fazą.

---

## Phase 3: Wejścia do listy

### Overview

Polska strona główna z wezwaniem do wyszukiwania, link do listy w Topbarze i domyślny tytuł aplikacji — tak, by przepływ z PRD zaczynał się od `/`.

### Changes Required:

#### 1. Strona główna

**File**: `src/components/Welcome.astro`

**Intent**: Zastąpić treść startera polskim wprowadzeniem do portalu z główną akcją „Znajdź opiekuna” (`/opiekunowie`) i drugorzędną „Jesteś opiekunem? Załóż konto” (`/auth/signup`); tło i styl bez zmian.

**Contract**: Nagłówek „Opieka dla bliskich”, 1–2 zdania opisu (kto i po co), dwa linki jak wyżej; brak treści po angielsku.

#### 2. Topbar i Layout

**File**: `src/components/Topbar.astro`, `src/layouts/Layout.astro`

**Intent**: Lista dostępna z każdej strony; tytuł karty przestaje mówić „10x Astro Starter”.

**Contract**: Link „Opiekunowie” (`/opiekunowie`) widoczny dla zalogowanych i niezalogowanych; domyślny `title` w `Layout` = „Opieka dla bliskich”.

#### 3. README i smoke

**File**: `README.md`, `scripts/smoke.mjs`

**Intent**: Opis smoke (kroki profilu są już w `README.md:228`) obejmuje też listę; smoke sprawdza, że strona główna prowadzi do listy.

**Contract**: Akapit smoke w `README.md:228` dostaje kroki RPC listy (niekompletny profil ukryty, gmina, usługi, `total_count` przed limitem), strony listy (render jako anonim, brak kontaktu w HTML, podpowiedzi, błędne parametry, strona poza zakresem) i `noindex`; zdanie o kontach mówi o trzech kontach `smoke-*@example.com` i profilach „Anna Smoke” i „Bartek Smoke”. Krok „home renders” sprawdza też, że HTML zawiera `href="/opiekunowie"`.

### Success Criteria:

#### Automated Verification:

- Lint przechodzi: `npm run lint`
- Typy przechodzą: `npx astro check`
- Build przechodzi: `npm run build`
- Smoke przechodzi: `npm run smoke`

#### Manual Verification:

- Pełny przepływ anonima: `/` → „Znajdź opiekuna” → filtr gminy i usługi → wyniki, po polsku, na 375 px
- Topbar pokazuje „Opiekunowie” zalogowanemu opiekunowi, koordynatorowi i anonimowi

**Implementation Note**: Po przejściu weryfikacji automatycznej zatrzymaj się na ręczne potwierdzenie.

---

## Testing Strategy

### Unit Tests:

- Brak zestawu testów jednostkowych w repozytorium (AGENTS.md); `parseCaregiverSearch` i `buildCaregiverSearchHref` są czystymi funkcjami, ale ich zachowanie pokrywają kroki smoke z błędnymi parametrami i linkami chipów.

### Integration Tests:

- `npm run smoke`: RPC jako anon (ukrycie niekompletnego profilu, gmina twarda, wszystkie usługi, brak kluczy kontaktowych, `total_count`) i strona jako anonim (render, brak telefonu/e-maila w HTML, podpowiedzi przy pustym wyniku, błędne parametry, nieznana gmina, strona poza zakresem, `noindex`).

### Manual Testing Steps:

1. Jako opiekun zapisz profil bez telefonu → profil nie jest na `/opiekunowie`; dodaj telefon → profil jest na górze listy.
2. Jako anonim wybierz gminę profilu i dwie usługi, z których profil ma jedną → pusty stan z „Usuń filtr usług (wyniki: ≥1)”; kliknij → profil widoczny, gmina zachowana.
3. Zdejmij chipem gminę → zostają usługi; „Wyczyść filtry” → pełna lista.
4. Wpisz ręcznie `?strona=999` → komunikat o nieistniejącej stronie z linkiem do strony 1.
5. Sprawdź nagłówki w DevTools: `X-Robots-Tag: noindex` na `/` i `/opiekunowie`.

## Performance Considerations

Jedno wywołanie RPC na wyświetlenie strony (plus do dwóch przy pustym wyniku z filtrami). Indeksy `caregiver_gminas_teryt_idx` i `caregiver_services_service_slug_idx` już istnieją. Reguła kompletności liczy się per kandydat; przy docelowej skali (dziesiątki–setki profili) to milisekundy. Jeśli katalog urośnie o rzędy wielkości, S-05 i tak przenosi ranking do SQL — wtedy warto rozważyć materializację kompletności.

## Migration Notes

Migracja tylko dodaje funkcję — bez zmian danych i bez wpływu na istniejące tabele. Wycofanie: `drop function public.search_caregivers(text, text[], int, int)`. Produkcja: `npx supabase db push` przed `wrangler deploy` (strona bez funkcji zwróci komunikat błędu wczytania listy).

## References

- Roadmap: `context/foundation/roadmap.md` — S-02
- PRD: `context/foundation/prd.md` — US-01, FR-008, FR-009, FR-010, Guardrails, NFR
- Follow-up F7: `context/archive/2026-11-03-caregiver-profile-setup/follow-ups/review-fixes.md`
- Schemat profilu i reguła kompletności: `supabase/migrations/20261103150000_caregiver_profiles.sql:356`
- Wzorzec strony SSR z serwisem: `src/pages/profil/index.astro`
- Wzorzec comboboxa gmin: `src/components/caregiver/GminaPicker.tsx`
- Ryzyko indeksowania `*.workers.dev`: `context/foundation/infrastructure.md:151,198`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Zapytanie wyszukiwania w bazie

#### Automated

- [x] 1.1 Wszystkie migracje stosują się od zera: `npx supabase db reset` — 33bdd26
- [x] 1.2 Lint bazy bez błędów: `npx supabase db lint --level error` — 33bdd26
- [x] 1.3 Lint przechodzi: `npm run lint` — 33bdd26
- [x] 1.4 Smoke przechodzi z nowymi krokami RPC: `npm run smoke` — 33bdd26

#### Manual

- [x] 1.5 W `psql` jako `set role anon` wywołanie `select * from public.search_caregivers('1465011')` zwraca tylko kolumny publiczne, a `explain analyze` pokazuje czas wykonania wyraźnie poniżej 100 ms na lokalnych danych — 33bdd26

### Phase 2: Publiczna lista z filtrami

#### Automated

- [x] 2.1 Lint przechodzi: `npm run lint` — 6d01b65
- [x] 2.2 Typy przechodzą: `npx astro check` — 6d01b65
- [x] 2.3 Build przechodzi: `npm run build` — 6d01b65
- [x] 2.4 Smoke przechodzi z krokami strony: `npm run smoke` — 6d01b65

#### Manual

- [x] 2.5 Jako anonim na `/opiekunowie` wybór gminy i dwóch usług, potem zdjęcie chipem jednej usługi — gmina i druga usługa zostają, a wynik się zgadza — 6d01b65
- [x] 2.6 Pusty wynik pokazuje wyjaśnienie i linki z liczbami; kliknięcie linku daje dokładnie podaną liczbę wyników — 6d01b65
- [x] 2.7 Profil opiekuna bez telefonu albo bez gminy nie pojawia się na liście, a po uzupełnieniu się pojawia — 6d01b65
- [x] 2.8 Przy ponad 20 kompletnych profilach (np. po kilku przebiegach smoke) działa przejście na stronę 2 z zachowaniem filtrów — 6d01b65
- [x] 2.9 Na 375 px formularz, chipy, karty i stronicowanie są używalne bez poziomego przewijania; `GminaPicker` w `/profil/edycja` działa jak wcześniej — 6d01b65
- [x] 2.10 Źródło strony i zakładka sieci nie zawierają telefonu ani e-maila żadnego opiekuna — 6d01b65

### Phase 3: Wejścia do listy

#### Automated

- [x] 3.1 Lint przechodzi: `npm run lint` — c2acf0e
- [x] 3.2 Typy przechodzą: `npx astro check` — c2acf0e
- [x] 3.3 Build przechodzi: `npm run build` — c2acf0e
- [x] 3.4 Smoke przechodzi: `npm run smoke` — c2acf0e

#### Manual

- [x] 3.5 Pełny przepływ anonima: `/` → „Znajdź opiekuna” → filtr gminy i usługi → wyniki, po polsku, na 375 px — c2acf0e
- [x] 3.6 Topbar pokazuje „Opiekunowie” zalogowanemu opiekunowi, koordynatorowi i anonimowi — c2acf0e
