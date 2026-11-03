<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Odsłonięcie kontaktu opiekuna po zalogowaniu

- **Plan**: context/changes/contact-reveal-after-signin/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-11-03
- **Verdict**: REJECTED
- **Findings**: 1 critical 0 warnings 0 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | FAIL |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Verification run

- `npm run lint` — exit 0
- `npx astro check` — 0 errors, 0 warnings, 0 hints (62 files)
- `npm run build` — exit 0
- `npx supabase db lint --level error` — No schema errors found
- `npm run smoke` (fresh build, restarted preview on :4321) — all steps passed, including the new RLS, `next`, public-profile and contact-page steps
- Manual rows 1.5, 2.5, 2.6, 3.5–3.7 are ticked in Progress; no contradicting evidence in the diff
- All 22 changed files match the plan's file list; no EXTRA or MISSING files

## Findings

### F1 — Open redirect: `safeNextPath` lets `/.//host` through as `//host`

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/redirect.ts:23-37
- **Detail**: The helper rejects `//…` and `/\…` on the raw input, then returns `pathname + search` of the WHATWG-normalized URL. Dot segments are collapsed during normalization, so `/.//evil.example`, `/a/..//evil.example` and `/%2e//evil.example` all pass the checks (origin stays `http://app.invalid`) and come out as `//evil.example`. The plan's own contract says "żaden cel zewnętrzny" and names `//…` as rejected. Reproduced on the running build: `GET /auth/signin?next=/.//evil.example` renders `<input name="next" value="//evil.example">` and a sign-up link with `next=%2F%2Fevil.example`; `POST /api/auth/signin` with that `next` keeps `next=%2F%2Fevil.example` on the error redirect. After a successful sign-in, `context.redirect("//evil.example")` sends a `Location: //evil.example` header, which browsers resolve to `https://evil.example`. Sign-up (coordinators) is affected the same way. A phishing link on the real domain therefore ends on an attacker's page right after the user types a valid password. The smoke steps only cover `//evil.example`, `/\evil.example` and `https://evil.example`, so CI stays green.
- **Fix**: In `safeNextPath`, validate the normalized result, not just the input: after `const target = pathname + search`, return `null` if `target.startsWith("//")` or `target.startsWith("/\\")`. Add smoke steps for `/.//evil.example` (signin ignores external next, expect `/profil` exact).
- **Decision**: FIXED — Fix now (target re-checked after normalization in `safeNextPath`; smoke step "signin ignores external next (dot segments)" added; lint, build and smoke green)
