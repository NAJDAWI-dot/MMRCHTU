# MMRC 26

Website for the IEEE RAS HTU Student Chapter's Micro Mouse Robot Competition 2026 — competition
info pages, registration, and the Robo-Maze Mouse browser game (Classic top-down + First-Person
raycaster modes).

## Stack

Next.js (App Router) + TypeScript, Tailwind CSS, Prisma + SQLite, Vitest, Playwright, Docker.

## Local development

```bash
npm install
cp .env.example .env          # DATABASE_URL="file:./dev.db"
npx prisma migrate dev        # creates prisma/dev.db and applies migrations
npx prisma db seed            # seeds the initial Counter rows
npm run dev                   # http://localhost:3000
```

## Testing

```bash
npm run test          # Vitest: game engine unit tests + component tests
npx playwright test   # Playwright e2e (builds + serves a standalone build automatically)
```

The Robo-Maze Mouse game (`src/game/classic/`) is an imperative canvas game ported directly from
the standalone ieee-ras-mouse-maze site rather than a pure-function engine, so it isn't unit
tested the way the earlier Cheddar Mouse prototype was; component/e2e tests cover the surrounding
page (routing, registration, dark mode) and a Playwright smoke test drives the game itself.

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
runs unmodified on EC2, ECS/Fargate, App Runner, or any other Docker host. Only `DATABASE_URL`
and where its data volume lives change between environments; swapping SQLite for Postgres later
is a one-line change to `prisma/schema.prisma`'s `provider` plus `prisma migrate deploy` against
the new database — no application code changes.

## Brand assets

`public/brand/logo/*.png` and `public/brand/favicon/*` were extracted from the official
`docs/brand/RAS Logos.pdf` IEEE RAS brand guideline (transparent-background crops of the RA mark
and HTU Student Chapter lockup in each required color variant). Replace them with true vector
(SVG) exports from IEEE RAS if/when official source files become available — `components/brand/Logo.tsx`
just needs the file paths updated.

## Project structure

- `src/app/` — routes (home, `/game`, `/rules`, `/schedule`, `/register`, `/faq`, API routes)
- `src/game/classic/` — Robo-Maze Mouse (Classic + First-Person modes), isolated behind
  `GameTabs.tsx`; `shared.ts`/`audio.ts` hold the maze layout, robot defs, and sound effects
  common to both modes
- `src/components/` — layout, brand, and shared UI components
- `src/lib/` — Prisma client, content loader, registration logic
- `content/` — hand-authored rulebook/FAQ (MDX) and schedule (JSON); swap for a CMS later by
  changing only `src/lib/mdx.ts`
- `prisma/` — schema, migrations, seed script
- `tests/` — `unit/`, `component/`, `e2e/`
