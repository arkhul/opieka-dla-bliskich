# E2E krytycznego przepływu koordynatora — Implementation Plan

## Overview

Dodajemy do repo pierwszą warstwę przeglądarkową: `@playwright/test` i jeden test przepływu koordynatora (filtr → lista z oznaczeniem braków → profil publiczny bez kontaktu → przekierowanie anonima na logowanie → rejestracja z powrotem na `/kontakt/<id>` → widoczny kontakt), uruchamiany na dwóch projektach (desktop i wąski viewport telefonu). Test wchodzi do CI jako kroki w jobie `smoke` i staje się wymaganą bramką (test-plan §5, §3 Phase 2; risk #5, widoczność #1 i #3).

## Current State Analysis

- Brak `@playwright/test`, `playwright.config.*`, katalogu testów i `context/foundation/test-stack.md` (research.md, Summary).
- Smoke HTTP (`scripts/smoke.mjs`) sprawdza przepływ jako HTML/302, ale nie wykonuje wysp React: `GminaSelect` (combobox, `client:load`), `SignInForm`/`SignUpForm` (walidacja `onSubmit`) ani nie sprawdza układu na wąskim ekranie.
- CI: job `smoke` stawia lokalny Supabase, buduje aplikację i uruchamia `npm run preview -- --port 4321 &`, po czym `npm run smoke` (`.github/workflows/ci.yml:27-72`).
- Lokalna baza zbiera profile ze wszystkich uruchomień smoke (`scripts/smoke.mjs:138-140`), więc e2e nie może zakładać pustej listy ani pozycji na liście.
- `eslint.config.js` stosuje `strictTypeChecked` z `projectService` do całego repo, a `tsconfig.json` obejmuje `**/*` — nowe pliki `.ts` w katalogu e2e i `playwright.config.ts` trafią pod lint i `astro check`.
- Astro 7 `preview` jest singletonem projektu; lokalnie może działać nieaktualny preview na :4321 (research.md, CI i uruchamianie).

## Desired End State

`npm run e2e` (lokalnie: build + świeży preview + lokalny Supabase) i krok w jobie `smoke` w CI przechodzą na zielono na dwóch projektach (`desktop`, `mobile`). Test jest czuły: celowe zepsucie powrotu `next`, ochrony `/kontakt` albo wyspy wyboru gminy daje czerwony e2e. `test-plan.md` §3 pokazuje Phase 2 jako `done`, §5 jako wymaganą bramkę, a §6.3 opisuje, jak dodać kolejny test e2e.

### Key Discoveries:

- `PROTECTED_ROUTES` + redirect z `next` w `src/middleware.ts:6, 47-51`; `signin.astro:19` linkuje do rejestracji z zachowanym `next`; `signup.astro` wstępnie zaznacza rolę koordynatora, gdy `next` zaczyna się od `/kontakt/`.
- Fixtura profilu opiekuna ze smoke (`scripts/smoke.mjs:173-182`): `PUT /api/caregiver/profile` z `displayName`, `phone`, `email`, `gminas`, `services`, `availability`; telefon zapisywany jako `+48XXXXXXXXX`, wyświetlany z odstępami (`src/lib/phone.ts`), np. `+48 600 100 200`.
- Smoke pomaga scopować asercje do jednej karty (`cardFragment`, `scripts/smoke.mjs:166-171`); w e2e odpowiednikiem jest locator karty (`article`) filtrowany po unikalnej nazwie.
- Zasada oracle (test-plan §6.1): oczekiwane braki i telefon wynikają z deklaracji fixtury, nie z odczytu aplikacji.

## What We're NOT Doing

- Nie powielamy macierzy rankingu ani reguły gminy w przeglądarce (anti-pattern #5; pokrywa to pgTAP z Phase 1).
- Nie testujemy logowania istniejącego konta ani wylogowania (wybrano ścieżkę rejestracji z `next`; logowanie pokrywa smoke na poziomie HTTP).
- Nie emulujemy urządzenia (dotyk, user-agent, WebKit) — tylko Chromium z wąskim viewportem.
- Nie dodajemy osobnego jobu CI ani drugiej przeglądarki.
- Nie ruszamy kodu aplikacji ani migracji; zmiany tylko w narzędziach testowych, CI i dokumentacji planu testów.
- Nie sprzątamy profili z lokalnej bazy po teście (jak smoke; unikalna nazwa wystarcza).
- Nie zajmujemy się Phase 3 (granice kontaktu i zapisów).

## Implementation Approach

Trzy fazy, każda kończy się zielono i jest weryfikowalna osobno: (1) fundament — pakiet, konfiguracja, seed-test, zgodność z lintem i typami; (2) właściwy przepływ z fixturą seedującą opiekuna przez API; (3) bramka CI i dowód czułości mutacjami (wzorzec z Phase 1). Playwright uruchamia aplikację sam lokalnie (`webServer`: build + preview na :4321, **bez** `reuseExistingServer`, żeby nie testować nieaktualnej instancji); gdy ustawiony jest `BASE_URL` (CI), `webServer` jest pomijany i testy idą w tym samym kroku co działający preview. Kolejność czekania: na elementy (hydratacja wyspy), nie na czas.

## Critical Implementation Details

- **Timing & lifecycle**: combobox gminy działa dopiero po hydratacji wyspy, a lista podpowiedzi pojawia się po debounce 250 ms i fetchu — asercje muszą czekać na widoczną opcję gminy, nie na `waitForTimeout`. Ukryty `input[name=gmina]` ma wartość TERYT dopiero po wyborze.
- **State sequencing**: CI ma uruchomić e2e w tym samym kroku `run`, w którym startuje preview (`ci.yml:68`) — proces tła z poprzedniego kroku nie jest gwarantowany po jego zakończeniu.
- **Dane testowe**: wybierz gminę, której nie używa smoke (smoke seeduje Warszawę `1465011`), żeby lista nie rosła z każdym przebiegiem; asercje i tak opieraj na unikalnej nazwie z `stamp` i sprawdź, czy lista nie jest paginowana/ucinana limitem, który mógłby ukryć kartę.

## Phase 1: Fundament Playwright

### Overview

Pakiet, konfiguracja z dwoma projektami, higiena repo (gitignore, lint, typy) i jeden zielony seed-test, który dowodzi, że całość uruchamia się na świeżym buildzie.

### Changes Required:

#### 1. Zależność i skrypt

**File**: `package.json`

**Intent**: Dodać `@playwright/test` jako devDependency (wersja z `npm view`, najnowsza stabilna, zweryfikowana przez Context7) i skrypt uruchamiający testy e2e, w stylu istniejącego `smoke`.

**Contract**: `devDependencies["@playwright/test"]`; `scripts.e2e = "playwright test"`.

#### 2. Konfiguracja Playwright

**File**: `playwright.config.ts`

**Intent**: Zdefiniować katalog testów, dwa projekty Chromium (`desktop` z domyślnym viewportem, `mobile` z viewportem telefonu ~390×844 bez deviceDescriptor), trace i screenshot przy błędzie oraz `webServer`, który lokalnie buduje i stawia świeży preview.

**Contract**: `testDir: "e2e"`; `use.baseURL = process.env.BASE_URL ?? "http://localhost:4321"`; `webServer` ustawiony tylko gdy `BASE_URL` nie jest zdefiniowany: `command` = build + `npm run preview -- --port 4321`, `url` = baseURL, `reuseExistingServer: false`, timeout wystarczający na build; `workers: 1`; `forbidOnly` i `retries: 0` w CI (jedna flaka = sygnał do zbadania, nie do ukrycia).

#### 3. Higiena repo

**Files**: `.gitignore`, `eslint.config.js` (jeśli potrzebne)

**Intent**: Wykluczyć artefakty Playwright z gita i upewnić się, że `e2e/**/*.ts` oraz `playwright.config.ts` przechodzą `npm run lint` i `npx astro check` bez luzowania reguł dla kodu aplikacji.

**Contract**: wpisy `test-results/`, `playwright-report/`, `blob-report/`; ewentualny blok `files: ["e2e/**", "playwright.config.ts"]` w `eslint.config.js` tylko jeśli reguły React/Astro lub `no-console` wymagają dostosowania (wzorzec: `scriptsConfig`).

#### 4. Seed-test

**File**: `e2e/seed.spec.ts`

**Intent**: Jeden minimalny test na obu projektach: otwiera `/opiekunowie` i widzi nagłówek „Wyniki: …" oraz formularz filtrów. Dowodzi, że build → preview → przeglądarka działa, zanim pojawi się logika przepływu.

**Contract**: test przechodzi na projektach `desktop` i `mobile`; nie zależy od danych w bazie.

### Success Criteria:

#### Automated Verification:

- Pakiet i konfiguracja istnieją: `node -e "require('@playwright/test/package.json')"` oraz plik `playwright.config.ts`
- Przeglądarka zainstalowana lokalnie: `npx playwright install chromium`
- Seed-test przechodzi na obu projektach (przy zatrzymanym preview): `npm run e2e`
- Lint przechodzi: `npm run lint`
- Typy przechodzą: `npx astro check`
- Build przechodzi: `npm run build`

#### Manual Verification:

- Przy uruchomionym nieaktualnym `astro preview` na :4321 `npm run e2e` kończy się błędem zajętego portu zamiast testować starą instancję
- `playwright-report/` i `test-results/` nie pojawiają się w `git status`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: Test przepływu koordynatora

### Overview

Fixture seedująca opiekuna przez API i jeden test przepływu (parametryzowany projektami `desktop`/`mobile`), z asercjami na braki, na brak kontaktu w publicznym DOM i na kontakt po rejestracji.

### Changes Required:

#### 1. Fixture opiekuna

**File**: `e2e/fixtures.ts`

**Intent**: Dostarczyć testowi unikalnego opiekuna z deklaracją danych (nazwa z `stamp`, gmina, usługi, telefon, e-mail kontaktowy), zapisanego tą samą ścieżką co smoke: rejestracja konta opiekuna i `PUT /api/caregiver/profile` przez `request` Playwrighta. Deklaracja jest źródłem oczekiwań w teście (oracle).

**Contract**: fixture zwraca `{ id, displayName, phone, phoneDisplay, contactEmail, gmina, services }`; `id` pochodzi z odpowiedzi API lub odczytu z listy; profil oferuje jedną usługę (`towarzystwo`), tak by filtr dwóch usług dał deterministyczne „Brakuje usług: …"; adresy e-mail unikalne per projekt i per przebieg (`stamp` + nazwa projektu); hasło spełnia reguły `SignUpForm`.

#### 2. Test przepływu

**File**: `e2e/coordinator-flow.spec.ts`

**Intent**: Odtworzyć ścieżkę koordynatora w przeglądarce: wybór gminy w `GminaSelect`, zaznaczenie dwóch usług, „Pokaż wyniki", karta fixtury z linią „Brakuje usług: <druga usługa>", wejście w profil publiczny (w DOM brak telefonu i e-maila kontaktowego w żadnej postaci), link do `/kontakt/<id>`, przekierowanie anonima na `/auth/signin?next=…`, przejście do rejestracji z zachowanym `next` i wstępnie zaznaczoną rolą koordynatora, rejestracja i lądowanie na `/kontakt/<id>` z widocznym `+48 600 100 200`/e-mailem opiekuna oraz e-mailem koordynatora w topbarze.

**Contract**: selektory po roli/etykiecie (`getByRole`, `getByLabel` — np. przycisk „Wybierz gminę", `aria-label="Szukaj gminy"`, pola `email`/`password`), bez CSS zależnych od klas Tailwind; karta wyszukiwana jako `article` filtrowany unikalną nazwą z fixtury; brak asercji na pozycję karty na liście; format telefonu w oczekiwaniu = `+48 600 100 200` (wyprowadzony z deklaracji, nie z odczytu strony); test działa bez zmian na obu projektach, a na mobile dodatkowo sprawdza, że karta i przycisk „Pokaż wyniki" są osiągalne (widoczne po przewinięciu) bez poziomego przewijania strony.

### Success Criteria:

#### Automated Verification:

- Test przepływu przechodzi na obu projektach: `npm run e2e`
- Seed-test nadal przechodzi: `npm run e2e`
- Lint przechodzi: `npm run lint`
- Typy przechodzą: `npx astro check`
- Smoke nadal zielony na tym samym preview i bazie: `npm run smoke`

#### Manual Verification:

- Przy `npx playwright test --headed` przepływ wygląda jak realna sesja koordynatora (wybór gminy, lista, logowanie, kontakt) — także na szerokości telefonu
- Powtórne uruchomienie testu (drugi przebieg na tej samej bazie) nadal przechodzi — profile z poprzednich przebiegów nie zaburzają asercji

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 3: Bramka CI i dowód czułości

### Overview

Podłączenie e2e do jobu `smoke`, dowód, że test łapie realne regresje (w tym taką, której smoke HTTP nie widzi), i zamknięcie fazy w `test-plan.md`.

### Changes Required:

#### 1. Kroki w CI

**File**: `.github/workflows/ci.yml`

**Intent**: W jobie `smoke` zainstalować Chromium i uruchomić e2e na tym samym działającym preview, który obsługuje smoke, jako wymagany krok (bez `continue-on-error`). Raport/trace wgrywany tylko przy błędzie.

**Contract**: krok `npx playwright install --with-deps chromium` przed uruchomieniem testów; w istniejącym kroku „Run smoke test against production preview" dodać po `npm run smoke` wywołanie `BASE_URL=http://localhost:4321 npm run e2e` (ten sam krok `run`, bo preview żyje jako proces tła tego kroku); `actions/upload-artifact` z `playwright-report/` z warunkiem `if: failure()`; kolejność: e2e po smoke, przed `supabase stop`.

#### 2. Dowód czułości (mutacje)

**Files**: scratchpad (kopie), brak commitowanych zmian kodu aplikacji

**Intent**: Powtórzyć wzorzec z Phase 1: dla każdej mutacji zbudować aplikację, uruchomić e2e, potwierdzić czerwony wynik, przywrócić kod i potwierdzić zielony. Mutacje: (a) `next` pomijany w redirecie po rejestracji (`src/pages/api/auth/signup.ts`); (b) usunięcie `/kontakt` z `PROTECTED_ROUTES` (`src/middleware.ts`); (c) zmiana `name="gmina"` ukrytego inputu w `GminaSelect.tsx` — mutacja widoczna tylko w przeglądarce, smoke HTTP jej nie wykrywa.

**Contract**: wynik każdej mutacji zapisany (która asercja zrobiła się czerwona); po przywróceniu `git diff` na plikach aplikacji jest pusty, a e2e i smoke zielone.

#### 3. Aktualizacja planu testów

**File**: `context/foundation/test-plan.md`

**Intent**: Zamknąć Phase 2: status `done` i folder zmiany w §3, wiersz e2e w §4 (Playwright, wersja, Node 22), §5 „required", wypełniona §6.3 (lokalizacja `e2e/`, komenda, konwencja fixtury i oracle, wąski viewport jako projekt, preview bez reuse), notatka w §6.5 z dowodem mutacjami, wpis w §8 Freshness Ledger.

**Contract**: sekcje §3 (tabela), §4 (tabela), §5, §6.3, §6.5, §8; bez zmian w §1–§2.

### Success Criteria:

#### Automated Verification:

- Lint i typy przechodzą: `npm run lint` oraz `npx astro check`
- Build przechodzi: `npm run build`
- Lokalnie e2e i smoke zielone: `npm run e2e` oraz `npm run smoke`
- Mutacje (a), (b), (c) dają czerwony `npm run e2e`, a po przywróceniu `git diff --stat src/` jest pusty i e2e zielony
- Workflow jest poprawny składniowo: `gh workflow view CI` (lub przegląd YAML) i zielony przebieg CI po pushu: `gh run watch`

#### Manual Verification:

- W przebiegu CI krok e2e jest widoczny jako osobny, wymagany krok i trwa akceptowalnie (zanotuj czas instalacji Chromium i samego testu)
- Umyślnie zepsuty test w gałęzi roboczej daje czerwony job i artefakt raportu (opcjonalnie, jednorazowo)
- `test-plan.md` jest spójny: Phase 2 `done`, §5 „required", §6.3 wypełniona

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Testing Strategy

### Unit Tests:

- Nie dotyczy: test-plan §4 nie planuje warstwy unit; ta zmiana sama jest warstwą e2e.

### Integration Tests:

- Istniejący `npm run smoke` i `supabase test db` pozostają bez zmian i muszą zostać zielone (Phase 2 i 3).

### Manual Testing Steps:

1. `npm run e2e --headed` na desktopie i na projekcie `mobile`, obserwacja wyboru gminy i powrotu po rejestracji.
2. Uruchomić `npm run e2e` dwa razy z rzędu na tej samej bazie.
3. Uruchomić `npm run e2e` przy działającym nieaktualnym preview i potwierdzić błąd portu.

## Performance Considerations

Dodatkowy czas CI: instalacja Chromium (do zmierzenia; ewentualny cache `~/.cache/ms-playwright` dopiero gdy przekroczy akceptowalny próg) i jeden przepływ × 2 projekty z `workers: 1`. Brak drugiego startu Supabase i buildu dzięki kluczowi decyzji „kroki w jobie `smoke`".

## Migration Notes

Brak zmian danych ani schematu. Rollback: usunięcie `e2e/`, `playwright.config.ts`, kroków w `ci.yml` i zależności.

## References

- Related research: `context/changes/testing-browser-flow/research.md`
- Test plan: `context/foundation/test-plan.md` §2 (risk #5), §3 Phase 2, §5, §6.1 (wzorzec oracle i dowodu mutacjami)
- Fixtura profilu i telefon: `scripts/smoke.mjs:173-182`
- CI job: `.github/workflows/ci.yml:27-72`
- Auth i `next`: `src/middleware.ts:6, 47-51`, `src/pages/auth/signin.astro:19`
- Prior phase: `context/archive/2026-11-04-testing-matching-correctness/`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Fundament Playwright

#### Automated

- [x] 1.1 Pakiet i konfiguracja istnieją: `node -e "require('@playwright/test/package.json')"` oraz plik `playwright.config.ts` — 00eacdd
- [x] 1.2 Przeglądarka zainstalowana lokalnie: `npx playwright install chromium` — 00eacdd
- [x] 1.3 Seed-test przechodzi na obu projektach (przy zatrzymanym preview): `npm run e2e` — 00eacdd
- [x] 1.4 Lint przechodzi: `npm run lint` — 00eacdd
- [x] 1.5 Typy przechodzą: `npx astro check` — 00eacdd
- [x] 1.6 Build przechodzi: `npm run build` — 00eacdd

#### Manual

- [x] 1.7 Przy uruchomionym nieaktualnym `astro preview` na :4321 `npm run e2e` kończy się błędem zajętego portu zamiast testować starą instancję — 00eacdd
- [x] 1.8 `playwright-report/` i `test-results/` nie pojawiają się w `git status` — 00eacdd

### Phase 2: Test przepływu koordynatora

#### Automated

- [x] 2.1 Test przepływu przechodzi na obu projektach: `npm run e2e` — 9e1ac68
- [x] 2.2 Seed-test nadal przechodzi: `npm run e2e` — 9e1ac68
- [x] 2.3 Lint przechodzi: `npm run lint` — 9e1ac68
- [x] 2.4 Typy przechodzą: `npx astro check` — 9e1ac68
- [x] 2.5 Smoke nadal zielony na tym samym preview i bazie: `npm run smoke` — 9e1ac68

#### Manual

- [x] 2.6 Przy `npx playwright test --headed` przepływ wygląda jak realna sesja koordynatora (wybór gminy, lista, logowanie, kontakt) — także na szerokości telefonu — 9e1ac68
- [x] 2.7 Powtórne uruchomienie testu (drugi przebieg na tej samej bazie) nadal przechodzi — 9e1ac68

### Phase 3: Bramka CI i dowód czułości

#### Automated

- [x] 3.1 Lint i typy przechodzą: `npm run lint` oraz `npx astro check` — 122ed3d
- [x] 3.2 Build przechodzi: `npm run build` — 122ed3d
- [x] 3.3 Lokalnie e2e i smoke zielone: `npm run e2e` oraz `npm run smoke` — 122ed3d
- [x] 3.4 Mutacje (a), (b), (c) dają czerwony `npm run e2e`, a po przywróceniu `git diff --stat src/` jest pusty i e2e zielony — 122ed3d
- [x] 3.5 Workflow jest poprawny składniowo i zielony przebieg CI po pushu: `gh run watch` — 122ed3d

#### Manual

- [x] 3.6 W przebiegu CI krok e2e jest widoczny jako osobny, wymagany krok i trwa akceptowalnie (zanotuj czas instalacji Chromium i samego testu) — 82215ab
- [x] 3.7 Umyślnie zepsuty test w gałęzi roboczej daje czerwony job i artefakt raportu (opcjonalnie, jednorazowo) — 82215ab
- [x] 3.8 `test-plan.md` jest spójny: Phase 2 `done`, §5 „required", §6.3 wypełniona — 82215ab

## Addendum (impl-review, 2026-11-04)

- Phase 1 odchylenie: `webServer.command` to `node scripts/preview-blocking.mjs`, nie goły build + `npm run preview`. `astro preview` demonizuje się i kończy, więc wrapper utrzymuje proces dla Playwrighta. Na starcie wywołuje `astro preview stop`, więc nieaktualny preview jest zatrzymywany (nie ma błędu zajętego portu, jak w kryterium 1.7); cel — nie testować starego buildu — jest spełniony. Teardown: `e2e/global-teardown.ts` (handlery sygnałów nie działają na Windows).
- Phase 3: dodany `reporter` html w CI (`playwright.config.ts`), bez niego `playwright-report/` nie powstaje i artefakt przy błędzie był pusty. Pozycja 3.7 potwierdzona 2026-11-04: na jednorazowym PR #6 (zamknięty, gałąź usunięta) umyślnie zepsuta asercja w `e2e/seed.spec.ts` dała czerwony job (przebieg 41918690529) i artefakt `playwright-report` (1,2 MB).
