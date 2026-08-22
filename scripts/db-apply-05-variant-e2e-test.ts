/**
 * End-to-end variant flow smoke test — runs against the real DB.
 *
 * Tests:
 *   V1.  Create a variant product via admin API path (using helpers).
 *   V2.  Verify parent Product price/salePrice/stock cache matches variants.
 *   V3.  Create a customer + cart, add 2 different variants of the product.
 *   V4.  Checkout (createOrder) — verify variant stock decremented atomically.
 *   V5.  Verify OrderItem has variantId + variantName snapshot.
 *   V6.  Verify parent cache re-synced after order (sum stock, lowest price).
 *   V7.  Cancel the order — verify variant stock restored + parent cache re-synced.
 *   V8.  Update the product (admin PUT) — change variant prices/stocks — verify
 *        parent cache re-derived from new variant state, atomically.
 *   V9.  Add a second variant product + checkout both in one order — verify
 *        multi-product multi-variant checkout works.
 *   V10. Cleanup all QA rows.
 *
 * Run: bun run scripts/db-apply-05-variant-e2e-test.ts
 *
 * Exit code 0 = all pass, 1 = any fail.
 */
import { PrismaClient } from '@prisma/client'
import { createOrder, cancelOrderAndRestoreStock, OrderError } from '../src/lib/orders'
import { validateAdminVariants, deriveParentCacheFromVariants } from '../src/lib/product-variants'

// Use the DIRECT_URL (not pooled) for this one-shot test script.
// We explicitly pass the URL because Bun doesn't auto-load .env (only
// Prisma CLI does via its own dotenv integration). The pooler URL has
// issues with some Prisma transaction patterns in transaction mode; the
// direct URL is safer for one-shot admin/test scripts.
const DIRECT_URL = process.env.DIRECT_URL
if (!DIRECT_URL) {
  console.error('FATAL: DIRECT_URL env var not set')
  process.exit(1)
}
const prisma = new PrismaClient({ datasources: { db: { url: DIRECT_URL } } })

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

// Track QA rows for cleanup
const qaProductIds: string[] = []
const qaUserIds: string[] = []
const qaOrderIds: string[] = []
let qaCategoryId: string | null = null

async function cleanup() {
  console.log('\n--- Cleanup ---')
  for (const oid of qaOrderIds) {
    try { await prisma.order.delete({ where: { id: oid } }) } catch {}
  }
  for (const pid of qaProductIds) {
    try { await prisma.productVariant.deleteMany({ where: { productId: pid } }) } catch {}
    try { await prisma.productImage.deleteMany({ where: { productId: pid } }) } catch {}
    try { await prisma.productPetType.deleteMany({ where: { productId: pid } }) } catch {}
    try { await prisma.productProblem.deleteMany({ where: { productId: pid } }) } catch {}
    try { await prisma.cartItem.deleteMany({ where: { productId: pid } }) } catch {}
    try { await prisma.product.delete({ where: { id: pid } }) } catch {}
  }
  for (const uid of qaUserIds) {
    try { await prisma.cart.deleteMany({ where: { userId: uid } }) } catch {}
    try { await prisma.user.delete({ where: { id: uid } }) } catch {}
  }
  console.log('  cleanup done')
}

