<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Tryb aktualizacji w generatorze migracji gmin

- **Plan**: context/changes/gminas-generator-upsert/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-11-03
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 4 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Generator nie sprawdza kolejności znacznika czasu migracji

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: scripts/generate-gminas-migration.mjs:89-94
- **Detail**: Generator sprawdza tylko kształt nazwy (`^\d{14}_[a-z0-9_]+\.sql$`), a nie to, czy znacznik czasu jest późniejszy niż istniejące migracje. Wygenerowany SQL wymaga kolumn `active`/`replaced_by` z `20261103120000_retirable_gminas.sql`. Wpisanie wcześniejszego znacznika (np. `20261001000000_update_gminas.sql`) albo nadpisanie `20260924130000_seed_gminas.sql` da migrację, przy której `npx supabase db reset` padnie na „column active does not exist”, a `db push` uzna plik za wstawiony nie po kolei.
- **Fix**: W istniejącej pętli po plikach katalogu (`:190-205`) zbierać też znaczniki czasu i odmówić (`fail`), gdy znacznik pliku wyjściowego nie jest późniejszy niż najnowszy z pozostałych migracji.
- **Decision**: FIXED — kontrola `latestMigration` w pętli po plikach katalogu wyjściowego; sprawdzone: wcześniejszy/równy znacznik i nadpisanie seeda → exit 1, późniejszy → OK

### F2 — Kontrola progu działa dopiero po upsercie

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: scripts/generate-gminas-migration.mjs:230-279
- **Detail**: „Przerwanie bez zmian” zależy wyłącznie od tego, że plik migracji działa w jednej transakcji. Supabase CLI to zapewnia (potwierdzone scenariuszem 3), ale uruchomienie pliku np. przez `psql -f` bez `-1` zostawi zastosowany upsert i przerwane wycofanie. Upsert nie dotyka gmin nieobecnych w TERC, więc liczbę wycofań bez następcy można policzyć przed nim.
- **Fix**: Przenieść kontrolę progu do osobnego bloku `do $$` przed upsertem (te same zapytania, wynik identyczny).
- **Decision**: FIXED — kontrola progu w osobnym bloku `do $$` przed upsertem (odstępstwo od kolejności z planu: upsert → próg). Sprawdzone: przez Supabase CLI przerwanie bez zmian; `psql -v ON_ERROR_STOP=1 -f` bez transakcji też bez zmian (wcześniej upsert by przeszedł); scenariusz 2 bez zmian w wyniku. Uwaga: domyślny `psql -f` (bez `ON_ERROR_STOP`) kontynuuje po błędzie i stosuje resztę pliku — przed tym kod w pliku nie chroni.

### F3 — Kontrola STAN_NA po cichu pomijana

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: scripts/generate-gminas-migration.mjs:188-210
- **Detail**: Gdy w katalogu wyjściowym nie ma żadnej linii `-- STAN_NA:` (np. zapis do katalogu roboczego), ochrona przed starszym plikiem TERC nie działa, a generator o tym nie informuje. Zgodne z planem („brak takich linii → kontrola pomijana”), ale niewidoczne dla operatora.
- **Fix**: Wypisać ostrzeżenie w konsoli, gdy nie znaleziono żadnego STAN_NA.
- **Decision**: FIXED — `console.warn` przy braku STAN_NA (kod wyjścia bez zmian); sprawdzone: pusty katalog → ostrzeżenie, `supabase/migrations` → brak

### F4 — Nazwy plików w nagłówku SQL bez filtrowania znaków sterujących

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: scripts/generate-gminas-migration.mjs:318
- **Detail**: `path.basename(inputPath)` i katalog z `outputShown` trafiają do komentarza `--` bez filtrowania. Nazwa ze znakiem nowej linii zakończyłaby komentarz i reszta trafiłaby do migracji jako SQL. Nazwy kontroluje wyłącznie operator, więc ryzyko jest teoretyczne.
- **Fix**: Usuwać znaki sterujące (`/[\x00-\x1f]/g`) z nazw wpisywanych w nagłówek.
- **Decision**: FIXED — funkcja `commentSafe` (zamiana znaków < 0x20 i 0x7f na `?`, bez regexa ze względu na regułę `no-control-regex`) w linii `-- Generated with:`; zwykły nagłówek bez zmian, logika sprawdzona bezpośrednio (Windows nie pozwala utworzyć pliku z nową linią w nazwie)

### F5 — Weryfikacja ręczna na CSV odtworzonym z seeda

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: N/A (Progress 2.6–2.11, 3.4)
- **Detail**: Brak prawdziwego pliku TERC — scenariusze ręczne wykonano na CSV w formacie TERC odtworzonym z `20260924130000_seed_gminas.sql` (wygenerowane wiersze identyczne z seedem, sprawdzone `diff`). Logika sync, próg, reaktywacja, STAN_NA i transakcyjność są zweryfikowane; parsowanie prawdziwego eksportu GUS nie było testowane w tej zmianie (parser nie był zmieniany od F-01).
- **Fix**: Przy pierwszym nowym pliku TERC (od 2027-01-01) wykonać scenariusz 1 lokalnie (`db reset` + `migration up` + zapytanie kontrolne z README) przed `db push`.
- **Decision**: FIXED — README: przed `db push` zastosować migrację lokalnie i sprawdzić wycofane gminy; dodatkowo punkt o kontroli znacznika czasu (z F1)

## Success criteria evidence (2026-11-03)

- Phase 1: `npm run lint` PASS, `npx astro check` PASS (0 errors), `npm run build` PASS, smoke (build + `preview`, jak w CI) PASS 12/12.
- Phase 2: lint PASS; generator bez argumentów / nazwa bez znacznika / `--max-retired abc` → exit 1 z komunikatem; smoke PASS.
- Phase 3: `npx prettier --check README.md` PASS; `on delete restrict` w `roadmap.md:104`; fraza „plain `insert` statements” usunięta.
- Manual: wszystkie `[x]`; dowody w przebiegu `/10x-implement` (scenariusze 1–5, sprzątanie, procedura README).
- Uwaga: brak przebiegu CI dla tej gałęzi (`gh run list` pusty) — smoke uruchomiony lokalnie w konfiguracji CI.
