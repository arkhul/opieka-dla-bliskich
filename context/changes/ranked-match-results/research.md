---
date: 2026-11-04T11:10:19Z
researcher: Claude (Opus 5.5)
git_commit: 6af4c7e
branch: master
repository: 10xdevs (Opieka dla bliskich)
topic: "S-05 ranked-match-results: jak dziś działa wyszukiwanie i co trzeba zmienić, by wyniki były uszeregowane według dopasowania z oznaczeniem braków (US-01, FR-016) oraz zastąpić podpowiedzi pustego wyniku jednym RPC (F6)"
tags: [research, search_caregivers, caregiver.service, opiekunowie, ranking, smoke]
status: complete
last_updated: 2026-11-04
last_updated_by: Claude (Opus 5.5)
---

# Research: ranked-match-results (S-05)

**Date**: 2026-11-04T11:10:19Z
**Researcher**: Claude (Opus 5.5)
**Git Commit**: 6af4c7e
**Branch**: master
**Repository**: 10xdevs (Opieka dla bliskich)

## Research Question

Pytanie wyprowadzone z `change.md` (Notes) i roadmapy S-05: jak dziś liczy się i wyświetla publiczna lista opiekunów, jakie wymagania stawia reguła dopasowania z PRD, które kontrakty (SQL, serwis, typy, strona, smoke) dotknie ranking z oznaczeniem braków oraz jak zastąpić podpowiedzi pustego wyniku (do 5 wywołań `search_caregivers` na żądanie) jednym RPC (follow-up F6 z S-04).

## Summary

- **Dziś wszystkie trzy wymiary filtrują twardo, a kolejność nie zależy od dopasowania.** `search_caregivers()` (ostatnia definicja w `supabase/migrations/20261104120000_caregiver_availability.sql:237-345`) wymaga gminy (jeśli podana, `:263-273`), **wszystkich** wybranych usług (AND, `:274-284`) i **co najmniej jednego** wybranego terminu (OR, `:285-297`), a sortuje po `updated_at desc, user_id` (`:306`, `:344`).
- **PRD wymaga czegoś innego** (`context/foundation/prd.md:138-144`): gmina twardo, usługi i terminy miękko („brak części usług lub terminów obniża pozycję profilu, zamiast go usuwać”), pokrycie usług waży najwięcej, ranking jest domyślną kolejnością listy i przy każdym profilu widać, czego brakuje. Roadmapa (`context/foundation/roadmap.md:149`, `:157`) dodaje: ranking liczy się po stronie bazy (NFR < 1 s, limit CPU Workera).
- **Wszystkie dane potrzebne do rankingu już są w bazie** jako tabele złączeniowe z kluczem `(caregiver_id, X)`: `caregiver_services` (`20261103150000_caregiver_profiles.sql:172`), `caregiver_availability` (`20261104120000_caregiver_availability.sql:38-44`), oba z indeksem po wartości (`:175`, `:44`). Pokrycie to zwykły `count` przecięcia z `p_services` / `p_availability`, a braki to różnica zbiorów — S-04 zaprojektował model właśnie pod to (`context/archive/2026-11-04-caregiver-availability-filter/plan-brief.md:26`).
- **Kontrakt do zmiany ma jednego wywołującego w aplikacji**: `runSearch()` w `src/lib/services/caregiver.service.ts:187-203`, używany przez `searchCaregivers()` (`:213-225`) i `countCaregivers()` (`:206-209`); oba wołane wyłącznie z `src/pages/opiekunowie/index.astro:53` i `:71` (sprawdzony zakres: `grep` po `src/` i `scripts/`). Drugim konsumentem RPC jest `scripts/smoke.mjs:107`.
- **F6 upraszcza się po zmianie semantyki.** Gdy usługi i terminy przestaną usuwać profile, pusty wynik przy podanej gminie może wynikać tylko z gminy (brak kompletnych profili w tej gminie), więc podpowiedzi „Usuń filtr usług / dostępności” (`index.astro:58-63`) tracą sens, a jedyną użyteczną liczbą zostaje „ile byłoby bez gminy”. To wniosek z reguły PRD, nie z kodu — zależy od decyzji, czy profil z zerowym pokryciem usług ma się pojawiać (Open Questions).
- **Smoke odwróci wynik w co najmniej 7 sprawdzonych przypadkach**, które dziś asertują ukrywanie profilu przez usługi lub terminy (lista w Detailed Findings → Smoke). Dodatkowo teksty legend filtrów na stronie opisują stare AND/OR (`index.astro:136`, `:156`).

