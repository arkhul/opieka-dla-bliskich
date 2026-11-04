# Dostępność opiekuna i filtr po dostępności — plan implementacji

## Overview

Wycinek S-04 (FR-007, FR-011). Opiekun zaznacza w profilu terminy, w których jest dostępny: 7 dni tygodnia × 4 pory dnia (rano, popołudnie, wieczór, noc). Koordynator na `/opiekunowie` zawęża listę po dostępności razem z gminą i usługą. Dostępność widzi na kartach listy jako zwięzłą linię, a na stronach profilu jako siatkę. Dostępność jest informacją, a nie rezerwacją (PRD §Non-Goals), i nie wpływa na regułę kompletności profilu.

## Current State Analysis

- Profil opiekuna zapisuje jedna atomowa funkcja `public.save_caregiver_profile(text, text, text, text, text[], text[])` (`supabase/migrations/20261103150000_caregiver_profiles.sql:221`). Formularz (`src/components/caregiver/CaregiverProfileForm.tsx`) wysyła `PUT /api/caregiver/profile` z całym profilem, a API waliduje go zod (`src/pages/api/caregiver/profile.ts:30`).
- Listy profilu (gminy, usługi) to osobne tabele z wierszem na pozycję, publiczne do odczytu, zapisywane tylko przez właściciela: `caregiver_services` (`20261103150000_caregiver_profiles.sql:166`). Uprawnienia tabel to `revoke all` + jawne granty (`20261103230000_table_grants_mirror_policies.sql`). CI pilnuje tego przez `scripts/check-table-grants.sql`.
- Publiczna lista to `public.search_caregivers(text, text[], int, int)` (`20261103200000_search_caregivers.sql:25`): gmina twardo, usługi w trybie „ma wszystkie”, `updated_at desc`, stronicowanie, `total_count`. Pojedynczy profil zwraca `public.get_public_caregiver(uuid)` (`20261103220000_coordinator_contact_access.sql:56`). Obie funkcje zwracają wyłącznie kolumny publiczne.
- Strona `/opiekunowie` (`src/pages/opiekunowie/index.astro`) czyta filtry z URL przez `parseCaregiverSearch` / `buildCaregiverSearchHref` (`src/lib/caregiver-search.ts`), ma chipy zdejmujące pojedyncze filtry i podpowiedzi „Usuń filtr X (wyniki: N)” liczone osobnymi wywołaniami RPC.
- Reguła kompletności `caregiver_profile_missing()` steruje widocznością na liście, stroną profilu i odczytem kontaktu przez koordynatora (polityka RLS z S-03). Ten wycinek jej nie zmienia.
- Dostępności nie ma nigdzie w schemacie ani w kodzie.

## Desired End State

- Opiekun w `/profil/edycja` zaznacza terminy w siatce 7×4 i zapisuje je razem z resztą profilu. Na `/profil` widzi siatkę tylko do odczytu albo zachętę, gdy nic nie zaznaczył.
- Koordynator (także anonim) na `/opiekunowie` zaznacza terminy w siatce filtra. Lista pokazuje profile, które mają **co najmniej jeden** z zaznaczonych terminów. Profil bez dostępności znika tylko przy aktywnym filtrze dostępności. Stan filtra jest w URL (`?termin=pon-rano&termin=sr-rano`), zdejmuje go jeden chip, a pusty wynik podpowiada „Usuń filtr dostępności (wyniki: N)”.
- Karta listy ma linię „Dostępność: Pn–Pt: rano · Sb: noc” albo „Dostępność nie podana”. Strona `/opiekunowie/[id]` ma siatkę tylko do odczytu.
- Żadna odpowiedź publiczna nie zawiera kontaktu. Smoke sprawdza filtr w trybie OR, RLS, granty i HTML.
- Migracja i Worker są wdrożone na produkcji. Istniejące profile pozostają widoczne.

Weryfikacja: `npm run smoke` na lokalnym Supabase, `scripts/check-table-grants.sql`, przegląd UI na 375 px, przepływ na wdrożonym Workerze.

### Key Discoveries:

- Wzorzec tabeli listy z RLS: `supabase/migrations/20261103150000_caregiver_profiles.sql:166-191` (`caregiver_services`) i granty `20261103230000_table_grants_mirror_policies.sql:50-56`.
- Zmiana listy parametrów lub typu wyniku funkcji w Postgresie wymaga `drop function` + `create function` + ponownych `revoke`/`grant execute` (`create or replace` nie zmienia sygnatury ani `returns table`).
- PostgREST wywołuje RPC po nazwach parametrów (`src/lib/services/caregiver.service.ts:139`, `:189`), więc nowe parametry z wartościami domyślnymi nie psują starego Workera.
- Smoke zapisuje drugiego opiekuna („Bartek Smoke”) bezpośrednio przez RPC z tokenem (`scripts/smoke.mjs:360`). Dzięki temu da się testować bazę w fazie 1, zanim API przyjmie dostępność.
- Podpowiedź „Spróbuj sąsiedniej gminy” zakłada dziś dokładnie dwa wymiary (`src/pages/opiekunowie/index.astro:83`).

