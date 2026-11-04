<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Wyniki uszeregowane według dopasowania (S-05)

- **Plan**: context/changes/ranked-match-results/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-11-04
- **Verdict**: APPROVED
- **Findings**: 0 critical, 2 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | WARNING |

Notes:
- Plan Adherence: every Contract item in phases 1–3 is MATCH (migration, smoke, `types.ts`, service, page, README, change.md Notes). The only drift is F4, which the app cannot trigger. Measuring CPU with `wrangler tail --format json` instead of the dashboard reads the same data, and the method is written in change.md.
- Scope Discipline: the extras are harmless. Smoke drops `allServiceSlugs`, whose last user was the rewritten hint step, and `toRankedCaregiver` re-maps `missing_services` to `{slug, label}`. Nothing in "What We're NOT Doing" is violated.
- Safety & Quality (security part): both RPCs are `security invoker` with `search_path = ''`, never read `caregiver_contacts`, and have EXECUTE revoked from `public` and granted to `anon, authenticated` (migration :267-271). The `p_limit`/`p_offset` clamps are unchanged. No `set:html`. The page handles a `null` client.
- Pattern Consistency: the changes follow the repo's conventions. Two trivial items are not findings: `countCaregivers` is still exported but used only inside the module, and `RelaxedCaregiverCounts` has no `*Dto` suffix.
- Success Criteria (re-run 2026-11-04): `npx supabase db reset` (all migrations including 20261104140000), `npx supabase db lint --level error` (no errors), `check-table-grants.sql` (`DO`, no exception), `npm run lint`, `npx astro check` (0 errors), `npm run build` and `npm run smoke` on a fresh preview after the reset (all steps PASS) all pass. Every Manual row has a commit SHA. Phase 3 is ops-only.

## Findings

### F1 — Błąd RPC podpowiedzi zastępuje poprawny pusty wynik ogólnym błędem strony

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/opiekunowie/index.astro:59-60
- **Detail**: `countRelaxedCaregivers()` działa w tym samym `try` co cała strona (`:40-83`). Jeśli RPC podpowiedzi zawiedzie, koordynator zamiast poprawnego „Wyniki: 0” z chipami filtrów widzi „Nie udało się wczytać listy opiekunów…”. Tak samo było przed zmianą (`Promise.all(countCaregivers…)` w tym samym `try`), więc to nie regresja. Teraz jednak podpowiedzi zależą od nowej funkcji, która nie istnieje przy złej kolejności wdrożenia (Worker przed migracją) albo przy rollbacku samej bazy. Podpowiedź jest opcjonalna, a lista nie.
- **Fix**: Owinąć wywołanie `countRelaxedCaregivers()` i budowę `hints` własnym `try/catch`, który loguje błąd (`console.error`) i zostawia `hints` puste, a `withoutServices`/`withoutGmina` równe `null`. Pusty wynik renderuje się wtedy bez linków podpowiedzi.
- **Decision**: FIXED

### F2 — Krok 3.3 odhaczony, choć wierszy dopasowania nie widziano na produkcji

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: context/changes/ranked-match-results/plan.md:345
- **Detail**: Kryterium 3.3 brzmi „z usługami lub terminami karty pokazują braki albo »Pełne dopasowanie«”. Produkcja ma 0 profili, więc nie wyrenderowała żadnej karty. Notes uczciwie opisują tę lukę (`change.md:22`, „Zweryfikowane tylko lokalnie”), ale wiersz Progress jest `[x]` bez zastrzeżenia. Przyszły `/10x-status` albo archiwum odczyta go jako pełną weryfikację produkcyjną.
- **Fix**: Dopisać do wiersza 3.3 w Progress „(wiersze dopasowania tylko lokalnie — change.md Notes)” i dodać sprawdzenie kart do warunku ponownego pomiaru CPU („gdy któraś gmina ma ≥ 20 kompletnych profili”) w `change.md`.
- **Decision**: FIXED

