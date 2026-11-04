<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: E2E krytycznego przepływu koordynatora

- **Plan**: context/changes/testing-browser-flow/plan.md
- **Scope**: Full plan (Phase 3 of 3)
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-11-04
- **Verdict**: APPROVED
- **Findings**: 0 critical 2 warnings 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | WARNING |

Automated checks re-run during the review: `npm run lint` OK, `npx astro check` 0 errors, `npm run build` OK, `npm run e2e` 4/4 passed (desktop + mobile; flow + seed). CI run 41914157315 (commit 122ed3d) green, 8m36s.

## Findings

### F1 — Artefakt raportu przy błędzie e2e w CI jest pusty

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: playwright.config.ts (brak `reporter`), .github/workflows/ci.yml:73-77
- **Detail**: Krok `upload-artifact` wgrywa `playwright-report/`, ale config nie ustawia `reporter`. W CI Playwright domyślnie używa reportera `dot`, który nie tworzy `playwright-report/`; trace i screenshoty trafiają do `test-results/`. Przy czerwonym e2e artefakt będzie pusty (warning „No files were found"). Pozycja 3.7 (zepsuty test daje czerwony job i artefakt raportu) jest odhaczona bez śladu dowodu w commicie (82215ab mówi tylko o widoczności kroku i spójności test-plan.md).
- **Fix**: Dodać `reporter: process.env.CI ? [["dot"], ["html", { open: "never" }]] : "list"` w `playwright.config.ts` (raport HTML zawiera trace i screenshoty), a pozycję 3.7 zweryfikować jednorazowym umyślnie czerwonym przebiegiem w gałęzi roboczej.
- **Decision**: FIXED via Fix now — reporter html w CI dodany do playwright.config.ts (CI config ładuje się poprawnie). Pozycja 3.7 nadal do potwierdzenia umyślnie czerwonym przebiegiem w CI.

### F2 — Teardown preview nie działa na Windows; po `npm run e2e` zostaje działający daemon

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: scripts/preview-blocking.mjs:25-32
- **Detail**: Sprzątanie opiera się na `process.on("SIGTERM"/"SIGINT")`, ale Playwright na Windows kończy proces przez `taskkill /F`, więc handler się nie wykonuje. Zweryfikowane w przeglądzie: po zielonym `npm run e2e` `http://localhost:4321/` odpowiadał 200 (pid 8092, zatrzymany ręcznie przez `astro preview stop`). Zostawia to nieaktualny preview dokładnie tam, gdzie notatka projektu ostrzega przed nim (singleton preview przed `npm run smoke`). Kolejne `npm run e2e` samo go zatrzyma (`stopDaemon()` na starcie), ale `npm run smoke` po e2e trafi w stary build.
- **Fix**: Dodać `globalTeardown` (np. `e2e/global-teardown.ts`, aktywny tylko bez `BASE_URL`) wywołujący `npx astro preview stop`, zamiast polegać na sygnałach procesu.
- **Decision**: FIXED via Fix now — e2e/global-teardown.ts + globalTeardown w playwright.config.ts; po `npm run e2e` :4321 nie odpowiada.

### F3 — Wrapper `preview-blocking.mjs` poza planem i inna semantyka niż „błąd zajętego portu"

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: scripts/preview-blocking.mjs, playwright.config.ts:44-52, eslint.config.js:78-81
- **Detail**: Plan (Phase 1) przewidywał `command` = build + `npm run preview`, a kryterium 1.7 „nieaktualny preview → błąd zajętego portu". Implementacja dodała wrapper (uzasadniony: `astro preview` daemonizuje się i kończy), który na starcie robi `astro preview stop` — nieaktualna instancja jest zabijana, a nie zgłaszana jako błąd. Cel (nie testować starego buildu) jest spełniony, literalne kryterium 1.7 nie. Doszło też `setInterval` w globalsach `scriptsConfig`. Uzasadnienie jest w commicie 00eacdd i w test-plan §6.3, ale nie w planie.
- **Fix**: Dopisać do plan.md krótki addendum (wrapper, `astro preview stop` zamiast błędu portu) tak, by plan zgadzał się z kodem.
- **Decision**: FIXED via Fix now — addendum w plan.md.

### F4 — Koszt czasowy CI nie zapisany; instalacja Chromium to ~5,5 min

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: .github/workflows/ci.yml:66
- **Detail**: Plan (3.6) wymagał zanotowania czasu instalacji Chromium i testu. Z przebiegu 41914157315: `playwright install --with-deps chromium` 5m22s, smoke+e2e 21s; job `smoke` ok. 8,5 min wobec ok. 3 min przed zmianą. Pozycja odhaczona, ale liczb nie ma w repo; plan przewidywał cache dopiero po przekroczeniu progu.
- **Fix**: Zapisać liczby w test-plan §6.5 (Phase 2) i zdecydować o cache `~/.cache/ms-playwright`.
- **Decision**: FIXED via Fix now — czasy zapisane w test-plan §6.5 (cache bez wdrożenia).

### F5 — AGENTS.md nie wspomina o `npm run e2e`

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: AGENTS.md (sekcja Testing & CI)
- **Detail**: Sekcja opisuje smoke i pgTAP, lista „przed pushem" nie zawiera `npm run e2e`, mimo że to teraz wymagana bramka CI. Plan nie przewidywał zmiany AGENTS.md, więc kolejny agent nie dowie się o nowej warstwie z reguł repo.
- **Fix**: Dodać do „Testing & CI" jedną linię o `npm run e2e` (Playwright, wymaga lokalnego Supabase) i o `e2e/` oraz test-plan §6.3.
- **Decision**: FIXED via Fix now — linia o `npm run e2e` w AGENTS.md (Testing & CI).
