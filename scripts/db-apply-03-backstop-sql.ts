/**
 * Apply the CartItem unique-index backstop SQL.
 *
 * This is the partial unique index that Prisma's @@unique can't express
 * (because Postgres treats NULLs as distinct in unique indexes — we need
 * a partial index WHERE variantId IS NULL to enforce one-cart-line-per-
 * non-variant-product semantics).
 *
 * The SQL file is at:
 *   prisma/sql/20260822-variants-v1-cartitem-uniq-backstop.sql
 *
 * We execute its statements one-by-one via Prisma $executeRawUnsafe so we
 * can capture each step's outcome (the SQL file's DO block uses RAISE
 * EXCEPTION which we want to surface clearly).
 *
 * Run: bun run scripts/db-apply-03-backstop-sql.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL! } } })

async function main() {
  console.log('=== APPLY CARTITEM BACKSTOP SQL ===\n')

  // ---- Step 1: Drop legacy unique constraint if it still exists ----
  // db push already replaced it with the composite unique index, but this
  // is idempotent safety.
  console.log('--- Step 1: Drop legacy CartItem_cartId_productId_key (if exists) ---')
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "CartItem" DROP CONSTRAINT IF EXISTS "CartItem_cartId_productId_key"`
    )
    console.log('  ✓ done (or was already dropped)')
  } catch (e: any) {
    console.error('  ✗ FAILED:', e.message)
    throw e
  }
  console.log()

  // Also drop the legacy UNIQUE INDEX form (Prisma may have created it as
  // an index rather than a constraint — verified earlier in audit).
  console.log('--- Step 1b: Drop legacy CartItem_cartId_productId_key INDEX (if exists) ---')
  try {
    await prisma.$executeRawUnsafe(
      `DROP INDEX IF EXISTS "CartItem_cartId_productId_key"`
    )
    console.log('  ✓ done (or was already dropped)')
  } catch (e: any) {
    console.error('  ✗ FAILED:', e.message)
    throw e
  }
  console.log()

  // ---- Step 2: Duplicate pre-check (the DO block from the SQL file) ----
  // This is the critical safety check — if duplicates exist, abort BEFORE
  // trying to create the partial unique index.
  console.log('--- Step 2: Duplicate pre-check (DO block, aborts on duplicates) ---')
  try {
    await prisma.$executeRawUnsafe(`
      DO $$
      DECLARE
        dup_count INTEGER;
      BEGIN
        SELECT COUNT(*) INTO dup_count
        FROM (
          SELECT "cartId", "productId"
          FROM "CartItem"
          WHERE "variantId" IS NULL
          GROUP BY "cartId", "productId"
          HAVING COUNT(*) > 1
        ) AS dups;

        IF dup_count > 0 THEN
          RAISE EXCEPTION
            'ABORTING: found % groups of duplicate non-variant cart items.',
            dup_count
            USING ERRCODE = '23000';
        END IF;
      END $$;
    `)
    console.log('  ✓ pre-check passed (0 duplicates among non-variant cart items)')
  } catch (e: any) {
    console.error('  ✗ PRE-CHECK FAILED — aborting backstop SQL application:')
    console.error('   ', e.message)
    console.error('')
    console.error('  Fix the duplicates first, then re-run this script.')
    throw e
  }
  console.log()

  // ---- Step 3: Create partial unique index ----
  console.log('--- Step 3: Create partial unique index (idempotent) ---')
  try {
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "CartItem_cartId_productId_variantId_null_backstop"
        ON "CartItem" ("cartId", "productId")
        WHERE "variantId" IS NULL
    `)
    console.log('  ✓ partial unique index created (or already existed)')
  } catch (e: any) {
    console.error('  ✗ FAILED:', e.message)
    throw e
  }
  console.log()

  console.log('=== BACKSTOP SQL APPLIED SUCCESSFULLY ===')
}

main()
  .catch((e) => {
    console.error('\n=== BACKSTOP SQL APPLICATION FAILED ===')
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
