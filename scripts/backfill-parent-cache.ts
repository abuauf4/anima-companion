/**
 * Backfill: recompute Product.price / salePrice / stock cache for variant products.
 *
 * WHY THIS EXISTS
 * ---------------
 * `deriveParentCacheFromVariants` previously returned the winner's EFFECTIVE
 * selling price (salePrice if discounted) as `Product.price`. That produced
 * `price === salePrice` for any discounted winner, which made the storefront
 * show "Hemat 0%" with the strikethrough equal to the sale price — visible
 * on the Product Detail page until the user picked a variant.
 *
 * The fix (in src/lib/product-variants.ts + the inline copies in
 * src/lib/orders.ts) makes `Product.price` always the winner's NORMAL price,
 * and `Product.salePrice` the winner's discount (or null). New writes (admin
 * create/update, checkout stock decrement, order cancel) are now correct.
 *
 * BUT: existing variant products in the database still carry the OLD buggy
 * cache. This script recomputes the cache for every `hasVariants = true`
 * product using the corrected helper and writes only the rows that actually
 * changed. It is safe to re-run as many times as you want — idempotent.
 *
 * GUARDRAILS (per task brief)
 * ---------------------------
 *   - No schema changes. No `prisma db push`. No migrations.
 *   - Only touches `Product.price / salePrice / stock` columns.
 *   - Does NOT touch variant rows, orders, cart items, or any other table.
 *   - Does NOT call any checkout/order/cart code path — direct DB writes only.
 *   - Dry-run by default. Pass `--apply` to actually write.
 *   - Each product is updated in its own transaction; a failure on one
 *     product does NOT abort the others. Failures are logged + counted.
 *
 * USAGE
 * -----
 *   # Dry-run (default) — print what WOULD change, write nothing.
 *   bun run scripts/backfill-parent-cache.ts
 *
 *   # Apply — actually update the DB.
 *   bun run scripts/backfill-parent-cache.ts --apply
 *
 *   # Limit to first N products (for spot-checking on prod before full run).
 *   bun run scripts/backfill-parent-cache.ts --apply --limit 10
 *
 *   # Also process products whose cache is "already correct" (re-write
 *   # identical values — useful only for verifying the script runs cleanly).
 *   bun run scripts/backfill-parent-cache.ts --apply --force
 *
 * EXIT CODES
 * ----------
 *   0  All products processed (or would-be, in dry-run) with zero errors.
 *   1  One or more products errored during processing. Details logged.
 *      Re-run the script — idempotent, will retry only what's still wrong.
 */
import { PrismaClient } from '@prisma/client'
import { deriveParentCacheFromVariants } from '../src/lib/product-variants'

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------
const args = new Set(process.argv.slice(2))
const APPLY = args.has('--apply')
const FORCE = args.has('--force')
const LIMIT_IDX = process.argv.indexOf('--limit')
const LIMIT =
  LIMIT_IDX !== -1 && process.argv[LIMIT_IDX + 1]
    ? Math.max(0, parseInt(process.argv[LIMIT_IDX + 1], 10))
    : 0 // 0 = no limit

if (APPLY) {
  console.log('=== MODE: APPLY (writes to DB) ===')
} else {
  console.log('=== MODE: DRY-RUN (no writes). Pass --apply to actually update. ===')
}
if (FORCE) {
  console.log('  --force: will rewrite identical values too (no-op for cache).')
}
if (LIMIT > 0) {
  console.log(`  --limit: processing at most ${LIMIT} products.`)
}
console.log('')

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const prisma = new PrismaClient({
  // Quiet logging — we print our own report.
  log: [{ level: 'error', emit: 'stdout' }],
})

interface Diff {
  productId: string
  slug: string
  name: string
  field: 'price' | 'salePrice' | 'stock'
  from: number | null
  to: number | null
}

interface ProductRow {
  id: string
  slug: string
  name: string
  price: number
  salePrice: number | null
  stock: number
}

