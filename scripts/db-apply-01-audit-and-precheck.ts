/**
 * DB audit + CartItem duplicate pre-check.
 *
 * Run with:
 *   bun run scripts/db-apply-01-audit-and-precheck.ts
 *
 * Exits 0 if safe to proceed with db push, 1 if any blocker found.
 */
import { PrismaClient } from '@prisma/client'

// Use DIRECT_URL (not pooled) for one-shot admin queries — avoids
// PgBouncer transaction-mode quirks on the pooler.
const directUrl = process.env.DIRECT_URL
if (!directUrl) {
  console.error('FATAL: DIRECT_URL not set')
  process.exit(1)
}

const prisma = new PrismaClient({
  datasources: { db: { url: directUrl } },
})

async function main() {
  console.log('=== DB AUDIT + PRE-CHECK ===')
  console.log(`Target: ${directUrl!.replace(/:[^:@]+@/, ':***@')}`)
  console.log()

  // ---- 1. Row counts for context ----
  console.log('--- Row counts (existing data) ---')
  const tables = [
    'User', 'AdminUser', 'Product', 'ProductImage', 'Category',
    'Cart', 'CartItem', 'Order', 'OrderItem', 'Review',
    'Wishlist', 'Voucher', 'Banner', 'Testimonial', 'FAQ',
    'SiteSetting', 'Seller', 'PetType', 'Problem',
    'ProductPetType', 'ProductProblem',
    'EmailVerificationToken', 'OtpCode', 'PasswordResetGrant',
    'PetProfile', 'AdminPermission',
  ] as const

  for (const t of tables) {
    try {
      // Dynamic model access — Prisma's typed client doesn't support string indexing,
      // but at runtime all models are present on the client instance.
      const count = await (prisma as unknown as Record<string, { count: () => Promise<number> }>)[t].count()
      console.log(`  ${t.padEnd(28)} ${count}`)
    } catch (e: any) {
      console.log(`  ${t.padEnd(28)} ERROR: ${e.message.slice(0, 80)}`)
    }
  }
  console.log()

  // ---- 2. Verify ProductVariant table does NOT exist yet ----
  console.log('--- Pre-push schema check ---')
  const tablesRaw: Array<{ tablename: string }> = await prisma.$queryRaw`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
  `
  const tableNames = tablesRaw.map((r) => r.tablename)
  const expectedNew = ['ProductVariant']
  for (const t of expectedNew) {
    if (tableNames.includes(t)) {
      console.error(`  ✗ BLOCKER: table "${t}" already exists — db push may fail or be a no-op`)
      process.exit(1)
    } else {
      console.log(`  ✓ table "${t}" does not exist yet (expected)`)
    }
  }

  // ---- 3. Verify CartItem / OrderItem / Product columns ----
  const colsRaw: Array<{ table_name: string; column_name: string }> = await prisma.$queryRaw`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN ('Product', 'CartItem', 'OrderItem')
    ORDER BY table_name, column_name
  `
  const colsByTable = new Map<string, Set<string>>()
  for (const r of colsRaw) {
    if (!colsByTable.has(r.table_name)) colsByTable.set(r.table_name, new Set())
    colsByTable.get(r.table_name)!.add(r.column_name)
  }

  function checkCol(table: string, col: string, shouldBeAbsent: boolean) {
    const present = colsByTable.get(table)?.has(col) ?? false
    if (shouldBeAbsent && present) {
      console.error(`  ✗ BLOCKER: ${table}.${col} already exists — db push may conflict`)
      process.exit(1)
    } else if (shouldBeAbsent && !present) {
      console.log(`  ✓ ${table}.${col} does not exist yet (expected)`)
    } else if (!shouldBeAbsent && !present) {
      console.error(`  ✗ BLOCKER: ${table}.${col} is missing — schema drift detected`)
      process.exit(1)
    } else {
      console.log(`  ✓ ${table}.${col} exists (expected)`)
    }
  }

  checkCol('Product', 'hasVariants', true)
  checkCol('CartItem', 'variantId', true)
  checkCol('OrderItem', 'variantId', true)
  checkCol('OrderItem', 'variantName', true)

  // Existing columns that must still be present (sanity)
  checkCol('Product', 'price', false)
  checkCol('Product', 'salePrice', false)
  checkCol('Product', 'stock', false)
  checkCol('CartItem', 'cartId', false)
  checkCol('CartItem', 'productId', false)
  checkCol('OrderItem', 'orderId', false)

  console.log()

  // ---- 4. CartItem unique constraint check ----
  console.log('--- CartItem existing unique constraints ---')
  const constraintsRaw: Array<{
    conname: string
    contype: string
  }> = await prisma.$queryRaw`
    SELECT con.conname, con.contype
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = connamespace
    WHERE nsp.nspname = 'public' AND rel.relname = 'CartItem'
    ORDER BY con.conname
  `
  for (const c of constraintsRaw) {
    console.log(`  ${c.contype === 'u' ? 'UNIQUE' : c.contype}  ${c.conname}`)
  }

  // We expect: CartItem_cartId_productId_key (the legacy 2-col unique)
  const hasLegacyUnique = constraintsRaw.some(
    (c) => c.conname === 'CartItem_cartId_productId_key'
  )
  if (!hasLegacyUnique) {
    console.log('  (note: legacy CartItem_cartId_productId_key not found — may have been dropped already)')
  }
  console.log()

  // ---- 5. CartItem duplicate pre-check ----
  // This is the critical safety check before applying the partial unique index.
  // The variantId column doesn't exist yet, so we check ALL cart items for
  // duplicates by (cartId, productId). After db push adds variantId (all NULL
  // for existing rows), these would become duplicates under the partial index.
  console.log('--- CartItem duplicate pre-check (variantId-agnostic, all existing rows) ---')
  const dupsRaw: Array<{ cartid: string; productid: string; cnt: bigint }> = await prisma.$queryRaw`
    SELECT "cartId", "productId", COUNT(*)::bigint AS cnt
    FROM "CartItem"
    GROUP BY "cartId", "productId"
    HAVING COUNT(*) > 1
    ORDER BY cnt DESC
    LIMIT 20
  `
  if (dupsRaw.length === 0) {
    console.log('  ✓ No duplicate (cartId, productId) groups found — safe to apply partial unique index')
  } else {
    console.error(`  ✗ BLOCKER: found ${dupsRaw.length} duplicate group(s) (showing first 20):`)
    for (const d of dupsRaw) {
      console.error(`    cartId=${d.cartid}  productId=${d.productid}  count=${d.cnt}`)
    }
    console.error('')
    console.error('  Fix these duplicates before applying the backstop SQL:')
    console.error('    - Merge quantities into one row per (cartId, productId)')
    console.error('    - Delete the extras')
    console.error('  Then re-run this script.')
    process.exit(1)
  }
  console.log()

  // ---- 6. OrderItem references to Product (FK health) ----
  console.log('--- OrderItem → Product FK health ---')
  const orphanOrderItems: Array<{ cnt: bigint }> = await prisma.$queryRaw`
    SELECT COUNT(*)::bigint AS cnt
    FROM "OrderItem" oi
    LEFT JOIN "Product" p ON p.id = oi."productId"
    WHERE p.id IS NULL
  `
  if (Number(orphanOrderItems[0].cnt) === 0) {
    console.log('  ✓ No orphan OrderItem rows (all reference existing Product)')
  } else {
    console.error(`  ⚠ WARNING: ${orphanOrderItems[0].cnt} OrderItem rows reference missing Product — db push is still safe but you may want to investigate`)
  }

  console.log()
  console.log('=== PRE-CHECK PASSED — safe to proceed with `prisma db push` ===')
}

main()
  .catch((e) => {
    console.error('FATAL:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
