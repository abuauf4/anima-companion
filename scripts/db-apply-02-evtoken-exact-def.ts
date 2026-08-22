/**
 * Inspect exact DB definition of EmailVerificationToken:
 *   - columns: type, nullability, default
 *   - indexes: name, definition, uniqueness, partial-WHERE
 *
 * Used to match schema.prisma to the existing DB before running db push.
 *
 * Run: bun run scripts/db-apply-02-evtoken-exact-def.ts
 */
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL! } } })

async function main() {
  console.log('=== EmailVerificationToken — EXACT DB DEFINITION ===\n')

  // Columns
  const cols: Array<{
    column_name: string
    data_type: string
    is_nullable: string
    column_default: string | null
    character_maximum_length: number | null
    numeric_precision: number | null
    numeric_scale: number | null
    datetime_precision: number | null
  }> = await prisma.$queryRaw`
    SELECT
      column_name,
      data_type,
      is_nullable,
      column_default,
      character_maximum_length,
      numeric_precision,
      numeric_scale,
      datetime_precision
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'EmailVerificationToken'
    ORDER BY ordinal_position
  `
  console.log('--- Columns ---')
  for (const c of cols) {
    const nullable = c.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'
    const def = c.column_default ? ` DEFAULT ${c.column_default}` : ''
    const dtPrec = c.datetime_precision !== null ? `(${c.datetime_precision})` : ''
    const numPrec = c.numeric_precision !== null ? `(${c.numeric_precision}${c.numeric_scale !== null && c.numeric_scale !== 0 ? ',' + c.numeric_scale : ''})` : ''
    console.log(`  ${c.column_name.padEnd(20)} ${c.data_type}${dtPrec}${numPrec}  ${nullable}${def}`)
  }
  console.log()

  // Indexes
  const idx: Array<{ indexname: string; indexdef: string }> = await prisma.$queryRaw`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'EmailVerificationToken'
    ORDER BY indexname
  `
  console.log('--- Indexes ---')
  for (const i of idx) {
    console.log(`  ${i.indexname}`)
    console.log(`    ${i.indexdef}`)
  }
  console.log()

  // Constraints
  const con: Array<{ conname: string; contype: string; pg_get_constraintdef: string }> = await prisma.$queryRaw`
    SELECT con.conname, con.contype, pg_get_constraintdef(con.oid) AS pg_get_constraintdef
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = connamespace
    WHERE nsp.nspname = 'public' AND rel.relname = 'EmailVerificationToken'
    ORDER BY con.conname
  `
  console.log('--- Constraints ---')
  for (const c of con) {
    const typeLabel = c.contype === 'p' ? 'PRIMARY KEY' : c.contype === 'f' ? 'FOREIGN KEY' : c.contype === 'u' ? 'UNIQUE' : c.contype === 'c' ? 'CHECK' : c.contype
    console.log(`  [${typeLabel}] ${c.conname}`)
    console.log(`    ${c.pg_get_constraintdef}`)
  }
}

main().finally(() => prisma.$disconnect())
