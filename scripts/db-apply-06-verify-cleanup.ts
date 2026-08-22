/**
 * Post-test cleanup verification — ensure no QA rows leaked into production.
 *
 * Run: bun run scripts/db-apply-06-verify-cleanup.ts
 */
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL! } } })

async function main() {
  console.log('=== POST-TEST CLEANUP VERIFICATION ===\n')

  // Count QA rows by name pattern (anything starting with 'QA ' or 'qa-' should be gone)
  const qaProducts = await prisma.product.findMany({
    where: { OR: [{ name: { startsWith: 'QA ' } }, { sku: { startsWith: 'QA-' } }] },
    select: { id: true, name: true, sku: true },
  })
  const qaUsers = await prisma.user.findMany({
    where: { OR: [{ email: { contains: '@test.local' } }, { name: { startsWith: 'QA ' } }] },
    select: { id: true, email: true, name: true },
  })
  const qaOrders = await prisma.order.findMany({
    where: { OR: [{ customerName: { startsWith: 'QA' } }, { customerPhone: { in: ['08', '081234567890'] } }] },
    select: { id: true, orderNumber: true, customerName: true },
  })
  const qaVariants = await prisma.productVariant.findMany({
    where: { name: { in: ['10 kapsul', '30 kapsul', '60 kapsul', '60 ml'] } },
    select: { id: true, name: true, productId: true },
  })

  // Also check ProductVariant rows whose product no longer exists (orphans)
  const orphanVariants: Array<{ id: string; name: string; productId: string }> = await prisma.$queryRaw`
    SELECT pv.id, pv.name, pv."productId"
    FROM "ProductVariant" pv
    LEFT JOIN "Product" p ON p.id = pv."productId"
    WHERE p.id IS NULL
  `

  console.log(`QA products remaining:  ${qaProducts.length}`)
  for (const p of qaProducts) console.log(`  - ${p.id} ${p.name} (${p.sku})`)

  console.log(`QA users remaining:     ${qaUsers.length}`)
  for (const u of qaUsers) console.log(`  - ${u.id} ${u.email} (${u.name})`)

  console.log(`QA orders remaining:    ${qaOrders.length}`)
  for (const o of qaOrders) console.log(`  - ${o.id} ${o.orderNumber} (${o.customerName})`)

  console.log(`QA variants remaining:  ${qaVariants.length}`)
  for (const v of qaVariants) console.log(`  - ${v.id} ${v.name} (product: ${v.productId})`)

  console.log(`Orphan variants (no parent product):  ${orphanVariants.length}`)
  for (const v of orphanVariants) console.log(`  - ${v.id} ${v.name} (product: ${v.productId})`)

  // Final summary
  const totalLeftover = qaProducts.length + qaUsers.length + qaOrders.length + qaVariants.length + orphanVariants.length
  if (totalLeftover === 0) {
    console.log('\n✓ CLEANUP VERIFIED — no QA rows leaked into production')
    process.exit(0)
  } else {
    console.error(`\n✗ CLEANUP INCOMPLETE — ${totalLeftover} QA row(s) remaining`)
    process.exit(1)
  }
}

main().finally(() => prisma.$disconnect())
