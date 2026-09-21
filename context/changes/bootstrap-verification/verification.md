---
bootstrapped_at: 2026-09-21T16:49:26Z
starter_id: 10x-astro-starter
starter_name: "10x Astro Starter (Astro + Supabase + Cloudflare)"
project_name: opieka-dla-bliskich
language_family: js
package_manager: npm
cwd_strategy: git-clone
bootstrapper_confidence: first-class
phase_3_status: ok
audit_command: "npm audit --json"
---

## Hand-off

Verbatim copy of `context/foundation/tech-stack.md`.

Frontmatter:

```yaml
starter_id: 10x-astro-starter
package_manager: npm
project_name: opieka-dla-bliskich
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-pages
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: false
  has_background_jobs: false
```

Body — `## Why this stack`:

> Solo praca po godzinach, 3 tygodnie do MVP i katalog profili opiekunów, w którym logowanie
> jest bramką do danych kontaktowych — to zestaw, przy którym liczy się starter dający auth,
> bazę i wdrożenie od razu, zamiast tygodnia na sklejanie ich samodzielnie. 10x Astro Starter
> jest rekomendowanym wyborem dla aplikacji webowej w JS/TS i przechodzi wszystkie cztery
> bramki jakości: TypeScript i Zod dają jawne kontrakty, układ katalogów i routing są
> konwencjonalne, stos jest szeroko obecny w danych treningowych i ma aktualną dokumentację.
> Supabase pokrywa konta obu ról, profile opiekunów oraz filtrowanie po gminie, usłudze i
> dostępności po stronie Postgresa, a RLS jest właściwym miejscem na regułę, że dane kontaktowe
> widzi wyłącznie osoba zalogowana. Płatności, realtime i AI są poza zakresem zgodnie z
> Non-Goals PRD. Powiadomienia o nowym profilu (FR-015) zostały oznaczone jako nice-to-have i
> nie są tu uwzględnione — runtime brzegowy Cloudflare ogranicza długo działające zadania, więc
> przy ich wdrażaniu potrzebny będzie osobny worker lub kolejka. Wdrożenie na Cloudflare Pages,
> CI na GitHub Actions z automatycznym wdrożeniem po scaleniu.

## Pre-scaffold verification

| Signal      | Value                                                           | Severity | Notes                                                                                     |
| ----------- | --------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------- |
| npm package | not run                                                          | n/a      | `cmd_template` starts with `git clone`; no `create-*` package name derivable               |
| GitHub repo | przeprogramowani/10x-astro-starter last pushed 2026-09-12T21:16:08Z | fresh    | from `card.docs_url`; `gh` CLI not installed on this machine, read via public GitHub REST API instead |

Severity threshold applied: fresh = within 3 months of 2026-09-21 (9 days elapsed).

## Scaffold log

