<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Tryb aktualizacji w generatorze migracji gmin

- **Plan**: context/changes/gminas-generator-upsert/plan.md
- **Mode**: Deep
- **Date**: 2026-11-03
- **Verdict**: REVISE → SOUND (after triage)
- **Findings**: 0 critical, 3 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

7/7 paths ✓, 8/8 symbols ✓ (nit: duplicate-teryt check is at `scripts/generate-gminas-migration.mjs:128`, not `:126-127`), brief↔plan ✓, Progress↔Phase ✓. Blast radius: `gminas` / `search_gminas` used only by `src/lib/services/dictionary.service.ts`, `src/pages/api/dictionaries/gminas.ts`, `scripts/smoke.mjs`; the service selects fields explicitly.

## Findings

### F1 — Próg liczy także niegroźne zmiany RODZ

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 2, §3 pkt 4 (blok plpgsql) + decyzja „Zabezpieczenie”
- **Detail**: Próg 30 liczy wszystkie wycofania. Większość rocznych zmian to nadania praw miejskich (RODZ 2→3), które mają automatycznego następcę i są niegroźne. W latach z dużą liczbą nadań (np. 1.01.2023, ok. 34 nowe miasta) prawidłowa migracja zostanie przerwana. Prawdziwy sygnał „zły plik” to wycofania bez następcy.
- **Fix A ⭐ Recommended**: Próg liczy tylko wycofania bez następcy
  - Strength: Mierzy faktyczne ryzyko; zwykły rok nigdy nie wymaga `--max-retired`.
  - Tradeoff: Nieco bardziej złożony warunek (wyliczenie następcy przed kontrolą progu).
  - Confidence: MED — liczba nadań w 2023 z pamięci, nie z pliku TERC.
  - Blind spot: Starszy plik cofa zmiany RODZ z następcami i nie zostanie policzony (F2).
- **Fix B**: Zostawić łączny próg, podnieść domyślną wartość do ~60
  - Strength: Zero zmian w logice.
  - Tradeoff: Słabsza ochrona przed plikiem z brakami bez następców.
  - Confidence: MED — brak pewnych danych historycznych.
  - Blind spot: None significant
- **Decision**: FIXED (Fix A)

### F2 — Brak ochrony przed starszym plikiem TERC

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 2, §2 (kontrole przed zapisem)
- **Detail**: Plik starszy niż już wczytany przechodzi wszystkie kontrole. Migracja po cichu reaktywuje stare kody i wycofuje nowe, czyli cofa nadania praw miejskich. Każda wygenerowana migracja ma już w nagłówku linię `-- STAN_NA: …`.
- **Fix**: Generator czyta linie `-- STAN_NA:` z `supabase/migrations/*.sql` i kończy się `fail`, gdy STAN_NA nowego pliku jest wcześniejszy niż najnowszy znaleziony (równy jest dozwolony). Dodać punkt Automated w fazie 2 i wzmiankę w README.
  - Strength: Tanie, zgodne z zasadą „generator bez bazy”.
  - Tradeoff: Zakłada, że migracje w repo odpowiadają bazie produkcyjnej.
  - Confidence: HIGH — nagłówek STAN_NA już jest emitowany.
  - Blind spot: Nieusunięte testowe migracje z wyższym STAN_NA zablokowałyby generator.
- **Decision**: FIXED

### F3 — Scenariusz 3 blokuje scenariusz 4

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2, Manual Verification (2.8, 2.9)
- **Detail**: Nieudana migracja ze scenariusza 3 zostaje jako oczekująca, więc `migration up` w scenariuszu 4 znowu ją wykona i znowu się przerwie. Nie wiadomo też, z którego pliku CSV powstaje kopia w scenariuszu 3.
- **Fix**: Scenariusz 3: „kopia oryginalnego CSV bez 6 gmin; po potwierdzeniu błędu usunąć tę migrację przed scenariuszem 4” (albo wykonać scenariusz 3 jako ostatni).
- **Decision**: FIXED

### F4 — replaced_by może wskazywać gminę nieaktywną

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2 §3 (skracanie łańcuchów), Phase 3 §2 (ograniczenia S-01)
- **Detail**: Przypadek X → B, a później B wycofana bez następcy: X nadal wskazuje nieaktywną B. Przykładowe zapytanie przepinające dla S-01 przeniosłoby wtedy profile na gminę wycofaną.
- **Fix**: W ograniczeniach S-01 dopisać, że przepinamy tylko na aktywnego następcę; resztę zostawiamy do ręcznego rozstrzygnięcia.
- **Decision**: FIXED

### F5 — prettier --check na roadmapie nic nie sprawdza

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 3, Automated (3.1)
- **Detail**: `.prettierignore` wyklucza `context/`, więc ten check zawsze przechodzi.
- **Fix**: W 3.1 zostawić tylko README.md; dodać automatyczny `grep -n "on delete restrict" context/foundation/roadmap.md`.
- **Decision**: FIXED
