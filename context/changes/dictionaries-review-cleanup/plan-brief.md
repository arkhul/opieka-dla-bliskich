# Domknięcie ustaleń z przeglądu F-01 i porządki w roadmapie — Plan Brief

> Full plan: `context/changes/dictionaries-review-cleanup/plan.md`

## What & Why

Przegląd implementacji F-01 zostawił osiem ustaleń z `Decision: PENDING`. Pięć (F3–F6, F8) nadal jest otwartych w kodzie: połykane błędy bazy, domyślne uprawnienia Supabase (w tym TRUNCATE) na tabelach aplikacji, zbędne `getUser()` przy autocomplete, nieaktualne README i kruchy smoke. Po wdrożeniu S-01…S-03 na produkcję zamykamy je. Porządkujemy też dokumenty, żeby przegląd i roadmapa odpowiadały rzeczywistości.

## Starting Point

Migracje nadają `anon` i `authenticated` tylko potrzebne uprawnienia, ale nie odbierają domyślnego ALL w schemacie `public`, więc zapisy blokuje wyłącznie RLS. Endpointy słowników mają `catch {}` bez logowania. Middleware woła `getUser()` przy każdym żądaniu. Pętla smoke nie łapie wyjątków. F1, F2 i F7 są już zrobione, ale przegląd tego nie odnotowuje. Roadmapa ma Backlog Handoff z pierwszego wygenerowania.

## Desired End State

Uprawnienia 7 tabel są równe jawnym grantom (20 par rola/tabela/uprawnienie, bez TRUNCATE), lokalnie i na produkcji. Smoke pilnuje tego przez REST. Błędy słowników trafiają do Workers Logs. Autocomplete gmin nie odpytuje Supabase Auth. Smoke zgłasza FAIL zamiast się wywracać. Przegląd F-01 ma decyzje F1–F8, a roadmapa pokazuje S-04 i S-06 jako gotowe do planowania.

## Key Decisions Made

| Decision             | Choice                                                                          | Why (1 sentence)                                                                                        | Source    |
| -------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | --------- |
| Zakres revoke (F4)   | Wszystkie 7 tabel aplikacji: `revoke all` + te same granty                      | Ta sama luka dotyczy `caregiver_contacts` i `accounts` z danymi kontaktowymi; smoke wyłapie brak grantu | Plan      |
| Domyślne uprawnienia | Bez `alter default privileges`                                                  | Nie zmieniamy zachowania Supabase dla przyszłych tabel; nowe migracje kopiują wzorzec revoke + grant    | Plan      |
| Weryfikacja revoke   | Kroki smoke („permission denied for table …”) + zapytanie `has_table_privilege` | Smoke chroni przed regresją w CI, zapytanie obejmuje TRUNCATE, którego REST nie dotknie                 | Plan      |
| Kroki smoke anon     | Odczyt `caregiver_contacts`/`accounts` oczekuje odmowy zamiast `[]`             | Po revoke PostgREST zwraca 42501 zamiast pustej listy                                                   | Plan      |
| F5                   | Pominąć `getUser()` dla `/api/dictionaries/`                                    | Endpointy słowników nie czytają `locals.user` ani `getRole`                                             | change.md |
| F8                   | Wyjątek w kroku = FAIL i kontynuacja                                            | Spójne z obsługą nieudanej asercji; podsumowanie i kod wyjścia bez zmian                                | Plan      |
| Wdrożenie            | Faza ręczna: `db push` + `wrangler deploy`, zgoda przed każdym krokiem          | Decyzje FIXED w przeglądzie mają być prawdziwe na produkcji                                             | Plan      |
| Kontrola produkcji   | Bez zapisów testowych: tylko odczyty uprawnień i odmowy REST                    | Roadmap Open Question 2: brak osobnego środowiska testowego                                             | Plan      |
| Roadmapa             | Backlog Handoff + notatka; M-1 pozostaje `open`                                 | S-04…S-06 nie są `done`, więc warunek zamknięcia kamienia nie jest spełniony                            | change.md |

