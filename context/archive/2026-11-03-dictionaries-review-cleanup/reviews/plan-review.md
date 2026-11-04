<!-- PLAN-REVIEW-REPORT -->

# Plan Review: Domknięcie ustaleń z przeglądu F-01 i porządki w roadmapie

- **Plan**: context/changes/dictionaries-review-cleanup/plan.md
- **Mode**: Deep
- **Date**: 2026-11-03
- **Verdict**: SOUND
- **Findings**: 0 critical, 1 warning, 4 observations

## Verdicts

| Dimension             | Verdict |
| --------------------- | ------- |
| End-State Alignment   | PASS    |
| Lean Execution        | PASS    |
| Architectural Fitness | PASS    |
| Blind Spots           | WARNING |
| Plan Completeness     | WARNING |

## Grounding

9/9 paths ✓, 6/6 symbols ✓ (`getUser` w middleware, pętla smoke `:575`, `secondCaregiverToken`, `isEmptyArray`/`hasOneRow`, komentarz `normalize_pl` w `20261103120000_retirable_gminas.sql:66-67`, `supabase db query --local/--linked` w CLI 2.117.0), brief↔plan ✓, Progress↔Phase ✓.

Weryfikacja kodu (sub-agent) potwierdziła kluczowe twierdzenie planu:

- Macierz 20 grantów zgadza się z migracjami (`20260924120000_create_dictionaries.sql:117-118`, `20261103150000_caregiver_profiles.sql:398-405`).
- W `public` nie ma innych tabel, widoków, sekwencji ani grantów kolumnowych.
- Polityki dostępne dla `anon` to wyłącznie `using (true)`.
- Funkcje INVOKER (`save_caregiver_profile`, `enforce_caregiver_gminas_limit`, `search_caregivers`, `get_public_caregiver`, `search_gminas`) używają tylko operacji z grantów.
- W `src/` nie ma bezpośrednich zapisów do tabel.

## Findings

### F1 — Wzorzec revoke + grant dla nowych tabel zostaje tylko w planie

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: What We're NOT Doing (pkt 1), Migration Notes
- **Detail**: Bez `alter default privileges` reguła „nowe migracje robią revoke all przed grantami” istnieje tylko w plan.md, który trafi do archiwum. Hard Rule w AGENTS.md mówi tylko o RLS i politykach, więc tabela S-04/S-06 po cichu dostanie domyślne ALL, w tym TRUNCATE.
- **Fix**: W fazie 1 dopisać do Hard Rule w AGENTS.md `revoke all … from anon, authenticated` przed jawnymi grantami.
- **Decision**: FIXED — faza 1 §3 (AGENTS.md), odwołanie w Migration Notes

### F2 — Decyzja F1 w przeglądzie oznaczona jako „Fix B” zamiast Fix A

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Faza 4 §1
- **Detail**: W przeglądzie F-01 Fix B to upsert w ramach F-01, a naprawa poszła drogą Fix A (follow-up `gminas-generator-upsert`).
- **Fix**: „F1: FIXED (Fix A), follow-up zrealizowany, archiwum …”.
- **Decision**: FIXED

### F3 — „POST z dowolnym wierszem” może dać PGRST204 zamiast permission denied

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Faza 1 §2
- **Detail**: Nieznana kolumna w body daje błąd ze schema cache PostgREST (400 `PGRST204`), zanim zapytanie dotrze do sprawdzenia uprawnień w Postgresie.
- **Fix**: Body z istniejącymi kolumnami: `gminas` (`teryt`, `name`, `kind`, `powiat`, `wojewodztwo`), `services` (`slug`, `label`, `sort_order`).
- **Decision**: FIXED

### F4 — Fallback do anon na stronach chronionych: wyjątek zamiast pustego wyniku

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Key Discoveries (pkt 1)
- **Detail**: Gdy klient strony nie odświeży sesji i odpyta bazę jako `anon`, `kontakt/[id].astro:31` i embed w `caregiver.service.ts:57` dostaną po revoke 42501 zamiast pustego wyniku. Strona pokaże wtedy ogólny błąd.
- **Fix**: Zapisać w Key Discoveries jako zaakceptowany przypadek brzegowy.
- **Decision**: FIXED

### F5 — `## Done` w roadmapie nadal ma placeholder z pierwszego wygenerowania

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Faza 4 §2
- **Detail**: W archiwum jest 5 zmian, a `roadmap.md:208` nadal mówi „(Empty on first generation…)”.
- **Fix**: Wpisy `## Done` dla F-01, S-01, S-02, S-03 z datą archiwizacji i ścieżką archiwum.
- **Decision**: FIXED — faza 4 §2, kryterium 4.3
