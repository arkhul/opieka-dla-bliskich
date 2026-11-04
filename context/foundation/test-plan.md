# Test Plan

> Phased test rollout for this project. Strategy is frozen at the top
> (§1–§5); cookbook patterns at the bottom (§6) fill in as phases ship.
> Read before writing any new test.
>
> Refresh: re-run `/10x-test-plan --refresh` when stale (see §8).
>
> Last updated: 2026-11-04

## 1. Strategy

Testy w tym projekcie stosują trzy nienegocjowalne zasady:

1. **Koszt × sygnał.** Wygrywa najtańszy test, który daje realny sygnał dla
   danego ryzyka. Nie promuj testu do e2e, bo e2e „wydaje się bezpieczniejsze”.
   Nie nakładaj modelu wizji na deterministyczny diff wizualny, który już
   wyłapuje regresję.
2. **Obawy użytkownika są dowodem pierwszej klasy.** Ryzyka zakotwiczone
   w „autor obawia się błędnego dopasowania osób, a awaria ujawniłaby się
   gdzieś w obszarze wyszukiwania i rankingu” mają taką samą wagę jak linie
   PRD lub dane hot-spotów.
3. **Ryzyka to scenariusze, nie miejsca w kodzie.** Ten plan dokumentuje,
   *co może zawieść* i *dlaczego uważamy to za prawdopodobne*, na podstawie
   dokumentów, wywiadu i *sygnału* z bazy kodu (zmienność, struktura, baza
   testów). NIE twierdzi, że wie, która linia odpowiada za awarię. Tę wiedzę
   wytwarza `/10x-research` w każdym etapie wdrożenia. Jeśli plan i badanie
   różnią się co do miejsca awarii, prawdą jest badanie.

Hot-spot scope used for likelihood weighting: `src/`, `supabase/migrations/`, `scripts/` (bez `src/components/ui/`, `context/`, `dist/`, `node_modules/`).

## 2. Risk Map

