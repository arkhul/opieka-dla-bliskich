<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Dostępność opiekuna i filtr po dostępności

- **Plan**: context/changes/caregiver-availability-filter/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-11-04
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 2 warnings, 4 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

Notes:
- Plan Adherence: every planned item in phases 1–3 is MATCH, and all 5 `summarizeAvailability` examples give the expected output. Cosmetic deviations that are not findings: `AVAILABILITY_SLOTS` is typed `readonly AvailabilitySlot[]` instead of a literal tuple, and read-only grid cells are `h-9` while picker cells are `h-11`.
- Scope Discipline: the only extras are small helpers (`toSlot()` and the smoke helpers `hidesListContact`/`hidesProfileContact`). Nothing in "What We're NOT Doing" is violated.
- Success Criteria (re-run on 2026-11-04): `npm run lint`, `npx astro check` (0 errors), `npm run build`, `npx supabase db lint --level error`, `check-table-grants.sql` and `npm run smoke` (all steps) pass. `npx supabase db reset` (1.1) was not re-run, because it would wipe the local DB; CI runs it. Every Manual row has a commit SHA, and phase 4 is ops-only.

## Findings

### F1 — Pominięcie `p_availability` czyści dostępność (Worker-only rollback niszczy dane)

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20261104120000_caregiver_availability.sql:91
- **Detail**: `p_availability text[] default '{}'`: każde wywołanie bez tego parametru usuwa wszystkie terminy opiekuna. Plan (Critical Implementation Details) akceptował to tylko na okno między `db push` a `wrangler deploy`, kiedy nikt jeszcze nie miał dostępności. To okno minęło, ale zachowanie zostało. Rollback samego Workera do wersji sprzed p2 (`wrangler rollback`) sprawi, że każdy zapis profilu po cichu wyczyści dostępność, którą opiekunowie już wpisali. Migration Notes opisują tylko pełny rollback (migracja + Worker). Smoke wręcz utrwala to zachowanie krokiem „profile save without availability clears it”.
- **Fix A ⭐ Recommended**: Nowa migracja: `p_availability default null`, gdzie `null` oznacza „nie ruszaj dostępności”, a tylko jawna tablica (także `'{}'`) zastępuje wiersze. Smoke: krok „clears it” zmienia się w „keeps it”.
  - Strength: Nowy Worker zawsze wysyła jawną tablicę (zod `.default([])`), więc jego zachowanie się nie zmienia. Rollback Workera staje się bezpieczny dla danych.
  - Tradeoff: Kolejna migracja i `db push` na produkcję. Trzeba przepisać 2 kroki smoke.
  - Confidence: HIGH — semantyka `null = bez zmian` jest już użyta w `search_caregivers` (`null` = brak filtra).
  - Blind spot: Nie sprawdziłem, czy `create or replace` wystarczy do zmiany wartości domyślnej, czy potrzebny jest `drop` + `create` z ponownymi grantami.
- **Fix B**: Dopisać do README §Deployment (i do Migration Notes planu), że rollback samego Workera poza tę zmianę jest destrukcyjny dla dostępności.
  - Strength: Zero zmian w kodzie i na produkcji.
  - Tradeoff: Ryzyko zostaje; chroni tylko ktoś, kto przeczyta dokumentację przed rollbackiem w stresie.
  - Confidence: MED — skuteczność zależy od procesu.
  - Blind spot: None significant.
- **Decision**: FIXED (Fix A) — new migration `20261104130000_save_profile_keeps_availability.sql` (`create or replace`, default null = unchanged, grants kept); smoke: "profile save without availability keeps it" + "profile save with empty availability clears it". Verified locally (db lint, grants check, smoke). Production `db push` still pending.

### F2 — „Spróbuj sąsiedniej gminy” pokazuje się tylko wtedy, gdy nie może pomóc

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/pages/opiekunowie/index.astro:86-87
- **Detail**: Przy aktywnej gminie `hints` zawsze zawiera „Usuń filtr gminy”. Warunek `hints.every(count === 0)` obejmuje więc też wynik bez gminy. Jeśli ten wynik to 0, to w żadnej gminie nikt nie spełnia pozostałych filtrów, więc sąsiednia gmina na pewno nie pomoże. Podpowiedź pojawia się dokładnie wtedy, gdy wprowadza w błąd. Błąd był już przed zmianą (`hints.length === 2`): plan go rozszerzył (`>= 2`), a nowy komentarz „only another gmina can help” opisuje go błędnie. To wada planu, nie implementacji.
- **Fix A ⭐ Recommended**: Pokazywać podpowiedź, gdy gmina jest aktywna, licznik „Usuń filtr gminy” > 0, a każda inna podpowiedź daje 0 („tylko inna gmina pomoże”). Poprawić komentarz.
  - Strength: Odpowiada intencji komentarza. Wszystkie liczby są już policzone, więc nie ma dodatkowych zapytań.
  - Tradeoff: Obok jest już link „Usuń filtr gminy (wyniki: N)”, więc podpowiedź częściowo go dubluje.
  - Confidence: HIGH — logika wynika wprost z warunków.
  - Blind spot: Smoke może sprawdzać obecność/brak tego tekstu; trzeba to sprawdzić.