async function main() {
  const where = { hasVariants: true, isActive: true }
  const total = await prisma.product.count({ where })
  console.log(`Found ${total} active variant products (hasVariants=true).`)
  if (total === 0) {
    console.log('Nothing to do. Exiting.')
    return
  }

  // Stream products in batches to avoid loading everything into memory at once.
  const BATCH = 100
  let processed = 0
  let changedCount = 0
  let unchangedCount = 0
  let errorCount = 0
  const allDiffs: Diff[] = []

  // Use cursor-based pagination on a stable id (avoids SKIP-offset perf issues).
  let cursor: string | undefined
  while (true) {
    const products: ProductRow[] = await prisma.product.findMany({
      where,
      select: { id: true, slug: true, name: true, price: true, salePrice: true, stock: true },
      orderBy: { id: 'asc' },
      take: BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    })
    if (products.length === 0) break

    for (const p of products) {
      processed++
      if (LIMIT > 0 && processed > LIMIT) {
        console.log(`  --limit ${LIMIT} reached. Stopping.`)
        // Flush summary + exit.
        printSummary(processed - 1, changedCount, unchangedCount, errorCount, allDiffs, APPLY)
        await prisma.$disconnect()
        return
      }

      try {
        // Fetch this product's variants (ALL of them — active flag determines
        // inclusion in the derivation; we need inactive ones too so we can see
        // if e.g. an inactive variant should be excluded from stock sum).
        const variants = await prisma.productVariant.findMany({
          where: { productId: p.id },
          select: {
            price: true,
            salePrice: true,
            stock: true,
            isActive: true,
            sortOrder: true,
          },
        })

        const derived = deriveParentCacheFromVariants(variants)

        // Compute diffs (only count fields whose values actually differ).
        const diffs: Diff[] = []
        if (p.price !== derived.price) {
          diffs.push({ productId: p.id, slug: p.slug, name: p.name, field: 'price', from: p.price, to: derived.price })
        }
        if ((p.salePrice ?? null) !== (derived.salePrice ?? null)) {
          diffs.push({ productId: p.id, slug: p.slug, name: p.name, field: 'salePrice', from: p.salePrice, to: derived.salePrice })
        }
        if (p.stock !== derived.stock) {
          diffs.push({ productId: p.id, slug: p.slug, name: p.name, field: 'stock', from: p.stock, to: derived.stock })
        }

        if (diffs.length === 0) {
          unchangedCount++
          // --force rewrites identical values (rare; for testing only).
          if (!FORCE) continue
        } else {
          changedCount++
          allDiffs.push(...diffs)
          // Log the diff inline so the operator sees progress.
          for (const d of diffs) {
            console.log(
              `  [${APPLY ? 'UPDATE' : 'DRY  '}] ${p.slug} (${p.name}) ` +
              `${d.field}: ${fmt(d.from)} → ${fmt(d.to)}`
            )
          }
        }

        if (APPLY) {
          // Each product is its own transaction — a failure here doesn't
          // abort the whole backfill. We write only the three cache fields.
          await prisma.$transaction(async (tx) => {
            await tx.product.update({
              where: { id: p.id },
              data: {
                price: derived.price,
                salePrice: derived.salePrice,
                stock: derived.stock,
              },
            })
          })
        }
      } catch (e: any) {
        errorCount++
        console.error(`  [ERROR] ${p.slug} (${p.name}): ${e?.message || e}`)
      }
    }

    cursor = products[products.length - 1].id
  }

  printSummary(processed, changedCount, unchangedCount, errorCount, allDiffs, APPLY)
}

function fmt(v: number | null): string {
  if (v === null) return 'null'
  return String(v)
}

function printSummary(
  processed: number,
  changed: number,
  unchanged: number,
  errors: number,
  diffs: Diff[],
  apply: boolean
) {
  console.log('')
  console.log('=== SUMMARY ===')
  console.log(`  Processed : ${processed}`)
  console.log(`  Changed   : ${changed}`)
  console.log(`  Unchanged : ${unchanged}`)
  console.log(`  Errors    : ${errors}`)
  if (apply) {
    console.log(`  DB writes : ${changed} (only changed rows; idempotent)`)
  } else {
    console.log(`  DB writes : 0 (dry-run; re-run with --apply to write)`)
  }

  // Aggregate diff stats by field.
  const byField: Record<string, number> = {}
  for (const d of diffs) {
    byField[d.field] = (byField[d.field] || 0) + 1
  }
  if (Object.keys(byField).length > 0) {
    console.log('  Diffs by field:')
    for (const [field, count] of Object.entries(byField)) {
      console.log(`    ${field.padEnd(10)} : ${count}`)
    }
  }

  if (errors > 0) {
    console.log('')
    console.log(`⚠  ${errors} product(s) errored. Re-run the script — it is idempotent.`)
  }
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
main()
  .catch(async (e) => {
    console.error('\n=== FATAL ERROR ===')
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