## Detailed Findings

### Reguła domenowa (PRD, roadmapa)

- `context/foundation/prd.md:138` — ocena każdego profilu względem potrzeby, szeregowanie od najlepiej dopasowanego, „najwięcej waży pokrycie wymaganych usług”.
- `prd.md:140` — potrzebę wyraża się tymi samymi polami co filtry (gmina, usługi, terminy); nie ma osobnego formularza zgłoszenia.
- `prd.md:142` — gmina jest warunkiem twardym; usługi i terminy działają miękko; usługi ważą najwięcej, „bo grafik negocjuje się w rozmowie, a zakresu kompetencji nie”.
- `prd.md:144` — reguła widoczna jako kolejność listy plus oznaczenie braków przy każdym profilu; ranking to domyślny porządek, nie osobny ekran.
- `prd.md:117-118` — FR-016 must-have; Socratic rozważył, że ranking krzywdzi oszczędnie wypełnione profile — rozstrzygnięcie: bez zmian.
- `prd.md:26` — przy stukrotnie większym katalogu pokrycie przestałoby różnicować profile; w MVP nie ma reputacji ani weryfikacji jako czynnika rankingu (wniosek: tie-breaker w obrębie równego pokrycia pozostaje decyzją projektową).
- `prd.md:131` — NFR: wyniki filtrowania i rankingu < 1 s przy docelowej skali; `prd.md:8-11` — `target_scale.data_volume: small`.
- `context/foundation/roadmap.md:149` — outcome S-05; `:156` — niewiadoma Workers Free (10 ms CPU) vs Paid, decyzja po pomiarze, Owner: user, Block: no; `:157` — ranking musi liczyć się w bazie.
- `context/foundation/infrastructure.md:126`, `:194` — ryzyko błędu 1102 przy SSR rankingu na planie Free; mitygacja: ranking w Postgresie, nie w Workerze, albo plan Paid.

### `search_caregivers()` — stan obecny

Definicja: `supabase/migrations/20261104120000_caregiver_availability.sql:235-348` (drop + create, bo zmienia się sygnatura — komentarz `:23-25`). Późniejsza migracja `20261104130000_save_profile_keeps_availability.sql` zmienia tylko `save_caregiver_profile()` (sprawdzone nagłówkiem pliku).

- Sygnatura `(p_teryt text, p_services text[], p_availability text[], p_limit int, p_offset int)`, wszystkie z domyślnymi wartościami (`:237-243`); `language sql stable security invoker`, `search_path = ''` (`:254-257`).
- Zbiór wyników (CTE `matches`, `:259-298`):
  - tylko kompletne profile: `cardinality(public.caregiver_profile_missing(p.user_id)) = 0` (`:262`); reguła kompletności = nazwa + telefon + ≥1 aktywna gmina + ≥1 usługa (`20261103150000_caregiver_profiles.sql:349-388`), `SECURITY DEFINER`, nie zwraca danych kontaktowych;
  - gmina: `p_teryt is null` albo profil obsługuje tę gminę i jest ona aktywna (`:263-273`);
  - usługi: brak wybranej usługi, której profil nie oferuje (AND; puste/`null` = bez filtra; `null` w tablicy ignorowane) (`:274-284`);
  - terminy: brak niepustych wpisów = bez filtra, inaczej ≥1 wspólny termin (OR) (`:285-297`).
