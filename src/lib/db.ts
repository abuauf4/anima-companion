import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * Prisma client for Anima Companion.
 *
 * Phase 3 (Neon migration readiness):
 * - `DATABASE_URL`  → Neon pooled connection (PgBouncer transaction mode).
 *   MUST include `?pgbouncer=true&connection_limit=1&pool_timeout=60&prepared_statements=false`.
 *   Operator sets this at deploy time (Coolify / Vercel env var).
 * - `DIRECT_URL`    → Neon direct connection (no pooler). Used by `prisma migrate`,
 *   `prisma db push`, `prisma studio`, `prisma introspect`. Set in `.env` locally
 *   and in the deploy environment for migration tooling.
 *
 * The previous Supabase-specific runtime URL rewriting (port 5432 → 6543 with
 * injected pgbouncer params) has been removed. That was a defensive hack for
 * operators who pasted the session-mode Supabase URL into DATABASE_URL. With
 * Neon, the operator is expected to paste the correct pooled connection string
 * from the Neon dashboard directly. This matches the modern Prisma 6.x pattern
 * and avoids hiding misconfiguration behind runtime magic.
 *
 * If you see "prepared statement does not exist" errors at runtime, it means
 * DATABASE_URL is missing `prepared_statements=false` — fix it in the deploy
 * env, not in code.
 *
 * The client is reused across warm lambda invocations via `globalForPrisma`
 * cache to avoid spawning multiple clients (which would exhaust the connection
 * pool).
 */
export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: [{ level: 'warn', emit: 'stdout' }, { level: 'error', emit: 'stdout' }],
  })

// Always cache — production serverless benefits from reusing warm clients
globalForPrisma.prisma = db
