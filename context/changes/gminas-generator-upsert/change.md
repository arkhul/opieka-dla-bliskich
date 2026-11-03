---
change_id: gminas-generator-upsert
title: Tryb aktualizacji w generatorze migracji gmin
status: new
created: 2026-09-24
updated: 2026-11-03
archived_at: null
---

## Notes

Generator gmin (scripts/generate-gminas-migration.mjs) tworzy zwykłe inserty, więc migracja aktualizująca gminy (update_gminas, opisana w README) wywali się na konflikcie kluczy z istniejącymi wierszami. Potrzebny tryb aktualizacji: upsert zmienionych gmin i obsługa gmin zniesionych/połączonych (usunięcie lub oznaczenie), zanim ktoś wykona pierwszą aktualizację z nowego pliku TERC. Wynika z F-01 (gmina-and-service-dictionaries).

## Wymagania z przeglądu F-01

Źródło: `context/changes/gmina-and-service-dictionaries/reviews/impl-review.md` (2026-11-03), ustalenia F1 i F2. Kolejność: do rozstrzygnięcia **przed S-01** (`caregiver-profile-setup`), bo S-01 doda klucze obce z profili do `gminas(teryt)`.

### Z F1 — tryb aktualizacji generatora

- Generator ma tryb aktualizacji (np. flaga `--update`), który emituje `insert ... on conflict (teryt) do update set name, kind, powiat, wojewodztwo` zamiast zwykłych insertów; migracja musi przejść na zapełnionej tabeli.
- Kody `teryt` obecne w bazie, a nieobecne w nowym pliku TERC, są obsłużone jawnie (patrz F2) — nie są ani pomijane po cichu, ani usuwane twardo.
- Nagłówek wygenerowanego pliku odzwierciedla tryb i nazwę migracji (dziś `-- Migration: seed_gminas` jest wpisane na sztywno, `scripts/generate-gminas-migration.mjs:153`); komentarz użycia (`:3`) opisuje oba tryby.
- README (`README.md:135-138`) opisuje działającą procedurę i nie każe ręcznie edytować pliku oznaczonego „GENERATED FILE - do not edit by hand”.

### Z F2 — stabilność klucza gminy

- Problem: `teryt` = WOJ+POW+GMI+RODZ (`supabase/migrations/20260924120000_create_dictionaries.sql:58`). Gdy gmina wiejska dostaje prawa miejskie, RODZ zmienia się z 2 na 3 — stary kod znika, pojawia się nowy. Po S-01 każdy wariant usuwania jest zły: `restrict` blokuje, `cascade` kasuje profile, a martwe wiersze zostają w wyszukiwarce.
- Decyzja do podjęcia na etapie planu tej zmiany (rekomendacja z przeglądu: wariant A):
  - **A (rekomendowany):** zostawić `teryt` jako klucz; dodać wycofywanie gmin (`active boolean not null default true` lub `valid_to date`); `search_gminas` zwraca tylko aktywne; FK z profili w S-01 `on delete restrict`; migracja aktualizująca przepina profile ze starego kodu na nowy (mapowanie stary → nowy kod).
  - **B:** stabilny 6-znakowy klucz WOJ+POW+GMI, RODZ tylko w `kind`. Przed wyborem zweryfikować na pełnym pliku TERC unikalność trójki w RODZ 1/2/3 oraz czy GUS zachowuje GMI przy nadaniu praw miejskich.
- Plan S-01 musi przyjąć wybrany wariant (typ FK, `on delete restrict`, filtrowanie aktywnych gmin).