- **Fix B**: Usunąć podpowiedź „Spróbuj sąsiedniej gminy”: link z liczbą wyników bez gminy niesie tę samą informację.
  - Strength: Mniej kodu, brak wprowadzającego w błąd tekstu.
  - Tradeoff: Znika zachęta, którą wcześniejszy wycinek celowo dodał.
  - Confidence: MED — zależy od tego, czy podpowiedź była wymaganiem PRD.
  - Blind spot: Nie sprawdziłem, czy PRD wymaga tej podpowiedzi.
- **Decision**: FIXED (Fix A) — `noNeighbourHint` = gmina aktywna, „Usuń filtr gminy” > 0, pozostałe podpowiedzi = 0; komentarz poprawiony. PRD tej podpowiedzi nie wymaga (pochodzi z planu public-caregiver-search).

### F3 — Brak limitu długości listy terminów (API i RPC)

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/api/caregiver/profile.ts:80-86; supabase/migrations/20261104120000_caregiver_availability.sql:122-127
- **Detail**: `gminas` i `services` mają limity rozmiaru (`<= 30`, `<= 50`, „Input-size guard only”), a `availability` żadnego. zod sprawdza każdy element dowolnie długiej tablicy, zanim `sortAvailability` ją przytnie. RPC `save_caregiver_profile` i `search_caregivers` (wywoływane bezpośrednio przez PostgREST, to drugie także przez anon) też nie ograniczają `p_availability`. Ta sama luka istnieje już dla `p_services`.
- **Fix**: Dodać `.max(28, { error: "Lista terminów jest zbyt długa." })` do tablicy w zod. W `save_caregiver_profile` odrzucać `cardinality(v_availability) > 28` po deduplikacji.
- **Decision**: FIXED — `.max(28)` w zod; limit 28 (22023 „Lista terminów jest zbyt długa.”) w migracji `20261104130000_…` z F1, sprawdzony lokalnie (29 terminów → 22023). `search_caregivers` i `p_services` bez zmian.

### F4 — Podpowiedź i błąd siatki podpięte do `<table>`, nie do `<fieldset>`

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/caregiver/AvailabilityPicker.tsx:24; src/components/caregiver/CaregiverProfileForm.tsx:303
- **Detail**: Grupa usług ma `aria-describedby` na `<fieldset>` (`CaregiverProfileForm.tsx:243`). Dostępność przekazuje `describedBy` do `<table>` wewnątrz fieldsetu. Czytniki ekranu zwykle nie odczytują opisu tabeli przy wejściu fokusem na checkbox, więc podpowiedź „Noc oznacza godziny 22–6…” i błąd pola mogą nie zostać ogłoszone.
- **Fix**: Przenieść `aria-describedby` na `<fieldset>` dostępności i usunąć prop `describedBy` z `AvailabilityPicker`.
- **Decision**: FIXED — `aria-describedby` na `<fieldset>` w `CaregiverProfileForm.tsx`, prop `describedBy` usunięty z `AvailabilityPicker`.

### F5 — Siatka filtra: goły checkbox 24 px zamiast klikalnej komórki z `<label>`

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/caregiver/AvailabilityGrid.astro:43-53
- **Detail**: W trybie `name` komórka to `<div>` z natywnym checkboxem `size-6` opisanym tylko `aria-label`. `AvailabilityPicker` owija całą komórkę `h-11` w `<Label>`, a checkboxy usług na tej samej stronie listy też są w `<label>`. Na telefonie cel dotyku spada z 44 px do 24 px. To nadal spełnia WCAG 2.5.8, ale jest niespójne z sąsiednimi kontrolkami i z zapowiedzią „ten sam układ”.
- **Fix**: W trybie `name` zamienić `<div class="flex h-11 …">` na `<label class="flex h-11 … cursor-pointer">` wokół inputu.
- **Decision**: FIXED — komórka filtra to `<label class="flex h-11 cursor-pointer …">` wokół checkboxa.

### F6 — Pusty wynik z 3 filtrami to do 5 wywołań `search_caregivers` na żądanie

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/opiekunowie/index.astro:53-72
- **Detail**: Najgorszy przypadek (gmina + usługi + terminy, `strona>1`, brak wyników): `listServices`, `getActiveGmina`, wyszukiwanie strony, dodatkowe liczenie i 3 równoległe liczniki podpowiedzi. Razem 7 wywołań Supabase w 4 etapach, w tym 5 × `search_caregivers` (wcześniej 6 wywołań). To nie jest N+1 i przy skali MVP mieści się w NFR < 1 s, ale koszt rośnie z każdym nowym wymiarem filtra (S-05).
- **Fix**: Na razie zaakceptować. Gdy lista urośnie lub w S-05, zastąpić podpowiedzi jednym RPC zwracającym wszystkie „relaxed counts”.
- **Decision**: ACCEPTED — bez zmian w kodzie na teraz; zakolejkowane do S-05 w `follow-ups/review-fixes.md`.

## Triage summary (2026-11-04)

- Fixed: F1 (Fix A), F2 (Fix A), F3, F4, F5
- Accepted: F6 (queued for S-05)
- Verification after fixes: `npm run lint`, `npx astro check`, `npm run build`, `npx supabase db lint --level error`, `check-table-grants.sql` and `npm run smoke` (fresh preview) all pass. F2 was checked in HTML: an empty gmina with `termin=pon-rano` shows the neighbour hint (8 results without the gmina filter); with `termin=czw-noc` (0 results without it) the hint is hidden.
- Pending: production `db push` of `20261104130000_save_profile_keeps_availability.sql` and a Worker deploy (`follow-ups/review-fixes.md`).