- `total_count` = `count(*) over ()` liczone przed `limit/offset` (`:299-302`).
- Kolejność: `updated_at desc, user_id` (`:306`, ponownie `:344`); `limit` obcięty do 1..50, `offset` ≥ 0 (`:307-308`).
- Kolumny wyniku: `user_id, display_name, description, updated_at, services jsonb, gminas jsonb, availability text[], total_count` (`:244-253`); `services` w `sort_order` (`:315-320`), `gminas` tylko aktywne (`:321-336`), `availability` w kolejności tekstowej slotu (`:337-341`; kolejność kanoniczna ustawiana w aplikacji).
- Brak dopasowań → zero wierszy, więc brak `total_count` (komentarz `:232-233`); serwis interpretuje to jako 0 tylko na stronie 1.
- Uprawnienia: `revoke ... from public; grant execute ... to anon, authenticated` (`:419-420`). Zmiana sygnatury wymaga ponownego `grant` — wzorzec w tym samym pliku.
- Komentarz `:13-14` wprost zapowiada: „Ranking by the number of covered slots is a later slice (S-05)”.

### Model danych pod ranking

- `caregiver_services(caregiver_id, service_slug)` PK + indeks `caregiver_services_service_slug_idx` (`20261103150000_caregiver_profiles.sql:172-175`).
- `caregiver_availability(caregiver_id, slot)` PK + indeks `caregiver_availability_slot_idx`, `CHECK` na 28 slotów (`20261104120000_caregiver_availability.sql:38-44`).
- `caregiver_gminas(caregiver_id, teryt)` PK + indeks `caregiver_gminas_teryt_idx` (`20261103150000_caregiver_profiles.sql:132-135`).
- Wszystkie trzy tabele mają `select` dla `anon` (macierz uprawnień w `20261104120000_caregiver_availability.sql:26-33`), a funkcja jest `SECURITY INVOKER` — ranking i braki można liczyć w tej samej funkcji bez nowych uprawnień i bez dotykania `caregiver_contacts`.
- Wniosek: w obrębie jednego żądania zbiory `p_services` i `p_availability` są wspólne dla wszystkich profili, więc sortowanie po liczbie pokrytych pozycji i po ich odsetku daje tę samą kolejność; różnica ma znaczenie dopiero dla tekstu na karcie (np. „2 z 3 usług”).

### Warstwa aplikacji

- `src/lib/services/caregiver.service.ts:152` — `CAREGIVER_PAGE_SIZE = 20`.
- `:156-167` — `PublicRow` / `SearchRow` (kształt wiersza RPC, wspólny z `get_public_caregiver()`); `:169-185` — `toPublicCaregiver()` mapuje na `PublicCaregiverDto`.
- `:187-203` — `runSearch()`: jedyne miejsce w `src/` wołające `search_caregivers` (wynik nietypowany, rzutowany na `SearchRow[]`).
- `:206-209` — `countCaregivers()` = `runSearch(..., 1, 0)` i odczyt `total_count`.
- `:213-225` — `searchCaregivers()`: przy pustej stronie > 1 dolicza `countCaregivers()`, by odróżnić „brak wyników” od „strona poza zakresem”.
- `src/types.ts:63-70` — `PublicCaregiverDto` (bez pól dopasowania); `:74-78` — `CaregiverSearchFilter { teryt, services, availability }` z komentarzem opisującym semantykę AND/OR (`:72-73`).
- `src/lib/caregiver-search.ts:20-37` — parsowanie URL (`gmina`, `usluga`, `termin`, `strona`), nieznane wartości ignorowane; `:40-56` — budowa linku. Parametry URL nie wymagają zmian, jeśli potrzeba = filtry (`prd.md:140`).
- `src/lib/availability.ts:47-51` — `sortAvailability()`; `:53-56` — `slotLabel()`; `:78-101` — `summarizeAvailability()` (np. „Pn–Pt: rano · Sb: noc”) — gotowe do opisu brakujących terminów.