Najważniejsze scenariusze awarii, uporządkowane według ryzyka = wpływ ×
prawdopodobieństwo. Ryzyka są opisane w kategoriach użytkownika i biznesu, nie
jako nazwy testów. Kolumna Source cytuje *dowód, który wyniósł ryzyko na górę* —
nigdy konkretny plik jako „miejsce awarii” (to zadanie badania, zob. §1 zasada #3).

| # | Risk (failure scenario) | Impact | Likelihood | Source (evidence — not anchor) |
|---|---|---|---|---|
| 1 | Wyniki wyszukiwania pokazują opiekuna spoza wskazanej gminy (albo bez obsługiwanych gmin), a pomijają opiekuna, który ją obsługuje | High | High | PRD §Business Logic (gmina warunkiem twardym), US-01 AC3; interview Q1, Q3; hot-spot dir `supabase/migrations/` (11 commits/30d) |
| 2 | Ranking stawia wyżej profil pokrywający mniej wymaganych usług albo oznaczenie braków jest nieprawdziwe (pokazuje pełne dopasowanie, choć czegoś brakuje, lub odwrotnie) | High | High | PRD FR-016, §Business Logic (usługi ważą najwięcej); interview Q1, Q3; archive `2026-11-04-ranked-match-results/reviews/impl-review.md` F4; hot-spot dir `supabase/migrations/` (11 commits/30d) |
| 3 | Dane kontaktowe opiekuna (telefon, e-mail) docierają do osoby niezalogowanej: przez HTML strony publicznej, publiczne API, bezpośredni dostęp do bazy lub indeks wyszukiwarki | High | Medium | PRD §Guardrails, NFR 2; AGENTS.md Hard Rules; archive `2026-11-03-contact-reveal-after-signin/reviews/plan-review.md` F3; archive `2026-11-03-caregiver-profile-setup/reviews/impl-review.md` F7 |
| 4 | Nadużycie: zalogowany użytkownik zmienia, usuwa lub masowo czyta cudze dane z pominięciem aplikacji, albo nowa tabela trafia na produkcję z domyślnymi uprawnieniami | High | Medium | PRD §Access Control; archive `2026-11-03-caregiver-profile-setup/reviews/impl-review.md` F1 (limit obchodzony bezpośrednio przez API bazy); archive `2026-11-03-dictionaries-review-cleanup` review F1 (domyślne granty ALL); interview Q3 |
| 5 | Przepływ koordynatora w prawdziwej przeglądarce przestaje działać (filtry, logowanie z powrotem do kontaktu, ekran telefonu), choć testy na poziomie HTTP przechodzą | High | Medium | PRD §Success Criteria Primary 1–4, NFR 3 (telefon); archive `2026-11-03-public-caregiver-search/reviews/impl-review.md` F3 (błąd widoczny tylko w przeglądarce); test base: brak warstwy przeglądarkowej |
| 6 | Zapis profilu po cichu gubi wcześniej zapisane dane (terminy, gminy, usługi), przez co opiekun znika z filtrów | Medium | Medium | archive `2026-11-04-caregiver-availability-filter/reviews/impl-review.md` F1; hot-spot dirs `src/pages/api/` (12 commits/30d), `src/components/caregiver/` (13 commits/30d) |

### Risk Response Guidance

| Risk | What would prove protection | Must challenge | Context `/10x-research` must ground | Likely cheapest layer | Anti-pattern to avoid |
|------|-----------------------------|----------------|--------------------------------------|-----------------------|-----------------------|
| #1 | Na ustalonym zestawie profili wynik dla gminy G zawiera dokładnie profile obsługujące G; profil bez gmin i profil z sąsiedniej gminy się nie pojawiają | „Lista nie jest pusta, więc filtr działa” | Punkt wejścia wyszukiwania (baza i strona listy), źródło danych testowych, gminy wycofane | integracja (lokalny Supabase) | Oczekiwany zbiór odczytany z wyniku zapytania zamiast wyprowadzony z reguł PRD |
| #2 | Na zestawie z ręcznie wyliczoną kolejnością (reguła: usługi przed terminami) wynik ma dokładnie tę kolejność, a oznaczenia braków zgadzają się z deklaracjami profili | „Kolejność nie rośnie, więc ranking jest poprawny” | Reguła rankingu i rozstrzygania remisów, kształt oznaczenia braków, obsługa pustych i nieznanych wartości filtra | integracja | Problem wyroczni: oczekiwana kolejność skopiowana z implementacji |
| #3 | Telefon i e-mail opiekuna nie występują w żadnej odpowiedzi dla osoby niezalogowanej (HTML, API, baza), a występują na chronionej stronie kontaktu dla zalogowanego koordynatora | „Strona nie pokazuje pola, więc danych nie ma” (mogą siedzieć w JSON lub atrybutach) | Wszystkie powierzchnie publiczne, uprawnienia tabel i polityki, formaty zapisu numeru | integracja (istniejący smoke częściowo pokrywa) | Sprawdzanie nieobecności po fragmencie, który nie wystąpiłby nawet przy wycieku |
| #4 | Inny opiekun i koordynator nie zmieniają ani nie usuwają cudzego profilu bezpośrednio przez API bazy; żadna tabela nie ma domyślnych uprawnień ALL | „Aplikacja na to nie pozwala, więc baza też nie” | Polityki per operacja i rola, uprawnienia tabel, limity egzekwowane w funkcjach kontra bezpośredni zapis | integracja (bezpośrednio do bazy) | Testowanie wyłącznie przez endpoint aplikacji |
| #5 | Koordynator w przeglądarce (szerokim i wąskim ekranie) przechodzi: filtr, uszeregowana lista z brakami, logowanie, widoczny kontakt; bez logowania kontaktu nie widzi | „Smoke HTTP przeszedł, więc UI działa” | Powrót po logowaniu do docelowej strony, wyspy interaktywne (wybór gminy), dane testowe dla przeglądarki | e2e (jeden przepływ) | e2e dla czegoś, co wyłapie integracja (np. pełna macierz rankingu w przeglądarce) |
| #6 | Edycja jednego pola profilu zostawia pozostałe zapisane dane bez zmian | „Zapis zwrócił 200, więc dane są całe” | Kontrakt zapisu (pełne zastąpienie czy częściowe), starsze wywołania zapisu | integracja | Sprawdzanie tylko pola, które edytowano |

## 3. Phased Rollout

Każdy wiersz to osobny etap wdrożenia, który otworzy własny folder zmiany
przez `/10x-new`. Status przesuwa się od lewej do prawej przez wartości ze
schematu; orkiestrator aktualizuje Status, gdy na dysku pojawiają się artefakty.

| # | Phase name | Goal (one line) | Risks covered | Test types | Status | Change folder |
|---|---|---|---|---|---|---|
| 1 | Poprawność dopasowania | Dowieść twardego filtra gminy i kolejności rankingu na wyroczni wyprowadzonej z PRD, nie z kodu | #1, #2 | integration | done | testing-matching-correctness |
| 2 | Krytyczny przepływ w przeglądarce | Dowieść, że koordynator w przeglądarce (desktop i telefon) dochodzi od filtra do kontaktu, a bez logowania kontaktu nie widzi; test jako bramka CI | #5 (widoczność #1, #3) | e2e, CI gate | not started | — |
| 3 | Granice kontaktu i zapisów | Zmapować istniejący smoke na #3, #4, #6 i domknąć luki tam, gdzie sprawdzenie nie wyłapałoby wycieku, nadużycia lub utraty danych | #3, #4, #6 | integration | not started | — |

## 4. Stack

Klasyczna baza testów projektu. Narzędzia AI-native (jeśli są) mają datę
`checked:`. Zalecenia opierają się na lokalnych manifestach i konfiguracji
oraz na narzędziach dostępnych w bieżącej sesji.

Profil bazy testów: **sparse** — brak konfiguracji runnera (vitest/jest/playwright); jeden skrypt smoke bez zależności w `scripts/`, uruchamiany w CI na lokalnym Supabase razem z kontrolą uprawnień tabel.

| Layer | Tool | Version | Notes |
|---|---|---|---|
| integration (HTTP + baza) | `scripts/smoke.mjs` (Node, bez zależności) | Node 22 | Działa na zbudowanej aplikacji (`npm run preview`) i lokalnym Supabase; wymaga wyłączonego potwierdzania e-maila |
| integracja SQL (pgTAP) | `supabase test db` na `supabase/tests/database/*.test.sql` | pgTAP 1.3.3, `pg_prove:3.36`, Supabase CLI 2.117.0 | Reguła dopasowania i rankingu (`search_caregivers()`); każdy plik w jednej transakcji z `rollback`, fixtury nie zostają w bazie |
| uprawnienia bazy | `scripts/check-table-grants.sql` | Supabase CLI 2.117.0 (CI) | Blokuje tabele z domyślnymi uprawnieniami ALL |
| unit | none yet | — | Nie planowany: logika dopasowania żyje w bazie, więc najtańszy realny sygnał to integracja (§3 Phase 1, pgTAP) |
| e2e | none yet — see Phase 2 | — | Playwright jest kandydatem; wersję i konfigurację ugruntować w Phase 2 |
| accessibility | none yet | — | Poza bieżącym wdrożeniem |

**Stack grounding tools (current session):**
- Docs: Context7 — dostępny; nie użyty przy pisaniu planu (brak zaleceń zależnych od wersji poza Phase 2); użyć do konfiguracji Playwright i adaptera Cloudflare w Phase 2; checked: 2026-11-04
- Search: WebSearch — dostępny; Exa.ai not available in current session; nie użyty; checked: 2026-11-04
- Runtime/browser: Claude in Chrome — dostępny; możliwa ręczna weryfikacja przepływu, nie zastępuje testu e2e w CI; checked: 2026-11-04
- Provider/platform: GitHub (`gh`), Supabase CLI, Cloudflare (`wrangler`) — dostępne; istotne dla bramek CI i weryfikacji wdrożenia; checked: 2026-11-04

## 5. Quality Gates

| Gate | Where | Required? | Catches |
|---|---|---|---|
| lint + typecheck + build | local + CI | required | dryf składni i typów, błędy budowania |
| uprawnienia tabel (`check-table-grants.sql`) | CI | required | tabele z domyślnymi uprawnieniami ALL |
| smoke (integracja HTTP + baza) | CI | required | regresje auth, RLS, wyszukiwania, kontaktu, usuwania |
| testy poprawności dopasowania (pgTAP) | CI | required | błędna gmina, błędna kolejność, nieprawdziwe oznaczenie braków |
| e2e krytycznego przepływu | CI | required after §3 Phase 2 | zepsuty przepływ koordynatora w przeglądarce |
| smoke na wdrożonym Workerze | ręcznie po deployu | optional | różnice między lokalnym środowiskiem a produkcją |

## 6. Cookbook Patterns

Jak dodawać nowe testy w tym projekcie. Każda podsekcja zostanie wypełniona po
ukończeniu odpowiedniego etapu; do tego czasu brzmi „TBD — see §3 Phase N”.

### 6.1 Adding a matching/ranking test

- **Location**: `supabase/tests/database/*.test.sql` (pgTAP), uruchamiane przez `supabase test db` na lokalnym Supabase.
- **Run locally**: lokalny Supabase musi działać (`supabase start`); potem `supabase test db` (bez argumentów znajduje wszystkie pliki w tej lokalizacji).
- **Convention**: plik w jednej transakcji (`begin; create extension if not exists pgtap with schema extensions; select plan(n); …; select * from finish(); rollback;`); fixtury wstawiane jako `postgres`, wywołanie testowanej funkcji jako `set local role anon`. Gminy testowe pod prefiksem `9999xx1` (poza zasięgiem danych realnych i walidacją TERYT), stałe UUID dla profili, **jawny** `updated_at` na każdym profilu (w transakcji `now()` jest stałe — bez jawnej wartości remisy rozstrzygałby tylko `user_id`).
- **Oracle**: oczekiwany zbiór/kolejność/listy braków są literalne w komentarzu z odwołaniem do reguły PRD/S-05 i wyprowadzone z deklaracji fixtur — nigdy z wyniku zapytania (problem wyroczni). Kolejność wyniku odczytuj z `WITH ORDINALITY` na emisji funkcji, nie sortuj ponownie w teście.
- **Sensitivity proof**: nowy test musi łapać co najmniej jedną realistyczną mutację reguły (zmienić warunek filtra/progu/kolejności w kopii funkcji w scratchpad, potwierdzić czerwony `supabase test db`, przywrócić i potwierdzić zielony — wzorzec z §3 Phase 1 dowodu mutacjami).
- **Cleanup check**: po przebiegu w lokalnej bazie nie ma gmin `9999%` ani użytkowników fixtur (transakcja się wycofuje — to jest kontrola sanity, nie czyszczenie).

### 6.2 Adding an integration (smoke) step

- **Location**: `scripts/smoke.mjs` (istniejący wzorzec; szczegóły do uzupełnienia w §3 Phase 3).
- **Run locally**: `BASE_URL=http://localhost:4321 npm run smoke` na działającym `npm run preview` i lokalnym Supabase.
- TBD — see §3 Phase 3 (wzorzec sprawdzania nieobecności kontaktu i odmowy dostępu bezpośrednio w bazie).

### 6.3 Adding an e2e test

- TBD — see §3 Phase 2 (wzorzec: jeden przepływ koordynatora od filtra do kontaktu, desktop i telefon).

### 6.4 Adding a test for a new table or policy

- TBD — see §3 Phase 3 (wzorzec: odmowa dla anon, innego opiekuna i koordynatora bezpośrednio przez API bazy).

### 6.5 Per-rollout-phase notes

- **Phase 1 (Poprawność dopasowania, change `testing-matching-correctness`)**: dowiedzione pgTAP (`supabase/tests/database/search_caregivers_gmina.test.sql`, `search_caregivers_ranking.test.sql`), jeden krok smoke dla kontraktu kolejności braków na karcie, bramka CI (`supabase test db` w jobie `smoke`, po kontroli uprawnień tabel). Dowód mutacjami: 4 mutacje reguły (filtr gminy po prefiksie, pominięcie `g.active`, zamiana kolejności `matched_services`/`matched_slots`, usunięcie progu usług) dały czerwony `supabase test db`; po przywróceniu funkcji z migracji hash `pg_get_functiondef` identyczny i testy zielone.

## 7. What We Deliberately Don't Test

Wywiad Q5 pominięty; wykluczenia poniżej wynikają z dokumentów i uwag kwestionującego.

- **Komponenty `src/components/ui/`** — kod generowany przez shadcn/ui, nie pisany ręcznie. Re-evaluate, jeśli komponent zostanie istotnie zmodyfikowany. (Source: AGENTS.md Project Structure.)
- **Wydajność wyszukiwania (< 1 s)** — mierzona na produkcji (`wrangler tail`), nie testem. Re-evaluate przy realnym katalogu profili. (Source: PRD NFR 1, challenger finding.)
- **Usunięty profil nadal widoczny** — pokryte istniejącym smoke'iem na najtańszej warstwie, obszar bez zmian od S-06. Re-evaluate przy zmianie usuwania. (Source: roadmap S-06, challenger finding.)

## 8. Freshness Ledger

- Strategy (§1–§5) last reviewed: 2026-11-04
- Stack versions last verified: 2026-11-04
- AI-native tool references last verified: 2026-11-04
- §3 Phase 1 closed, §4/§6.1 pgTAP layer added: 2026-11-04

Refresh (`/10x-test-plan --refresh`) when:

- a new top-3 risk surfaces from the roadmap or archive,
- a recommended tool's `checked:` date is older than three months,
- the project's tech stack changes (new framework, new test runner),
- §7 negative-space no longer matches what the team believes.
