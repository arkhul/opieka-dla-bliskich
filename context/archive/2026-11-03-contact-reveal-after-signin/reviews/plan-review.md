<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Odsłonięcie kontaktu opiekuna po zalogowaniu

- **Plan**: context/changes/contact-reveal-after-signin/plan.md
- **Mode**: Deep
- **Date**: 2026-11-03
- **Verdict**: SOUND
- **Findings**: 0 critical, 1 warning, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

11/11 paths ✓, 8/8 symbols ✓, brief↔plan ✓, Progress↔Phase ✓

Zweryfikowane w kodzie:

- Nie ma rekurencji RLS. `caregiver_profile_missing` jest `security definer`, a żadna tabela nie ma `force row level security`.
- Upsert w `save_caregiver_profile` nadal przechodzi gałąź właściciela w polityce SELECT.
- `signUp` przy istniejącej sesji nadpisuje ciasteczka. Dzieje się to w `@supabase/ssr`: zdarzenie SIGNED_IN wywołuje `applyServerStorage`.
- Asercje smoke ze `startsWith` nadal przechodzą, gdy adres przekierowania ma dopisane `?next=`.
- CI uruchamia smoke na lokalnym Supabase (`supabase start`), ale nie wykonuje `supabase db lint`. Krok 1.2 sprawdza się więc tylko lokalnie.

## Findings

### F1 — Kolejność sesji w smoke dla nowych kroków jest niedookreślona

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 §5, Phase 3 §7 (smoke)
- **Detail**: Smoke ma jeden słoik ciasteczek, przez co plan pomijał trzy rzeczy:
  - (a) Krok „contact page hides contact from caregiver” wymaga sesji Anny. Po „signup sends coordinator home” (smoke.mjs:328) w słoiku jest jednak sesja koordynatora.
  - (b) Smoke nie zapamiętuje `secondCaregiverId`; smoke.mjs:263 bierze tylko token.
  - (c) Kroki logowania z `next` postawione w oknie anonima zepsułyby „profile API requires a session” (401, :326).
- **Fix**: W planie wskazać miejsca kroków:
  - kroki logowania z `next` zaraz po „signin sends caregiver to profile”;
  - kroki anonima między „signout clears session” a „signup sends coordinator home”;
  - krok „signin caregiver again” przed krokiem opiekuna na `/kontakt`;
  - `secondCaregiverId` z `json.user.id`.
- **Decision**: FIXED

### F2 — Pierwszeństwo `next` przed onboardingiem nowego opiekuna

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2 §4 (rejestracja)
- **Detail**: Użytkownik wchodzi z `/kontakt`, zmienia rolę na „opiekun” i zakłada konto. Trafia wtedy na `/kontakt/<id>` z komunikatem „tylko konta koordynatorów” zamiast na `/profil/edycja`. Plan nie rozstrzygał, co ma wtedy pierwszeństwo.
- **Fix**: Nowe konto opiekuna zawsze idzie na `/profil/edycja`. Bez sesji idzie na `/auth/confirm-email` bez `next`. Przy rejestracji `next` dotyczy tylko koordynatora, a przy logowaniu wygrywa dla każdej roli.
- **Decision**: FIXED

### F3 — Masowy odczyt kontaktów jednym zapytaniem REST nie jest nazwany jako ryzyko

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1 §1, What We're NOT Doing, Performance Considerations
- **Detail**: Każdy samodzielnie zarejestrowany koordynator może jednym `GET /rest/v1/caregiver_contacts` bez filtra pobrać wszystkie numery kompletnych profili. PRD (Socratic do FR-012) to akceptuje, ale plan wspominał o tym tylko przy wydajności. Funkcja RPC dla pojedynczego id niewiele by dała, bo można ją wywoływać w pętli po wynikach `search_caregivers`.
- **Fix**: Dopisać przyjęte ryzyko w nagłówku migracji i w „What We're NOT Doing”.
- **Decision**: FIXED

### F4 — Ręczny test 2.5 przejdzie, nawet gdy `next` nie działa

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 Manual Verification (2.5)
- **Detail**: `/profil` jest jednocześnie celem `next` i domyślną trasą opiekuna (signin.ts:24). Powrót na `/profil` niczego więc nie dowodzi.
- **Fix**: W 2.5, w fazie i w Progress, zamienić `/profil` na `/dashboard`.
- **Decision**: FIXED
