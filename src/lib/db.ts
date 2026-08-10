import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * Prisma client for Anima Companion.
 *
 * Phase 3 (Neon migration readiness):
 * - `DATABASE_URL`  → Neon pooled runtime endpoint (host with `-pooler` suffix).
 *   Used by the Next.js runtime (Prisma Client) for all app queries.
 * - `DIRECT_URL`    → Neon direct endpoint (host WITHOUT `-pooler`). Used by
 *   `prisma migrate`, `prisma db push`, `prisma studio`, `prisma introspect`,
 *   `pg_dump`/`psql restore`, and admin tooling.
 *
 * Phase 3.1 (DB config hygiene):
 *   - The previous Supabase-specific runtime URL rewriting hack (port 5432 →
 *     6543 with injected `pgbouncer`/`connection_limit`/`pool_timeout`/
 *     `prepared_statements` params) has been removed. Operator pastes the
 *     Neon connection strings from the dashboard directly into env vars.
 *   - Defensive pooler params are NOT pre-baked by default. Only add them if
 *     runtime testing shows actual need (e.g. "prepared statement does not
 *     exist" errors under load). Fix misconfiguration at the deploy env, not
 *     in code.
 *
 * The client is reused across warm lambda invocations via `globalForPrisma`
 * cache to avoid spawning multiple clients (which would exhaust the
 * connection pool).
 */
export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: [{ level: 'warn', emit: 'stdout' }, { level: 'error', emit: 'stdout' }],
  })

// Always cache — production serverless benefits from reusing warm clients
globalForPrisma.prisma = db
