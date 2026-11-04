# Wyniki uszeregowane według dopasowania (S-05) — Plan Brief

> Full plan: `context/changes/ranked-match-results/plan.md`
> Research: `context/changes/ranked-match-results/research.md`

## What & Why

Koordynator ma widzieć listę opiekunów ułożoną od profilu, który najpełniej pokrywa potrzebę, i przy każdym profilu — czego brakuje (US-01, FR-016). Według PRD gmina jest warunkiem twardym, a usługi i terminy mają obniżać pozycję zamiast usuwać profil; usługi ważą najwięcej, bo „grafik negocjuje się w rozmowie, a zakresu kompetencji nie”. Przy okazji zamykamy follow-up F6 z S-04: podpowiedzi pustego wyniku kosztują dziś do trzech dodatkowych wywołań `search_caregivers`.

## Starting Point

`search_caregivers()` filtruje dziś twardo wszystkie trzy wymiary (gmina, wszystkie usługi AND, co najmniej jeden termin OR) i sortuje po `updated_at desc`. Dane do rankingu już są w bazie (tabele złączeniowe usług i terminów z indeksami), a jedynym konsumentem w aplikacji jest `/opiekunowie` przez `caregiver.service.ts`.

## Desired End State

Wybór usług i terminów na `/opiekunowie` układa listę: najpierw profile z największą liczbą pokrytych usług, w ich obrębie — terminów, potem najświeżej zaktualizowane. Profil bez żadnej wybranej usługi nie pojawia się, a profil bez pasującego terminu (także bez podanej dostępności) jest niżej, nie znika. Karta mówi „Brakuje usług: …”, „Brakuje terminów: …” albo „Pełne dopasowanie”. Pusty wynik pokazuje „Usuń filtr usług” / „Usuń filtr gminy” z liczbami z jednego RPC. Produkcja działa na nowej wersji, a w `change.md` jest pomiar CPU i decyzja Workers Free/Paid.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Gdzie liczyć ranking | W `search_caregivers()` (SQL), przed `limit` | Ranking musi objąć cały wynik i nie obciążać CPU Workera (`roadmap.md:157`). | Research |
| Próg usług | Co najmniej 1 wybrana usługa musi pasować | Profil bez żadnej potrzebnej kompetencji jest bezużyteczny, a podpowiedź „Usuń filtr usług” zachowuje sens. | Plan |
| Próg terminów | Brak — terminy tylko ustalają kolejność | PRD: grafik negocjuje się w rozmowie; S-04: dostępność jest opcjonalna. | Plan |
| Formuła „najwięcej waży” | Leksykograficznie: usługi, potem terminy | Jedyna gwarancja, że żadna liczba terminów nie wyprzedzi usługi. | Research / Plan |
| Tie-breaker | `updated_at desc, user_id` (jak dziś) | Lista bez filtrów usług i terminów wygląda tak samo jak przed zmianą. | Plan |
| Oznaczenie braków | Nazwy brakujących usług + podsumowanie brakujących terminów; „Pełne dopasowanie” | PRD wymaga, by było widać, *czego* brakuje, a `summarizeAvailability` już to formatuje. | Plan |
| F6 | `count_caregivers_relaxed()` — jeden wiersz z liczbą bez usług i bez gminy | Terminy nie zawężają wyniku, więc wystarczą dwie liczby z jednego żądania, bez kopiowania reguły. | Research / Plan |
| DTO | Osobny `RankedCaregiverDto` z `match` | Pola dopasowania dotyczą tylko listy, nie strony profilu. | Research |
| Wdrożenie | Faza produkcyjna + pomiar CPU w Workers Logs | Zamyka niewiadomą roadmapy Free/Paid na prawdziwym ruchu. | Plan |

## Scope

**In scope:**

- Migracja: nowa `search_caregivers()` (kolumny `matched_*`, `missing_*`, ranking) i `count_caregivers_relaxed()` z grantami
- Serwis i typy listy, karta z brakami, legendy, komunikat i podpowiedzi pustego wyniku
- Przepisane i nowe kroki smoke (RPC i HTML), README
- Wdrożenie produkcyjne, pomiar CPU i zapis decyzji

**Out of scope:**

- Wagi i suma punktów, reputacja i weryfikacja w rankingu
- Zmiany URL, formularza filtra, `get_public_caregiver()` i `/opiekunowie/[id]`
- Materializacja kompletności i pokrycia
- Przejście na Workers Paid (tylko decyzja)
- Usunięcie dodatkowego liczenia przy stronie poza zakresem

## Architecture / Approach

`search_caregivers()` liczy w CTE, dla każdego kompletnego profilu w gminie, `matched_services` i `matched_slots` jako `count` przecięcia wybranych wartości z `caregiver_services` / `caregiver_availability`. Odrzuca profile z 0 pokrytymi usługami (gdy usługi wybrano), liczy `total_count` i sortuje `matched_services desc, matched_slots desc, updated_at desc, user_id`. Dla zwracanej strony dodaje `missing_services` (jsonb ze słownika) i `missing_slots`. `count_caregivers_relaxed()` woła `search_caregivers()` dwa razy (bez usług, bez gminy). Serwis mapuje wiersze na `RankedCaregiverDto`, a strona `.astro` renderuje wiersz dopasowania i podpowiedzi.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Ranking w bazie | Migracja z rankingiem, brakami i `count_caregivers_relaxed`; smoke RPC z testem kolejności | Kroki smoke zależne od pozycji psują się przy narastających danych smoke — stąd asercje monotoniczności |
| 2. Lista pokazuje ranking i braki | Karta z brakami, nowe legendy i podpowiedzi z jednego RPC; smoke HTML, README | Wiersz braków rozciąga kartę przy wielu terminach (sprawdzane na 375 px) |
| 3. Wdrożenie produkcyjne i pomiar CPU | Produkcja na nowej wersji, pomiar CPU, decyzja Free/Paid | Kolejność: Worker przed migracją nie działa — najpierw `db push` |

**Prerequisites:** S-02 i S-04 wdrożone (są), lokalny Supabase z wyłączonym potwierdzaniem e-maila do smoke, dostęp do produkcyjnego Supabase i Cloudflare w fazie 3.
**Estimated effort:** ~2 sesje: faza 1 i 2 po jednej, faza 3 krótka i ręczna.

## Open Risks & Assumptions

- Smoke zakłada, że w gminie Nowinka (`2001052`) lokalnie nie ma żadnego kompletnego profilu.
- Próg ≥1 usługa sprawia, że przy jednej wybranej usłudze filtr działa nadal twardo — to zamierzone.
- Pomiar CPU może wypaść powyżej 10 ms; wtedy decyzja o Paid należy do użytkownika i jest poza tym planem.

## Success Criteria (Summary)

- Koordynator wybiera usługi i terminy, widzi najlepiej dopasowanych na górze i przy każdym profilu jego braki.
- Profil bez pasującego terminu jest niżej, a nie znika; profil bez żadnej wybranej usługi się nie pojawia.
- Pusty wynik kosztuje jedno dodatkowe RPC, a decyzja Free/Paid jest zapisana po pomiarze na produkcji.