**Resolved invocation**: `git clone https://github.com/przeprogramowani/10x-astro-starter .bootstrap-scaffold && cd .bootstrap-scaffold && npm install`
**Strategy**: git-clone
**Exit code**: 0
**Files moved**: 21 top-level entries (8 directories, 13 files) — 30 826 files in total, of which 30 781 are under `node_modules/`
**Conflicts (.scaffold siblings)**: `CLAUDE.md.scaffold`
**.gitignore handling**: moved silently (no `.gitignore` existed in cwd, so no append-merge was needed)
**.bootstrap-scaffold cleanup**: deleted (upstream `.git/` removed before the move-up, so the starter's history did not leak into this project)

File-by-file move log:

```
MOVED    .github/  (1 files)
MOVED    .husky/  (1 files)
MOVED    .vscode/  (3 files)
MOVED    node_modules/  (30781 files)
MOVED    public/  (3 files)
MOVED    scripts/  (1 files)
MOVED    src/  (26 files)
MOVED    supabase/  (2 files)
MOVED    .env.example
MOVED    .gitignore
MOVED    .nvmrc
MOVED    .prettierrc.json
MOVED    AGENTS.md
MOVED    astro.config.mjs
CONFLICT CLAUDE.md -> CLAUDE.md.scaffold
MOVED    components.json
MOVED    eslint.config.js
MOVED    package-lock.json
MOVED    package.json
MOVED    README.md
MOVED    tsconfig.json
MOVED    wrangler.jsonc
```

`context/` was preserved verbatim — the scaffold shipped no `context/` payload, so nothing had to be dropped.

Note: `AGENTS.md` and `CLAUDE.md` came from the starter repository itself, not from bootstrapper. v1 does not generate either file; `AGENTS.md` moved in because cwd had none, and the existing `CLAUDE.md` won its conflict, leaving the starter's copy as `CLAUDE.md.scaffold`.

**Toolchain warning captured during install** (non-blocking, exit code was 0): local Node is v20.19.1 / npm 10.8.2, while the starter's dependency tree declares `node >=22` (`astro@7.3.2` requires `>=22.12.0`, the Supabase and Cloudflare packages require `>=22.0.0`). npm emitted `EBADENGINE` warnings for 20 packages and installed anyway. The repo ships an `.nvmrc`; switching to Node 22 before running `npm run dev` is the expected fix.

> **Resolved 2026-09-21, after this run.** The warning was not cosmetic — `npx astro --version` under Node 20 returned `Node.js v20.19.1 is not supported by Astro!`, so `dev`/`build`/`preview` were all blocked. Node was upgraded to v22.23.2 (official MSI from nodejs.org, SHA256 verified against `SHASUMS256.txt`, installed over the existing v20.19.1). `.nvmrc` was bumped from `22.14.0` to `22.23.2`, because `22.14.0` sits below `astro-eslint-parser`'s `^22.22.3` floor and would have kept emitting `EBADENGINE`. Post-upgrade state: `npm install` → 0 `EBADENGINE` warnings, `npx astro --version` → `astro v7.3.2`, `npm run build` → exit 0. Note the 22 line was chosen over the current LTS (v24.21.0) to match `.github/workflows/ci.yml`, which pins `node-version: 22`.

## Post-scaffold audit

**Tool**: `npm audit --json`
**Exit code**: 0
**Summary**: 0 CRITICAL, 0 HIGH, 0 MODERATE, 0 LOW
**Direct vs transitive**: no findings to split. This npm version (10.8.2) reported `metadata.dependencies` as prod 377 / dev 269 / optional 167 / total 804 without a `direct` count.

Raw `metadata` block:

```json
{
  "vulnerabilities": {
    "info": 0,
    "low": 0,
    "moderate": 0,
    "high": 0,
    "critical": 0,
    "total": 0
  },
  "dependencies": {
    "prod": 377,
    "dev": 269,
    "optional": 167,
    "peer": 0,
    "peerOptional": 0,
    "total": 804
  }
}
```

The `vulnerabilities` advisory map was empty (`[]`).

#### CRITICAL findings

None.

#### HIGH findings

None.

#### MODERATE findings

None.

#### LOW / INFO findings

None.

## Hints recorded but not acted on

| Hint                    | Value                    |
| ----------------------- | ------------------------ |
| bootstrapper_confidence | first-class              |
| quality_override        | false                    |
| path_taken              | standard                 |
| self_check_answers      | null                     |
| team_size               | solo                     |
| deployment_target       | cloudflare-pages         |
| ci_provider             | github-actions           |
| ci_default_flow         | auto-deploy-on-merge     |
| has_auth                | true                     |
| has_payments            | false                    |
| has_realtime            | false                    |
| has_ai                  | false                    |
| has_background_jobs     | false                    |

v1 surfaced these values in conversation and recorded them here, but took no automated action on any of them. In particular: no CI workflow was generated for `github-actions` / `auto-deploy-on-merge`, no deployment configuration was tailored for `cloudflare-pages` beyond what the starter ships (`wrangler.jsonc`, `@astrojs/cloudflare`), and `has_auth: true` did not change the scaffold — Supabase auth is part of the starter regardless.

## Next steps

Next: a future skill will set up agent context (CLAUDE.md, AGENTS.md). For now, your project is scaffolded and verified — happy hacking.

Useful manual steps in the meantime:
- `git init` (if you have not already) to start your own repo history.
- Review any `.scaffold` siblings the conflict policy created and decide which version of each file to keep — here that is `CLAUDE.md.scaffold` (`diff CLAUDE.md CLAUDE.md.scaffold`).
- ~~Switch to Node 22 before running the dev server.~~ Done on 2026-09-21 — Node v22.23.2 is installed and `npm run build` passes. See the resolution note in `## Scaffold log`.
- Run `npx astro sync` after a fresh checkout. Without the generated `.astro/types.d.ts`, `astro:env/server` and `astro:middleware` do not resolve and `npm run lint` reports 20 spurious `@typescript-eslint/no-unsafe-*` errors. Running sync clears all 20.
- ~~Normalise line endings.~~ Done on 2026-09-21. The Windows clone checked the tree out with CRLF, so `npm run lint` reported 1086 `prettier/prettier` "Delete `␍`" errors. Fixed by `npm run format`; `.gitattributes` (`* text=auto eol=lf`) now stops it recurring on the next clone. A `.prettierignore` was added alongside it, because `prettier --write .` otherwise reaches `context/`, the CLI-managed `CLAUDE.md`, and the `.claude/` + `.agents/` skill definitions — none of which may be reformatted. `npm run lint` is now clean.
- Copy `.env.example` to `.env` and fill in the Supabase and Cloudflare values.
- Address audit findings per your project's risk tolerance — the full breakdown is in this log (this run: none).