### Strona `/opiekunowie`

`src/pages/opiekunowie/index.astro`:

- `:53` — jedno wywołanie `searchCaregivers()`.
- `:55-74` — podpowiedzi przy `total === 0` i aktywnym filtrze: kandydaci „Usuń filtr usług” (`:58-60`), „Usuń filtr dostępności” (`:61-63`), „Usuń filtr gminy” (`:64-66`), każdy liczony osobnym `countCaregivers()` (`:67-73`).
- `:86-89` — „Spróbuj sąsiedniej gminy” tylko gdy zdjęcie gminy daje wyniki, a zdjęcie każdego innego filtra nie.
- `:136` — legenda „Rodzaj usług (opiekun musi oferować wszystkie wybrane)”; `:156` — „Dostępność (opiekun musi mieć co najmniej jeden z zaznaczonych terminów)”: oba teksty opisują twardą semantykę.
- `:241-282` — karta profilu: nazwa (link), opis, chipy usług, do 3 gmin (wybrana pierwsza, `:94-96`), podsumowanie dostępności albo „Dostępność nie podana” (`:274-276`). Brak miejsca na oznaczenie braków.
- `:14` — `Cache-Control: private, no-store`; `src/middleware.ts:16`, `:21` — `X-Robots-Tag: noindex`. Braki to dane publiczne (usługi/terminy), więc reguła o kontakcie z AGENTS.md nie jest tu dotknięta.

### Koszt podpowiedzi (F6)

- Liczba wywołań `search_caregivers` na żądanie, przy pustym wyniku i wszystkich trzech filtrach: 1 (strona, `index.astro:53`) + 1 (`countCaregivers` tylko gdy `strona > 1`, `caregiver.service.ts:220-221`) + 3 (podpowiedzi, `index.astro:67-73`) = 5. Zgodne z `context/archive/2026-11-04-caregiver-availability-filter/reviews/impl-review.md:103` (5 × `search_caregivers`, łącznie 7 wywołań Supabase z `listServices` i `getActiveGmina`).
- Follow-up: `context/archive/2026-11-04-caregiver-availability-filter/follow-ups/review-fixes.md:6` — „replace them with one RPC that returns all "relaxed" counts in one call”, status `[ ]`.
- Wniosek (warunkowy): jeśli usługi i terminy staną się miękkie bez progu minimalnego pokrycia, przy `p_teryt` podanym pusty wynik oznacza brak kompletnych profili w gminie; wtedy zdjęcie usług lub terminów nic nie zmienia (te same 0), a jedyną wartą policzenia liczbą jest wynik bez gminy. Bez gminy i z miękkimi wymiarami pusty wynik = pusty katalog (`index.astro:212-214`). Przy progu (np. „≥1 wybrana usługa”) podpowiedź „Usuń filtr usług” odzyskuje sens. F6 może więc skurczyć się do jednej liczby zwracanej przez to samo RPC (np. kolumna/ścieżka „count bez gminy”) albo do jednego dodatkowego wywołania — wybór projektowy.

### Smoke (`scripts/smoke.mjs`)

Konsument RPC: `:107`. Dane: pierwszy opiekun „Anna Smoke” — gmina `1465011`, usługa `towarzystwo`, terminy Pn–Pt rano + `sob-noc` (`:137-140`); drugi „Bartek Smoke” — `1465011`, `towarzystwo` (`:145-150`), terminy zmieniane w trakcie (`nd-wieczor`, `sr-noc`, potem pusto).

Przypadki, których asercja opiera się na twardym filtrze usług/terminów (sprawdzone ręcznie; po zmianie semantyki odwrócą wynik lub stracą sens):

