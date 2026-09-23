import { PrismaClient } from "@prisma/client";

/**
 * The database URL, with more patience while `next build` runs.
 *
 * The build prerenders every static page at once, each firing its queries
 * together, against the same small pool (connection_limit=3 on Vercel) that a
 * single request uses. Prisma gives up after waiting 10 seconds for a free
 * connection, and one page doing so fails the whole deploy with P2024, though
 * nothing is wrong but the queue. During the build only, a query waits up to a
 * minute instead; live requests keep the default, where failing fast is right.
 */
function databaseUrl(): string | undefined {
  const url = process.env.DATABASE_URL;
  if (!url || process.env.NEXT_PHASE !== "phase-production-build" || /[?&]pool_timeout=/.test(url)) return url;
  return `${url}${url.includes("?") ? "&" : "?"}pool_timeout=60`;
}

// Next.js hot-reloads modules in dev, which would otherwise create a new
// PrismaClient (and DB connection pool) on every edit. Cache it on `global`.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const url = databaseUrl();
export const prisma = globalForPrisma.prisma ?? new PrismaClient(url ? { datasources: { db: { url } } } : undefined);

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
