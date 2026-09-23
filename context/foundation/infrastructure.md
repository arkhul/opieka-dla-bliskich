---
project: opieka-dla-bliskich
researched_at: 2026-09-23
recommended_platform: Cloudflare Workers
runner_up: Vercel
context_type: mvp
tech_stack:
  language: TypeScript
  framework: Astro 7.3 (SSR, output "server") + React 19 islands
  runtime: Cloudflare Workers (workerd, nodejs_compat) via @astrojs/cloudflare 14.3.1
---

## Recommendation

**Deploy on Cloudflare Workers (Worker with static assets, not Cloudflare Pages).**

Cloudflare is the only platform with a Pass on all five agent-friendly criteria. It is also where the project already points: `@astrojs/cloudflare` 14.3.1, `wrangler.jsonc` with the `ASSETS` binding, `astro:env` secrets and `.dev.vars` are all set up for it. Choosing it costs no migration, while every alternative requires an adapter swap and a rewrite of the three-place secrets rule in AGENTS.md. The interview answers set the weights:
- **Request/response only:** no persistent-process filter applies, so serverless platforms stay in.
- **DX over cost:** Cloudflare's cost advantage was not counted. The $5 Paid plan is treated as acceptable.
- **Single region (Poland) and external Supabase:** the edge advantage is neutral. What matters is short Warsaw-edge → Supabase Frankfurt round trips, which Cloudflare provides without configuration.

> Correction to `tech-stack.md`: its hint `deployment_target: cloudflare-pages` is outdated for this stack. Adapter v14 deploys only as a Worker with static assets. Cloudflare's own Pages docs say "Start new projects with Workers", and third-party sources describe Pages as being in maintenance mode. Use `wrangler deploy`, never `wrangler pages deploy`.

## Platform Comparison

Research date: 2026-09-23. Sources: official docs, pricing pages and changelogs, fetched live. Pass/Partial/Fail scored against `.claude/skills/10x-infra-research/references/agent-friendly-criteria.md`.

| Platform | CLI-first | Managed/Serverless | Agent-readable docs | Stable deploy API | MCP / Integration | Total |
|---|---|---|---|---|---|---|
| Cloudflare Workers | Pass | Pass | Pass | Pass | Pass | **5 Pass** |
| Vercel | Pass | Pass | Pass | Pass | Partial | 4 Pass, 1 Partial (light-weight criterion) |
| Netlify | Partial | Pass | Pass | Pass | Pass | 4 Pass, 1 Partial (heavy-weight criterion) |
| Render | Partial | Pass | Pass | Pass | Pass | 4 Pass, 1 Partial (heavy-weight criterion) |
| Railway | Partial | Partial | Pass | Pass | Pass | 3 Pass, 2 Partial |
| Fly.io | Pass | Partial | Partial | Pass | Partial | 2 Pass, 3 Partial |

Hard filters: none eliminated. No persistent connections are needed (interview answer), and every platform runs TypeScript/Node.

**Cloudflare Workers.**
- **CLI:** `wrangler` covers the whole loop: `deploy`, `versions upload`/`versions deploy` for gradual rollouts, `rollback`, `tail` and `secret put`.
- **Runtime:** workerd with `nodejs_compat`.
- **Docs:** root `llms.txt` with an `llms.txt` per product, pages served as markdown (`/index.md`), MDX source in `cloudflare/cloudflare-docs`.
- **MCP:** managed servers for the API, docs, bindings, builds and observability, none labelled beta.
- **Cost:** Free covers 100k requests/day but caps CPU at 10 ms per request. Paid is $5/mo with a 30 s default CPU limit (max 5 min).
- **Services:** D1, KV, R2, Queues, Hyperdrive and Cron Triggers are available, but none are needed because Supabase stays.

**Vercel.**
- **CLI:** the `vercel` CLI is strong: `--prod`, `rollback`, `promote`, and `logs --json`.
- **Docs:** `llms.txt` plus `.md` pages, but the docs source is not on GitHub.
- **MCP:** official, but still **public beta** (label checked 2026-09-15). This is the only Partial, and it is on the light-weight criterion.
- **Practical gaps:**
  - Hobby is non-commercial only, so the realistic plan is Pro at $20/mo.
  - On Hobby, rollback goes back only to the previous production deployment.
  - `logs --follow` streams for at most 5 minutes.
  - Functions default to `iad1` (US East); you must set `"regions": ["fra1"]` in `vercel.json`.
  - Needs `@astrojs/vercel` 11.0.11 (compatible with Astro 7).

