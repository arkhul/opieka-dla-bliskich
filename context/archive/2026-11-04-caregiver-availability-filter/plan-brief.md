# Dostępność opiekuna i filtr po dostępności — Plan Brief

> Full plan: `context/changes/caregiver-availability-filter/plan.md`

## What & Why

Wycinek S-04 (FR-007, FR-011): opiekun ustawia dostępność w dniach tygodnia i porach dnia, a koordynator zawęża po niej listę razem z gminą i usługą. PRD wskazuje wolny termin jako to, czego dziś szuka się telefonicznie. Ten sam wymiar zasili ranking w S-05.

## Starting Point

Profil (S-01) ma gminy i usługi w osobnych tabelach zapisywanych jedną funkcją `save_caregiver_profile()`. Publiczna lista (S-02) filtruje w bazie przez `search_caregivers()` i trzyma stan filtrów w URL, a strona profilu (S-03) czyta `get_public_caregiver()`. Dostępności nie ma nigdzie.

## Desired End State

Opiekun zaznacza terminy w siatce 7 dni × 4 pory w formularzu profilu. Koordynator, także bez logowania, zaznacza terminy w filtrze `/opiekunowie` (`?termin=pon-rano&termin=sr-rano`) i widzi profile mające co najmniej jeden z tych terminów. Na kartach widzi linię „Dostępność: Pn–Pt: rano · Sb: noc”, a na stronie profilu siatkę. Istniejące profile pozostają widoczne, z adnotacją „Dostępność nie podana”.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Pory dnia | rano 6–12, popołudnie 12–18, wieczór 18–22, noc 22–6; 28 terminów | Noc jest osobno, bo przy stałej opiece po wylewie to kluczowa informacja. |
| Semantyka filtra | Co najmniej jeden wspólny termin (OR); profil bez dostępności znika tylko przy aktywnym filtrze | PRD: grafik negocjuje się w rozmowie, a S-05 ułoży profile według liczby pokrytych terminów. |
| Forma filtra | Siatka dni × pory, parametr `termin` w URL | Wyraża dokładną potrzebę („Pn rano + Pt wieczór”) i 1:1 trafia w model danych pod S-05. |
| Kompletność profilu | Dostępność opcjonalna; `caregiver_profile_missing()` i RLS kontaktu bez zmian | Żaden istniejący profil (także produkcyjny) nie znika po wdrożeniu. |
| Prezentacja | Siatka na stronach profilu, zwięzła linia z grupowaniem dni na karcie | US-01: wyniki „wraz z dostępnością”, porównywalne bez wchodzenia w każdy profil. |
| Model danych | Tabela `caregiver_availability(caregiver_id, slot)` w kształcie `caregiver_services`, `slot` = `pon-rano` z `CHECK` | Jeden zapis terminu w bazie, API i URL; S-05 policzy pokrycie zwykłym `count`. |
| Zapis i odczyt | Rozszerzenie trzech istniejących funkcji (drop + create), nowe parametry z wartościami domyślnymi | Zapis zostaje atomowy, a stary Worker działa w oknie między `db push` a `deploy`. |
| Chip filtra | Jeden chip na cały wymiar dostępności | 28 chipów byłoby nieczytelne; inne wymiary zostają przy zdejmowaniu. |
| Testy | Rozszerzony smoke (RPC/RLS/granty, API, HTML) + `check-table-grants.sql` | Wzorzec S-02/S-03; repo nie ma testów jednostkowych. |

## Scope

**In scope:**
- Migracja: tabela z RLS i grantami, `save_caregiver_profile`, `search_caregivers` i `get_public_caregiver` z dostępnością
- `src/lib/availability.ts` (terminy, etykiety, sortowanie, podsumowanie), typy, serwis, walidacja zod w API
- Siatka w formularzu (`AvailabilityPicker.tsx`) i siatka `.astro` (podgląd + checkboxy filtra)
- `/profil`, `/opiekunowie` (filtr, chip, podpowiedź, linia na karcie), `CaregiverPublicDetails`
- Smoke, README, wdrożenie produkcyjne

**Out of scope:**
- Ranking po pokryciu terminów i oznaczanie braków (S-05)
- Dostępność w regule kompletności, okresy od–do, daty, kalendarz rezerwacji
- Słownik terminów jako tabela w bazie, chip na każdy termin, testy jednostkowe

## Architecture / Approach

Termin `<dzień>-<pora>` (np. `pon-rano`) jest tym samym ciągiem w wierszu bazy, w tablicy RPC/API i w parametrze URL. Kolejność i etykiety są w `src/lib/availability.ts`. Baza filtruje (`exists … slot = any(p_availability)`) i zwraca `availability text[]`. Serwis porządkuje terminy kanonicznie. Strony `.astro` renderują siatkę w trybie podglądu albo natywnych checkboxów formularza `GET`, a formularz profilu używa wersji React.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Dostępność w bazie | Tabela, RLS, granty (24 wiersze), trzy funkcje, smoke RPC | Zmiana sygnatur funkcji: drop + create musi odtworzyć granty; smoke sprawdza też wywołanie starym kształtem |
| 2. Opiekun ustawia dostępność | Słownik terminów, API, siatka w formularzu i na `/profil` | Siatka 7×4 na 375 px i obsługa z klawiatury |
| 3. Koordynator filtruje i widzi | `?termin=`, siatka filtra, chip, podpowiedź, linia na karcie, siatka na profilu | Czytelność formularza listy na telefonie; poprawne grupowanie dni w linii |
| 4. Wdrożenie produkcyjne | `db push` → `wrangler deploy` → weryfikacja | Odwrotna kolejność zepsułaby nowy Worker; każdy krok za zgodą użytkownika |

**Prerequisites:** S-01 i S-02 zamknięte (są); lokalny Supabase z wyłączonym potwierdzaniem e-maila do smoke; dostęp do produkcyjnego Supabase i Cloudflare w fazie 4.
**Estimated effort:** ~3 sesje: faza 1, fazy 2–3 (po jednej), faza 4 krótka.

## Open Risks & Assumptions

- Dostępność się dezaktualizuje (Socratic do FR-011). Nie dodajemy przypomnień ani znacznika świeżości; lista nadal sortuje po `updated_at`.
- Profile bez dostępności znikają przy każdym aktywnym filtrze terminów. Łagodzi to podpowiedź „Usuń filtr dostępności (wyniki: N)” i zachęta na `/profil`.
- Semantyka OR różni się od filtra usług (AND), więc legenda filtra musi to mówić wprost.
- „Noc” danego dnia to 22–6 następnego. Wyjaśniają to etykiety i podpowiedź w formularzu.
- Preview Workera korzysta z produkcyjnego Supabase (Open Roadmap Question 2), więc testy z zapisami wyłącznie lokalnie.

## Success Criteria (Summary)

- Opiekun ustawia terminy w profilu, a koordynator bez logowania znajduje go filtrem po jednym z nich, na telefonie i po polsku.
- Dostępność widać na kartach i na profilu; pusty wynik mówi, że to filtr dostępności blokuje, i ile wyników da jego zdjęcie.
- Żaden istniejący profil nie znika po wdrożeniu, a smoke w CI pilnuje RLS, grantów i semantyki filtra.
