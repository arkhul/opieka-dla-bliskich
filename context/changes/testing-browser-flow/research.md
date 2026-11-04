---
date: 2026-11-04T21:00:00+01:00
researcher: Claude (Sonnet 5.5)
git_commit: 06931f8b3892eba33d63dbde116938a155172293
branch: master
repository: 10xdevs (Opieka dla bliskich)
topic: "Co trzeba wiedzieć, by dowieść w przeglądarce przepływu koordynatora (filtr → lista → logowanie → kontakt) jako bramki CI (test-plan Phase 2, risk #5)"
tags: [research, e2e, playwright, ci, coordinator-flow, auth, search]
status: complete
last_updated: 2026-11-04
last_updated_by: Claude (Sonnet 5.5)
---

# Research: przepływ koordynatora w przeglądarce jako bramka CI

**Git Commit**: 06931f8 (master, czyste drzewo) · **Data**: 2026-11-04

## Research Question

Test-plan §3 Phase 2: dowieść, że koordynator w przeglądarce (desktop i telefon) dochodzi od filtra do kontaktu, a bez logowania kontaktu nie widzi; test jako bramka CI (#5, widoczność #1, #3). Co istnieje w kodzie, CI i danych, na czym plan musi się oprzeć?

## Summary

- **Warstwy przeglądarkowej nie ma.** W `package.json` nie ma `@playwright/test`, a `node_modules/.bin` nie zawiera playwrighta (sprawdzone `ls | grep playwright`); w korzeniu repo nie ma `playwright.config.*` ani katalogu `tests/` (`ls`). Brak też `context/foundation/test-stack.md`. Najnowszy `@playwright/test` w npm: 1.64.1 (`npm view`).
- **Przepływ ma cztery przeglądarkowe punkty, których smoke HTTP nie wykonuje**: wyspa React `GminaSelect` (combobox `client:load`, fetch do `/api/dictionaries/gminas`), natywny GET-formularz filtrów, `SignInForm`/`SignUpForm` (wyspy React z walidacją `onSubmit`) oraz powrót po logowaniu przez `next`. Smoke sprawdza je tylko jako HTML/302 (`scripts/smoke.mjs:222-282, 835-837, 1058-1064`).
- **CI ma już wszystko poza przeglądarką**: job `smoke` stawia lokalny Supabase, buduje aplikację i uruchamia `npm run preview` na porcie 4321 (`.github/workflows/ci.yml`). E2E może dołączyć do tego jobu albo dostać własny (decyzja dla planu).
- **Dane testowe**: koordynator rejestruje się przez UI przy wyłączonym potwierdzaniu e-mail (`supabase/config.toml:209`, `enable_confirmations = false` w `[auth.email]`); opiekuna trzeba zasilić przez API/RPC (wzorzec smoke: konto + `PUT /api/caregiver/profile`).

## Detailed Findings

### Przepływ i selektory (stan kodu)

- Lista `/opiekunowie` jest publiczna: `src/pages/opiekunowie/index.astro` (GET-form na `CAREGIVER_LIST_PATH`, checkboxy `name="usluga"`, siatka `termin`, przycisk „Pokaż wyniki"; nagłówek „Wyniki: {total}"; karta = `article` z `h3` linkującym do `/opiekunowie/<id>`; linia dopasowania „Pełne dopasowanie" / „Brakuje usług: …" / „Brakuje terminów: …" tylko gdy ustawiony jest filtr usług lub terminów).
- `GminaSelect` (`src/components/search/GminaSelect.tsx`): przycisk „Wybierz gminę" otwiera Popover z `CommandInput` (`aria-label="Szukaj gminy"`, min. 2 znaki, debounce 250 ms w `src/hooks/useGminaSearch.ts`); wybór wpisuje TERYT do `<input type="hidden" name="gmina">`. Wybór gminy zależy od hydratacji wyspy — test musi czekać na element, nie na czas.
- Karta → `/opiekunowie/<id>` (publiczny profil, bez kontaktu) → link do `/kontakt/<id>`.
- `/kontakt/<id>`: middleware przekierowuje anonima na `/auth/signin?next=%2Fkontakt%2F<id>` (`src/middleware.ts:6, 47-51`); `/kontakt` jest w `PROTECTED_ROUTES`.
- Logowanie: `signin.astro` → `SignInForm` (pola o `id` `email`, `password`; ukryte `next`), POST `/api/auth/signin`; gdy jest `next`, redirect tam bez względu na rolę (`src/pages/api/auth/signin.ts`). Rejestracja koordynatora z `next`: radio „Szukam opieki dla bliskiej osoby — koordynator" (`SignUpForm.tsx:16`), po sukcesie bez wymaganego potwierdzenia e-mail redirect na `next` (`signup.ts`); strona rejestracji wstępnie zaznacza rolę koordynatora, gdy `next` zaczyna się od `/kontakt/` (`signup.astro`).
- Kontakt widoczny po zalogowaniu koordynatora: `dl` z „Telefon" (`<a href="tel:+48…">`, tekst z `formatPlPhone`, np. `+48 600 100 200`) i „E-mail" (`mailto:`); bez kontaktu sekcja pokazuje komunikat zamiast danych (`src/pages/kontakt/[id].astro`). Strona ma `Cache-Control: private, no-store`.
- Odpowiedzi przechodzące przez middleware dostają `X-Robots-Tag: noindex` (`src/middleware.ts:19-30, 53`).
- Topbar pokazuje e-mail zalogowanego i „Wyloguj się" (`src/components/Topbar.astro`) — użyteczny dowód stanu sesji w przeglądarce.

### Wąski ekran

- `Layout.astro` ma `<meta name="viewport" content="width=device-width">`; widoki używają klas `sm:` (np. `p-4 sm:p-8`, `sm:grid-cols-2`). Zachowanie na szerokości telefonu nie było dotąd sprawdzane w żadnym zbadanym teście (brak warstwy przeglądarkowej) — luka do pokrycia (pytanie otwarte 3).

### CI i uruchamianie

- Job `smoke` (`ci.yml`): `supabase start` z wyłączonymi usługami pobocznymi, `check-table-grants`, `supabase test db`, zapis `.env` i `.dev.vars` z lokalnego `API_URL`/`ANON_KEY`, `npm run build`, `npm run preview -- --port 4321 &`, pętla `curl` do 60 s, `npm run smoke`; Node 22. Test-plan §5 oznacza e2e jako „required after §3 Phase 2".
- Astro 7 preview jest singletonem projektu (pamięć `astro-preview-singleton`); lokalnie w momencie badania działa preview na :4321 (uptime ~1894 s, `astro preview status`), więc `reuseExistingServer` w Playwright mógłby testować tę, potencjalnie nieaktualną, instancję. Plan musi to rozstrzygnąć (skill `10x-e2e-setup` krok 1.5 opisuje to samo ryzyko).
- Lokalny Supabase działa w Dockerze (kontenery `supabase_*_10x-astro-starter`); `.env` i `.dev.vars` istnieją (wartości nie były czytane).
- Dostępne skille: `10x-e2e-setup` (instalacja Playwright, `playwright.config.ts`, seed, `test-stack.md`) i `10x-e2e` (plan → generate → review → verify); oba zakładają build + preview jako `webServer`.

### Dane testowe

- Smoke zapisuje profil `PUT /api/caregiver/profile` z gminą `1465011` (Warszawa), usługą `towarzystwo`, telefonem `600 100 200` (`scripts/smoke.mjs:174-182`); krok „gminas search ranks exact prefix first" potwierdza, że `warszawa` daje `1465011` jako pierwszą (`:208-210`); `1061011` to Łódź (`:203-205`).
- Lokalna baza zbiera profile ze wszystkich uruchomień smoke (komentarz w `smoke.mjs` przy rankingu, ok. linii 138-140), więc e2e nie może zakładać pustej listy ani pozycji na liście; powinno opierać asercje na unikalnej nazwie wyświetlanej z `stamp`, a oczekiwanie wyprowadzać z deklaracji fixtury (zasada oracle z test-plan §6.1).
- Telefon jest zapisywany jako `+48XXXXXXXXX`, wyświetlany z odstępami (`src/lib/phone.ts`) — oczekiwanie w teście: `+48 600 100 200`, nie surowy zapis.

## Code References

- `src/middleware.ts:6, 47-51` — `PROTECTED_ROUTES`, redirect z `next`
- `src/pages/opiekunowie/index.astro` — lista, formularz filtrów, karty i linia dopasowania
- `src/components/search/GminaSelect.tsx`, `src/hooks/useGminaSearch.ts` — combobox gminy (wyspa React)
- `src/pages/kontakt/[id].astro` — chroniona strona kontaktu
- `src/pages/api/auth/signin.ts`, `signup.ts` — powrót po logowaniu/rejestracji
- `src/components/auth/SignInForm.tsx`, `SignUpForm.tsx` — formularze (wyspy)
- `scripts/smoke.mjs:174-182, 1058-1064` — fixtury i rejestracja koordynatora z `next`
- `.github/workflows/ci.yml` — job `smoke` (miejsce na bramkę)

## Architecture Insights

- Aplikacja jest SSR z natywnymi formularzami GET/POST; JS jest potrzebny w comboboxie gminy i formularzach auth. Test przeglądarkowy ma sens wąski: jeden przepływ przez wyspy, bez powielania macierzy rankingu (anti-pattern #5 w test-plan §2).
- Niezmiennik #3 w przeglądarce: e-mail i telefon opiekuna nie występują w DOM `/opiekunowie/<id>` dla anonima, a występują na `/kontakt/<id>` koordynatora. Smoke sprawdza HTML; e2e dołoży stan po hydratacji.

## Historical Context (from prior changes)

- `context/archive/2026-11-03-public-caregiver-search/reviews/impl-review.md` F3 — test-plan podaje je jako błąd widoczny tylko w przeglądarce; sam wpis F3 dotyczy jednak poziomów nagłówków (karty `h2` → `h3`, naprawione). Uzasadnienie ryzyka #5 opiera się więc głównie na braku warstwy przeglądarkowej, a nie na tym wpisie (twierdzenie z test-plan: częściowo poparte).
- `context/archive/2026-11-04-testing-matching-correctness/` — Phase 1; wzorzec do powtórzenia: oracle w komentarzu, dowód czułości mutacją, bramka w CI (dla e2e np. zepsucie `next` w redirect → czerwony test).
- Pamięć `next-change-test-plan-phase-2`: „browser e2e flow (risk #5), then phase 3".

## Related Research

- `context/archive/2026-11-04-testing-matching-correctness/research.md`

## Open Questions

1. **Gdzie w CI?** Kroki w jobie `smoke` (współdzielony Supabase i build) czy osobny job `e2e`. Skłaniam się ku pierwszemu, decyzja dla `/10x-plan`.
2. **Seed opiekuna**: przez API w fixture (jak smoke) czy SQL/RPC; API nie wymaga klucza service-role.
3. **Telefon**: emulacja urządzenia Playwright (profil mobilny) vs. samo wąskie okno — plan wybiera jeden projekt.
4. **Przeglądarka w CI**: `npx playwright install --with-deps chromium` na ubuntu-24.04 — koszt czasu i cache do zmierzenia; wersję i konfigurację ugruntować przez Context7 w planie.
5. **Preview na :4321**: wymusić świeży build/inny port albo `reuseExistingServer: false`.
6. **Zakres asercji #3**: zalecane — brak telefonu i e-maila w DOM publicznego profilu anonima oraz pełny przepływ anon → `/kontakt/<id>` → logowanie/rejestracja → kontakt (Success Criteria 3–4).
