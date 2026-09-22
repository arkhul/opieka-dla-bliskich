# Repository Guidelines

"Opieka dla bliskich" is a caregiver directory web app (PRD: @context/foundation/prd.md) built on the 10x Astro Starter: Astro 7 SSR on Cloudflare Workers, React 19 islands, Tailwind 4, shadcn/ui and Supabase Auth.

## Hard Rules

- `createClient()` in `src/lib/supabase.ts` returns `null` when Supabase env vars are missing. Every caller must handle `null` (pattern: `src/pages/api/auth/signin.ts`).
- Contact data of both caregivers and coordinators (phone, email, address) must render only on protected routes, never on public pages, in public API responses or in anything search engines can index (@context/foundation/prd.md: Guardrails, Non-Functional Requirements, Access Control).
- Add every page that requires login to `PROTECTED_ROUTES` in `src/middleware.ts`. Matching uses `startsWith`, so `/dashboard` also protects `/dashboard-anything`.
- New tables go in `supabase/migrations/YYYYMMDDHHmmss_short_description.sql` with RLS enabled and one policy per operation and role.
- Secrets live in three places: `.env` (Node), `.dev.vars` (local workerd), and `npx wrangler secret put` (production). A new secret must be added to all three and declared in `env.schema` in @astro.config.mjs.

## Commands

- `npx astro check`: type check. CI runs it, but there is no npm script for it.

Setup and the full script list: @README.md.

## Project Structure

- `src/components/ui/`: shadcn/ui ("new-york"). Add components with `npx shadcn@latest add <name>`; do not hand-write them.
- `src/lib/services/<entity>.service.ts` (e.g. `caregiver.service.ts`): functions that read or write Supabase for that entity. Endpoints in `src/pages/api/` call a service instead of querying Supabase directly. `src/lib/`: pure helpers without I/O. `src/types.ts`: shared entity/DTO types. Create each on first use.
- `src/hooks/`: React hooks (the `hooks` alias in @components.json).
- Import through the `@/*` alias, not relative paths.

## Coding Conventions

- Write components as `.astro`. Use React (`.tsx`) only when the component needs client state or event handlers, and mount it with a `client:*` directive (pattern: `src/pages/auth/signin.astro`).
- Merge conditional Tailwind classes with `cn()` from `@/lib/utils`, never with string concatenation.
- Validate API input with zod. It is not in @package.json yet, so add it with the first endpoint that needs it. The existing auth routes skip validation.
- The husky pre-commit hook runs lint-staged (`eslint --fix`, `prettier --write`). Do not bypass it with `--no-verify`.

## Testing & CI

- There is no unit or integration test suite. `npm run smoke` is the only automated test. It needs Supabase with email confirmation disabled.
- Before pushing, run `npm run lint`, `npx astro check` and `npm run build`. CI steps: @.github/workflows/ci.yml.