## What We're NOT Doing

- Ranking według liczby pokrytych terminów i oznaczanie braków: to S-05. Tu filtr jest twardy (OR).
- Dostępność w regule kompletności (`caregiver_profile_missing`) i w polityce RLS kontaktu: dostępność jest opcjonalna.
- Okresy od–do, konkretne daty, godziny co do minuty, kalendarz rezerwacji, blokowanie terminów (PRD §Non-Goals).
- Osobny słownik terminów w bazie (tabela z FK): 28 terminów pilnuje `CHECK`, a etykiety są w aplikacji.
- Przypomnienia o nieaktualnej dostępności i znacznik „zaktualizowano”.
- Chip na każdy pojedynczy termin: jeden chip zdejmuje cały wymiar dostępności.
- Testy jednostkowe (repo ich nie ma; `AGENTS.md` §Testing). Helpery są sprawdzane pośrednio przez smoke.

## Implementation Approach

Jeden zapis terminu we wszystkich warstwach: `<dzień>-<pora>`, gdzie dzień ∈ `pon wt sr czw pt sob nd`, a pora ∈ `rano popoludnie wieczor noc` (np. `pon-rano`, `sob-noc`). Ten sam ciąg jest wierszem w bazie, elementem tablicy w RPC i API oraz wartością parametru `termin` w URL. Kanoniczna kolejność (pon→nd, w dniu rano→noc) i polskie etykiety żyją w jednym module `src/lib/availability.ts`.

Baza: tabela `caregiver_availability(caregiver_id, slot)` w kształcie `caregiver_services`, zapisywana przez rozszerzone `save_caregiver_profile()`. `search_caregivers()` dostaje filtr „istnieje wspólny termin”, a obie funkcje publiczne zwracają `availability text[]`. UI: jedna siatka `.astro` w dwóch trybach (tylko do odczytu oraz natywne checkboxy dla formularza `GET` listy) i jedna siatka React w formularzu profilu.

Kolejność faz: baza → strona opiekuna → strona koordynatora → produkcja. Każda faza zostawia działającą aplikację.

## Critical Implementation Details

- **Kolejność wdrożenia:** najpierw `supabase db push`, potem `wrangler deploy`. Nowe parametry mają wartości domyślne (`p_availability text[] default '{}'` w zapisie, `default null` w wyszukiwaniu), więc stary Worker w oknie między tymi krokami wywołuje funkcje bez zmian. Zapis ze starego Workera w tym oknie wyczyściłby dostępność, ale nikt jej jeszcze wtedy nie ma.
- **Noc:** termin `pon-noc` oznacza noc zaczynającą się w poniedziałek o 22 (do 6 we wtorek). Etykieta pory w siatkach musi to mówić („noc 22–6”), a formularz opiekuna ma o tym jednozdaniową podpowiedź.

## Phase 1: Dostępność w bazie

### Overview

Tabela terminów z RLS i grantami, zapis w `save_caregiver_profile()`, filtr i kolumna w `search_caregivers()`, kolumna w `get_public_caregiver()`. Smoke testuje to wprost przez REST Supabase.

### Changes Required:

#### 1. Migracja

**File**: `supabase/migrations/20261104120000_caregiver_availability.sql`

**Intent**: Dodać trwały, publiczny do odczytu zapis dostępności opiekuna i przeprowadzić go przez zapis profilu oraz obie funkcje publiczne. Nagłówek migracji (jak w poprzednich) opisuje decyzje S-04: OR w filtrze, dostępność opcjonalna, reguła kompletności bez zmian, kolejność wdrożenia.

**Contract**:
- Tabela `public.caregiver_availability`:
  - `caregiver_id uuid not null references public.caregiver_profiles (user_id) on delete cascade`
  - `slot text not null check (slot ~ '^(pon|wt|sr|czw|pt|sob|nd)-(rano|popoludnie|wieczor|noc)$')`
  - `primary key (caregiver_id, slot)`; indeks na `slot` (pod filtr i S-05)
  - komentarze tabeli i kolumny, w tym znaczenie nocy