**Netlify.**
- **CLI:** deploy and logs work well from the CLI, but rollback has no dedicated command. It goes through `netlify api restoreSiteDeploy`, hence Partial on CLI-first.
- **MCP:** GA.
- **Preview deploys:** automatically get `X-Robots-Tag: noindex`.
- **Gaps:**
  - Functions default to Ohio. Frankfurt is available only on Pro ($20), and on this adapter only through the UI.
  - The Free plan has a hard credit cap that pauses the site.
  - `cacheOnDemandPages` must stay off, because it would CDN-cache the contact-data pages.

**Render.**
- **MCP:** GA hosted server.
- **Docs:** `llms.txt` plus markdown pages.
- **Region:** Frankfurt is available.
- **Cost:** Starter is $7/mo and is always on. The free tier sleeps after 15 min and takes about a minute to wake.
- **CLI:** no rollback command (Partial). An API rollback leaves autodeploy on, so the next commit can redeploy the bad code.
- **Migration:** requires `@astrojs/node` plus `HOST=0.0.0.0`.
- **PR previews:** full-stack preview environments need Pro ($25 workspace).

**Railway.**
- **Docs:** excellent, with `llms.txt`, `.md` pages and a public GitHub repo.
- **MCP:** official, bundled in the CLI (GA).
- **Rollback:** dashboard or GraphQL only, and only within 72 h on Hobby.
- **Serverless sleep:** can return a 502 on wake-up.
- **Stability:** a platform-wide outage of about 8 h on 2026-05-19.
- **Migration:** a container-based Node service is a step away from the current serverless model.

**Fly.io.**
- **Region:** the Warsaw region was removed in the September 2025 region consolidation.
- **Operations:** a Dockerfile and machine lifecycle to maintain.
- **Docs:** `llms.txt` only links to HTML pages.
- **MCP:** `fly mcp server` is experimental and has no read-only mode.
- **Rollback:** a manual redeploy of an old image.
- **Verdict:** a strong fit for persistent workloads, which this MVP does not have.

### Shortlisted Platforms

#### 1. Cloudflare Workers (Recommended)

Only perfect score, zero migration cost, lowest operational surface: no containers, no region to configure, TLS and routing handled.
- **Operating it:** deploy, rollback and log tailing are each a single `wrangler` command. Official MCP servers give an agent structured access to builds and observability.
- **Latency:** Polish users hit nearby edge locations. supabase-js talks HTTPS, so there is no connection-pool problem, and the edge → Frankfurt round trip is roughly 15–25 ms (estimate).
- **Cost:** $0 on Free, or $5/mo on Paid, which removes the 10 ms CPU cap.

#### 2. Vercel

Best DX outside Cloudflare, with mature rollback and promote semantics.
- **Gap versus Cloudflare:**
  - an adapter switch (`@astrojs/vercel`) and a rewritten secrets rule;
  - a realistic $20/mo, because Hobby excludes commercial use;
  - the region must be pinned to `fra1` by hand;
  - the MCP server is still beta.
- **When to choose it instead:** if the Workers runtime limits (CPU, Node compat) ever block a needed library, this is the fallback. Full Node.js with Fluid compute is GA.

#### 3. Netlify

GA MCP, automatic `noindex` on deploy previews, and a serverless model close to the current architecture.
- **Gap versus Cloudflare:**
  - an adapter switch;
  - the Frankfurt region needs Pro ($20), otherwise every Supabase call crosses the Atlantic;
  - rollback only via `netlify api`;
  - Free-plan credit exhaustion pauses the site.

Render was a close fourth. It tied on the criteria, and the tie went to Netlify because Netlify keeps the serverless model and Render needs a Node server migration.

## Anti-Bias Cross-Check: Cloudflare Workers

### Devil's Advocate — Weaknesses

1. **10 ms CPU cap per request on the Free plan.** SSR of the ranked, filtered caregiver list plus React island rendering can exceed it as the catalog grows. The failure is error 1102 for the coordinator, and it does not reproduce locally.
2. **Hidden KV session binding.** `@astrojs/cloudflare` 14.3.1 enables Astro sessions on a `SESSION` KV binding unless `astro.config.mjs` sets `session: false`. This is verified in `node_modules/@astrojs/cloudflare/dist/index.js`. The project does not use Astro sessions, because Supabase keeps its session in cookies. Yet the binding brings KV Free's 1,000 writes/day cap and a known deploy-conflict error (withastro/astro#15802).
3. **Version preview URLs are public and share production secrets.** Secrets are per Worker, not per version, so a preview talks to the production Supabase project. `wrangler tail` and Workers Logs do not capture preview traffic.
4. **Partial Node compatibility.** `child_process`, `vm`, `worker_threads` and `http2` are stubs. An npm dependency that uses them builds fine and fails only at runtime.
5. **Short log retention on Free.** Workers Logs keeps 200k events/day for 3 days on Free (7 days on Paid). An intermittent CPU-limit error can age out before anyone looks.

