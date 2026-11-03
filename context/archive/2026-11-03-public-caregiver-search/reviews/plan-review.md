<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Publiczna lista opiekunów z filtrami gminy i usługi

- **Plan**: context/changes/public-caregiver-search/plan.md
- **Mode**: Deep (weryfikacja kodu wykonana bezpośrednio, bez sub-agenta)
- **Date**: 2026-11-03
- **Verdict**: REVISE → SOUND (po triage: wszystkie 4 ustalenia poprawione w planie)
- **Findings**: 1 critical, 1 warning, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | FAIL |

## Grounding
Grounding: 11/11 paths ✓, 8/8 symbols ✓, brief↔plan ✓ (poza ryzykiem fazy 1 — zob. F2)

## Findings

### F1 — Strona poza zakresem pokazuje pusty stan zamiast „Nie ma takiej strony”

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Faza 2 — §2 Serwisy (`searchCaregivers`) vs Critical Implementation Details (UX spec) i §5 Puste stany
- **Detail**: `search_caregivers()` przy braku wierszy nie zwraca `total_count` (Faza 1, „serwis traktuje jako 0 tylko przy offset = 0”), ale kontrakt `searchCaregivers` mówi „`total` … 0 gdy brak wierszy” bez wyjątku dla `page > 1`. Dla `?strona=999` (albo `?strona=2` przy ≤ 20 wynikach) strona dostaje `total = 0`, więc nigdy nie spełni warunku „page poza zakresem przy `total > 0`” — zamiast „Nie ma takiej strony wyników.” pokaże „Nie ma jeszcze opiekunów…” albo podpowiedzi filtrów. Krok ręczny 4 nie przejdzie, a smoke tego nie sprawdza (jest tylko `strona=-1`).
- **Fix**: W kontrakcie `searchCaregivers` dopisać: brak wierszy przy `page > 1` ⇒ `total` z `countCaregivers(filter)` (jedno dodatkowe RPC tylko na stronach poza zakresem); dodać krok smoke „caregiver list reports page out of range” — `?gmina=1465011&strona=999`: 200, HTML zawiera „Nie ma takiej strony wyników”.
- **Decision**: FIXED (Fix in plan)

### F2 — Smoke nie dowodzi `total_count` przed limitem ani braku e-maila kontaktowego

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Faza 1 — §2 Smoke („search reports total count”); Faza 2 — §7 Smoke; plan-brief „Phases at a Glance”
- **Detail**: Brief twierdzi, że „`total_count` liczony po limicie … smoke to wyłapuje”. W CI (`supabase start` na czystej bazie, `.github/workflows/ci.yml`) istnieje dokładnie jeden kompletny profil, więc przy `p_limit: 1` zarówno poprawny `count(*) over ()` w CTE, jak i liczenie po limicie dają 1 — asercja `total_count >= 1` przechodzi w obu przypadkach. Podobnie „brak e-maila”: `completeProfile.email` to `""` (`scripts/smoke.mjs`), więc kontaktowego e-maila nie ma w bazie i sprawdzenie HTML/RPC pod jego kątem jest puste; sprawdzany jest tylko login opiekuna.
- **Fix A ⭐ Recommended**: Drugi kompletny opiekun w smoke + kontaktowy e-mail w profilu
  - Strength: CI faktycznie łapie kluczowe ryzyko fazy 1 i wyciek e-maila; helper `supabase()` z `token` już istnieje, więc to 2–3 kroki (signup przez `/auth/v1/signup` z `data.role = "caregiver"`, `rpc/save_caregiver_profile` z tokenem, potem `p_limit: 1` ⇒ 1 wiersz i `total_count >= 2`). `completeProfile.email = "kontakt-<stamp>@example.com"` i asercja jego braku w RPC i HTML.
  - Tradeoff: Każdy przebieg smoke zakłada trzecie konto w bazie; kilka linii więcej w skrypcie.
  - Confidence: HIGH — wzorzec kroków z tokenem koordynatora już działa w smoke.
  - Blind spot: Signup przez Auth API musi zwrócić `access_token` (wymaga wyłączonego potwierdzania e-maila — to już jest warunek smoke).
- **Fix B**: Zostawić smoke, przenieść dowód do kroku ręcznego 1.5 i poprawić brief
  - Strength: Zero zmian w smoke; lokalna baza ma wiele profili z poprzednich przebiegów, więc porównanie `total_count` (z `p_limit => 1`) z `select count(*)` jest miarodajne.
  - Tradeoff: Ryzyko pilnowane tylko ręcznie, raz; regresja w S-04/S-05 (które ruszą tę funkcję) przejdzie CI.
  - Confidence: MED — zależy od tego, czy ktoś powtórzy krok ręczny przy kolejnych zmianach.
  - Blind spot: Wyciek e-maila kontaktowego nadal niesprawdzony automatycznie.
- **Decision**: FIXED (Fix A)

### F3 — Przyciski `GminaSelect` w natywnym formularzu GET muszą mieć `type="button"`

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Faza 2 — §4 `GminaSelect`
- **Detail**: `GminaSelect` żyje w `<form method="get">`, a nie w formularzu React z `preventDefault`. Przycisk „Usuń gminę” bez `type="button"` wyśle formularz (nawigacja ze starą wartością ukrytego pola) zamiast wyczyścić wybór. `GminaPicker.tsx:124,143` stosuje `type="button"`, ale kontrakt `GminaSelect` tego nie wymaga.
- **Fix**: Dopisać w kontrakcie `GminaSelect`: wszystkie przyciski `type="button"`; wysyłka wyłącznie przyciskiem „Pokaż wyniki”.
- **Decision**: FIXED (Fix in plan)

### F4 — README już opisuje kroki profilu z S-01

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Faza 3 — §3 README i smoke
- **Detail**: Plan zakłada „zaległość z S-01” w opisie smoke, ale `README.md:228` już wymienia API profilu, strony profilu i kroki RLS. Do dopisania są tylko kroki RPC listy i strony listy (oraz `noindex`).
- **Fix**: Zmienić intencję §3 na „dopisać kroki listy (RPC, strona, `noindex`) do istniejącego akapitu `README.md:228`”.
- **Decision**: FIXED (Fix in plan)