- RLS włączone. Polityki: `select` dla `anon` i `authenticated` (`using (true)`), `insert` i `delete` dla `authenticated` z `caregiver_id = (select auth.uid())`. Bez `update` (wiersze się zastępuje).
- Uprawnienia: `revoke all … from anon, authenticated`; `grant select` dla `anon`; `grant select, insert, delete` dla `authenticated`. Macierz z `20261103230000_…` rośnie z 20 do 24 wierszy (wymienić je w komentarzu).
- `drop function public.save_caregiver_profile(text, text, text, text, text[], text[])` i nowa `save_caregiver_profile(p_display_name, p_description, p_phone, p_email, p_gminas, p_services, p_availability text[] default '{}')`. Ciało jak dotąd plus: deduplikacja i pominięcie `null` w `p_availability`, walidacja wzorca z błędem `22023` „Nieznane terminy dostępności: %. Wybierz terminy z siatki.”, a następnie zastąpienie wierszy (delete spoza listy + insert `on conflict do nothing`), jak przy usługach. `revoke … from public, anon` i `grant execute … to authenticated` dla nowej sygnatury.
- `drop function public.search_caregivers(text, text[], int, int)` i nowa `search_caregivers(p_teryt text default null, p_services text[] default null, p_availability text[] default null, p_limit int default 20, p_offset int default 0)`. Dodatkowy warunek w CTE `matches`: brak niepustych elementów w `p_availability` oznacza brak filtra (`null`, `{}` i `{null}` traktujemy tak samo). W przeciwnym razie musi istnieć wiersz `caregiver_availability` profilu ze `slot = any(p_availability)`. W wyniku nowa kolumna `availability text[]` (przed `total_count`, `'{}'` gdy brak, `array_agg … order by slot`; kanoniczną kolejność ustala aplikacja). Reszta semantyki bez zmian. Granty `execute` dla `anon, authenticated` jak dotąd.
- `drop function public.get_public_caregiver(uuid)` i ponowne utworzenie z dodatkową kolumną `availability text[]` w tym samym kształcie. Granty jak dotąd.
- Komentarze `comment on function` zaktualizowane o dostępność.

#### 2. Smoke: baza

**File**: `scripts/smoke.mjs`

**Intent**: Pilnować w CI zapisu, RLS, grantów i semantyki OR na poziomie bazy, zanim zmieni się API.

**Contract**: Kroki dopisane po „second caregiver saves complete profile” (drugi opiekun dostaje w tym wywołaniu `p_availability: ["sr-noc", "nd-wieczor"]`):
- „anon reads caregiver availability”: `GET /rest/v1/caregiver_availability?caregiver_id=eq.<second>` → 200, 2 wiersze
- „anon cannot write caregiver availability”: `POST` jako anon → 401, `permission denied for table caregiver_availability`
- „caregiver cannot write another caregiver's availability”: `POST` z tokenem drugiego opiekuna i `caregiver_id` pierwszego (`caregiverId`; trzeci opiekun powstaje dopiero później, `smoke.mjs:382`) → 403 (RLS)
- „profile save rejects unknown availability slot”: RPC `save_caregiver_profile` z `p_availability: ["pon-swit"]` → 400 z komunikatem „Nieznane terminy dostępności”
- „search matches any selected slot”: `search_caregivers({ p_teryt: "1465011", p_availability: ["sr-noc", "czw-noc"], p_limit: 50 })` zawiera drugiego opiekuna z `availability` równym zapisanym terminom i nie zawiera pierwszego
- „search hides profile without matching slot”: `p_availability: ["czw-noc"]` nie zawiera drugiego opiekuna
- „public caregiver returns availability”: `get_public_caregiver(<second>)` ma `availability` z 2 terminami i żadnego klucza z `CONTACT_KEYS`
- „profile save without availability clears it”: drugi opiekun zapisuje profil ponownie przez RPC dokładnie w dzisiejszym kształcie, czyli 6 parametrów bez `p_availability` (tak woła stary Worker) → 204. Wartość domyślna `'{}'` zeruje dostępność.
- „search without availability filter keeps profile without availability”: bez `p_availability` lista zawiera drugiego opiekuna z `availability` równym `[]`, a z `p_availability: ["sr-noc"]` już go nie zawiera

Od tego miejsca „Bartek Smoke” pozostaje kompletnym profilem bez dostępności (potrzebnym w fazie 3). Terminy filtra (`*-noc` w środę i czwartek) są rozłączne z dostępnością, którą pierwszy opiekun dostanie w fazie 2 (Pn–Pt rano, Sb noc), więc kroki zostają prawdziwe po kolejnych fazach.

### Success Criteria:

#### Automated Verification:

- Wszystkie migracje stosują się od zera: `npx supabase db reset`
- Lint bazy bez błędów: `npx supabase db lint --level error`
- Kontrola grantów przechodzi: `npx supabase db query --local -f scripts/check-table-grants.sql`
- Lint i typy: `npm run lint` i `npx astro check`
- Smoke przechodzi z nowymi krokami bazy: `npm run smoke`

#### Manual Verification:

- Macierz uprawnień (`information_schema.role_table_grants` dla `anon`/`authenticated` w `public`) ma 24 wiersze, w tym 4 nowe dla `caregiver_availability`: anon select; authenticated select, insert, delete
- Istniejąca lista `/opiekunowie` i strona profilu działają bez zmian w wyglądzie (stary kod aplikacji na nowych funkcjach)

**Implementation Note**: Po przejściu weryfikacji automatycznej zatrzymaj się na ręczne potwierdzenie, zanim przejdziesz do fazy 2.

---

## Phase 2: Opiekun ustawia dostępność

### Overview

Słownik terminów w aplikacji, typy, serwis, walidacja API, siatka w formularzu profilu i podgląd na `/profil`.

### Changes Required:

#### 1. Słownik terminów

**File**: `src/lib/availability.ts` (nowy)

**Intent**: Jedno źródło zapisu terminów, ich kolejności i polskich etykiet dla API, URL, formularzy i widoków. Czysty moduł bez I/O.

**Contract**:
- Stałe `WEEKDAYS` (`pon … nd`, z etykietą pełną „Poniedziałek” i skrótem „Pn, Wt, Śr, Cz, Pt, Sb, Nd”) i `DAY_PARTS` (`rano` 6–12, `popoludnie` 12–18, `wieczor` 18–22, `noc` 22–6, z etykietą „rano / popołudnie / wieczór / noc” i zakresem godzin)
- Typ `AvailabilitySlot` (`${Weekday}-${DayPart}`) i krotka `AVAILABILITY_SLOTS` (28 terminów w kolejności kanonicznej; do użycia w `z.enum`)
- `isAvailabilitySlot(value: string): value is AvailabilitySlot`
- `sortAvailability(values: readonly string[]): AvailabilitySlot[]`: odrzuca nieznane, usuwa duplikaty, porządkuje kanonicznie
- `slotLabel(slot)`: np. „Poniedziałek, rano” (etykiety dostępności checkboxów)
- `summarizeAvailability(slots): string | null`. Dni z takim samym niepustym zestawem pór tworzą grupę (grupy w kolejności pierwszego dnia). W grupie ciągi kolejnych dni o długości ≥ 2 zapisujemy jako zakres z półpauzą, pojedyncze dni jako skrót, a ciągi łączymy „, ”. Po dwukropku pory w kolejności kanonicznej, łączone „, ”. Grupy łączymy „ · ”. Pusty zbiór daje `null`. Przykłady (oczekiwane wyniki):
  - Pn–Pt rano + Sb noc → `Pn–Pt: rano · Sb: noc`
  - `pon-rano`, `sr-rano`, `pt-rano` → `Pn, Śr, Pt: rano`
  - `pon-rano`, `pon-noc`, `wt-rano` → `Pn: rano, noc · Wt: rano`
  - `pon-rano`, `wt-rano`, `czw-rano` → `Pn–Wt, Cz: rano`
  - wszystkie 28 → `Pn–Nd: rano, popołudnie, wieczór, noc`

#### 2. Typy

**File**: `src/types.ts`

**Intent**: Dostępność jako część profilu własnego, polecenia zapisu i profilu publicznego (dane publiczne, bez kontaktu).

**Contract**: `availability: AvailabilitySlot[]` (kolejność kanoniczna) w `OwnCaregiverProfileDto`, `SaveCaregiverProfileCommand` i `PublicCaregiverDto`. Typ `AvailabilitySlot` importowany z `@/lib/availability` (albo zdefiniowany w `types.ts` i reeksportowany; jedno źródło).

#### 3. Serwis

**File**: `src/lib/services/caregiver.service.ts`

**Intent**: Czytać i zapisywać dostępność tymi samymi ścieżkami co gminy i usługi.

**Contract**:
- `OWN_PROFILE_SELECT` dostaje `caregiver_availability(slot)`, a `getOwnProfile` mapuje to przez `sortAvailability`
- `saveOwnProfile` przekazuje `p_availability: cmd.availability`
- `PublicRow` dostaje `availability: string[]`, a `toPublicCaregiver` mapuje ją przez `sortAvailability`

#### 4. API

**File**: `src/pages/api/caregiver/profile.ts`

**Intent**: Walidować dostępność przed bazą, z polskim komunikatem przypisanym do pola.

