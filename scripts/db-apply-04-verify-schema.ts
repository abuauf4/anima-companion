/**
 * Post-push schema verification.
 *
 * Verifies that all variant V1 schema changes are present in the DB:
 *   - ProductVariant table exists with all expected columns + indexes
 *   - Product.hasVariants column exists
 *   - CartItem.variantId column + composite unique index + partial backstop index
 *   - OrderItem.variantId + variantName columns + FK
 *   - EmailVerificationToken.attemptCount/lastSentAt/purpose still intact
 *     (drift reconciliation didn't lose any columns)
 *
 * Run: bun run scripts/db-apply-04-verify-schema.ts
 */
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL! } } })

async function main() {
  let pass = 0
  let fail = 0
  function check(name: string, ok: boolean, detail = '') {
    if (ok) {
      pass++
      console.log(`  ✓ ${name}${detail ? ' — ' + detail : ''}`)
    } else {
      fail++
      console.error(`  ✗ ${name}${detail ? ' — ' + detail : ''}`)
    }
  }

  console.log('=== POST-PUSH SCHEMA VERIFICATION ===\n')

  // ---- 1. Tables ----
  console.log('--- Tables ---')
  const tables: Array<{ tablename: string }> = await prisma.$queryRaw`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
  `
  const tableNames = tables.map((t) => t.tablename)
  check('ProductVariant table exists', tableNames.includes('ProductVariant'))
  check('CartItem table still exists', tableNames.includes('CartItem'))
  check('OrderItem table still exists', tableNames.includes('OrderItem'))
  check('Product table still exists', tableNames.includes('Product'))
  console.log()

  // ---- 2. ProductVariant columns ----
  console.log('--- ProductVariant columns ---')
  const pvCols: Array<{ column_name: string; data_type: string; is_nullable: string; column_default: string | null }> = await prisma.$queryRaw`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ProductVariant'
    ORDER BY ordinal_position
  `
  const pvColMap = new Map(pvCols.map((c) => [c.column_name, c]))
  const expectedPvCols = [
    ['id', 'text', 'NO', null],
    ['productId', 'text', 'NO', null],
    ['name', 'text', 'NO', null],
    ['price', 'integer', 'NO', null],
    ['salePrice', 'integer', 'YES', null],
    ['stock', 'integer', 'NO', '0'],
    ['isActive', 'boolean', 'NO', 'true'],
    ['sortOrder', 'integer', 'NO', '0'],
    ['createdAt', 'timestamp without time zone', 'NO', 'CURRENT_TIMESTAMP'],
    ['updatedAt', 'timestamp without time zone', 'NO', null],
  ] as const
  for (const [name, type, nullable, def] of expectedPvCols) {
    const c = pvColMap.get(name)
    if (!c) {
      check(`ProductVariant.${name}`, false, 'column missing')
      continue
    }
    const typeOk = c.data_type === type
    const nullableOk = c.is_nullable === nullable
    // default check is loose because Postgres may store it differently
    const defOk = def === null ? (c.column_default === null) : (c.column_default !== null && c.column_default.includes(String(def)))
    check(`ProductVariant.${name} (type=${type}, nullable=${nullable})`, typeOk && nullableOk && defOk,
      `got type=${c.data_type}, nullable=${c.is_nullable}, default=${c.column_default}`)
  }
  console.log()

  // ---- 3. ProductVariant indexes ----
  console.log('--- ProductVariant indexes ---')
  const pvIdx: Array<{ indexname: string; indexdef: string }> = await prisma.$queryRaw`
    SELECT indexname, indexdef FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'ProductVariant'
    ORDER BY indexname
  `
  const pvIdxMap = new Map(pvIdx.map((i) => [i.indexname, i.indexdef]))
  check('ProductVariant_pkey exists', pvIdxMap.has('ProductVariant_pkey'))
  check('ProductVariant_productId_idx exists', pvIdxMap.has('ProductVariant_productId_idx'),
    pvIdxMap.get('ProductVariant_productId_idx') || '')
  check('ProductVariant_productId_isActive_idx exists', pvIdxMap.has('ProductVariant_productId_isActive_idx'),
    pvIdxMap.get('ProductVariant_productId_isActive_idx') || '')
  console.log()

  // ---- 4. ProductVariant FKs ----
  console.log('--- ProductVariant foreign keys ---')
  const pvFks: Array<{ conname: string; pg_get_constraintdef: string }> = await prisma.$queryRaw`
    SELECT con.conname, pg_get_constraintdef(con.oid) AS pg_get_constraintdef
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = connamespace
    WHERE nsp.nspname = 'public' AND rel.relname = 'ProductVariant' AND con.contype = 'f'
  `
  for (const fk of pvFks) {
    console.log(`  FK: ${fk.conname} = ${fk.pg_get_constraintdef}`)
  }
  check('ProductVariant has FK to Product (cascade delete)',
    pvFks.some((f) => f.pg_get_constraintdef.includes('"Product"') && f.pg_get_constraintdef.includes('ON DELETE CASCADE')))
  console.log()

  // ---- 5. Product.hasVariants ----
  console.log('--- Product.hasVariants column ---')
  const phCols: Array<{ column_name: string; data_type: string; is_nullable: string; column_default: string | null }> = await prisma.$queryRaw`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Product' AND column_name = 'hasVariants'
  `
  if (phCols.length === 0) {
    check('Product.hasVariants exists', false, 'column missing')
  } else {
    const c = phCols[0]
    check('Product.hasVariants exists',
      c.data_type === 'boolean' && c.is_nullable === 'NO' && c.column_default === 'false',
      `type=${c.data_type}, nullable=${c.is_nullable}, default=${c.column_default}`)
  }
  console.log()

  // ---- 6. CartItem.variantId + unique indexes ----
  console.log('--- CartItem.variantId + unique indexes ---')
  const ciCols: Array<{ column_name: string; data_type: string; is_nullable: string }> = await prisma.$queryRaw`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'CartItem' AND column_name = 'variantId'
  `
  if (ciCols.length === 0) {
    check('CartItem.variantId exists', false, 'column missing')
  } else {
    const c = ciCols[0]
    check('CartItem.variantId exists',
      c.data_type === 'text' && c.is_nullable === 'YES',
      `type=${c.data_type}, nullable=${c.is_nullable}`)
  }
  const ciIdx: Array<{ indexname: string; indexdef: string }> = await prisma.$queryRaw`
    SELECT indexname, indexdef FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'CartItem'
    ORDER BY indexname
  `
  const ciIdxMap = new Map(ciIdx.map((i) => [i.indexname, i.indexdef]))
  // The Prisma-generated composite unique index name follows the pattern
  // <Model>_<col1>_<col2>_<col3>_key
  const compositeIdxDef = ciIdxMap.get('CartItem_cartId_productId_variantId_key')
  check('CartItem composite unique index (cartId, productId, variantId) exists',
    !!compositeIdxDef && compositeIdxDef.includes('UNIQUE') && compositeIdxDef.includes('"cartId"') && compositeIdxDef.includes('"productId"') && compositeIdxDef.includes('"variantId"'),
    compositeIdxDef || 'NOT FOUND')
  const backstopIdxDef = ciIdxMap.get('CartItem_cartId_productId_variantId_null_backstop')
  check('CartItem partial unique backstop index (cartId, productId) WHERE variantId IS NULL exists',
    !!backstopIdxDef && backstopIdxDef.includes('UNIQUE') && backstopIdxDef.includes('WHERE "variantId" IS NULL'),
    backstopIdxDef || 'NOT FOUND')
  // Verify legacy 2-col unique is GONE
  check('Legacy CartItem_cartId_productId_key (2-col unique) is DROPPED',
    !ciIdxMap.has('CartItem_cartId_productId_key'))
  console.log()

  // ---- 7. OrderItem.variantId + variantName ----
  console.log('--- OrderItem.variantId + variantName ---')
  const oiCols: Array<{ column_name: string; data_type: string; is_nullable: string }> = await prisma.$queryRaw`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'OrderItem' AND column_name IN ('variantId', 'variantName')
  `
  const oiColMap = new Map(oiCols.map((c) => [c.column_name, c]))
  const vi = oiColMap.get('variantId')
  const vn = oiColMap.get('variantName')
  check('OrderItem.variantId exists (text, nullable)',
    !!vi && vi.data_type === 'text' && vi.is_nullable === 'YES',
    vi ? `type=${vi.data_type}, nullable=${vi.is_nullable}` : 'NOT FOUND')
  check('OrderItem.variantName exists (text, nullable)',
    !!vn && vn.data_type === 'text' && vn.is_nullable === 'YES',
    vn ? `type=${vn.data_type}, nullable=${vn.is_nullable}` : 'NOT FOUND')

  // Verify OrderItem.variantId FK to ProductVariant with ON DELETE SET NULL
  const oiFks: Array<{ conname: string; pg_get_constraintdef: string }> = await prisma.$queryRaw`
    SELECT con.conname, pg_get_constraintdef(con.oid) AS pg_get_constraintdef
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = connamespace
    WHERE nsp.nspname = 'public' AND rel.relname = 'OrderItem' AND con.contype = 'f'
  `
  const variantFkOnOrderItem = oiFks.find((f) => f.pg_get_constraintdef.includes('"variantId"'))
  check('OrderItem.variantId FK to ProductVariant with ON DELETE SET NULL',
    !!variantFkOnOrderItem && variantFkOnOrderItem.pg_get_constraintdef.includes('"ProductVariant"') && variantFkOnOrderItem.pg_get_constraintdef.includes('ON DELETE SET NULL'),
    variantFkOnOrderItem?.pg_get_constraintdef || 'NOT FOUND')
  console.log()

  // ---- 8. EmailVerificationToken drift reconciliation preserved ----
  console.log('--- EmailVerificationToken: drift columns still intact ---')
  const evtCols: Array<{ column_name: string }> = await prisma.$queryRaw`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'EmailVerificationToken'
      AND column_name IN ('attemptCount', 'lastSentAt', 'purpose')
  `
  const evtColNames = evtCols.map((c) => c.column_name)
  check('EmailVerificationToken.attemptCount preserved', evtColNames.includes('attemptCount'))
  check('EmailVerificationToken.lastSentAt preserved', evtColNames.includes('lastSentAt'))
  check('EmailVerificationToken.purpose preserved', evtColNames.includes('purpose'))

  const evtIdx: Array<{ indexname: string }> = await prisma.$queryRaw`
    SELECT indexname FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'EmailVerificationToken'
      AND indexname = 'EmailVerificationToken_userId_purpose_consumedAt_idx'
  `
  check('EmailVerificationToken_userId_purpose_consumedAt_idx preserved',
    evtIdx.length > 0)
  console.log()

  // ---- 9. Existing Product data sanity (hasVariants defaults to false) ----
  console.log('--- Existing Product data sanity ---')
  const productsWithHasVariants: Array<{ cnt: bigint; hasVariants: boolean }> = await prisma.$queryRaw`
    SELECT "hasVariants", COUNT(*)::bigint AS cnt
    FROM "Product"
    GROUP BY "hasVariants"
  `
  for (const r of productsWithHasVariants) {
    console.log(`  Product.hasVariants=${r.hasVariants}: ${r.cnt} rows`)
  }
  check('All existing products have hasVariants=false',
    productsWithHasVariants.length === 1 && productsWithHasVariants[0].hasVariants === false)
  console.log()

  console.log(`=== VERIFICATION: ${pass} passed, ${fail} failed ===`)
  if (fail > 0) process.exit(1)
}

main()
  .catch((e) => {
    console.error('FATAL:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