### Pre-Mortem — How This Could Fail

The team deployed Astro 7 on Cloudflare Workers, assuming "edge means fast and free."
1. **Wrong deploy target.** The agent read `deployment_target: cloudflare-pages` in `tech-stack.md` and wrote `wrangler pages deploy` scripts and Pages-oriented docs. Adapter v14 no longer targets Pages, and two days went into untangling that.
2. **CPU cap.** After launch the catalog grew to several hundred profiles. Ranking computed inside the Worker began exceeding 10 ms of CPU on the Free plan, and some coordinators saw error pages. Nobody noticed, because Free logs live for three days and no one was reading them.
3. **Session KV.** The adapter had silently enabled KV-backed sessions. On the day of a local Facebook-group promotion, the 1,000 writes/day cap ran out.
4. **Preview data.** A developer tested a feature on a version preview URL, which used production secrets. Test caregiver profiles appeared to real coordinators.
5. **Rollback.** Finally, a `wrangler rollback` reverted the code but not the Supabase migration shipped with it, and the old version crashed against the new schema.

Every cause was known and cheap to prevent. None was written down.

### Unknown Unknowns

- **Pages is not the target anymore.** Adapter 14.x builds a Worker with static assets. The correct commands are `wrangler deploy`, `wrangler versions ...` and `wrangler rollback`, not `wrangler pages ...`.
- **`astro dev` already runs on workerd** through the Cloudflare Vite plugin in adapter 14.x and reads `.dev.vars`. A separate `wrangler dev` is redundant for local development, and `Astro.locals.runtime` has been removed. Keep using `astro:env/server` (as `src/lib/supabase.ts` does) or `import { env } from "cloudflare:workers"`.
- **`wrangler secret put` deploys immediately.** It creates a new deployment from the current version. To stage a secret with a new version instead, use `wrangler versions secret put`.
- **Rollback reverts code only.**
  - Supabase migrations and data stay as they are.
  - `wrangler versions list` / `deployments list` show only the last 10 entries.
- **The `*.workers.dev` hostname is public and indexable** unless you disable it or add `X-Robots-Tag: noindex`. This matters for the PRD guardrail that contact data must stay out of search engines, even though contact data already sits behind login.
- **`compatibility_date` is 2026-05-08.** That is before the 2026-08-04 date that turns on `nodejs_compat` by default, so the explicit flag in `wrangler.jsonc` must stay.

## Operational Story

- **Preview deploys**:
  - Command: `npx wrangler versions upload --preview-alias <branch>`. This uploads without promoting and returns a `<alias>-<worker>.<subdomain>.workers.dev` URL (GA).
  - The URL is public unless Cloudflare Access is put in front of it, and it exists only on workers.dev.
  - It uses the production secrets and Supabase project. Until a separate staging Supabase project exists, do not create test data through previews.
  - No preview for fork PRs, because they have no access to the API token.
- **Secrets**:
  - Production: `SUPABASE_URL` and `SUPABASE_KEY` live in Workers Secrets, set with `npx wrangler secret put <NAME>`. Readable only through the dashboard or API by account members.
  - Local: `.dev.vars` for `astro dev` and preview, `.env` for Node tooling.
  - CI: build-time values in GitHub Secrets, as `ci.yml` already does. A deploy job will also need `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` there.
  - Rotation: put the new value with `wrangler secret put`, which deploys immediately, then revoke the old key in Supabase.
  - Every new secret goes in all three places and in `env.schema`, per AGENTS.md.
- **Rollback**:
  - Command: `npx wrangler rollback [version-id]`. It takes effect globally within seconds.
  - Only code and config revert. Supabase migrations do not, so write migrations to be backward-compatible (expand, then contract) so the previous version can still run.
  - The history lists only the last 10 versions or deployments.
- **Approval**:
  - **Requires a human:**
    - production `wrangler deploy` or `versions deploy`
    - `wrangler rollback`
    - `wrangler secret put` and `delete`, and rotating Supabase keys
    - Supabase migrations against the production project
    - DNS and custom-domain changes
    - deleting the Worker or disabling workers.dev
  - **An agent may do these unattended:**
    - `npm run build`
    - `wrangler versions upload` (preview only)
    - `wrangler deployments list`, `versions list` and `tail`
    - read-only MCP observability queries
