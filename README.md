# MMRC 26

Website for the IEEE RAS HTU Student Chapter's Micro Mouse Robot Competition 2026 — competition
info pages, registration, and the Pac Mouse browser game (Classic top-down + First-Person
raycaster modes).

## Stack

Next.js (App Router) + TypeScript, Tailwind CSS, Prisma + PostgreSQL (Supabase), Vitest,
Playwright, Docker.

## Local development

The app needs a PostgreSQL database to start — there is no file-based fallback. The simplest
setup is to point local development at a Supabase project (use a separate one from production,
so test registrations never land in the real table).

```bash
npm install
cp .env.example .env          # then fill in DATABASE_URL and DIRECT_URL
npx prisma migrate deploy     # applies migrations to that database
npx prisma db seed            # seeds the initial Counter rows
npm run dev                   # http://localhost:3000
```

Both connection strings come from the Supabase dashboard, under
**Project Settings → Database → Connection string**:

| Variable       | Which string        | Port | Used for                       |
| -------------- | ------------------- | ---- | ------------------------------ |
| `DATABASE_URL` | Transaction pooler  | 6543 | Every query the app runs       |
| `DIRECT_URL`   | Direct connection   | 5432 | Prisma migrations only         |

Migrations need the direct connection because the pooler cannot run the statements they issue.

## Testing

```bash
npm run test          # Vitest: game engine unit tests + component tests
npx playwright test   # Playwright e2e (builds + serves a standalone build automatically)
```

The Pac Mouse game (`src/game/classic/`) is an imperative canvas game ported directly from
the standalone ieee-ras-mouse-maze site rather than a pure-function engine, so it isn't unit
tested the way the original pure-function engine was; component/e2e tests cover the surrounding
page (routing, registration, dark mode) and a Playwright smoke test drives the game itself.
The pure parts that *are* unit tested live in `shared.ts` (maze enclosure, speed tuning) and
`src/lib/leaderboard.ts` (player-name sanitising) — see `tests/component/game-maze.test.ts`.

Game notes:

- The maze is fully enclosed. There is no side tunnel and nothing wraps from one edge to the
  other; `isWall()`/`cellAt()` treat out-of-bounds columns as solid.
- Walls render as glowing barrier outlines (the edges facing open space) rather than filled
  blocks.
- Pace is tuned by `GAME_SPEED_SCALE`, `MOUSE_SPEED_SCALE`, and `ROBOT_SPEED_SCALE` in
  `shared.ts`. Keep `MOUSE_SPEED_SCALE > ROBOT_SPEED_SCALE` or the game becomes unwinnable.
- Both modes support fullscreen and pause. Fullscreen targets the whole `.game-stage` wrapper so
  the HUD stays on screen; because the browser consumes Esc to leave fullscreen, leaving
  fullscreen mid-game pauses, and `P` works as a second pause key.
- Ending a run dispatches a `pacmouse:gameover` event that `Leaderboard.tsx` picks up to show the
  name-entry form; scores POST to `/api/game/scores` and are boarded per mode. Scores are
  client-reported and therefore not tamper-proof — the board is for fun, not ranking.

## Email broadcast lists

`/admin/broadcasts` groups people into lists (custom, confirmed, waiting) and sends each member
their own copy of a message. Confirmed and waiting lists can import team members straight from
registrations with a matching status; the import is re-runnable and never touches hand-added
contacts. Sends are sequential to stay inside Resend's rate limit, and each run is logged to the
`Broadcast` table.

## Production build

`next.config.mjs` sets `output: "standalone"`, so `next start` won't work directly — use one of:

```bash
# Local, without Docker
npm run build:standalone-serve

# Docker (recommended for anything resembling production)
docker compose up -d --build
docker compose run --rm migrate                             # first run only: applies migrations to the volume
docker compose run --rm --entrypoint "npx tsx prisma/seed.ts" migrate   # first run only: seeds Counter rows
```

The Docker image is a plain 12-factor Next.js container — no AWS-specific code or config, so it
runs unmodified on EC2, ECS/Fargate, App Runner, or any other Docker host. Only the connection
strings change between environments.

## Deploying

The site renders on the server and writes to the database on nearly every page — registration,
the admin panel, session login, the live stat counters, and the game leaderboard. **It cannot be
served as static files, so GitHub Pages and similar static hosts will not run it.** It needs a
host that executes Node.

Any of these work, with Supabase as the database in each case:

- **Vercel** — connect the repository, set the environment variables below, deploy. Free tier.
- **Render / Railway** — same, as a web service.
- **Any Docker host** — build the image above.

Set these in the host's environment settings, never in the repository:

| Variable                   | Notes                                                     |
| -------------------------- | --------------------------------------------------------- |
| `DATABASE_URL`             | Supabase pooled string, port 6543                          |
| `DIRECT_URL`               | Supabase direct string, port 5432                          |
| `SESSION_SECRET`           | Fresh random hex, different from any other environment     |
| `ADMIN_BOOTSTRAP_USERNAME` | Creates the first admin on first run                       |
| `ADMIN_BOOTSTRAP_PASSWORD` | Only used when no admin exists yet                         |
| `RESEND_API_KEY`           | Outbound email                                             |
| `RESEND_FROM_EMAIL`        | Verified Resend sender, e.g. `MMRC 26 <support@mmrchtu.tech>` |
| `ADMIN_NOTIFICATION_EMAIL` | Where FAQ questions are sent                               |
| `SITE_URL`                 | Public URL, used for links inside emails                   |

Then apply the schema once, from a machine holding the production connection strings:

```bash
npx prisma migrate deploy
npx prisma db seed
```

Before deploying email, add and verify your domain in Resend under **Domains**, then add the DNS
records Resend provides at your DNS host. Set `RESEND_FROM_EMAIL` to an address on that verified
domain, such as `MMRC 26 <support@mmrchtu.tech>`. The domain must be verified before Resend
will deliver to arbitrary recipients.

## Brand assets

`public/brand/logo/*.png` and `public/brand/favicon/*` were extracted from the official
`docs/brand/RAS Logos.pdf` IEEE RAS brand guideline (transparent-background crops of the RA mark
and HTU Student Chapter lockup in each required color variant). Replace them with true vector
(SVG) exports from IEEE RAS if/when official source files become available — `components/brand/Logo.tsx`
just needs the file paths updated.

## Project structure

- `src/app/` — routes (home, `/game`, `/rules`, `/schedule`, `/register`, `/faq`, API routes)
- `src/game/classic/` — Pac Mouse (Classic + First-Person modes), isolated behind
  `GameTabs.tsx`; `shared.ts`/`audio.ts` hold the maze layout, robot defs, and sound effects
  common to both modes
- `src/components/` — layout, brand, and shared UI components
- `src/lib/` — Prisma client, content loader, registration logic, broadcast-list and
  leaderboard rules shared between the API routes and the client
- `content/` — hand-authored rulebook/FAQ (MDX) and schedule (JSON); swap for a CMS later by
  changing only `src/lib/mdx.ts`
- `prisma/` — schema, migrations, seed script
- `tests/` — `unit/`, `component/`, `e2e/`