### F3 — Stany pustego wyniku: nota rankingu nad „0” i brak komunikatu dla samych terminów

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/opiekunowie/index.astro:86, :214-218
- **Detail**: (a) „Najpierw opiekunowie pokrywający najwięcej wybranych usług, potem terminów.” renderuje się przy `isRanked`, także gdy `total === 0`, czyli nad ramką „Żaden opiekun nie spełnia…”. (b) Z samymi terminami (`?termin=…`) terminy nikogo nie ukrywają, więc `total === 0` oznacza brak jakichkolwiek kompletnych profili. Mimo to `hasFilters` liczy dostępność, więc strona pokazuje „Żaden opiekun nie spełnia wybranych warunków.” bez żadnej podpowiedzi zamiast „Nie ma jeszcze opiekunów z uzupełnionym profilem.” Dziś dotyczy to produkcji (0 profili), a przed zmianą ten przypadek obsługiwała podpowiedź „Usuń filtr dostępności”.
- **Fix**: Notę rankingu warunkować przez `isRanked && caregivers.length > 0`. Do wyboru komunikatu pustego wyniku liczyć tylko filtry zawężające (`filter.teryt !== null || filter.services.length > 0`).
- **Decision**: FIXED

### F4 — Pusty string i nieznany slug liczą się w SQL jako „wybrana usługa”

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: supabase/migrations/20261104140000_ranked_caregiver_search.sql:79-88, :240-245
- **Detail**: Plan mówi „różne, **niepuste** wpisy”. `wanted_services`/`wanted_slots` odrzucają tylko `null`, a `count_caregivers_relaxed` sprawdza tylko `is not null`. `p_services = '{""}'` albo sam nieznany slug ukrywa więc wszystkich (próg ≥1) i daje niepuste `without_services`. Aplikacja tego nie wyśle, bo `parseCaregiverSearch` zostawia tylko slugi ze słownika, a terminy przechodzą przez `isAvailabilitySlot`. Bezpośredni wywołujący RPC ukryje wyniki tylko sobie, więc nie ma wpływu na bezpieczeństwo. SQL zależy jednak od filtrowania w aplikacji, a `missing_services` już je robi przez join ze słownikiem (:187-188).
- **Fix**: Przy następnej migracji dotykającej `search_caregivers()` złączyć `wanted_services` z `public.services` (i `w.slot <> ''` dla terminów), tak samo w `count_caregivers_relaxed`. Nie warto robić osobnej migracji tylko dla tej poprawki.
- **Decision**: FIXED — at the user's choice, a separate migration right away: `supabase/migrations/20261104150000_search_ignores_unknown_selections.sql` (`create or replace`, `wanted_services` joined with `public.services`, `w.slot <> ''`, the same in `count_caregivers_relaxed`). Tested locally with `migration up`, `db lint` and direct RPC calls. **Not yet on production** (requires `npx supabase db push` with the user's consent; no Worker change needed).

### F5 — `data[0]` bez zabezpieczenia w `countRelaxedCaregivers`

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/caregiver.service.ts:266-268
- **Detail**: `const row = data[0]` zakłada dokładnie jeden wiersz. SQL to gwarantuje (select bez FROM), ale pusta tablica albo `data === null` dałyby `TypeError` bez nazwanego komunikatu. Inne funkcje serwisu rzucają czytelne „Failed to …”.
- **Fix**: `if (!row) throw new Error("Failed to count relaxed caregivers: no row returned");`.
- **Decision**: FIXED

## Triage

- **Fixed**: F1, F2, F3, F4 (new migration `20261104150000_search_ignores_unknown_selections.sql`), F5
- **Verification after the fixes** (2026-11-04): `npx supabase migration up --local`, `npx supabase db lint --level error`, `check-table-grants.sql`, `npm run lint`, `npx astro check` (0 errors), `npm run build`, `npm run smoke` on a fresh preview (all steps PASS); direct RPC calls with `'{""}'`, `'{nieznana}'` and `'{""}'` for slots behave as if nothing were selected.
- **Remaining for production**: `follow-ups/review-fixes.md` (db push of the new migration, Worker deploy, re-check of the cards on production).