## Scope

**In scope:**

- Migracja `20261103230000_table_grants_mirror_policies.sql` (7 tabel); Hard Rule w `AGENTS.md`: revoke all przed grantami dla nowych tabel
- `console.error` w `gminas.ts` i `services.ts`; pominięcie `getUser()` w middleware dla słowników
- Smoke: try/catch w pętli, nowe i zmienione kroki uprawnień, komentarz nagłówka
- README: `:58`, `:221`, `:230`
- Produkcja: `db push`, `wrangler deploy`, kontrole
- Decyzje F1–F8 w archiwalnym przeglądzie; Backlog Handoff, notatka i wpisy `## Done` w roadmapie

**Out of scope:**

- `alter default privileges`, zmiany RLS, funkcji i danych, uprawnienia `service_role`
- Cache odpowiedzi słowników, zmiana treści odpowiedzi 500
- Zamknięcie M-1 i zmiany statusów pozycji roadmapy

## Architecture / Approach

Jedna migracja zmienia wyłącznie uprawnienia tabel. Wszystkie funkcje SECURITY INVOKER (`save_caregiver_profile`, `search_caregivers`, `get_public_caregiver`) używają tylko operacji z jawnych grantów, a funkcje czytające kontakt dla `anon` są SECURITY DEFINER, więc aplikacja działa bez zmian. Migracja i dostosowany smoke trafiają do jednej fazy, żeby CI pozostał zielony. Poprawki aplikacji są niezależne. Dokumenty idą na końcu, po sprawdzeniu produkcji.

## Phases at a Glance

| Phase                                             | What it delivers                                                     | Key risk                                                  |
| ------------------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------- |
| 1. Uprawnienia tabel (F4)                         | Migracja revoke + grant, kroki smoke uprawnień                       | Pominięty grant psuje zapis profilu (wyłapie smoke)       |
| 2. Kod aplikacji, smoke i README (F3, F5, F8, F6) | Logowanie błędów, lżejszy middleware, odporny smoke, aktualne README | Pominięcie `getUser()` na zbyt szerokim prefiksie         |
| 3. Wdrożenie produkcyjne                          | Migracja i Worker na produkcji, kontrole bez zapisów                 | Operacja zewnętrzna; wymaga zgody i zlinkowanego projektu |
| 4. Dokumenty kontekstu                            | Decyzje F1–F8, Backlog Handoff, notatka o przepływie PRD             | Edycja archiwum: tylko wiersze Decision                   |

**Prerequisites:** działający Docker i lokalny Supabase (`db reset`, `db query --local`, smoke); praca na gałęzi i scalenie do `master` przed fazą 3; zalogowane `supabase` (link do produkcji) i `wrangler`.
**Estimated effort:** ~1 sesja, 4 krótkie fazy.

## Open Risks & Assumptions

- Statusy HTTP odmowy (401 dla `anon`, 403 dla `authenticated`) są założeniem z zachowania PostgREST. Rozstrzyga komunikat `permission denied for table …`, a statusy potwierdzamy lokalnie.
- Przyszłe migracje tabel (S-04, S-06) znów dostaną domyślne ALL, jeśli nie skopiują wzorca revoke + grant.
- Kontrola produkcji przez `npx supabase db query --linked` wymaga dostępu do Management API. Zapasowo: SQL Editor w panelu Supabase.

## Success Criteria (Summary)

- Na produkcji `anon` i `authenticated` mają dokładnie zamierzone uprawnienia tabel, a aplikacja (profil, lista, kontakt) działa bez zmian.
- Błąd bazy w słownikach jest widoczny w logach, a smoke kończy się czytelnym podsumowaniem także przy awarii sieci.
- Przegląd F-01 nie ma ustaleń `PENDING`, a roadmapa wskazuje S-04 i S-06 jako następne do planowania.
