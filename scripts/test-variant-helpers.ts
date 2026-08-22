/**
 * Smoke test for the pure variant/order helpers — no DB required.
 *
 * Run with:
 *   bun run scripts/test-variant-helpers.ts
 *
 * This exercises the pure functions changed in the Variants phase:
 *   - aggregateCartItems (now keyed by productId+variantId)
 *   - byProductAndVariantId (canonical sort)
 *   - validateAdminVariants
 *   - deriveParentCacheFromVariants
 *
 * Exit code 0 = all pass, 1 = any fail.
 */

import { aggregateCartItems, __test__ } from '../src/lib/orders'
import { validateAdminVariants, deriveParentCacheFromVariants, variantEffectivePrice } from '../src/lib/product-variants'

let pass = 0
let fail = 0

function check(name: string, got: unknown, want: unknown) {
  const gotJ = JSON.stringify(got)
  const wantJ = JSON.stringify(want)
  if (gotJ === wantJ) {
    pass++
    // console.log(`  ✓ ${name}`)
  } else {
    fail++
    console.error(`  ✗ ${name}`)
    console.error(`    got:  ${gotJ}`)
    console.error(`    want: ${wantJ}`)
  }
}

console.log('== aggregateCartItems (variant-aware) ==')

// Case 1: non-variant items — same as before, merge by productId
check(
  'non-variant merge',
  aggregateCartItems([
    { productId: 'A', quantity: 2 },
    { productId: 'B', quantity: 1 },
    { productId: 'A', quantity: 3 },
  ]),
  [
    { productId: 'A', quantity: 5, variantId: null },
    { productId: 'B', quantity: 1, variantId: null },
  ]
)

// Case 2: same product, DIFFERENT variants — NOT merged
check(
  'different variants not merged',
  aggregateCartItems([
    { productId: 'A', quantity: 2, variantId: 'v1' },
    { productId: 'A', quantity: 3, variantId: 'v2' },
  ]),
  [
    { productId: 'A', quantity: 2, variantId: 'v1' },
    { productId: 'A', quantity: 3, variantId: 'v2' },
  ]
)

// Case 3: mixed — non-variant + variant of same product
check(
  'mixed variant + non-variant of same product',
  aggregateCartItems([
    { productId: 'A', quantity: 2 },
    { productId: 'A', quantity: 3, variantId: 'v1' },
    { productId: 'A', quantity: 1 },
  ]),
  [
    { productId: 'A', quantity: 3, variantId: null },
    { productId: 'A', quantity: 3, variantId: 'v1' },
  ]
)

// Case 4: undefined variantId normalized to null
check(
  'undefined variantId → null',
  aggregateCartItems([
    { productId: 'A', quantity: 1, variantId: undefined },
    { productId: 'A', quantity: 2 },
  ]),
  [{ productId: 'A', quantity: 3, variantId: null }]
)

console.log()
console.log('== byProductAndVariantId (canonical sort) ==')

const { byProductAndVariantId } = __test__

// Sort by productId first, then variantId (empty = non-variant sorts first)
check(
  'sort by productId then variantId',
  [
    { productId: 'B', variantId: null },
    { productId: 'A', variantId: 'v2' },
    { productId: 'A', variantId: null },
    { productId: 'A', variantId: 'v1' },
  ].sort(byProductAndVariantId),
  [
    { productId: 'A', variantId: null },
    { productId: 'A', variantId: 'v1' },
    { productId: 'A', variantId: 'v2' },
    { productId: 'B', variantId: null },
  ]
)

console.log()
console.log('== variantEffectivePrice ==')

check('salePrice < price', variantEffectivePrice({ price: 100, salePrice: 80 }), 80)
check('salePrice >= price (use price)', variantEffectivePrice({ price: 100, salePrice: 100 }), 100)
check('salePrice null', variantEffectivePrice({ price: 100, salePrice: null }), 100)

console.log()
console.log('== validateAdminVariants ==')

// Valid case
const valid = validateAdminVariants([
  { name: '10 kapsul', price: 50000, salePrice: 40000, stock: 10 },
  { name: '30 kapsul', price: 120000, salePrice: null, stock: 5 },
])
check('valid → ok=true', valid.ok, true)
if (valid.ok) {
  check('valid → 2 variants', valid.variants.length, 2)
  check('valid → sortOrder defaults to index', [valid.variants[0].sortOrder, valid.variants[1].sortOrder], [0, 1])
  check('valid → salePrice null preserved', valid.variants[1].salePrice, null)
}

// Empty
check('empty → ok=false', validateAdminVariants([]).ok, false)

// Duplicate names
check(
  'duplicate names → ok=false',
  validateAdminVariants([
    { name: '10 kapsul', price: 50000, stock: 10 },
    { name: '10 kapsul', price: 60000, stock: 5 },
  ]).ok,
  false
)

