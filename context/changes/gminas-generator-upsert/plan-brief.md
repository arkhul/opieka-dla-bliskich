# Tryb aktualizacji w generatorze migracji gmin — Plan Brief

> Full plan: `context/changes/gminas-generator-upsert/plan.md`

## What & Why

Generator gmin emituje wyłącznie zwykłe `insert`y, więc pierwsza migracja aktualizująca gminy z nowego pliku TERC wywali się na kluczu głównym zapełnionej tabeli (F1 z przeglądu F-01). Dodatkowo `teryt` zawiera cyfrę RODZ, która zmienia się przy nadaniu praw miejskich — stary kod znika, a po S-01 profile będą na niego wskazywać (F2). Trzeba to rozstrzygnąć przed S-01, zanim pojawią się klucze obce do `gminas(teryt)`.

## Starting Point

`public.gminas` ma 2479 gmin z seeda (PK `teryt` = WOJ+POW+GMI+RODZ, bez kolumny statusu), `search_gminas` zwraca wszystkie wiersze, a generator nie łączy się z bazą i ma nagłówek `seed_gminas` na sztywno. README każe ręcznie poprawiać plik oznaczony jako generowany. Nic jeszcze nie wskazuje na `gminas(teryt)`.

## Desired End State

Jedno polecenie generatora z nowym plikiem TERC daje migrację, która przechodzi na zapełnionej bazie: aktualizuje gminy, dodaje nowe, a brakujące oznacza jako wycofane (bez usuwania), wskazując następcę przy zmianie rodzaju gminy. Wycofane gminy znikają z wyszukiwarki. Migracja przerywa się bez zmian, gdy wycofałaby podejrzanie dużo gmin. README opisuje tę procedurę, a roadmapa mówi S-01, jak oprzeć klucze obce na gminach.

## Key Decisions Made

| Decision                    | Choice                                                                  | Why (1 sentence)                                                                                         | Source             |
| --------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------ |
| Klucz gminy                 | Wariant A: zostaje 7-znakowy `teryt` + `active` + `replaced_by`         | Bez zmiany PK i API, kod zostaje 1:1 z TERC; przepinanie profili przez `replaced_by` przejmuje S-01.     | Przegląd F-01 / Plan |
| Reprezentacja wycofania     | `active boolean` (nie `valid_to date`)                                  | Data aktualizacji i tak jest w nagłówku migracji (`STAN_NA`); prostszy filtr.                            | Plan               |
| Tryb generatora             | Jeden tryb sync (bez `--update`), nazwa migracji z nazwy pliku          | Ten sam wynik działa na pustej i zapełnionej tabeli — nie da się wybrać złego trybu.                     | Plan               |
| Gminy nieobecne w TERC      | Wycofanie; następca automatycznie przy tym samym WOJ+POW+GMI            | Pokrywa coroczny przypadek praw miejskich; połączenia (rzadkie) dostają następcę ręczną migracją.        | Plan               |
| Zabezpieczenie              | Przerwanie powyżej 30 wycofań bez następcy, flaga `--max-retired N`     | Druga linia obrony obok kontroli 2470–2490 gmin, np. przed plikiem z innego zakresu.                     | Plan               |
| Logika różnicy              | Tabela tymczasowa z TERC + SQL w migracji                               | Generator nie ma dostępu do bazy; tylko SQL zna wiersze „w bazie, a nie w pliku”.                        | Plan               |
| Ostrzeżenie F7              | Komentarz na `normalize_pl` w tej migracji                              | Przegląd F-01 kazał dodać go przy następnej migracji dotykającej gmin — to jest ta migracja.             | Przegląd F-01      |

## Scope

**In scope:**

- Migracja schematu: `active`, `replaced_by`, filtr w `search_gminas`, komentarz F7
- Generator: upsert, wycofanie, automatyczny następca, skracanie łańcuchów, próg, nazwa z pliku, kontrola unikalności prefiksu, kontrola STAN_NA względem istniejących migracji
- README: działająca procedura odświeżania; roadmapa: ograniczenia dla S-01

**Out of scope:**

- Klucz 6-znakowy (wariant B), flaga `--update`, plik mapowania następców
- Przepinanie profili (brak tabel — obowiązek S-01)
- Commit wygenerowanej migracji aktualizującej; zmiany API/DTO/UI; ustalenia F3–F6, F8

## Architecture / Approach

Wygenerowany plik: nagłówek z nazwą i trybem → `create temporary table gminas_terc` + paczki insertów → `insert … on conflict (teryt) do update` (z `active = true, replaced_by = null`) → blok plpgsql: kontrola progu, wycofanie brakujących z następcą po prefiksie, skrócenie łańcuchów, `raise notice` → `drop table`. Całość w transakcji migracji, więc przerwanie nie zostawia zmian.

## Phases at a Glance

| Phase                                   | What it delivers                                                  | Key risk                                                                   |
| --------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 1. Schemat — gminy z wycofywaniem       | `active`, `replaced_by`, wyszukiwarka tylko aktywnych, komentarz F7 | `create or replace` musi zachować sygnaturę, uprawnienia i kolejność wyników |
| 2. Generator — tryb sync                | Migracja synchronizująca z TERC, próg, następcy                   | Założenie o transakcji na plik migracji (weryfikuje scenariusz progu)      |
| 3. Dokumentacja i przekazanie do S-01   | Procedura w README, ograniczenia S-01 w roadmapie                 | S-01 zignoruje ograniczenia, jeśli wpis będzie niewidoczny                  |

**Prerequisites:** lokalny Docker + Supabase CLI do weryfikacji ręcznej; aktualny plik TERC (wersja urzędowa, CSV) pobrany lokalnie z eteryt.stat.gov.pl.
**Estimated effort:** ~1–2 sesje w 3 fazach.

## Open Risks & Assumptions

- Zakładamy, że Supabase CLI wykonuje plik migracji w jednej transakcji — scenariusz 3 w fazie 2 to sprawdza.
- `raise notice` może nie być widoczny w `db push`; dlatego README każe sprawdzić wycofane gminy zapytaniem.
- Automatyczny następca zakłada, że GUS zachowuje GMI przy nadaniu praw miejskich; gdy nie, gmina jest wycofana bez następcy i trafia do ręcznej migracji.

## Success Criteria (Summary)

- Migracja wygenerowana z aktualnego pliku TERC stosuje się na zapełnionej bazie bez zmian w danych, a zmiana RODZ daje wycofaną gminę z następcą.
- Wycofane gminy nie pojawiają się w `GET /api/dictionaries/gminas`; smoke w CI przechodzi.
- README i wpis S-01 opisują działającą procedurę i reguły kluczy obcych.
