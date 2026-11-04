<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Trwałe usunięcie profilu opiekuna

- **Plan**: context/changes/caregiver-profile-deletion/plan.md
- **Mode**: Deep (weryfikacja inline)
- **Date**: 2026-11-04
- **Verdict**: REVISE → SOUND po poprawkach
- **Findings**: 0 critical, 2 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | PASS |

## Grounding

11/11 paths ✓, 9/9 symbols ✓ (guard, json, deniesTable, supabase(), coordinatorToken, secondCaregiverToken, OwnCaregiverProfileDto.id, Button destructive, ServerError), brief↔plan ✓ (1 nieścisłość, F3).

Potwierdzone: kaskady FK we wszystkich czterech tabelach zależnych (`20261103150000_caregiver_profiles.sql:94,130,170`, `20261104120000_caregiver_availability.sql:39`); brak triggerów DELETE na tabelach zależnych (limit gmin to tylko BEFORE INSERT); `caregiver_profiles_select_authenticated using (true)` pozwala na `delete().select()`; anon bez grantu dostaje 401 + `deniesTable` jak w istniejących krokach smoke; spójność Progress↔Phase 7/7/4.

## Findings

### F1 — Konto testowe na produkcji przy włączonym potwierdzaniu e-maila

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 3 §3 — Weryfikacja na produkcji i sprzątanie
- **Detail**: Potwierdzanie e-maila jest wyłączone tylko lokalnie (`supabase/config.toml:209`), PRD Open Question 1 jest otwarte. Jeśli produkcja wymaga potwierdzenia, rejestracja `s06-check-…@example.com` kończy się bez sesji (lub błędem domyślnego SMTP), więc krok 3.3 jest nie do przejścia.
- **Fix A ⭐ Recommended**: Sprawdzić `GET /auth/v1/settings` (`mailer_autoconfirm`); gdy false, użyć plus-adresu użytkownika i potwierdzić konto linkiem z poczty.
  - Strength: Prawdziwy przepływ end-to-end.
  - Tradeoff: Wymaga udziału użytkownika (skrzynka).
  - Confidence: MED — ustawienia produkcji nie były sprawdzane.
  - Blind spot: Obsługa plus-adresów w domenie użytkownika.
- **Fix B**: Gdy false, ograniczyć 3.3 do 401 bez sesji; przepływ dowodzi lokalny smoke.
  - Strength: Zero zapisów na produkcji.
  - Tradeoff: Brak dowodu end-to-end na produkcji.
  - Confidence: HIGH — niezależne od konfiguracji auth.
  - Blind spot: None significant
- **Decision**: FIXED (Fix A)

### F2 — Sprawdzenia nieobecności w smoke'u są kruche

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2 §5 („deleted profile is not on the list”), Phase 1 §2 (kroki `search_caregivers`)
- **Detail**: Sprawdzenie po stałej nazwie „Ewa Smoke” pada trwale po przerwanym przebiegu (lokalna baza zbiera profile ze wszystkich przebiegów). Kroki `search_caregivers` fazy 1 bez `p_limit` (domyślnie 20), istniejące kroki używają `p_limit: 50`.
- **Fix**: Nieobecność na liście po `/opiekunowie/${appDeletableCaregiverId}`; `p_limit: 50` w obu krokach fazy 1.
- **Decision**: FIXED

### F3 — Brief przypisuje check-table-grants.sql zadanie, którego nie wykonuje

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: plan-brief.md — Phases at a Glance, faza 1
- **Detail**: Skrypt sprawdza tylko TRUNCATE/REFERENCES/TRIGGER; DELETE dla anon wyłapuje krok smoke i ręczne 1.6.
- **Fix**: Poprawić opis ryzyka w briefie.
- **Decision**: FIXED