- **Logs**:
  - Live runtime logs: `npx wrangler tail [--format json] [--status error]`.
  - History: `npx wrangler deployments list`, `npx wrangler versions list` and `npx wrangler deployments status`.
  - Persisted logs: Workers Logs (enabled by `observability.enabled: true`), queried through the Cloudflare observability MCP server.
  - Pipeline logs: GitHub Actions (`gh run view --log`).

## Risk Register

| Risk | Source | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| SSR of ranked list exceeds 10 ms CPU on Free, error 1102 | Devil's advocate | M | H | Start on Workers Paid ($5/mo), or measure CPU time in Workers Logs before launch. Keep filtering and ranking in Postgres, not in the Worker. |
| Adapter's implicit `SESSION` KV binding hits the 1,000 writes/day cap or conflicts on deploy | Devil's advocate / Research finding | M | M | Add `session: false` to `astro.config.mjs`, since the app uses Supabase cookie sessions and not Astro sessions. Confirm no KV binding appears in the build output. |
| Agent uses Cloudflare Pages commands because `tech-stack.md` says `cloudflare-pages` | Pre-mortem / Unknown unknowns | H | M | Treat this file as the source of truth. Update the `deployment_target` hint in `tech-stack.md` to `cloudflare-workers`, and use only `wrangler deploy`/`versions`/`rollback`. |
| Preview version writes test data to the production Supabase project | Devil's advocate / Pre-mortem | M | H | No test writes through previews until a staging Supabase project exists. Longer term, a separate staging Worker (`--env staging`) with its own secrets. |
| `*.workers.dev` or preview URLs get indexed | Unknown unknowns | M | M | Add `X-Robots-Tag: noindex` for non-production hosts in middleware, or disable `workers_dev` once a custom domain is attached. Keep contact data on `PROTECTED_ROUTES` only. |
| Rollback reverts code but not the Supabase schema, and the old version crashes | Pre-mortem / Unknown unknowns | M | H | Expand-then-contract migrations. Deploy the migration and the code separately, and verify that the previous version works on the new schema. |
| An npm dependency relies on a stubbed Node API (`child_process`, `vm`, `worker_threads`) | Devil's advocate | L | M | Run `npm run preview` (workerd) and the smoke test before each deploy. CI already does this. |
| Intermittent errors age out of the 3-day Free log retention | Devil's advocate | M | L | On Paid (7 days), or check `wrangler tail --status error` and Workers Logs weekly. |
| Smart Placement / `placement.region` pinning is **beta** (checked 2026-09-23) | Research finding | L | L | Don't enable it. The edge-to-Frankfurt latency is acceptable without it. |
| Pages status: third-party sources call it "maintenance mode", but Cloudflare has published no deprecation date (checked 2026-09-23) | Research finding | L | L | Not used. The project deploys as a Worker. |

## Getting Started

Checked against the installed versions: Astro 7.3.2, `@astrojs/cloudflare` 14.3.1, wrangler 4.131.1.

1. **Authenticate wrangler:**
   - Locally: `npx wrangler login`, then check with `npx wrangler whoami`.
   - For CI later: create an API token with the "Edit Cloudflare Workers" template.
2. **Prepare the config:**
   - Rename `"name": "10x-astro-starter"` to `"opieka-dla-bliskich"` in `wrangler.jsonc`. The Worker name becomes part of the workers.dev URL.
   - Add `session: false` to `astro.config.mjs` so the adapter stops provisioning a `SESSION` KV binding.
3. **Set production secrets:** `npx wrangler secret put SUPABASE_URL` and `npx wrangler secret put SUPABASE_KEY`. Enter them once the Worker exists: the first `wrangler deploy` creates it, or use `wrangler secret put` on first deploy.
4. **Build and deploy:** `npm run build`, then `npx wrangler deploy`. The build writes a redirected config into `dist/`, and wrangler picks it up from the project root.
5. **Verify:**
   - Open the workers.dev URL and run `BASE_URL=<url> npm run smoke`.
   - Watch `npx wrangler tail`.
   - Confirm with `npx wrangler deployments list`.
   - Then decide on Workers Paid ($5) based on the CPU times observed in Workers Logs.

## Out of Scope

The following were not evaluated in this research:
- Docker image configuration
- CI/CD pipeline setup (the auto-deploy-on-merge job with `CLOUDFLARE_API_TOKEN` is a follow-up)
- Production-scale architecture (multi-region, HA, DR)