async function main() {
  console.log('=== VARIANT E2E SMOKE TEST ===\n')

  // ---- Setup: get a category ----
  let category = await prisma.category.findFirst()
  if (!category) {
    category = await prisma.category.create({
      data: { name: 'QA Variant Test Cat', slug: 'qa-variant-test-cat-' + Date.now() }
    })
    qaCategoryId = category.id
  }
  console.log(`Using category: ${category.name} (${category.id})\n`)

  // ============ V1. Create variant product via Prisma (mimics admin POST) ============
  console.log('--- V1. Create variant product ---')
  const variantInputs = [
    { name: '10 kapsul', price: 50000, salePrice: null, stock: 10, isActive: true },
    { name: '30 kapsul', price: 120000, salePrice: 99000, stock: 5, isActive: true },
    { name: '60 kapsul', price: 200000, salePrice: null, stock: 0, isActive: true },
  ]
  const validated = validateAdminVariants(variantInputs)
  if (!validated.ok) {
    console.error('  validation failed:', validated.error)
    process.exit(1)
  }
  const derivedCache = deriveParentCacheFromVariants(validated.variants)

  const product = await prisma.product.create({
    data: {
      name: 'QA Variant Product',
      slug: 'qa-variant-product-' + Date.now().toString(36),
      sku: 'QA-VAR-' + Date.now().toString(36),
      brand: 'QA Brand',
      price: derivedCache.price,
      salePrice: derivedCache.salePrice,
      stock: derivedCache.stock,
      description: 'QA test product',
      benefit: 'QA benefit',
      usage: 'QA usage',
      ingredients: 'QA ingredients',
      isActive: true,
      hasVariants: true,
      categoryId: category.id,
      images: { create: [{ url: '/products/qa/01.webp', alt: 'QA', order: 0 }] },
      variants: {
        create: validated.variants.map((v) => ({
          name: v.name,
          price: v.price,
          salePrice: v.salePrice,
          stock: v.stock,
          isActive: v.isActive,
          sortOrder: v.sortOrder,
        })),
      },
    },
    include: { variants: { orderBy: { sortOrder: 'asc' } } },
  })
  qaProductIds.push(product.id)
  console.log(`  Created product ${product.id} with ${product.variants.length} variants`)
  console.log(`  Parent cache: price=${product.price}, salePrice=${product.salePrice}, stock=${product.stock}`)

  // ============ V2. Verify parent cache matches variants ============
  console.log('\n--- V2. Verify parent cache correctness ---')
  // Lowest effective price: variant 1 (50000) < variant 2 salePrice (99000) < variant 3 (200000)
  // So parent.price = 50000, parent.salePrice = null (variant 1 has no salePrice)
  check('parent.price = 50000 (lowest effective)', product.price === 50000, `got ${product.price}`)
  check('parent.salePrice = null (winner has no sale)', product.salePrice === null, `got ${product.salePrice}`)
  check('parent.stock = 15 (10 + 5 + 0)', product.stock === 15, `got ${product.stock}`)

  // ============ V3. Create customer + cart, add 2 variants ============
  console.log('\n--- V3. Create customer + cart + 2 variant cart items ---')
  const user = await prisma.user.create({
    data: {
      email: `qa-variant-${Date.now()}@test.local`,
      password: '$2a$10$dummyhashfornonproductionuseonly',
      name: 'QA Variant User',
      role: 'CUSTOMER',
      emailVerifiedAt: new Date(),
    },
  })
  qaUserIds.push(user.id)
  const cart = await prisma.cart.create({ data: { userId: user.id } })

  const variant1 = product.variants[0] // 10 kapsul, stock 10
  const variant2 = product.variants[1] // 30 kapsul, stock 5

  // Add 3x variant1 + 2x variant2 (separate cart lines)
  await prisma.cartItem.create({
    data: { cartId: cart.id, productId: product.id, variantId: variant1.id, quantity: 3 },
  })
  await prisma.cartItem.create({
    data: { cartId: cart.id, productId: product.id, variantId: variant2.id, quantity: 2 },
  })
  const cartItems = await prisma.cartItem.findMany({ where: { cartId: cart.id } })
  check('cart has 2 separate lines for the 2 variants', cartItems.length === 2, `got ${cartItems.length}`)

  // ============ V4. Checkout via createOrder ============
  console.log('\n--- V4. Checkout (createOrder) ---')
  const orderInput = {
    user: { id: user.id, email: user.email, name: user.name, phone: user.phone },
    items: [
      { productId: product.id, quantity: 3, variantId: variant1.id },
      { productId: product.id, quantity: 2, variantId: variant2.id },
    ],
    customerName: 'QA Customer',
    customerPhone: '081234567890',
    address: 'QA Test Address',
    notes: null,
    voucherCode: null,
  }
  const order = await createOrder(orderInput)
  qaOrderIds.push(order.id)
  console.log(`  Order ${order.orderNumber} created with ${order.items.length} items`)
  check('order has 2 OrderItems (one per variant)', order.items.length === 2, `got ${order.items.length}`)

  // ============ V5. Verify OrderItem snapshots variantId + variantName ============
  console.log('\n--- V5. Verify OrderItem variantId + variantName snapshot ---')
  const item1 = order.items.find((i: any) => i.variantId === variant1.id)
  const item2 = order.items.find((i: any) => i.variantId === variant2.id)
  check('OrderItem for variant1 has correct variantId', !!item1 && item1.variantId === variant1.id)
  check('OrderItem for variant1 has variantName "10 kapsul"', !!item1 && item1.variantName === '10 kapsul')
  check('OrderItem for variant2 has correct variantId', !!item2 && item2.variantId === variant2.id)
  check('OrderItem for variant2 has variantName "30 kapsul"', !!item2 && item2.variantName === '30 kapsul')
  // variant1 price = 50000 (no sale), qty 3 → subtotal 150000
  check('OrderItem variant1 price = 50000', !!item1 && item1.price === 50000, `got ${item1?.price}`)
  check('OrderItem variant1 subtotal = 150000 (50000 × 3)', !!item1 && item1.subtotal === 150000, `got ${item1?.subtotal}`)
  // variant2 salePrice = 99000 < price 120000, qty 2 → subtotal 198000
  check('OrderItem variant2 price = 99000 (salePrice applied)', !!item2 && item2.price === 99000, `got ${item2?.price}`)
  check('OrderItem variant2 subtotal = 198000 (99000 × 2)', !!item2 && item2.subtotal === 198000, `got ${item2?.subtotal}`)

  // ============ V6. Verify variant stock decremented + parent cache re-synced ============
  console.log('\n--- V6. Verify variant stock decremented + parent cache re-synced ---')
  const v1After = await prisma.productVariant.findUnique({ where: { id: variant1.id } })
  const v2After = await prisma.productVariant.findUnique({ where: { id: variant2.id } })
  const productAfter = await prisma.product.findUnique({ where: { id: product.id } })
  check('variant1 stock: 10 → 7 (decremented by 3)', v1After?.stock === 7, `got ${v1After?.stock}`)
  check('variant2 stock: 5 → 3 (decremented by 2)', v2After?.stock === 3, `got ${v2After?.stock}`)
  // Parent stock cache = sum of all variant stocks = 7 + 3 + 0 = 10
  check('parent stock cache re-synced to 10 (7 + 3 + 0)', productAfter?.stock === 10, `got ${productAfter?.stock}`)
  // Parent price cache = lowest effective = 50000 (variant1, unchanged)
  check('parent price cache still 50000', productAfter?.price === 50000, `got ${productAfter?.price}`)
  check('parent salePrice cache still null', productAfter?.salePrice === null, `got ${productAfter?.salePrice}`)

  // ============ V7. Cancel order — verify stock restored + cache re-synced ============
  console.log('\n--- V7. Cancel order — verify stock restored + cache re-synced ---')
  const cancelResult = await cancelOrderAndRestoreStock(order.id)
  check('cancel returned alreadyCancelled=false', cancelResult.alreadyCancelled === false)

  const v1Cancelled = await prisma.productVariant.findUnique({ where: { id: variant1.id } })
  const v2Cancelled = await prisma.productVariant.findUnique({ where: { id: variant2.id } })
  const productCancelled = await prisma.product.findUnique({ where: { id: product.id } })
  check('variant1 stock restored: 7 → 10', v1Cancelled?.stock === 10, `got ${v1Cancelled?.stock}`)
  check('variant2 stock restored: 3 → 5', v2Cancelled?.stock === 5, `got ${v2Cancelled?.stock}`)
  check('parent stock cache re-synced back to 15 (10 + 5 + 0)', productCancelled?.stock === 15, `got ${productCancelled?.stock}`)

  // Idempotent re-cancel
  const cancelResult2 = await cancelOrderAndRestoreStock(order.id)
  check('re-cancel returns alreadyCancelled=true (idempotent)', cancelResult2.alreadyCancelled === true)
  const v1Idem = await prisma.productVariant.findUnique({ where: { id: variant1.id } })
  check('idempotent cancel did NOT re-restore stock', v1Idem?.stock === 10, `got ${v1Idem?.stock}`)

  // ============ V8. Admin PUT update — change variant prices/stocks ============
  console.log('\n--- V8. Admin PUT update variants (atomicity test) ---')
  // Simulate the admin PUT path: update variants + recompute parent cache in one tx.
  // We'll do it via the same db.$transaction pattern the route uses.
  const newVariantInputs = [
    { id: variant1.id, name: '10 kapsul', price: 60000, salePrice: 45000, stock: 8, isActive: true, sortOrder: 0 },
    { id: variant2.id, name: '30 kapsul', price: 110000, salePrice: null, stock: 4, isActive: true, sortOrder: 1 },
    // variant3 (60 kapsul) — soft-delete by removing from payload; it has 0 order items, so will hard-delete
  ]
  await prisma.$transaction(async (tx) => {
    // Update existing variants in payload
    for (const input of newVariantInputs) {
      await tx.productVariant.update({
        where: { id: input.id },
        data: {
          name: input.name,
          price: input.price,
          salePrice: input.salePrice,
          stock: input.stock,
          isActive: input.isActive,
          sortOrder: input.sortOrder,
        },
      })
    }
    // Hard-delete variant3 (no OrderItems)
    await tx.productVariant.delete({ where: { id: product.variants[2].id } })
    // Recompute parent cache
    const finalVariants = await tx.productVariant.findMany({
      where: { productId: product.id },
      select: { price: true, salePrice: true, stock: true, isActive: true, sortOrder: true },
    })
    const derived = deriveParentCacheFromVariants(finalVariants)
    await tx.product.update({
      where: { id: product.id },
      data: { price: derived.price, salePrice: derived.salePrice, stock: derived.stock },
    })
  })

  const productUpdated = await prisma.product.findUnique({
    where: { id: product.id },
    include: { variants: { orderBy: { sortOrder: 'asc' } } },
  })
  // Lowest effective: variant1 effective (45000 via salePrice) < variant2 price 110000 → winner = variant1.
  // Parent cache: price = winner NORMAL price (60000, NOT effective 45000),
  //               salePrice = winner salePrice (45000, active),
  //               stock = 8 + 4 = 12.
  // (Previous buggy behavior stored `price = 45000` = effective, causing
  //  `price === salePrice` → "Hemat 0%" on the storefront. Fixed.)
  check('after PUT: variant3 (60 kapsul) hard-deleted', productUpdated?.variants.length === 2, `got ${productUpdated?.variants.length}`)
  check('after PUT: parent.price = 60000 (winner NORMAL price, NOT effective)', productUpdated?.price === 60000, `got ${productUpdated?.price}`)
  check('after PUT: parent.salePrice = 45000 (winner active salePrice)', productUpdated?.salePrice === 45000, `got ${productUpdated?.salePrice}`)
  check('after PUT: parent.stock = 12 (8 + 4)', productUpdated?.stock === 12, `got ${productUpdated?.stock}`)

  // ============ V9. Multi-product multi-variant checkout ============
  console.log('\n--- V9. Multi-product multi-variant checkout ---')
  // Create a second variant product
  const product2 = await prisma.product.create({
    data: {
      name: 'QA Variant Product 2',
      slug: 'qa-variant-product-2-' + Date.now().toString(36),
      sku: 'QA-VAR2-' + Date.now().toString(36),
      brand: 'QA Brand',
      price: 0, // will be derived
      description: 'QA2', benefit: 'QA2', usage: 'QA2', ingredients: 'QA2',
      isActive: true,
      hasVariants: true,
      categoryId: category.id,
      images: { create: [{ url: '/products/qa2/01.webp', alt: 'QA2', order: 0 }] },
      variants: {
        create: [
          { name: '60 ml', price: 75000, salePrice: null, stock: 20, isActive: true, sortOrder: 0 },
        ],
      },
    },
    include: { variants: true },
  })
  qaProductIds.push(product2.id)
  // Derive parent cache (single variant: 75000, null, 20)
  await prisma.product.update({
    where: { id: product2.id },
    data: { price: 75000, salePrice: null, stock: 20 },
  })

  const order2 = await createOrder({
    user: { id: user.id, email: user.email, name: user.name, phone: user.phone },
    items: [
      { productId: product.id, quantity: 2, variantId: variant1.id },
      { productId: product2.id, quantity: 1, variantId: product2.variants[0].id },
    ],
    customerName: 'QA Customer 2',
    customerPhone: '081234567890',
    address: 'QA Test Address 2',
  })
  qaOrderIds.push(order2.id)
  check('multi-product order created', !!order2.id)
  check('multi-product order has 2 items', order2.items.length === 2, `got ${order2.items.length}`)

  // Verify both products' variant stocks decremented
  const p1v1After = await prisma.productVariant.findUnique({ where: { id: variant1.id } })
  const p2v1After = await prisma.productVariant.findUnique({ where: { id: product2.variants[0].id } })
  check('product1.variant1 stock: 8 → 6 (decremented by 2)', p1v1After?.stock === 6, `got ${p1v1After?.stock}`)
  check('product2.variant1 stock: 20 → 19 (decremented by 1)', p2v1After?.stock === 19, `got ${p2v1After?.stock}`)

  // Verify both products' parent caches re-synced
  const p1Final = await prisma.product.findUnique({ where: { id: product.id } })
  const p2Final = await prisma.product.findUnique({ where: { id: product2.id } })
  check('product1 parent stock re-synced (6 + 4 = 10)', p1Final?.stock === 10, `got ${p1Final?.stock}`)
  check('product2 parent stock re-synced (19)', p2Final?.stock === 19, `got ${p2Final?.stock}`)

  // ============ V10. Variant with 0 stock cannot be ordered ============
  console.log('\n--- V10. Out-of-stock variant rejection ---')
  // variant2 has stock 4, try to order 5 → should fail
  let oosError: any = null
  try {
    await createOrder({
      user: { id: user.id, email: user.email, name: user.name, phone: user.phone },
      items: [{ productId: product.id, quantity: 5, variantId: variant2.id }],
      customerName: 'QA OOS', customerPhone: '08', address: 'addr',
    })
  } catch (e: any) {
    oosError = e
  }
  check('ordering qty 5 of variant with stock 4 throws', oosError instanceof OrderError, `got ${oosError?.constructor.name}`)
  check('error code is OUT_OF_STOCK', (oosError as OrderError)?.code === 'OUT_OF_STOCK', `got ${(oosError as OrderError)?.code}`)

  // ============ V11. Variant required check ============
  console.log('\n--- V11. Variant-required check ---')
  let vrError: any = null
  try {
    await createOrder({
      user: { id: user.id, email: user.email, name: user.name, phone: user.phone },
      items: [{ productId: product.id, quantity: 1 }], // no variantId
      customerName: 'QA VR', customerPhone: '08', address: 'addr',
    })
  } catch (e: any) {
    vrError = e
  }
  check('ordering variant product without variantId throws', vrError instanceof OrderError)
  check('error code is VARIANT_REQUIRED', (vrError as OrderError)?.code === 'VARIANT_REQUIRED', `got ${(vrError as OrderError)?.code}`)

  // ============ Done ============
  console.log(`\n=== RESULTS: ${pass} passed, ${fail} failed ===`)
  if (fail > 0) process.exit(1)
}

main()
  .catch(async (e) => {
    console.error('\n=== TEST FAILED WITH FATAL ERROR ===')
    console.error(e)
    await cleanup()
    process.exit(1)
  })
  .finally(async () => {
    await cleanup()
    await prisma.$disconnect()
  })
