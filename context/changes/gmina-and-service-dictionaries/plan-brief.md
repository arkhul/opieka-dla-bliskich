# Słowniki gmin i usług — Plan Brief

> Full plan: `context/changes/gmina-and-service-dictionaries/plan.md`

## What & Why

Wprowadzamy słownik wszystkich gmin w Polsce i zamknięty katalog 13 rodzajów usług jako wspólne dane referencyjne. Opiekun (S-01) i koordynator (S-02) muszą mówić tymi samymi wartościami — rozjazd między profilem a filtrem po cichu zeruje wyniki, a ranking (S-05) ma liczyć się w bazie.

## Starting Point

Projekt nie ma jeszcze żadnej tabeli domenowej ani migracji; jest tylko Supabase Auth, klient `createClient()` zwracający `null` bez env i test `npm run smoke`, który w CI stawia lokalny Supabase.

## Desired End State

Każde środowisko (lokalne, CI, produkcja) ma tabele `gminas` (~2477 gmin z TERYT) i `services` (13 pozycji), czytelne bez logowania i niemodyfikowalne przez API. Publiczne `GET /api/dictionaries/services` i `GET /api/dictionaries/gminas?q=` zwracają gotowe DTO; wyszukiwanie działa bez polskich znaków („lodz” → Łódź), a smoke pilnuje tego w CI.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Zakres gmin | Cała Polska (TERC, rodzaje 1/2/3) | Portal działa dla każdego koordynatora od pierwszego dnia, bez migracji przy rozszerzaniu. |
| Duże miasta | Tylko gminy, bez dzielnic/delegatur | Jedna spójna jednostka zgodna z decyzją PRD „gmina zamiast miejscowości”. |
| Katalog usług | 11 opiekuńczych + 2 pielęgniarskie (13) | Pokrywa realną potrzebę osób po wylewie z PRD; deklaracje nie są weryfikowane. |
| Model danych | Tabele Postgres, RLS tylko-do-odczytu | Klucze obce z profili i ranking w SQL wykluczają rozjazd wartości. |
| Powierzchnia | Serwis + typy + 2 publiczne GET + smoke | Weryfikowalne end-to-end w CI i gotowe źródło autocomplete dla S-01/S-02. |
| Dane w migracji, nie w seed | Generowana migracja z pliku TERC | `seed.sql` nie trafia na produkcję; generator czyni aktualizację powtarzalną. |
| Normalizacja wyszukiwania | Funkcja SQL `IMMUTABLE` (`translate`) | Jedno miejsce reguły dla kolumny generowanej i wyszukiwania; `unaccent` nie jest immutable. |

## Scope

**In scope:** migracja schematu z RLS i 13 usługami; generator i migracja danych gmin; `src/types.ts`, `src/lib/gmina.ts`, `dictionary.service.ts`; endpointy usług i wyszukiwania gmin (zod); kroki smoke; README; wypchnięcie migracji na produkcję.

**Out of scope:** tabele profili i klucze obce (S-01); komponent wyboru gminy/usług i strony; dzielnice/delegatury; weryfikacja uprawnień pielęgniarskich; cache odpowiedzi; automatyczna synchronizacja z TERYT; `supabase gen types`.

## Architecture / Approach

Plik TERC → `scripts/generate-gminas-migration.mjs` → migracja danych. Migracja schematu definiuje tabele, RLS (select dla `anon`/`authenticated`), `normalize_pl()` i `search_gminas()`. Endpoint → `dictionary.service.ts` → Supabase (klucz anon, RLS) → DTO z etykietą z `formatGminaLabel()`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Schemat słowników i katalog usług | Tabele, RLS, funkcje, 13 usług | Pierwsza migracja ustala konwencję RLS dla całego projektu |
| 2. Import gmin z TERYT | Generator + migracja ~2477 gmin | Pobranie pliku TERC może wymagać ręcznego kroku |
| 3. Serwis, publiczne API i smoke | Endpointy JSON, kroki smoke, README, push na produkcję | Push migracji na produkcję jest ręczny |

**Prerequisites:** lokalny Supabase (`npx supabase start`); plik TERC (wersja urzędowa, CSV) z eteryt.stat.gov.pl; dostęp do produkcyjnego projektu Supabase dla `db push`.
**Estimated effort:** ~1–2 sesje w 3 fazach.

## Open Risks & Assumptions

- Plik TERC pobiera się przez formularz eteryt — agent może potrzebować, by użytkownik pobrał go ręcznie.
- Usługi pielęgniarskie są samodeklaracją bez weryfikacji (PRD Non-Goal) — S-01/S-02 powinny to komunikować.
- Duże miasta jako jedna gmina: opiekun z jednego końca Warszawy pojawi się przy potrzebie na drugim.
- Preview Workera współdzieli produkcyjną bazę — bezpieczne, bo nowe tabele są tylko do odczytu.

## Success Criteria (Summary)

- Opiekun i koordynator w kolejnych slice'ach wybierają gminę i usługi z tych samych, publicznie dostępnych słowników.
- Wpisanie „lodz” lub „Łódź” znajduje Łódź; duplikaty nazw są jednoznacznie opisane rodzajem, powiatem i województwem.
- `npm run smoke` w CI wykrywa każdą regresję migracji, RLS lub endpointów słowników.
