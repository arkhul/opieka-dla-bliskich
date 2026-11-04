# E2E krytycznego przepływu koordynatora — Plan Brief

> Full plan: `context/changes/testing-browser-flow/plan.md`
> Research: `context/changes/testing-browser-flow/research.md`

## What & Why

Dodajemy pierwszy test w prawdziwej przeglądarce (Playwright): koordynator przechodzi od filtra do kontaktu na desktopie i na ekranie telefonu, a anonim kontaktu nie widzi. Test jest wymaganą bramką CI. Smoke HTTP nie wykonuje wysp React (wybór gminy, formularze auth) ani nie sprawdza układu na wąskim ekranie, więc regresja widoczna tylko w przeglądarce (test-plan risk #5) dziś by przeszła.

## Starting Point

Brak warstwy przeglądarkowej: nie ma `@playwright/test`, konfiguracji ani katalogu testów. Job CI `smoke` ma już lokalny Supabase, build i `preview` na :4321. Lokalna baza zbiera profile ze wszystkich przebiegów smoke, a lint (`strictTypeChecked`) i `astro check` obejmują całe repo.

## Desired End State

`npm run e2e` lokalnie i krok w jobie `smoke` w CI przechodzą na projektach `desktop` i `mobile`. Celowe zepsucie `next`, ochrony `/kontakt` albo wyspy wyboru gminy daje czerwony e2e. `test-plan.md` ma Phase 2 jako `done`, e2e jako wymaganą bramkę i opisany wzorzec dodawania testów (§6.3).

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Miejsce w CI | Kroki w jobie `smoke` | Reużywa działającego Supabase, `.env` i buildu, bez drugiego startu stacku. | Plan |
| Ekran telefonu | Drugi projekt Chromium z wąskim viewportem | Jedna przeglądarka w CI i test układu, który widzi użytkownik; bez emulacji dotyku. | Plan |
| Ścieżka koordynatora | Rejestracja z `next` z `/kontakt/<id>` | Pokrywa powrót `next` i ścieżkę nowego użytkownika bez wcześniej utworzonego konta. | Plan |
| Seed opiekuna | Fixture przez API z unikalną nazwą (`stamp`) | Ta sama ścieżka co smoke, bez klucza service-role; oczekiwania z deklaracji fixtury (oracle). | Plan |
| Świeżość serwera | `webServer` bez `reuseExistingServer` lokalnie; w CI `BASE_URL` na istniejący preview | Nie testujemy nieaktualnego singletona preview. | Research |
| Zakres asercji #3 | Brak telefonu i e-maila w DOM profilu publicznego, kontakt po rejestracji | Dokłada stan po hydratacji do tego, co sprawdza smoke. | Research |
| Dowód czułości | 3 mutacje, w tym `name="gmina"` w `GminaSelect` | Wzorzec z Phase 1; trzecia mutacja jest niewidoczna dla smoke HTTP. | Plan |

## Scope

**In scope:**
- `@playwright/test`, `playwright.config.ts`, skrypt `e2e`, katalog `e2e/`
- Fixture opiekuna i jeden test przepływu na `desktop` i `mobile`
- Kroki w `ci.yml`, higiena lint/typy/gitignore
- Dowód mutacjami i aktualizacja `test-plan.md`

**Out of scope:**
- Macierz rankingu i reguła gminy w przeglądarce (pokrywa pgTAP)
- Logowanie istniejącego konta, wylogowanie
- Emulacja urządzeń, WebKit, osobny job CI
- Zmiany kodu aplikacji; Phase 3 test-planu

## Architecture / Approach

Playwright uruchamia lokalnie build + świeży preview na :4321; gdy ustawiony jest `BASE_URL` (CI), testy idą na już działającym preview w tym samym kroku. Fixture rejestruje opiekuna i zapisuje profil przez API, test odtwarza ścieżkę koordynatora przez UI, a asercje na braki i telefon wynikają z deklaracji fixtury, nie z odczytu aplikacji. Selektory po roli i etykiecie, czekanie na elementy (hydratacja), bez asercji na pozycję karty.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Fundament Playwright | Pakiet, config z dwoma projektami, higiena lint/typy, zielony seed-test | Konflikt reguł lintu i typów z nowym katalogiem; stary preview na :4321 |
| 2. Test przepływu koordynatora | Fixture + test: filtr → braki → redirect → rejestracja → kontakt, desktop i telefon | Flaky hydratacja wyspy; lista uciążliwie rosnąca od profili smoke |
| 3. Bramka CI i dowód czułości | Kroki w CI, 3 mutacje, aktualizacja test-planu | Proces tła preview i czas instalacji Chromium w CI |

**Prerequisites:** lokalny Supabase w Dockerze, Node 22, `npx playwright install chromium`, zatrzymany lokalny `astro preview`.
**Estimated effort:** ~2–3 sesje w 3 fazach.

## Open Risks & Assumptions

- Czas instalacji Chromium w CI nie jest zmierzony; cache dodajemy dopiero, gdy będzie potrzebny.
- Zakładamy, że lista `/opiekunowie` nie ucina wyników w sposób ukrywający kartę fixtury; implementer sprawdza paginację/limit i wybiera gminę poza Warszawą używaną przez smoke.
- Proces tła preview musi żyć w tym samym kroku CI co e2e.
- Wersja i konfiguracja Playwright mają być zweryfikowane w Context7 przy implementacji.

## Success Criteria (Summary)

- `npm run e2e` przechodzi lokalnie i w CI na `desktop` i `mobile`, a smoke i pgTAP pozostają zielone.
- Trzy celowe mutacje (`next`, ochrona `/kontakt`, `name="gmina"`) dają czerwony e2e.
- `test-plan.md` pokazuje Phase 2 jako `done` i e2e jako wymaganą bramkę.