**Contract**: W `saveProfileSchema` pole `availability`: tablica `z.enum(AVAILABILITY_SLOTS)` (błąd elementu „Nieznany termin dostępności.”, błąd tablicy „Lista terminów jest niepoprawna.”), `.default([])`, potem przez `sortAvailability`. Błąd z bazy `22023` obsługuje już istniejąca ścieżka `CaregiverProfileValidationError`.

#### 5. Siatka w formularzu

**File**: `src/components/caregiver/AvailabilityPicker.tsx` (nowy), `src/components/caregiver/CaregiverProfileForm.tsx`

**Intent**: Opiekun zaznacza terminy w siatce 7 dni × 4 pory, wygodnej także na telefonie.

**Contract**:
- `AvailabilityPicker({ value: AvailabilitySlot[], onChange, describedBy? })`. Tabela: wiersze to dni (na wąskim ekranie skrót, szerzej pełna nazwa), kolumny to pory z zakresem godzin w nagłówku. Komórka zawiera shadcn `Checkbox` z `aria-label` ze `slotLabel`. Mieści się w 375 px bez przewijania w poziomie.
- W `CaregiverProfileForm`: stan `availability` inicjowany z `initialProfile?.availability ?? []`, pole `"availability"` w typie `Field`, `fieldset` z legendą „Kiedy możesz pomagać (opcjonalnie)” i podpowiedzią „Noc oznacza godziny 22–6 zaczynające się danego dnia.”, `availability` wysyłane w `SaveCaregiverProfileCommand` w kolejności kanonicznej, błąd pola przez `FieldError`.

#### 6. Siatka tylko do odczytu i `/profil`

**File**: `src/components/caregiver/AvailabilityGrid.astro` (nowy), `src/pages/profil/index.astro`

**Intent**: Jeden komponent siatki dla widoków (tu `/profil`, w fazie 3 profil publiczny i filtr listy).

**Contract**:
- `AvailabilityGrid.astro` z propsami `{ selected: AvailabilitySlot[]; name?: string }`. Bez `name` siatka jest tylko do odczytu: znacznik dostępności w komórce plus tekst `sr-only` „dostępny” / „niedostępny”. Z `name` komórki mają natywne `<input type="checkbox" name={name} value={slot} aria-label={slotLabel(slot)}>` zaznaczone według `selected` (używane w fazie 3). Ten sam układ i nagłówki co w `AvailabilityPicker`.
- `/profil`: sekcja „Dostępność” z siatką albo tekstem „Nie podano dostępności — koordynatorzy, którzy filtrują po terminach, nie zobaczą Twojego profilu.” Sekcja nie wpływa na komunikat o kompletności.

#### 7. Smoke: API

**File**: `scripts/smoke.mjs`

**Intent**: Zapis dostępności przez API pierwszego opiekuna i walidacja.

**Contract**:
- `completeProfile.availability = ["sob-noc", "pon-rano", "wt-rano", "sr-rano", "czw-rano", "pt-rano", "pon-rano"]` (poza kolejnością i z duplikatem). Krok „profile save normalizes phone and completes profile” sprawdza dodatkowo `profile.availability` równe `["pon-rano", "wt-rano", "sr-rano", "czw-rano", "pt-rano", "sob-noc"]`.
- Nowy krok „profile save rejects unknown availability slot (API)”: `PUT` z `availability: ["pon-swit"]` → 400 z `fieldErrors.availability`.

### Success Criteria:

#### Automated Verification:

- Lint i typy: `npm run lint` i `npx astro check`
- Build: `npm run build`
- Smoke przechodzi z krokami API dostępności: `npm run smoke`

#### Manual Verification:

- Opiekun w `/profil/edycja` zaznacza Pn–Pt rano i Sb noc, zapisuje, a `/profil` pokazuje te terminy w siatce. Po ponownym wejściu w edycję zaznaczenia są zachowane
- Odznaczenie wszystkich terminów i zapis: `/profil` pokazuje zachętę, a komunikat „Profil jest kompletny” się nie zmienia
- Na 375 px siatka w formularzu i na `/profil` mieści się bez przewijania w poziomie, a checkboxy da się trafić palcem i obsłużyć klawiaturą (Tab, Spacja)

**Implementation Note**: Po przejściu weryfikacji automatycznej zatrzymaj się na ręczne potwierdzenie, zanim przejdziesz do fazy 3.

---

## Phase 3: Koordynator filtruje i widzi dostępność

### Overview

Parametr `termin` w URL, siatka w filtrze listy, chip, podpowiedź przy pustym wyniku, linia dostępności na karcie, siatka na publicznej stronie profilu. Smoke stron i README.

### Changes Required:

#### 1. Filtry w URL

**File**: `src/types.ts`, `src/lib/caregiver-search.ts`

**Intent**: Dostępność jako trzeci wymiar filtra, odporny na ręcznie edytowane linki.