// Price <= 0
check(
  'price 0 → ok=false',
  validateAdminVariants([{ name: 'X', price: 0, stock: 10 }]).ok,
  false
)

// salePrice >= price
check(
  'salePrice >= price → ok=false',
  validateAdminVariants([{ name: 'X', price: 100, salePrice: 100, stock: 10 }]).ok,
  false
)

// Negative stock
check(
  'negative stock → ok=false',
  validateAdminVariants([{ name: 'X', price: 100, stock: -1 }]).ok,
  false
)

// All inactive
check(
  'all inactive → ok=false',
  validateAdminVariants([
    { name: 'X', price: 100, stock: 10, isActive: false },
    { name: 'Y', price: 200, stock: 5, isActive: false },
  ]).ok,
  false
)

// String inputs (from <Input type="number">)
const strInput = validateAdminVariants([
  { name: '10 kapsul', price: '50000', salePrice: '40000', stock: '10' },
])
check('string inputs ok', strInput.ok, true)
if (strInput.ok) {
  check('string price parsed', strInput.variants[0].price, 50000)
}

console.log()
console.log('== deriveParentCacheFromVariants ==')

// Single active variant — parent cache = that variant
check(
  'single active variant',
  deriveParentCacheFromVariants([
    { price: 50000, salePrice: null, stock: 10, isActive: true, sortOrder: 0 },
  ]),
  { price: 50000, salePrice: null, stock: 10 }
)

// Multiple variants — parent price = winner's NORMAL price (NOT effective).
// Winner = variant with lowest effective selling price.
// Here winner is variant 2 (effective 40000 via salePrice). Its NORMAL
// price is 50000, so parent.price = 50000 (NOT 40000), parent.salePrice
// = 40000, parent.stock = 5+10+3 = 18.
check(
  'multiple variants — lowest effective wins; parent.price = winner NORMAL',
  deriveParentCacheFromVariants([
    { price: 100000, salePrice: null, stock: 5, isActive: true, sortOrder: 0 },
    { price: 50000, salePrice: 40000, stock: 10, isActive: true, sortOrder: 1 },
    { price: 80000, salePrice: null, stock: 3, isActive: true, sortOrder: 2 },
  ]),
  { price: 50000, salePrice: 40000, stock: 18 }
)

// Inactive variants excluded from price but stock sum is of ACTIVE only
check(
  'inactive variant excluded',
  deriveParentCacheFromVariants([
    { price: 50000, salePrice: null, stock: 10, isActive: true, sortOrder: 0 },
    { price: 1000, salePrice: null, stock: 99, isActive: false, sortOrder: 1 },
  ]),
  // parent price = 50000 (only active variant), stock = 10 (only active)
  { price: 50000, salePrice: null, stock: 10 }
)

// No active variants
check(
  'no active variants → zeros',
  deriveParentCacheFromVariants([
    { price: 50000, salePrice: null, stock: 10, isActive: false, sortOrder: 0 },
  ]),
  { price: 0, salePrice: null, stock: 0 }
)

// Tie-break: same effective price, lower sortOrder wins.
// Both variants have effective price 50000 (variant1: 50000 flat,
// variant2: 60000 normal with 50000 salePrice). Tie → sortOrder 1 wins.
// Winner = variant2: NORMAL price 60000, salePrice 50000, stock 5+3=8.
// parent.price = 60000 (winner NORMAL), parent.salePrice = 50000 (winner sale).
check(
  'tie-break by sortOrder',
  deriveParentCacheFromVariants([
    { price: 50000, salePrice: null, stock: 5, isActive: true, sortOrder: 5 },
    { price: 60000, salePrice: 50000, stock: 3, isActive: true, sortOrder: 1 },
  ]),
  { price: 60000, salePrice: 50000, stock: 8 }
)

// Variant with salePrice >= price — sale is NOT active, so winner's
// effective price = its normal price. salePrice should be null on the
// parent (no active discount). parent.price = winner NORMAL price.
check(
  'winner with stale salePrice (>= price) → parent.salePrice = null',
  deriveParentCacheFromVariants([
    { price: 50000, salePrice: 60000, stock: 10, isActive: true, sortOrder: 0 },
    { price: 80000, salePrice: null, stock: 5, isActive: true, sortOrder: 1 },
  ]),
  // variant1 effective = 50000 (salePrice ignored since 60000 >= 50000),
  // variant2 effective = 80000. Winner = variant1. parent.price = 50000
  // (variant1 normal), parent.salePrice = null (no active sale),
  // parent.stock = 10 + 5 = 15.
  { price: 50000, salePrice: null, stock: 15 }
)

console.log()
console.log(`== Results: ${pass} passed, ${fail} failed ==`)
process.exit(fail === 0 ? 0 : 1)