1. `:362` „search requires all selected services” — oczekuje ukrycia Anny przy `towarzystwo + demencja`.
2. `:446` „search matches any selected slot” — oczekuje ukrycia Anny (`hidesCaregiver`) przy `sr-noc, czw-noc`.
3. `:455` „search hides profile without matching slot” — oczekuje braku Bartka przy `czw-noc`.
4. `:500` „search without availability filter keeps profile without availability” — część „filtered” oczekuje braku Bartka przy `sr-noc`.
5. `:590` „caregiver list filters by availability” — oczekuje braku „Bartek Smoke” w HTML przy `termin=pon-rano`.
6. `:607` „caregiver list shows availability relax hint” — oczekuje „Usuń filtr dostępności (wyniki:” przy `termin=czw-noc`.
7. `:617` „caregiver list shows relax hints when nothing matches” — wszystkie usługi naraz → oczekuje „Usuń filtr usług”.

Bez zmian semantycznie: `:573` „search counts matches before the limit” (`total_count ≥ 2` przy samej gminie), testy gminy (`:358`), ukrywania niekompletnych profili i braku kontaktu w wierszach (`:342-356`). Brak testu asertującego kolejność wyników (sprawdzone: żaden z przejrzanych przypadków `searchCaregivers` nie porównuje pozycji).

## Code References

- `supabase/migrations/20261104120000_caregiver_availability.sql:220-348` — bieżąca `search_caregivers()` z komentarzem semantyki.
- `supabase/migrations/20261104120000_caregiver_availability.sql:419-420` — uprawnienia RPC.
- `supabase/migrations/20261103150000_caregiver_profiles.sql:349-391` — `caregiver_profile_missing()` (reguła kompletności, nazwa „missing” zajęta przez kompletność profilu, nie dopasowanie).
- `src/lib/services/caregiver.service.ts:152-225` — `PublicRow`/`SearchRow`, `runSearch`, `countCaregivers`, `searchCaregivers`.
- `src/types.ts:63-78` — `PublicCaregiverDto`, `CaregiverSearchFilter`.
- `src/pages/opiekunowie/index.astro:53-89` — wyszukiwanie i podpowiedzi; `:136`, `:156` — legendy; `:241-282` — karta.
- `src/lib/availability.ts:47-101` — porządek, etykiety i podsumowanie terminów.
- `scripts/smoke.mjs:107`, `:362`, `:446`, `:455`, `:500`, `:590`, `:607`, `:617` — konsument RPC i przypadki do przepisania.

## Architecture Insights

- Reguły domenowe żyją w SQL (`caregiver_profile_missing()`, `search_caregivers()`), a aplikacja tylko mapuje wynik — `caregiver.service.ts:65`, `:188-189`. Ranking i lista braków pasują do tego wzorca jako kolumny tej samej funkcji (np. pokrycie usług, pokrycie terminów, brakujące usługi/terminy), liczone dla stron ≤ 50 wierszy.
- Zmiana kolumn wyniku lub parametrów wymaga `drop function` + `create` + ponownego `grant` (`20261104120000_caregiver_availability.sql:23-25`). Kolejność wdrożenia z S-04: najpierw migracja, potem Worker; nowe parametry z wartościami domyślnymi utrzymują stary Worker w oknie wdrożenia (`:18-22`). Dodanie kolumn do wyniku jest wstecznie zgodne dla starego Workera (PostgREST zwraca nadmiarowe pola, serwis ich nie czyta) — wniosek z kształtu `toPublicCaregiver()`, niezweryfikowany wdrożeniem.
- `get_public_caregiver()` dzieli kształt wiersza z `search_caregivers()` (`:409-410`, `caregiver.service.ts:154-163`); pola rankingu dotyczą tylko listy, więc warto rozdzielić `SearchRow` od `PublicRow` zamiast poszerzać wspólny DTO.
- Brak generowanych typów DB: wynik RPC jest rzutowany ręcznie (`caregiver.service.ts:188-196`), więc nowe kolumny trzeba dopisać do interfejsu ręcznie; `npx astro check` ich nie zweryfikuje względem SQL.
- Strona jest renderowana serwerowo bez wysp React dla wyników (`index.astro:241-282`); oznaczenie braków może zostać w `.astro` (zgodnie z konwencją AGENTS.md).

## Historical Context (from prior changes)

- `context/archive/2026-11-03-public-caregiver-search/plan-brief.md:21` — usługi jako AND „do czasu S-05, który zamieni usługi w miękki ranking z oznaczeniem braków” — **potwierdzone** przez obecny kod (`:274-284`).
- `.../public-caregiver-search/plan-brief.md:67` — ponowny zapis „podbija” profil na górę; „S-05 zastępuje kolejność” — **częściowo**: ranking zastąpi kolejność między różnymi poziomami pokrycia, ale przy równym pokryciu (albo bez wybranych usług i terminów) `updated_at desc` nadal decyduje, chyba że S-05 zmieni tie-breaker.
- `.../public-caregiver-search/plan.md:47`, `:293` — koszt `caregiver_profile_missing()` per kandydat akceptowalny przy „dziesiątkach–setkach profili”; przy wzroście „rozważyć materializację kompletności” — **nadal aktualne**, brak materializacji w migracjach.
- `context/archive/2026-11-04-caregiver-availability-filter/plan-brief.md:22`, `:26` i `plan.md:36`, `:75`, `:371` — filtr OR jako tymczasowy, model `slot` i indeks na `slot` „pod S-05”, pokrycie „zwykłym count” — **potwierdzone** (`20261104120000_caregiver_availability.sql:13-14`, `:44`).
- `.../caregiver-availability-filter/reviews/impl-review.md:103-105` i `follow-ups/review-fixes.md:6` — F6 zaakceptowany i odłożony do S-05 — **otwarty**.
- `context/archive/2026-09-24-gmina-and-service-dictionaries/plan-brief.md:7`, `:24` — słowniki jako tabele, „ranking (S-05) ma liczyć się w bazie” — **potwierdzone** kierunkiem roadmapy (`roadmap.md:157`).

## Related Research

Nie dotyczy — `find context -name research.md` zwraca tylko ten plik; wcześniejsze zmiany mają `plan.md`/`plan-brief.md` i recenzje.

## Open Questions

Decyzje produktowe/projektowe dla `/10x-plan` (kod ich nie rozstrzyga):

1. **Próg miękkości usług.** Czy profil z zerowym pokryciem wybranych usług ma się pojawiać (dosłownie `prd.md:142`: „brak części usług… obniża pozycję”), czy wymagane jest ≥1 wspólnej usługi? Od tego zależy, czy podpowiedź „Usuń filtr usług” przetrwa i jak wygląda F6.
2. **Analogicznie dla terminów** — czy profil bez żadnego wspólnego terminu (w tym „Dostępność nie podana”) zostaje na liście, niżej.
3. **Formuła „najwięcej waży”.** Leksykograficznie (najpierw liczba pokrytych usług, potem terminów) czy suma ważona? Leksykografia spełnia `prd.md:138` w każdym przypadku; suma ważona wymaga dobrania wag tak, by 1 usługa > 28 terminów, inaczej kilka terminów może wyprzedzić usługę.
4. **Tie-breaker** przy równym pokryciu i przy braku wybranych usług/terminów: zostaje `updated_at desc, user_id` czy np. `display_name`/losowo-stabilnie (efekt „podbijania” zapisem).
5. **Forma oznaczenia braków na karcie**: lista brakujących usług po nazwie i brakujących terminów (podsumowaniem `summarizeAvailability`) czy liczniki „2 z 3 usług”; czy pokazywać pozytywny „pełne dopasowanie”.
6. **Bez wybranej gminy** — gmina jest twarda tylko, gdy podana; czy ranking działa też na liście ogólnopolskiej (dziś `p_teryt null` = dowolna gmina).
7. **Workers Free vs Paid** (`roadmap.md:156`) — decyzja po pomiarze CPU, Owner: user, nie blokuje planu.