**Contract**:
- `CaregiverSearchFilter.availability: AvailabilitySlot[]`
- `parseCaregiverSearch` czyta wszystkie `termin` przez `sortAvailability`, więc nieznane wartości są ignorowane, bez błędu
- `buildCaregiverSearchHref` dopisuje `termin` po `usluga`, a przed `strona`, w kolejności kanonicznej

#### 2. Serwis wyszukiwania

**File**: `src/lib/services/caregiver.service.ts`

**Intent**: Przekazać filtr do bazy.

**Contract**: `runSearch` wysyła `p_availability: filter.availability`. Pusta tablica oznacza brak filtra (semantyka SQL z fazy 1).

#### 3. Strona listy

**File**: `src/pages/opiekunowie/index.astro`

**Intent**: Koordynator zawęża listę po terminach i widzi dostępność na kartach.

**Contract**:
- Domyślny `filter` zawiera `availability: []`. `hasFilters` uwzględnia dostępność.
- Formularz: `fieldset` z legendą „Dostępność (opiekun musi mieć co najmniej jeden z zaznaczonych terminów)” i `AvailabilityGrid` z `name="termin"`, po usługach.
- Chip „Dostępność (<summarizeAvailability wybranych>)” z linkiem do filtra bez `availability`.
- Podpowiedzi przy pustym wyniku: nowy kandydat „Usuń filtr dostępności” z liczbą wyników. Warunek, który uruchamia liczenie kandydatów (dziś `filter.teryt || filter.services.length > 0`, `index.astro:54`), obejmuje też `filter.availability.length > 0`, więc sam filtr terminów (bez gminy) też dostaje podpowiedź. „Spróbuj sąsiedniej gminy” pokazujemy, gdy filtr gminy jest aktywny, są co najmniej 2 podpowiedzi i każda daje 0 wyników.
- Karta: linia „Dostępność: <summarizeAvailability>” albo „Dostępność nie podana”, pod gminami, w stylu linii gmin.

#### 4. Publiczna strona profilu

**File**: `src/components/caregiver/CaregiverPublicDetails.astro`

**Intent**: Pełna siatka dostępności na profilu (publicznym i chronionym, bo komponent jest współdzielony).

**Contract**: Sekcja „Dostępność” z `AvailabilityGrid` bez `name` albo tekst „Dostępność nie podana”. Komponent nadal przyjmuje wyłącznie `PublicCaregiverDto`.

#### 5. Smoke: strony

**File**: `scripts/smoke.mjs`

**Intent**: Pilnować filtra i prezentacji na HTML-u, który widzi anonim.

