import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * Normalize DATABASE_URL for Vercel serverless + Supabase.
 *
 * Supabase session-mode pooler (port 5432) only allows 15 concurrent
 * connections — Vercel serverless instances exhaust this within minutes
 * and APIs return 500 with "max clients reached in session mode".
 *
 * This auto-rewrites port 5432 → 6543 (transaction-mode PgBouncer pooler,
 * 200 connections) and injects pgbouncer=true + connection_limit=1.
 *
 * This is a safety net. The clean fix is to set the correct URL in Vercel
 * env vars directly:
 *   postgresql://...pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
 */
function normalizeDatabaseUrl(url: string): string {
  if (!url) return url
  // Only rewrite Supabase pooler URLs on port 5432 (session mode)
  if (url.includes('pooler.supabase.com') && url.includes(':5432')) {
    let rewritten = url.replace(':5432', ':6543')
    // Strip existing query params and rebuild with pgbouncer-friendly defaults
    const [base, query = ''] = rewritten.split('?')
    const params = new URLSearchParams(query)
    params.set('pgbouncer', 'true')
    params.set('connection_limit', '1')
    params.set('pool_timeout', '60')
    // pgbouncer transaction mode doesn't support prepared statements
    params.set('prepared_statements', 'false')
    rewritten = `${base}?${params.toString()}`
    console.log('[db] Rewrote DATABASE_URL: port 5432 → 6543 (PgBouncer transaction mode)')
    return rewritten
  }
  return url
}

// In production, override the URL BEFORE Prisma client is created
if (process.env.NODE_ENV === 'production' && process.env.DATABASE_URL) {
  process.env.DATABASE_URL = normalizeDatabaseUrl(process.env.DATABASE_URL)
}

/**
 * Prisma client. Reused across warm lambda invocations via globalThis cache
 * to avoid spawning multiple clients (which would exhaust connection pool).
 */
export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: [{ level: 'warn', emit: 'stdout' }, { level: 'error', emit: 'stdout' }],
  })

// Always cache — production serverless benefits from reusing warm clients
globalForPrisma.prisma = db
