import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * Prisma client with conservative connection limits to avoid
 * exhausting Supabase's pooler (max 15 in session mode).
 *
 * Note: actual connection_limit is set via DATABASE_URL query param,
 * but we also reduce log noise here for cleaner dev output.
 */
export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Only log queries that take >200ms — quieter + still useful for perf debugging
    log: [{ level: 'warn', emit: 'stdout' }, { level: 'error', emit: 'stdout' }],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
