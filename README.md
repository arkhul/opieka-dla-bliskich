# 10x Astro Starter

![](./public/template.png)

A modern, opinionated starter template for building fast, accessible web applications.

## Tech Stack

- [Astro](https://astro.build/) v7 - Modern web framework with server-first rendering
- [React](https://react.dev/) v19 - UI library for interactive components
- [TypeScript](https://www.typescriptlang.org/) v6 - Type-safe JavaScript
- [Tailwind CSS](https://tailwindcss.com/) v4 - Utility-first CSS framework
- [Supabase](https://supabase.com/) - Authentication and backend-as-a-service
- [Cloudflare Workers](https://workers.cloudflare.com/) - Edge deployment runtime

## Prerequisites

- Node.js v22.14.0 (as specified in `.nvmrc`)
- npm (comes with Node.js)

## Getting Started

1. Clone the repository:

```bash
git clone https://github.com/przeprogramowani/10x-astro-starter.git
cd 10x-astro-starter
```

2. Install dependencies:

```bash
npm install
```

3. Set up Supabase and configure environment variables — see [Supabase Configuration](#supabase-configuration) below.

4. Create a `.dev.vars` file for local Cloudflare dev secrets:

```bash
cp .env.example .dev.vars
```

5. Run the development server:

```bash
npm run dev
```

## Available Scripts

- `npm run dev` - Start development server (Cloudflare workerd runtime)
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint with type-checked rules
- `npm run lint:fix` - Auto-fix ESLint issues
- `npm run format` - Run Prettier
- `npm run smoke` - Smoke test the auth flow, the dictionaries, the caregiver profile API, the public caregiver list, the contact reveal, and RLS and table privileges against a running server (`BASE_URL`, defaults to `http://localhost:4321`; reads `SUPABASE_URL`/`SUPABASE_KEY` from `.env`)

## Project Structure

```md
.
├── src/
│ ├── layouts/ # Astro layouts
│ ├── pages/ # Astro pages
│ │ └── api/ # API endpoints
│ ├── components/ # UI components (Astro & React)
│ └── assets/ # Static assets
├── public/ # Public assets
├── wrangler.jsonc # Cloudflare Workers config
```

## Supabase Configuration

This project uses [Supabase](https://supabase.com/) for authentication. Environment variables are declared via Astro's `astro:env` schema and are treated as **server-only secrets** — they are never exposed to the client.

### First-time setup (local, no cloud project needed)

Requires [Docker](https://www.docker.com/) and ~7 GB RAM.

1. Create your `.env` file:

```bash
cp .env.example .env
```

2. Initialize the local Supabase project (creates a `supabase/` config folder):

```bash
npx supabase init
```

3. Start the local stack (downloads Docker images on first run):

```bash
npx supabase start
```

4. Copy the credentials printed by the CLI into your `.env` and `.dev.vars`:

```
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_KEY=<anon key from CLI output>
```

5. To stop the stack when done:

```bash
npx supabase stop
```

The local Studio UI is available at `http://localhost:54323`.

### Database migrations

The schema and reference data (the service catalogue and all Polish gminas from TERYT) live in `supabase/migrations/`. Reference data is kept in migrations, not in `seed.sql`, because production only runs migrations.

Apply all migrations to the local database from scratch:

```bash
npx supabase db reset
```

Push migrations to the production project (link once, then push after every new migration):

```bash
npx supabase link --project-ref <project-ref>
npx supabase db push
```

To refresh gminas after administrative changes, download the latest TERC file (eteryt.stat.gov.pl → "Pobieranie plików" → TERC, wersja urzędowa, CSV) and generate a new migration from it; do not commit the raw CSV:

```bash
node scripts/generate-gminas-migration.mjs <TERC.csv> supabase/migrations/<YYYYMMDDHHmmss>_update_gminas.sql
```

The generated migration syncs `public.gminas` with the file and works on a populated table:

- It updates existing gminas, adds new ones and marks gminas missing from TERC as retired (`active = false`). Rows are never deleted. Retired gminas disappear from the gmina search.
- When only the gmina type changes (same WOJ+POW+GMI, different RODZ, e.g. a village gets town rights), the new code is set as the successor in `replaced_by` automatically.
- The generator refuses a TERC file whose `STAN_NA` is older than the one in the existing gmina migrations, so an outdated file cannot undo later changes. It also refuses an output timestamp that is not later than every existing migration.
- The migration aborts without changes if it would retire more than 30 gminas without a successor (type changes do not count). For a real large reform, regenerate it with `--max-retired N`.

Before `npx supabase db push`, apply it locally first (`npx supabase migration up`, or `npx supabase db reset` for a clean run) and check the retired gminas:

```sql
select teryt, name, replaced_by from public.gminas where not active order by teryt;
```

For gminas merged or abolished without an automatic successor, write a separate migration by hand that sets `replaced_by`. Do not edit the generated file.

Migracja przepina też profile opiekunów: każde powiązanie w `public.caregiver_gminas` z wycofaną gminą przechodzi na jej `replaced_by`, jeśli ten następca jest aktywny (opiekun, który ma już następcę, zachowuje jedno powiązanie). Powiązania z wycofaną gminą bez aktywnego następcy zostają bez zmian, więc w profilu opiekuna gmina nadal widnieje jako wycofana; komunikat `gminas sync: re-pointed N caregiver gmina links …; M links left on retired gminas without an active successor: <kody>` wymienia te kody. Rozstrzygnij je, ustawiając `replaced_by` w ręcznie napisanej migracji (kolejna wygenerowana migracja je przepnie), albo zostaw opiekunom do wymiany w profilu. `npx supabase migration up` nie wyświetla komunikatów `NOTICE` (a `npx supabase db push` może ich nie pokazać), więc pozostawione powiązania znajdziesz zapytaniem:

```sql
select cg.teryt, g.name, g.replaced_by, count(*) as caregivers
from public.caregiver_gminas as cg
join public.gminas as g on g.teryt = cg.teryt
where not g.active
group by cg.teryt, g.name, g.replaced_by
order by cg.teryt;
```

### Using a cloud Supabase project instead

If you prefer to use a hosted Supabase project, add these variables to your `.env` and `.dev.vars` files:

| Variable       | Description                                                |
| -------------- | ---------------------------------------------------------- |
| `SUPABASE_URL` | Project URL from Supabase dashboard → Settings → API       |
| `SUPABASE_KEY` | `anon` public key from Supabase dashboard → Settings → API |

```
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_KEY=<anon-key>
```

### Email confirmation in local development

By default Supabase requires email confirmation before a user can sign in. To skip this during local development:

1. Open the Supabase dashboard for your project
2. Go to **Authentication → Email → Confirm email**
3. Toggle it **off**

Users can then sign in immediately after sign-up without clicking a confirmation link.

### Auth routes

| Route                 | Description                                                                                    |
| --------------------- | ---------------------------------------------------------------------------------------------- |
| `/auth/signin`        | Email/password sign-in form                                                                    |
| `/auth/signup`        | Email/password sign-up form                                                                    |
| `/auth/confirm-email` | Post-signup "check your inbox" page                                                            |
| `/dashboard`          | Example protected page (redirects to `/auth/signin` if unauthenticated)                        |
| `/opiekunowie/[id]`   | Public caregiver profile (no contact data; 404 for a missing or incomplete profile)            |
| `/kontakt/[id]`       | Protected: caregiver contact data (phone, e-mail), shown to coordinators only (decided by RLS) |

Route protection is handled in `src/middleware.ts`. Add paths to the `PROTECTED_ROUTES` array there to require authentication. An anonymous visitor is redirected to `/auth/signin?next=<the page they asked for>`; after sign-in or sign-up (coordinators) they return there. `next` must be a local path (`src/lib/redirect.ts`), anything else is ignored.

## Deployment

This project deploys to [Cloudflare Workers](https://workers.cloudflare.com/).

1. Build the project:

```bash
npm run build
```

2. Deploy with Wrangler:

```bash
npx wrangler deploy
```

Set `SUPABASE_URL` and `SUPABASE_KEY` as secrets in your Cloudflare dashboard or via `npx wrangler secret put`.

## Smoke test

`scripts/smoke.mjs` is a dependency-free Node script that checks the public dictionaries (service list, gmina search, `q` validation) and walks the whole auth flow (sign-up, sign-in, protected page, sign-out) over HTTP, followed by the steps described below. Run it against the dev server or the production preview after dependency upgrades:

```bash
npm run dev            # or: npm run build && npm run preview
BASE_URL=http://localhost:4321 npm run smoke
```

It needs a reachable Supabase instance (local or cloud) with email confirmation disabled.

Smoke sprawdza też API profilu opiekuna (`GET`/`PUT /api/caregiver/profile`: brak profilu, walidacja telefonu, zapis kompletnego profilu, 401 bez sesji, 403 dla koordynatora), strony profilu (`/profil` i `/profil/edycja` renderują się opiekunowi, anonim trafia na `/auth/signin`, koordynator na `/`) oraz rozdział danych przez RLS, wywołując REST Supabase bezpośrednio: jako `anon` czyta publiczną część profilu i gminy, ale z `caregiver_contacts` i `accounts` dostaje odmowę uprawnień do tabeli (`permission denied`), a nie pustą listę; zalogowany koordynator nie widzi cudzego kontaktu i nie może utworzyć profilu opiekuna. Kroki uprawnień sprawdzają też, że zapis do słowników `gminas` (jako `anon`) i `services` (jako zalogowany opiekun) przez REST jest odrzucany brakiem uprawnienia do tabeli. Sprawdza też publiczną listę opiekunów: funkcję `search_caregivers` wywołaną jako `anon` (niekompletny profil jest ukryty, gmina filtruje twardo, z wybranymi usługami musi pasować co najmniej jedna, kolejność wyznacza najpierw liczba pokrytych usług, potem terminów, wiersze niosą braki w `missing_services` i `missing_slots`, `total_count` liczony przed limitem, brak danych kontaktowych w wyniku) oraz `count_caregivers_relaxed` (liczby do podpowiedzi bez filtra usług i bez filtra gminy w jednym wierszu), stronę `/opiekunowie` renderowaną anonimowi (profil „Anna Smoke” na liście, brak telefonu i e-maila w HTML, wiersz dopasowania na kartach — „Brakuje usług: …”, „Brakuje terminów: …” albo „Pełne dopasowanie”, z pełnym dopasowaniem wyżej — podpowiedzi z `count_caregivers_relaxed` przy braku wyników, ignorowanie błędnych parametrów, komunikaty o nieznanej gminie i stronie poza zakresem), nagłówek `X-Robots-Tag: noindex` oraz to, że strona główna zawiera link do listy. Do tych kroków `npm run smoke` wczytuje `SUPABASE_URL` i `SUPABASE_KEY` (klucz `anon`) z `.env` (`node --env-file-if-exists=.env`); można je też podać w zmiennych środowiskowych. Bez nich skrypt kończy się błędem, zanim wykona jakikolwiek krok. Sprawdza też odsłonięcie kontaktu: koordynator czyta przez RLS kontakt kompletnego profilu, ale nie profilu niekompletnego (ani nikt poza właścicielem i koordynatorami); funkcja `get_public_caregiver` zwraca anonimowi profil bez kontaktu; karty listy linkują do `/opiekunowie/<id>`; strona profilu nie zawiera w HTML telefonu ani e-maila i daje 404 dla profilu niekompletnego i błędnego UUID; `/kontakt/<id>` odsyła anonima na `/auth/signin?next=…`, pokazuje koordynatorowi telefon (`tel:`) i e-mail, a opiekunowi — komunikat bez kontaktu; nowy koordynator rejestruje się z `next=/kontakt/<id>` i wraca na tę stronę z numerem. Sprawdza też dostępność opiekunów: zapis i walidację terminów (przez RPC `save_caregiver_profile` i przez API profilu, w tym odrzucenie nieznanego terminu i kolejność kanoniczną), RLS i granty tabeli `caregiver_availability` (`anon` czyta, ale nie zapisuje; opiekun nie zapisze cudzych terminów), terminy w `search_caregivers` i na stronie `/opiekunowie?termin=…` tylko ustalające kolejność, bez ukrywania profili, także bez dostępności (z ignorowaniem błędnych wartości), linię dostępności na karcie listy („Dostępność nie podana” dla profilu bez terminów) oraz siatkę dostępności na stronie `/opiekunowie/<id>`. Parametr `next` jest też sprawdzany w logowaniu (powrót, ignorowanie zewnętrznych adresów, zachowanie po błędzie). Sprawdza też usuwanie profilu: `DELETE /api/caregiver/profile` (401 bez sesji, 403 dla koordynatora, 200 dla właściciela i 404 przy drugim wywołaniu), przycisk „Usuń profil” i komunikat na `/profil?usunieto=1`, 404 strony `/opiekunowie/<id>` i brak profilu na liście po usunięciu, a przez REST Supabase: usuwa tylko właściciel (`anon` nie ma uprawnienia do tabeli, inny opiekun i koordynator nie usuwają nic), a kaskada czyści kontakt, gminy, usługi i dostępność. Każde uruchomienie zakłada w bazie siedem kont `smoke-*@example.com` (pięciu opiekunów i dwóch koordynatorów) oraz profile „Anna Smoke”, „Bartek Smoke” i „Celina Smoke” (niekompletny); profile „Dorota Smoke” i „Ewa Smoke” są usuwane w trakcie przebiegu.

> **Note:** this script exists primarily to guard the development of the starter itself — it is a fast sanity check that dependency upgrades did not break the build, the Cloudflare adapter or the Supabase auth flow. It is **not** a substitute for a real test suite. Once you build your own product on top of this starter, add proper tests (unit, integration, end-to-end) suited to your application.

## CI

GitHub Actions runs two jobs on every push and PR to `master`:

- **ci** — lint, `astro check` and build. Configure `SUPABASE_URL` and `SUPABASE_KEY` as repository secrets for the build step.
- **smoke** — starts a local Supabase via the Supabase CLI, builds, serves the production preview on the Cloudflare runtime and runs `npm run smoke` against it. No secrets required.

## License

MIT
