# Granice kontaktu i zapisów (test rollout Phase 3) — Plan Brief

> Full plan: `context/changes/testing-contact-and-write-boundaries/plan.md`
> Research: `context/changes/testing-contact-and-write-boundaries/research.md`

## What & Why

Domykamy luki testowe dla trzech ryzyk z `test-plan.md`: #3 (kontakt opiekuna trafia do niezalogowanego), #4 (zalogowany użytkownik zmienia, usuwa lub czyta cudze dane z pominięciem aplikacji) i #6 (zapis profilu po cichu gubi dane). Zmiana jest wyłącznie testowa; chcemy, żeby regresja w uprawnieniach, politykach RLS lub zapisie profilu zaczerwieniła CI, zanim trafi na produkcję.

## Starting Point

Smoke (112 kroków) dobrze pokrywa wyciek kontaktu w HTML i usuwanie cudzego profilu, ale nie pokrywa pozostałych zapisów (`UPDATE` kontaktu, zapisy do gmin/usług/dostępności, `accounts.role`, 31. gmina), a `check-table-grants.sql` łapie tylko `TRUNCATE`/`REFERENCES`/`TRIGGER`. `PUT /api/caregiver/profile` to pełne zastąpienie, więc „zmiana jednego pola" jest własnością cyklu formularza, a żaden krok nie porównuje wszystkich pól po edycji.

## Desired End State

`supabase test db` ma dwa nowe pliki: dokładną macierz 25 uprawnień (plus RLS na każdej tabeli i allowlistę `EXECUTE`) oraz macierz odmów zapisu z impersonacją `authenticated`. Smoke ma kroki dla embed PostgREST, `GET` koordynatora, sond 0-wierszy i cyklu formularza dla każdego pola. Każdy nowy test ma udokumentowaną mutację, która go czerwieni, a cookbook (§6.2, §6.4, §6.5) mówi, jak dodać następny.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Warstwa dla #4 | pgTAP dla macierzy i odmów + 2 sondy w smoke | Jedna transakcja bez kumulacji użytkowników, a sondy zachowują semantykę PostgREST „0 wierszy, nie błąd". | Plan |
| Kontrakt #6 | Blokujemy cykl formularza, nie częściowe body | Endpoint to pełne zastąpienie z założenia; test „PUT z jednym polem zachowuje resztę" musiałby dziś pasować do zmiany kodu. | Plan |
| Zmiana kodu `profile.ts` (400 na częściowe body) | Nie w tej zmianie | Zmiana „tylko testowa", a to decyzja produktowa z własnym przeglądem. | Plan |
| Zaostrzenie `check-table-grants` | Macierz i `EXECUTE` w pgTAP, plik SQL bez zmian | Wykorzystuje istniejący krok CI `supabase test db` i nie miesza twardej macierzy z ogólnym strażnikiem. | Plan |
| Luki #3 | Embed PostgREST (anon i opiekun-nie-właściciel) i `GET` koordynatora | Embed to realna ścieżka omijająca aplikację; nagłówki i sitemap nie wybrane. | Plan |
| Oracle | Literalne macierze i fikstury, pozytywna kontrola przy każdej odmowie | Unika problemu wyroczni i fałszywej zieleni „odmowa, bo odmawiamy wszystkim". | Research |
| Dowód czułości | Mutacja na każdy nowy test (wzorzec §6.1/§6.3) | Test, który nie czerwieni się na realistycznej mutacji, nie dowodzi ochrony. | Research |

## Scope

**In scope:** pgTAP `grants_matrix` i `write_boundaries`; nowe kroki smoke dla #3, #4, #6; dowód mutacjami; §6.2, §6.4, §6.5, §3, §5, §8 w `test-plan.md`.

**Out of scope:** zmiany `src/` i migracji; zmiana `check-table-grants.sql`; testy nagłówków, sitemap, współbieżności i produkcji; masowy odczyt kontaktów przez koordynatora (akceptowane ryzyko); testy „PUT częściowego body".

## Architecture / Approach

Najpierw tanie, deterministyczne pgTAP z literalnym oracle z migracji, potem najbardziej niepewny element: impersonacja `authenticated` z JWT claims (wyzwalacz limitu gmin pomija sprawdzenie, gdy `auth.uid()` jest puste). Kroki smoke dodajemy obok kroków tego samego użytkownika, a konto dla #6 na końcu, bo zmienia sesję. Każda odmowa jest sparowana z udaną operacją na własnym wierszu i odczytem wiersza ofiary.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Macierz uprawnień i EXECUTE | `grants_matrix.test.sql`: 25 uprawnień, RLS, allowlista funkcji | Allowlista funkcji musi zgadzać się z migracjami i żywą bazą |
| 2. Odmowy zapisu (pgTAP) | `write_boundaries.test.sql` z impersonacją i odczytem ofiary | Pierwsze użycie `authenticated` + claims; ryzyko zieleni na `uid = null` |
| 3. Smoke #3 i #4 | Embed, `GET` koordynatora, sondy PATCH/accounts | Kolejność kroków i wspólna sesja `jar` |
| 4. Smoke #6 | Cykl formularza dla 7 pól, dwa niezależne odczyty | Oracle musi być lokalny, nie z odpowiedzi |
| 5. Czułość i cookbook | Mutacje z wynikami, §6.2/6.4/6.5, status | Cofnięcie mutacji bez śladów w migracjach |

**Prerequisites:** lokalny Supabase uruchomiony; Phase 1–2 rolloutu zamknięte (są); brak nieaktualnego preview na :4321 przed smoke.
**Estimated effort:** ok. 3–4 sesje, 5 faz.

## Open Risks & Assumptions

- Impersonacja `authenticated` przez `request.jwt.claims` w lokalnym Supabase nie była jeszcze użyta w repo; pierwsza asercja pliku ma to potwierdzić, a jeśli nie zadziała, faza 2 wymaga zmiany techniki (np. rola w `set_config` inaczej).
- Brak weryfikacji produkcji (grants, `pg_graphql`, sitemap): testy dowodzą stanu lokalnej bazy z migracji.
- Test cyklu formularza nie chroni przed częściowym body, które czyści profil; to znana, świadomie nieobjęta własność kontraktu.

## Success Criteria (Summary)

- `supabase test db` i `npm run smoke` zielone, smoke dwa razy z rzędu na tej samej bazie.
- Każdy nowy test zaczerwieniony przez realistyczną mutację i zielony po jej cofnięciu.
- `test-plan.md` pokazuje Phase 3 jako `done`, a §6.2/§6.4 wystarczają do dodania kolejnego testu.