**Contract**:
Kroki działają na stanie z faz 1–2: „Anna Smoke” ma Pn–Pt rano + Sb noc, a „Bartek Smoke” jest kompletny i bez dostępności.
- „caregiver list filters by availability”: `/opiekunowie?gmina=1465011&termin=pon-rano` zawiera „Anna Smoke” i `Pn–Pt: rano · Sb: noc`, nie zawiera „Bartek Smoke” i nie zawiera kontaktu (te same wartości co w kroku „caregiver list renders for anonymous user”)
- „caregiver list shows missing availability”: `/opiekunowie?gmina=1465011` zawiera „Bartek Smoke” i „Dostępność nie podana”
- „caregiver list shows availability relax hint”: `/opiekunowie?gmina=1465011&termin=czw-noc` zawiera „Usuń filtr dostępności (wyniki:”
- „caregiver list ignores malformed availability”: `/opiekunowie?gmina=1465011&termin=xyz` → 200 i zawiera „Anna Smoke” oraz „Bartek Smoke”
- „public profile page shows availability”: `/opiekunowie/<caregiverId>` zawiera sekcję „Dostępność” i tekst `sr-only` „dostępny” jako całą zawartość elementu (`>dostępny<`, bo samo „dostępny” trafiłoby też w „niedostępny”), bez kontaktu w HTML

#### 6. README

**File**: `README.md`

**Intent**: Opis smoke obejmuje dostępność.

**Contract**: Akapit „Smoke sprawdza też…” w sekcji `## Smoke test` dostaje zdanie o dostępności: zapis i walidacja terminów (RPC i API), RLS i granty `caregiver_availability`, filtr „co najmniej jeden termin”, linia na karcie, podpowiedź i siatka na stronie profilu.

### Success Criteria:

#### Automated Verification:

- Lint i typy: `npm run lint` i `npx astro check`
- Build: `npm run build`
- Smoke przechodzi z krokami stron: `npm run smoke`

#### Manual Verification:

- Anonim na `/opiekunowie` wybiera gminę, usługę i terminy „Pn rano” oraz „Śr rano”. Wyniki zawierają opiekuna z samym „Pn rano” (OR), URL ma `termin=pon-rano&termin=sr-rano`, a chip „Dostępność (Pn, Śr: rano)” zdejmuje tylko ten wymiar
- Pusty wynik z filtrem dostępności pokazuje „Usuń filtr dostępności (wyniki: N)” z prawdziwą liczbą
- Karty pokazują linię dostępności albo „Dostępność nie podana”, a `/opiekunowie/<id>` i `/kontakt/<id>` (koordynator) pokazują siatkę
- Na 375 px formularz filtra z siatką, chipy i karty są czytelne bez przewijania w poziomie

**Implementation Note**: Po przejściu weryfikacji automatycznej zatrzymaj się na ręczne potwierdzenie, zanim przejdziesz do fazy 4.

---

## Phase 4: Wdrożenie produkcyjne

### Overview

Migracja i kod z faz 1–3 trafiają na produkcję w kolejności baza → Worker. Sprawdzamy je tam bez zapisów danych testowych (Open Roadmap Question 2).

### Changes Required:

#### 1. Migracja na produkcji

**File**: brak zmian w repo (operacja)

**Intent**: Schemat produkcyjny ma dostępność, zanim pojawi się nowy Worker.

**Contract**: Najpierw zanotować „Wyniki: N” z produkcyjnego `/opiekunowie` bez filtrów (punkt odniesienia dla 4.4). Potem, z commita scalonego do `master`: `npx supabase db push` na zlinkowany projekt produkcyjny. Przed wykonaniem pytam użytkownika o zgodę.

#### 2. Wdrożenie Workera

**File**: brak zmian w repo (operacja)

**Intent**: Formularz, filtr i widoki dostępności działają na wdrożonym Workerze.

**Contract**: `npm run build` i `npx wrangler deploy` (procedura z `README.md` §Deployment). Przed wykonaniem pytam użytkownika o zgodę. Potwierdzenie przez `npx wrangler deployments list`.

### Success Criteria:

#### Manual Verification:

- `npx supabase db push` zastosował `20261104120000_caregiver_availability.sql` na produkcji
- Na produkcji macierz uprawnień ma 24 wiersze, a `anon` `POST /rest/v1/caregiver_availability` dostaje `permission denied for table caregiver_availability`; nic nie zostaje zapisane
- `npx wrangler deploy` zakończony, nowe wdrożenie widoczne w `npx wrangler deployments list`
- Na wdrożonym Workerze `/opiekunowie` renderuje siatkę filtra i karty z linią dostępności (istniejące profile: „Dostępność nie podana”), `/opiekunowie?termin=pon-rano` działa i podpowiada zdjęcie filtra, a liczba wyników bez filtrów jest taka sama jak przed wdrożeniem

**Implementation Note**: Faza wyłącznie ręczna, z akceptacją użytkownika przed każdym `db push` i `deploy`.

---

## Testing Strategy

### Unit Tests:

- Brak (repo nie ma zestawu testów jednostkowych). `summarizeAvailability` i `sortAvailability` są sprawdzane pośrednio: smoke porównuje znormalizowaną tablicę z API, linię `Pn–Pt: rano · Sb: noc` i tekst „Dostępność nie podana” w HTML. Przykłady z fazy 2 §1 są kontraktem przy przeglądzie kodu.

### Integration Tests:

- `npm run smoke`: RPC i RLS jako anon i z tokenem (faza 1), API zapisu (faza 2), HTML listy i profilu jako anon (faza 3)
- `scripts/check-table-grants.sql`: brak domyślnych grantów na nowej tabeli

### Manual Testing Steps:

1. Opiekun ustawia Pn–Pt rano + Sb noc i widzi to na `/profil`
2. Anonim filtruje po gminie opiekuna i „Pn rano” + „Śr rano”, widzi opiekuna, zdejmuje chip dostępności, a gmina i usługi zostają
3. Filtr na termin, którego nikt nie ma: komunikat i podpowiedź z liczbą
4. Profil bez dostępności: widoczny bez filtra, z linią „Dostępność nie podana”, a z filtrem terminów znika
5. Wszystko na 375 px

## Performance Considerations

Filtr to jedno `exists` po kluczu głównym `(caregiver_id, slot)` na profil, w tej samej funkcji co gmina i usługi, a kolumna `availability` to jedno podzapytanie na zwracany wiersz (maks. 50). Koszt mieści się w NFR < 1 s przy docelowej skali. Indeks na `slot` przyda się w S-05.

## Migration Notes

Migracja nie zmienia danych: istniejące profile dostają pustą dostępność i pozostają widoczne (dostępność nie wchodzi do reguły kompletności). Wdrożenie: `db push`, potem `wrangler deploy` (zob. Critical Implementation Details). Wycofanie: nowa migracja przywracająca poprzednie sygnatury trzech funkcji i usuwająca tabelę, a potem wdrożenie poprzedniej wersji Workera (kod faz 2–3 wymaga nowych funkcji).

## References

- Roadmap: `context/foundation/roadmap.md` (S-04; S-05 zależy od tego wycinka)
- PRD: `context/foundation/prd.md` (FR-007, FR-011, US-01, Business Logic, Non-Goals)
- Poprzednie wycinki: `context/archive/2026-11-03-caregiver-profile-setup/plan.md`, `context/archive/2026-11-03-public-caregiver-search/plan.md`, `context/archive/2026-11-03-contact-reveal-after-signin/plan.md`
- Wzorzec tabeli listy: `supabase/migrations/20261103150000_caregiver_profiles.sql:166`
- Granty: `supabase/migrations/20261103230000_table_grants_mirror_policies.sql`, `scripts/check-table-grants.sql`
- Funkcje do zmiany: `supabase/migrations/20261103150000_caregiver_profiles.sql:221`, `20261103200000_search_caregivers.sql:25`, `20261103220000_coordinator_contact_access.sql:56`
- Strona listy: `src/pages/opiekunowie/index.astro`; filtry w URL: `src/lib/caregiver-search.ts`
- Smoke: `scripts/smoke.mjs:116` (`completeProfile`), `:360` (drugi opiekun przez RPC), `:442` (lista jako anon)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Dostępność w bazie

#### Automated

- [x] 1.1 Wszystkie migracje stosują się od zera: `npx supabase db reset` — 1c8cd63
- [x] 1.2 Lint bazy bez błędów: `npx supabase db lint --level error` — 1c8cd63
- [x] 1.3 Kontrola grantów przechodzi: `npx supabase db query --local -f scripts/check-table-grants.sql` — 1c8cd63
- [x] 1.4 Lint i typy: `npm run lint` i `npx astro check` — 1c8cd63
- [x] 1.5 Smoke przechodzi z nowymi krokami bazy: `npm run smoke` — 1c8cd63

#### Manual

- [x] 1.6 Macierz uprawnień ma 24 wiersze, w tym 4 nowe dla `caregiver_availability` — 1c8cd63
- [x] 1.7 Istniejąca lista `/opiekunowie` i strona profilu działają bez zmian w wyglądzie — 1c8cd63

### Phase 2: Opiekun ustawia dostępność

#### Automated

- [x] 2.1 Lint i typy: `npm run lint` i `npx astro check` — cc1ced6
- [x] 2.2 Build: `npm run build` — cc1ced6
- [x] 2.3 Smoke przechodzi z krokami API dostępności: `npm run smoke` — cc1ced6

#### Manual

- [x] 2.4 Opiekun zapisuje Pn–Pt rano i Sb noc, `/profil` pokazuje siatkę, edycja zachowuje zaznaczenia — cc1ced6
- [x] 2.5 Bez terminów `/profil` pokazuje zachętę, a komunikat o kompletności się nie zmienia — cc1ced6
- [x] 2.6 Siatka w formularzu i na `/profil` działa na 375 px i z klawiatury — cc1ced6

### Phase 3: Koordynator filtruje i widzi dostępność

#### Automated

- [x] 3.1 Lint i typy: `npm run lint` i `npx astro check`
- [x] 3.2 Build: `npm run build`
- [x] 3.3 Smoke przechodzi z krokami stron: `npm run smoke`

#### Manual

- [x] 3.4 Filtr „Pn rano” + „Śr rano” działa w trybie OR, URL ma `termin=…`, chip zdejmuje tylko dostępność
- [x] 3.5 Pusty wynik z filtrem dostępności pokazuje „Usuń filtr dostępności (wyniki: N)”
- [x] 3.6 Karty pokazują linię dostępności albo „Dostępność nie podana”, strony profilu pokazują siatkę
- [x] 3.7 Filtr, chipy i karty są czytelne na 375 px

### Phase 4: Wdrożenie produkcyjne

#### Manual

- [ ] 4.1 `npx supabase db push` zastosował migrację dostępności na produkcji
- [ ] 4.2 Na produkcji macierz ma 24 wiersze, a anon dostaje `permission denied` przy zapisie do `caregiver_availability`
- [ ] 4.3 `npx wrangler deploy` zakończony, nowe wdrożenie widoczne w `npx wrangler deployments list`
- [ ] 4.4 Na wdrożonym Workerze filtr i linia dostępności działają, a liczba wyników bez filtrów się nie zmieniła
