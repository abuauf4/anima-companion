/**
 * Order integrity helpers.
 *
 * All order-creation and order-status-transition logic that touches stock
 * lives here so it can be reasoned about and tested in isolation.
 *
 * INVARIANTS enforced:
 *
 * 1. Every customer order belongs to an authenticated User (no guest checkout).
 * 2. Server is the single source of truth for product price, salePrice, stock,
 *    name, SKU, and isActive. Client-sent values for these are NEVER trusted.
 * 3. Stock check and decrement happen atomically inside the same transaction
 *    as Order/OrderItem creation. If any product is out of stock or inactive,
 *    the entire transaction rolls back — no partial orders, no negative stock.
 * 4. Duplicate productId entries in the request are aggregated server-side
 *    before stock validation.
 * 5. Order numbers (`AC-YYYYMMDD-NNN`) are generated race-safely via the
 *    existing `@unique` constraint + bounded retry on Prisma P2002.
 * 6. Cancellation restores stock exactly once. The cancellation claim is
 *    atomic at the database layer (`UPDATE WHERE status != CANCELLED`),
 *    so two concurrent CANCEL requests cannot both restock — exactly one
 *    wins the claim, the other returns idempotent success without touching
 *    stock.
 * 7. CANCELLED is terminal for V1, enforced at the database layer. Non-cancel
 *    status transitions use a conditional `UPDATE WHERE status != CANCELLED`,
 *    so a stale read cannot revive a CANCELLED order into CONFIRMED/etc.
 *    Concurrent CANCEL vs CONFIRMED can never produce CONFIRMED + restored stock.
 * 8. Multi-product stock mutations (decrement at order creation, increment at
 *    cancellation) lock product rows in canonical `productId` order to avoid
 *    deadlocks between concurrent multi-product checkouts.
 * 9. Voucher is server-authoritative. The client may only send `voucherCode`
 *    (a string key) — server resolves the voucher record from DB inside the
 *    create-order transaction and computes the authoritative discount from
 *    the server-computed subtotal. Client-supplied `discount`/`subtotal`/
 *    `total`/`voucherValue`/`voucherType`/`voucherId` fields in the request
 *    body are structurally unreachable from `createOrder()` — the input type
 *    only declares `voucherCode: string | null`, so any other voucher-related
 *    fields are silently dropped by destructuring.
 * 10. Invalid voucher is rejected EXPLICITLY with a structured error code
 *     (VOUCHER_NOT_FOUND / VOUCHER_INACTIVE / VOUCHER_EXPIRED /
 *     VOUCHER_MINIMUM_NOT_MET). The previous flow silently returned
 *     `{ discount: 0 }` for any invalid condition, which meant the customer
 *     entered a voucher and was charged full price without warning. The
 *     whole transaction rolls back on any voucher error — no partial order.
 * 11. Voucher rules enforced are ONLY those the schema supports: `isActive`,
 *     `validUntil`, `minSpend`, `type` (PERCENTAGE|FIXED), `value`. No
 *     `validFrom`, `maxDiscount`, `usageLimit`, `usedCount`, or per-customer
 *     `VoucherRedemption` model exists in the schema, so those rules are
 *     not enforced (and not invented).
 * 12. Voucher cancellation semantics: the existing Voucher model has no usage
 *     counter (`usedCount`) and no redemption record (`VoucherRedemption`),
 *     so there is no voucher state to restore on order CANCEL. The existing
 *     `cancelOrderAndRestoreStock` only restores stock — this is correct
 *     because voucher consumption is a no-op at the DB level. The
 *     `Order.voucherCode` field is a free-form string snapshot preserved
 *     on the order row for record-keeping, not a FK to Voucher.
 */

import { Prisma, PrismaClient } from '@prisma/client'
import { db } from '@/lib/db'
import { generateOrderNumber } from '@/lib/format'

// =====================================================
// Types
// =====================================================

export interface CreateOrderInput {
  user: { id: string; email: string; name: string | null; phone: string | null }
  // Variant support (Phase: Variants).
  // `variantId` is optional — null/undefined for non-variant products.
  // For variant products, the caller MUST supply a variantId; the server
  // enforces this in `atomicStockDecrement` (throws VARIANT_REQUIRED if
  // missing on a hasVariants=true product, or VARIANT_NOT_FOUND if the
  // variantId doesn't match any active variant of the product).
  items: Array<{ productId: string; quantity: number; variantId?: string | null }>
  customerName: string
  customerPhone: string
  address: string
  notes?: string | null
  voucherCode?: string | null
}

export type CreateOrderResult =
  | { ok: true; order: any }
  | { ok: false; status: 400 | 401 | 409; code: string; message: string }

// =====================================================
// Errors
// =====================================================

/**
 * OrderError carries an HTTP-style status code and a machine-readable code
 * so the API route can produce the correct response without try/parse.
 */
export class OrderError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

export const ORDER_ERRORS = {
  UNAUTHENTICATED: () => new OrderError(401, 'UNAUTHENTICATED', 'Login diperlukan untuk checkout'),
  EMPTY_CART: () => new OrderError(400, 'EMPTY_CART', 'Keranjang kosong'),
  MISSING_FIELDS: () => new OrderError(400, 'MISSING_FIELDS', 'Data pesanan tidak lengkap'),
  INVALID_QUANTITY: (productId: string) =>
    new OrderError(400, 'INVALID_QUANTITY', `Jumlah tidak valid untuk produk ${productId}`),
  PRODUCT_NOT_FOUND: (productId: string) =>
    new OrderError(400, 'PRODUCT_NOT_FOUND', `Produk tidak ditemukan: ${productId}`),
  // ORDER_NOT_FOUND is distinct from PRODUCT_NOT_FOUND so the API can return 404
  // when an order id is missing during cancellation / status updates, matching
  // the documented contract (404 order missing). Previously the code reused
  // PRODUCT_NOT_FOUND (400) for this case, which was a contract bug.
  ORDER_NOT_FOUND: (orderId: string) =>
    new OrderError(404, 'ORDER_NOT_FOUND', `Pesanan tidak ditemukan: ${orderId}`),
  PRODUCT_INACTIVE: (productId: string) =>
    new OrderError(400, 'PRODUCT_INACTIVE', `Produk tidak tersedia: ${productId}`),
  OUT_OF_STOCK: (productId: string) =>
    new OrderError(409, 'OUT_OF_STOCK', `Stok tidak mencukupi untuk produk: ${productId}`),
  // ----- Variant errors (Phase: Variants) -----
  // The server is the source of truth for variant identity. The client
  // sends a `variantId`; the server validates it against the product's
  // active variants. These errors cover the three failure modes:
  //   - product has variants but no variantId sent (client bug)
  //   - variantId doesn't match any variant of this product (client bug
  //     or stale variant id after admin deactivated/renamed it)
  //   - variant exists but is inactive (admin deactivated it)
  VARIANT_REQUIRED: (productId: string) =>
    new OrderError(400, 'VARIANT_REQUIRED', `Produk ${productId} memiliki varian — pilih varian terlebih dahulu`),
  VARIANT_NOT_FOUND: (productId: string, variantId: string) =>
    new OrderError(400, 'VARIANT_NOT_FOUND', `Varian tidak ditemukan: ${variantId} (produk ${productId})`),
  VARIANT_INACTIVE: (productId: string, variantId: string) =>
    new OrderError(400, 'VARIANT_INACTIVE', `Varian tidak tersedia: ${variantId} (produk ${productId})`),
  INVALID_TRANSITION: (from: string, to: string) =>
    new OrderError(400, 'INVALID_TRANSITION', `Tidak dapat mengubah status dari ${from} ke ${to}`),
  ORDER_NUMBER_CONFLICT: () =>
    new OrderError(500, 'ORDER_NUMBER_CONFLICT', 'Gagal membuat nomor pesanan unik, coba lagi'),
  // ----- Voucher errors -----
  // Structured errors for invalid vouchers. The previous implementation silently
  // returned { discount: 0, appliedVoucherCode: null } for ANY invalid condition
  // (not found / inactive / expired / below min spend), which meant the customer
  // entered a voucher code and was silently charged full price without warning.
  // These errors force explicit rejection so the customer gets a clear message
  // and the order is NOT created with the wrong total.
  //
  // VOUCHER_MINIMUM_NOT_MET carries the actual minSpend and current subtotal so
  // the client can render a helpful message ("Belanja Rp X lagi untuk pakai voucher ini").
  VOUCHER_NOT_FOUND: (code: string) =>
    new OrderError(404, 'VOUCHER_NOT_FOUND', `Kode voucher tidak ditemukan: ${code}`),
  VOUCHER_INACTIVE: (code: string) =>
    new OrderError(400, 'VOUCHER_INACTIVE', `Voucher tidak aktif: ${code}`),
  VOUCHER_EXPIRED: (code: string, expiredAt: Date) =>
    new OrderError(400, 'VOUCHER_EXPIRED', `Voucher sudah kedaluwarsa: ${code} (berlaku hingga ${expiredAt.toISOString().slice(0, 10)})`),
  VOUCHER_MINIMUM_NOT_MET: (code: string, minSpend: number, subtotal: number) =>
    new OrderError(
      400,
      'VOUCHER_MINIMUM_NOT_MET',
      `Minimal belanja ${minSpend} untuk voucher ${code}. Subtotal Anda ${subtotal}. Tambah belanja ${Math.max(0, minSpend - subtotal)} lagi untuk memakai voucher ini.`
    ),
} as const

// =====================================================
// Internal: canonical (productId, variantId) ordering (deadlock avoidance)
// =====================================================

/**
 * Composite comparator for sorting items by (productId, variantId).
 *
 * Used to ensure all transactions acquire row locks in the SAME order when
 * decrementing or restocking multiple products/variants. Without this, two
 * concurrent multi-product orders can deadlock:
 *
 *   Order A: lock P1 → wait for P2
 *   Order B: lock P2 → wait for P1
 *   → PostgreSQL aborts one transaction as deadlock victim.
 *
 * By always sorting by (productId, variantId) before the lock loop, every
 * transaction acquires locks in the same canonical order, eliminating
 * AB-BA deadlocks. Data is never corrupted (the deadlock victim rolls back
 * cleanly), but the customer gets a spurious 500 — this fix removes that
 * failure mode.
 *
 * variantId is treated as the empty string when null/undefined — this is
 * safe because real cuids are never empty, so non-variant items sort
 * before variant items of the same product (deterministic).
 */
function byProductAndVariantId<
  T extends { productId: string; variantId?: string | null }
>(a: T, b: T): number {
  if (a.productId !== b.productId) {
    return a.productId < b.productId ? -1 : 1
  }
  const av = a.variantId || ''
  const bv = b.variantId || ''
  return av < bv ? -1 : av > bv ? 1 : 0
}

// Backward-compat alias — old tests may import `byProductId`. Keep the
// same signature so existing tests still compile.
function byProductId<T extends { productId: string; variantId?: string | null }>(a: T, b: T): number {
  return byProductAndVariantId(a, b)
}

// =====================================================
// Internal: aggregate duplicate cart items
// =====================================================

/**
 * Merge items with the same (productId, variantId) by summing their
 * quantities. Returns items in stable insertion order (first occurrence
 * wins).
 *
 * Variant-aware (Phase: Variants):
 *   Two cart items with the same productId but DIFFERENT variantId are
 *   NOT merged — they represent different variants of the same product
 *   and must remain separate order lines.
 *
 * Example: [{A,null,2},{B,null,1},{A,null,3},{A,"v1",1}]
 *        → [{A,null,5},{B,null,1},{A,"v1",1}]
 */
export function aggregateCartItems(
  items: Array<{ productId: string; quantity: number; variantId?: string | null }>
): Array<{ productId: string; quantity: number; variantId: string | null }> {
  // Normalize variantId: undefined → null (so the Map key is consistent).
  const normalize = (v: string | null | undefined) => (v ?? null)
  const map = new Map<string, { productId: string; quantity: number; variantId: string | null }>()
  const order: string[] = []
  for (const item of items) {
    const variantId = normalize(item.variantId)
    const key = `${item.productId}::${variantId || ''}`
    if (!map.has(key)) {
      order.push(key)
      map.set(key, { productId: item.productId, quantity: 0, variantId })
    }
    const existing = map.get(key)!
    existing.quantity += item.quantity
  }
  return order.map((key) => map.get(key)!)
}

// =====================================================
// Internal: validate aggregated items
// =====================================================

/**
 * Validate that every quantity is a positive integer. productId must be a
 * non-empty string. variantId (if present) must be a non-empty string.
 *
 * Throws OrderError(400, 'INVALID_QUANTITY', ...) on first violation.
 */
function validateQuantities(
  items: Array<{ productId: string; quantity: number; variantId?: string | null }>
) {
  for (const item of items) {
    if (
      !item.productId ||
      typeof item.quantity !== 'number' ||
      !Number.isInteger(item.quantity) ||
      item.quantity <= 0
    ) {
      throw ORDER_ERRORS.INVALID_QUANTITY(item.productId || '(unknown)')
    }
    // variantId, if present, must be a non-empty string. (null/undefined
    // is fine — that means non-variant product.)
    if (item.variantId !== null && item.variantId !== undefined && item.variantId === '') {
      throw ORDER_ERRORS.INVALID_QUANTITY(item.productId)
    }
  }
}

// =====================================================
// Internal: order-number generation (race-safe)
// =====================================================

/**
 * Count today's orders and generate a candidate order number.
 *
 * This is NOT race-safe by itself — two concurrent transactions can both
 * see count=N and both generate `AC-...-(N+1)`. The race is resolved by
 * the `Order.orderNumber @unique` constraint + the retry loop in
 * `createOrderWithRetry`.
 */
async function nextOrderNumberCandidate(tx: Prisma.TransactionClient): Promise<string> {
  const today = new Date()
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const todayCount = await tx.order.count({
    where: { createdAt: { gte: todayStart } },
  })
  return generateOrderNumber(todayCount + 1)
}

// =====================================================
// Internal: atomic stock decrement for one product
// =====================================================

interface ResolvedProduct {
  id: string
  name: string
  sku: string
  price: number
  salePrice: number | null
  stock: number
  isActive: boolean
  // Variant fields (Phase: Variants).
  // For non-variant products: `hasVariants=false`, `variantId=null`,
  // `variantName=null`. The price/stock above are the authoritative
  // Product-level values (same as before variants existed).
  // For variant products: `hasVariants=true`, `variantId=<the chosen
  // variant's id>`, `variantName=<its name>`. The price/stock above are
  // the VARIANT's authoritative values, NOT the parent Product's cache.
  hasVariants: boolean
  variantId: string | null
  variantName: string | null
}

/**
 * Atomically check + decrement stock for ONE product (or ONE variant of a
 * variant product) inside a transaction.
 *
 * Variant-aware (Phase: Variants):
 *   - If the product has `hasVariants=true`, the caller MUST supply a
 *     `variantId`. We fetch the variant by (productId, variantId) and
 *     decrement `ProductVariant.stock` (not `Product.stock`). The variant
 *     must be active. The returned `ResolvedProduct` carries the variant's
 *     price/salePrice/stock/name.
 *   - If the product has `hasVariants=false`, behavior is unchanged —
 *     we decrement `Product.stock` and return Product-level price/stock.
 *
 * In BOTH cases, the decrement uses `updateMany` with a WHERE clause that
 * requires `isActive = true AND stock >= requestedQuantity`. The decrement
 * happens in the same SQL UPDATE statement, so it's atomic at the row level
 * — two concurrent transactions cannot both pass the check.
 *
 * Throws:
 *   - PRODUCT_NOT_FOUND     — product missing
 *   - PRODUCT_INACTIVE      — product.isActive=false
 *   - VARIANT_REQUIRED      — product has variants but no variantId supplied
 *   - VARIANT_NOT_FOUND     — variantId doesn't match any variant of this
 *                             product (or product has no variants at all)
 *   - VARIANT_INACTIVE      — variant exists but isActive=false
 *   - OUT_OF_STOCK          — atomic update affected 0 rows
 */
async function atomicStockDecrement(
  tx: Prisma.TransactionClient,
  productId: string,
  quantity: number,
  variantId: string | null | undefined
): Promise<ResolvedProduct> {
  // First, fetch authoritative product data. We need `hasVariants` to know
  // whether to decrement Product.stock or ProductVariant.stock.
  const product = await tx.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      name: true,
      sku: true,
      price: true,
      salePrice: true,
      stock: true,
      isActive: true,
      hasVariants: true,
    },
  })

  if (!product) {
    throw ORDER_ERRORS.PRODUCT_NOT_FOUND(productId)
  }
  if (!product.isActive) {
    throw ORDER_ERRORS.PRODUCT_INACTIVE(productId)
  }

  // ---- Variant branch ----
  if (product.hasVariants) {
    if (!variantId) {
      throw ORDER_ERRORS.VARIANT_REQUIRED(productId)
    }
    const variant = await tx.productVariant.findUnique({
      where: { id: variantId },
      select: { id: true, productId: true, name: true, price: true, salePrice: true, stock: true, isActive: true },
    })
    if (!variant || variant.productId !== productId) {
      throw ORDER_ERRORS.VARIANT_NOT_FOUND(productId, variantId)
    }
    if (!variant.isActive) {
      throw ORDER_ERRORS.VARIANT_INACTIVE(productId, variantId)
    }

    // Atomic conditional decrement on the VARIANT row.
    // Equivalent SQL:
    //   UPDATE "ProductVariant"
    //   SET stock = stock - $1
    //   WHERE id = $2 AND "isActive" = true AND stock >= $1
    const result = await tx.productVariant.updateMany({
      where: {
        id: variantId,
        isActive: true,
        stock: { gte: quantity },
      },
      data: {
        stock: { decrement: quantity },
      },
    })

    if (result.count !== 1) {
      // Either variant stock was insufficient, or variant was deactivated
      // between our findUnique and our updateMany. Either way, the order
      // cannot proceed.
      throw ORDER_ERRORS.OUT_OF_STOCK(productId)
    }

    return {
      id: product.id,
      name: product.name,
      sku: product.sku,
      // Use the VARIANT's price/salePrice, NOT the parent product cache.
      price: variant.price,
      salePrice: variant.salePrice,
      stock: variant.stock, // pre-decrement stock, for snapshot
      isActive: product.isActive,
      hasVariants: true,
      variantId: variant.id,
      variantName: variant.name,
    }
  }

  // ---- Non-variant branch (unchanged behavior) ----
  // Atomic conditional decrement on the Product row.
  const result = await tx.product.updateMany({
    where: {
      id: productId,
      isActive: true,
      stock: { gte: quantity },
    },
    data: {
      stock: { decrement: quantity },
    },
  })

  if (result.count !== 1) {
    // Either stock was insufficient, or product was deactivated between
    // our findUnique and our updateMany. Either way, the order cannot proceed.
    throw ORDER_ERRORS.OUT_OF_STOCK(productId)
  }

  return {
    ...product,
    hasVariants: false,
    variantId: null,
    variantName: null,
  }
}

// =====================================================
// Internal: voucher validation (server-authoritative, structured errors)
// =====================================================

/**
 * Resolve voucher by code. Returns {discount, appliedVoucherCode, voucher} on
 * success. Throws OrderError on any invalid condition — the previous flow
 * silently returned zero discount and let the order proceed at full price,
 * which meant the customer entered a voucher code and was charged full price
 * without any warning that the voucher was invalid.
 *
 * RULES ENFORCED (only those the schema actually supports — no invented rules):
 *   1. voucherCode falsy → no voucher applied, return zero discount (NOT an error)
 *   2. voucher not found by code → throw VOUCHER_NOT_FOUND (404)
 *   3. isActive === false → throw VOUCHER_INACTIVE (400)
 *   4. validUntil exists AND validUntil < now → throw VOUCHER_EXPIRED (400)
 *   5. subtotal < minSpend → throw VOUCHER_MINIMUM_NOT_MET (400)
 *
 * NOT ENFORCED (no schema field for these — do not invent):
 *   - validFrom / start date — Voucher has no validFrom column
 *   - maxDiscount cap — Voucher has no maxDiscount column
 *   - usageLimit / global quota — Voucher has no usageLimit column
 *   - per-customer redemption — no VoucherRedemption model exists
 *
 * DISCOUNT CALCULATION:
 *   - PERCENTAGE: Math.round(subtotal * value / 100)
 *   - FIXED: value (flat rupiah off)
 *   - No maxDiscount cap (field doesn't exist)
 *   - The `subtotal` argument is the server-authoritative subtotal computed
 *     from server product prices × server quantities, NEVER a client-supplied
 *     value. The client cannot influence this calculation except by choosing
 *     which products and quantities to put in the cart.
 *
 * Server-side authoritative. The client-sent voucherCode is just a key; the
 * discount value comes from the DB. The caller (createOrder) passes the
 * server-computed subtotal, so client-supplied subtotal/discount/total fields
 * in the request body are structurally unreachable from this code path.
 */
async function resolveVoucher(
  tx: Prisma.TransactionClient,
  voucherCode: string | null | undefined,
  subtotal: number
): Promise<{ discount: number; appliedVoucherCode: string | null }> {
  // Rule 1: no voucher code supplied — legitimate "no voucher" case, NOT an error.
  if (!voucherCode) {
    return { discount: 0, appliedVoucherCode: null }
  }

  const normalizedCode = voucherCode.toUpperCase().trim()
  const voucher = await tx.voucher.findUnique({
    where: { code: normalizedCode },
  })

  // Rule 2: code doesn't match any voucher.
  if (!voucher) {
    throw ORDER_ERRORS.VOUCHER_NOT_FOUND(normalizedCode)
  }

  // Rule 3: voucher exists but isActive=false (admin deactivated it).
  if (!voucher.isActive) {
    throw ORDER_ERRORS.VOUCHER_INACTIVE(normalizedCode)
  }

  // Rule 4: voucher has expired. validUntil is nullable — null means "no expiry".
  if (voucher.validUntil && new Date(voucher.validUntil) < new Date()) {
    throw ORDER_ERRORS.VOUCHER_EXPIRED(normalizedCode, new Date(voucher.validUntil))
  }

  // Rule 5: subtotal below minimum spend threshold.
  // `subtotal` here is the server-authoritative subtotal, never client-supplied.
  if (subtotal < voucher.minSpend) {
    throw ORDER_ERRORS.VOUCHER_MINIMUM_NOT_MET(normalizedCode, voucher.minSpend, subtotal)
  }

  // Discount calculation. No maxDiscount cap (field doesn't exist in schema).
  const discount =
    voucher.type === 'PERCENTAGE'
      ? Math.round((subtotal * voucher.value) / 100)
      : voucher.value

  return { discount, appliedVoucherCode: voucher.code }
}

// =====================================================
// Internal: build OrderItem records from resolved products
// =====================================================

interface OrderItemRecord {
  productId: string
  productName: string
  productSku: string
  price: number
  quantity: number
  subtotal: number
  // Variant snapshot (Phase: Variants).
  // variantId is the FK to ProductVariant (will be set to NULL by the DB
  // if the variant is later deleted, preserving the OrderItem row).
  // variantName is a denormalized snapshot — historical orders remain
  // readable even if the variant is renamed or deleted later.
  variantId: string | null
  variantName: string | null
}

/**
 * Compute authoritative per-item price and subtotal from the resolved product
 * snapshot. The price used is salePrice if set and less than the regular price,
 * otherwise the regular price — matching `effectivePrice()` in lib/format.ts.
 *
 * Variant-aware: for variant products, the resolved product already carries
 * the variant's price/salePrice (not the parent cache), so the same
 * effective-price logic applies uniformly. The variantId + variantName
 * snapshot is passed through to the OrderItem record.
 */
function buildOrderItemRecords(
  resolved: ResolvedProduct[],
  // Quantities keyed by `${productId}::${variantId||''}` — matches the
  // composite key used in `aggregateCartItems`. This lets us look up the
  // quantity for each resolved (product, variant) pair.
  quantities: Map<string, number>
): { items: OrderItemRecord[]; subtotal: number } {
  const orderItems: OrderItemRecord[] = []
  let subtotal = 0
  for (const product of resolved) {
    const key = `${product.id}::${product.variantId || ''}`
    const quantity = quantities.get(key)!
    const price =
      product.salePrice && product.salePrice < product.price
        ? product.salePrice
        : product.price
    const lineSubtotal = price * quantity
    subtotal += lineSubtotal
    orderItems.push({
      productId: product.id,
      productName: product.name,
      productSku: product.sku,
      price,
      quantity,
      subtotal: lineSubtotal,
      variantId: product.variantId,
      variantName: product.variantName,
    })
  }
  return { items: orderItems, subtotal }
}

// =====================================================
// Public: createOrder
// =====================================================

const MAX_ORDER_NUMBER_RETRIES = 5

/**
 * Create a customer order with full transactional stock + voucher integrity.
 *
 * Flow:
 * 1. Validate input (auth enforced by caller; items non-empty; quantities
 *    are positive integers).
 * 2. Aggregate duplicate productId entries, then sort by productId for
 *    canonical row-lock order (deadlock avoidance).
 * 3. Inside `db.$transaction`:
 *    a. For each unique productId: atomicStockDecrement() — this fetches
 *       authoritative product data AND atomically checks+decrements stock.
 *       If any product is missing/inactive/out-of-stock, throw → rollback.
 *    b. Compute subtotal from authoritative server prices × server quantities.
 *    c. Resolve voucher server-side using the server-computed subtotal.
 *       If voucher is invalid (not found / inactive / expired / below min),
 *       throw OrderError(VOUCHER_*) → rollback. NO silent ignore.
 *    d. Compute total = max(0, subtotal - authoritativeDiscount).
 *    e. Generate order number.
 *    f. Create Order + OrderItems with authoritative values.
 * 4. If step 3f fails with Prisma P2002 on orderNumber, retry the whole
 *    transaction (with a fresh count-based order number) up to
 *    MAX_ORDER_NUMBER_RETRIES times.
 *
 * TRANSACTION GUARANTEES:
 * - All stock decrements + voucher validation + Order creation succeed, OR
 *   NONE do. Stock can never go negative. No partial orders. No voucher
 *   consumed without a successful order (voucher has no usage state to consume
 *   in V1, but the pattern holds for future quota support).
 *
 * TAMPERING PROTECTION (server-authoritative calculation):
 * - The CreateOrderInput type only declares `voucherCode: string | null` for
 *   voucher-related fields. Any other voucher-related fields the client might
 *   send in the request body (e.g. `discount`, `subtotal`, `total`,
 *   `voucherValue`, `voucherType`, `voucherId`) are silently dropped by the
 *   destructuring at the API route layer — they never reach this function.
 * - `subtotal` is computed from server-fetched product prices × server-aggregated
 *   quantities. The client CANNOT influence this value.
 * - `discount` is computed from the server-resolved voucher record × the
 *   server-computed subtotal. The client CANNOT influence this value.
 * - `total` is computed as `max(0, subtotal - discount)`. The client CANNOT
 *   influence this value.
 * - `userId` is derived from the authenticated session at the API route layer,
 *   NEVER from the request body. The body's `userId` field (if sent) is
 *   silently dropped by destructuring.
 *
 * VOUCHER ERROR HANDLING:
 * - VOUCHER_NOT_FOUND (404): code doesn't match any voucher in DB.
 * - VOUCHER_INACTIVE (400): voucher.isActive === false.
 * - VOUCHER_EXPIRED (400): voucher.validUntil < now.
 * - VOUCHER_MINIMUM_NOT_MET (400): subtotal < voucher.minSpend.
 * - All voucher errors throw inside the transaction → entire transaction
 *   rolls back. No stock is decremented, no order is created. The customer
 *   must fix the voucher (or remove it) and retry.
 */
export async function createOrder(input: CreateOrderInput): Promise<any> {
  // ----- 1. Validate input -----
  if (!input.items?.length) {
    throw ORDER_ERRORS.EMPTY_CART()
  }
  if (!input.customerName || !input.customerPhone || !input.address) {
    throw ORDER_ERRORS.MISSING_FIELDS()
  }

  // ----- 2. Aggregate + validate quantities -----
  // Aggregate duplicates first (now keyed by productId+variantId), then sort
  // by (productId, variantId) so the per-product/variant stock-decrement loop
  // below acquires row locks in canonical order. This eliminates AB-BA
  // deadlocks between two concurrent multi-product checkouts.
  const aggregated = aggregateCartItems(input.items).sort(byProductAndVariantId)
  validateQuantities(aggregated)

  // Quantities map keyed by `${productId}::${variantId||''}` — matches the
  // composite key used in `buildOrderItemRecords`.
  const quantities = new Map(
    aggregated.map((i) => [`${i.productId}::${i.variantId || ''}`, i.quantity])
  )

  // Track which products are variant products so we can recompute their
  // parent cache after the transaction commits.
  const variantProductIds = new Set<string>()

  // ----- 3. Transaction with retry on order-number conflict -----
  let lastError: unknown
  for (let attempt = 0; attempt < MAX_ORDER_NUMBER_RETRIES; attempt++) {
    try {
      const order = await db.$transaction(async (tx) => {
        // 3a. Atomic stock check + decrement for each product/variant.
        //     Collect authoritative product snapshots in deterministic order.
        const resolved: ResolvedProduct[] = []
        for (const { productId, quantity, variantId } of aggregated) {
          // Sequential — preserves deterministic error ordering on failure.
          const product = await atomicStockDecrement(tx, productId, quantity, variantId)
          resolved.push(product)
          if (product.hasVariants) {
            variantProductIds.add(productId)
          }
        }

        // 3b. Compute subtotal from authoritative prices.
        const { items: orderItemRecords, subtotal } = buildOrderItemRecords(
          resolved,
          quantities
        )

        // 3c. Resolve voucher server-side.
        const { discount, appliedVoucherCode } = await resolveVoucher(
          tx,
          input.voucherCode,
          subtotal
        )
        const total = Math.max(0, subtotal - discount)

        // 3d. Generate order number.
        const orderNumber = await nextOrderNumberCandidate(tx)

        // 3e. Create Order + OrderItems. If two concurrent transactions
        //     generate the same orderNumber, the second one's INSERT will
        //     fail with P2002 on the `orderNumber @unique` constraint. We
        //     catch that outside the transaction and retry.
        const order = await tx.order.create({
          data: {
            orderNumber,
            userId: input.user.id, // authenticated user, NEVER from client
            status: 'PENDING',
            customerName: input.customerName,
            customerPhone: input.customerPhone,
            address: input.address,
            notes: input.notes || null,
            subtotal,
            discount,
            total,
            voucherCode: appliedVoucherCode,
            items: { create: orderItemRecords },
          },
          include: { items: true },
        })

        // 3f. Recompute parent Product cache for variant products.
        // The variant stock was decremented above; the parent Product.stock
        // cache must be updated to reflect the new sum. We do this INSIDE
        // the transaction so the cache update is atomic with the stock
        // decrement — no window where the cache is stale.
        //
        // We do this for EVERY variant product touched by this order, even
        // if only one variant's stock changed. The derivation is cheap
        // (single query per product) and keeps the cache consistent.
        for (const productId of variantProductIds) {
          const variants = await tx.productVariant.findMany({
            where: { productId },
            select: { price: true, salePrice: true, stock: true, isActive: true, sortOrder: true },
          })
          // Derive inline — same logic as `deriveParentCacheFromVariants`
          // but we don't import it here to keep orders.ts self-contained
          // (it already has enough imports). The logic is identical.
          const active = variants.filter((v) => v.isActive)
          if (active.length === 0) {
            await tx.product.update({
              where: { id: productId },
              data: { price: 0, salePrice: null, stock: 0 },
            })
            continue
          }
          const stock = active.reduce((s, v) => s + (v.stock || 0), 0)
          const sorted = [...active].sort((a, b) => {
            const pa = a.salePrice && a.salePrice < a.price ? a.salePrice : a.price
            const pb = b.salePrice && b.salePrice < b.price ? b.salePrice : b.price
            if (pa !== pb) return pa - pb
            return a.sortOrder - b.sortOrder
          })
          const winner = sorted[0]
          const winnerEffective = winner.salePrice && winner.salePrice < winner.price
            ? winner.salePrice
            : winner.price
          const salePrice = winner.salePrice && winner.salePrice < winner.price
            ? winner.salePrice
            : null
          await tx.product.update({
            where: { id: productId },
            data: { price: winnerEffective, salePrice, stock },
          })
        }

        return order
      })

      return order
    } catch (e: any) {
      lastError = e
      // Prisma unique-constraint violation on orderNumber → retry whole tx
      if (
        e?.code === 'P2002' &&
        Array.isArray(e?.meta?.target) &&
        e.meta.target.includes('orderNumber')
      ) {
        continue
      }
      // Any other error (including our OrderError throws for out-of-stock,
      // inactive product, variant errors, etc.) propagates immediately.
      throw e
    }
  }
  // Exhausted retries
  throw ORDER_ERRORS.ORDER_NUMBER_CONFLICT()
}

// =====================================================
// Public: cancelOrderAndRestoreStock
// =====================================================

/**
 * Transition an order to CANCELLED and restore stock exactly once.
 *
 * ATOMIC CLAIM SEMANTICS (concurrency-safe):
 *
 * The previous implementation read the order, checked `status === 'CANCELLED'`,
 * then restored stock and updated status. Under concurrency, two requests
 * could both read PENDING, both restore stock, and both set status —
 * resulting in stock being restored twice (e.g. 9 → 11 instead of 9 → 10).
 *
 * This implementation uses a conditional UPDATE as the claim:
 *
 *   UPDATE "Order"
 *   SET status = 'CANCELLED'
 *   WHERE id = ? AND status != 'CANCELLED'
 *
 * PostgreSQL row-level locking guarantees that only ONE concurrent
 * transaction receives `count === 1` from this UPDATE. All others receive
 * `count === 0` (because the row's status is already CANCELLED by the time
 * their UPDATE acquires the lock). Only the winner proceeds to restock.
 *
 * Rules:
 * - If the order doesn't exist → throw ORDER_NOT_FOUND (404).
 * - If the order is already CANCELLED → return idempotent success with
 *   `alreadyCancelled: true`. Stock is NOT touched.
 * - If the order is in any non-CANCELLED status → claim it atomically and
 *   restore stock for every OrderItem inside the same transaction. Only the
 *   transaction that wins the claim performs the restock.
 * - CANCELLED is terminal: callers should never pass a non-CANCELLED status
 *   after this. Use `updateOrderStatus` for ordinary transitions.
 *
 * Stock restoration uses `updateMany` (not `update`) so a deleted Product
 * row doesn't fail the cancellation — the order is still marked CANCELLED,
 * and the missing product simply doesn't get its stock restored.
 *
 * Items are restocked in canonical `productId` order to avoid deadlocks
 * with concurrent multi-product checkouts.
 */
export async function cancelOrderAndRestoreStock(orderId: string): Promise<{
  order: any
  alreadyCancelled: boolean
}> {
  return db.$transaction(async (tx) => {
    // 1. Fetch order + items. We need the items regardless of outcome
    //    (either to restock on claim-win, or to return them on idempotent skip).
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    })
    if (!order) {
      throw ORDER_ERRORS.ORDER_NOT_FOUND(orderId)
    }

    // 2. ATOMIC CLAIM. This is the concurrency-critical statement.
    //    Equivalent SQL:
    //      UPDATE "Order"
    //      SET status = 'CANCELLED', "updatedAt" = NOW()
    //      WHERE id = $1 AND status != 'CANCELLED'
    //    Returns affected-row count. Only one concurrent transaction gets 1.
    const claim = await tx.order.updateMany({
      where: { id: orderId, status: { not: 'CANCELLED' } },
      data: { status: 'CANCELLED' },
    })

    // 3. Lost the claim race — order was already CANCELLED by a concurrent
    //    transaction (or by a prior request in the same transaction, which is
    //    impossible here since we just fetched it). Idempotent success — do NOT
    //    restock. The winner has already restored (or is restoring) stock.
    if (claim.count === 0) {
      return { order, alreadyCancelled: true }
    }

    // 4. Won the claim. Restore stock for each item, in canonical
    //    (productId, variantId) order to avoid deadlocks with concurrent
    //    multi-product checkouts. We use updateMany (not update) so a
    //    deleted product/variant doesn't fail the whole cancellation —
    //    that product/variant simply doesn't get restocked.
    //
    //    Variant-aware (Phase: Variants):
    //    If the OrderItem has a non-null `variantId`, we restore stock on
    //    the ProductVariant row. Otherwise (non-variant product, or variant
    //    was deleted and variantId was set to null by SetNull), we restore
    //    on the Product row. The `variantId` snapshot column tells us which
    //    branch to take.
    //
    //    After restocking variant stock, we recompute the parent Product
    //    cache for any variant product whose stock changed. This keeps the
    //    parent cache in sync after cancellation.
    const itemsToRestore = [...order.items].sort(byProductAndVariantId)
    const variantProductsToRecompute = new Set<string>()
    for (const item of itemsToRestore) {
      if (item.variantId) {
        // Variant stock restore
        await tx.productVariant.updateMany({
          where: { id: item.variantId },
          data: { stock: { increment: item.quantity } },
        })
        // We need the productId to recompute the parent cache. The OrderItem
        // has it directly.
        variantProductsToRecompute.add(item.productId)
      } else {
        // Non-variant product stock restore (or variant was deleted —
        // restore on the Product row as a fallback that won't fail).
        await tx.product.updateMany({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        })
      }
    }

    // Recompute parent cache for variant products whose variant stock changed.
    // Same inline derivation as in createOrder.
    for (const productId of variantProductsToRecompute) {
      const variants = await tx.productVariant.findMany({
        where: { productId },
        select: { price: true, salePrice: true, stock: true, isActive: true, sortOrder: true },
      })
      const active = variants.filter((v) => v.isActive)
      if (active.length === 0) {
        await tx.product.update({
          where: { id: productId },
          data: { price: 0, salePrice: null, stock: 0 },
        })
        continue
      }
      const stock = active.reduce((s, v) => s + (v.stock || 0), 0)
      const sorted = [...active].sort((a, b) => {
        const pa = a.salePrice && a.salePrice < a.price ? a.salePrice : a.price
        const pb = b.salePrice && b.salePrice < b.price ? b.salePrice : b.price
        if (pa !== pb) return pa - pb
        return a.sortOrder - b.sortOrder
      })
      const winner = sorted[0]
      const winnerEffective = winner.salePrice && winner.salePrice < winner.price
        ? winner.salePrice
        : winner.price
      const salePrice = winner.salePrice && winner.salePrice < winner.price
        ? winner.salePrice
        : null
      await tx.product.update({
        where: { id: productId },
        data: { price: winnerEffective, salePrice, stock },
      })
    }

    // 5. Return the post-claim snapshot. We don't re-fetch since we know the
    //    only field that changed is `status` (and `updatedAt`, which Prisma
    //    auto-updated). Merge manually to avoid an extra round-trip.
    return {
      order: { ...order, status: 'CANCELLED' },
      alreadyCancelled: false,
    }
  })
}

// =====================================================
// Public: updateOrderStatus (ordinary transitions only)
// =====================================================

const TERMINAL_STATUS = 'CANCELLED'
const VALID_STATUSES = ['PENDING', 'CONFIRMED', 'PROCESSED', 'COMPLETED', 'CANCELLED']

/**
 * Update order status. Cancellation (transition INTO CANCELLED) must go
 * through `cancelOrderAndRestoreStock` to ensure stock is restored.
 *
 * ATOMIC TERMINAL GUARD (concurrency-safe):
 *
 * The previous implementation read the current status, validated it wasn't
 * CANCELLED, then issued a plain UPDATE. Under concurrency, a stale read
 * could let a CONFIRMED request slip through AFTER a concurrent CANCEL
 * had already restored stock — producing CONFIRMED status with stock
 * already restored (a worse corruption than the cancel-double-restock bug,
 * because the status says the order is active but inventory is gone).
 *
 * This implementation uses a conditional UPDATE as the guard:
 *
 *   UPDATE "Order"
 *   SET status = $newStatus
 *   WHERE id = $id AND status != 'CANCELLED'
 *
 * If `count === 0`, we refetch to disambiguate: missing → ORDER_NOT_FOUND,
 * or already CANCELLED → INVALID_TRANSITION. This eliminates the stale-read
 * window entirely.
 *
 * This function:
 * - Rejects unknown status values (400 INVALID_TRANSITION).
 * - Rejects transition FROM CANCELLED → any other status (400 INVALID_TRANSITION)
 *   at the database layer — even under concurrent requests.
 * - For an already-CANCELLED order transitioning to CANCELLED, delegates to
 *   `cancelOrderAndRestoreStock` which is idempotent.
 * - For non-CANCELLED → CANCELLED, delegates to `cancelOrderAndRestoreStock`
 *   (which uses the atomic claim pattern).
 * - For all other transitions (PENDING → CONFIRMED, etc.), performs a
 *   conditional atomic status update. Stock is NOT modified — it was already
 *   decremented at order creation time.
 */
export async function updateOrderStatus(orderId: string, newStatus: string): Promise<any> {
  if (!VALID_STATUSES.includes(newStatus)) {
    throw ORDER_ERRORS.INVALID_TRANSITION('(unknown)', newStatus)
  }

  // Transition INTO CANCELLED — delegate to the cancellation helper which
  // restores stock atomically (atomic claim) and is idempotent on already-CANCELLED.
  if (newStatus === 'CANCELLED') {
    const result = await cancelOrderAndRestoreStock(orderId)
    return result.order
  }

  // ATOMIC CONDITIONAL UPDATE — only succeeds if order is NOT CANCELLED.
  // Equivalent SQL:
  //   UPDATE "Order"
  //   SET status = $1
  //   WHERE id = $2 AND status != 'CANCELLED'
  // If a concurrent CANCEL won the race between our (implicit) read and our
  // UPDATE, our UPDATE affects 0 rows. We then refetch to surface the proper
  // error: ORDER_NOT_FOUND (404) if missing, or INVALID_TRANSITION (400) if
  // the order is now CANCELLED.
  const result = await db.order.updateMany({
    where: { id: orderId, status: { not: 'CANCELLED' } },
    data: { status: newStatus },
  })

  if (result.count === 0) {
    // Either the order doesn't exist, OR a concurrent transaction already
    // transitioned it to CANCELLED. Disambiguate by refetching the row.
    const current = await db.order.findUnique({
      where: { id: orderId },
      select: { status: true },
    })
    if (!current) {
      throw ORDER_ERRORS.ORDER_NOT_FOUND(orderId)
    }
    // Status is CANCELLED → terminal violation for V1.
    throw ORDER_ERRORS.INVALID_TRANSITION(TERMINAL_STATUS, newStatus)
  }

  // Ordinary status change succeeded — return updated order. No stock modification.
  return db.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  })
}

// =====================================================
// Internal helpers exported for tests
// =====================================================

/**
 * Test-only helper: exposes the atomic stock decrement for unit tests.
 * Not used by the application code path; tests call this directly to verify
 * the concurrency logic without going through createOrder.
 */
export const __test__ = {
  aggregateCartItems,
  atomicStockDecrement,
  buildOrderItemRecords,
  resolveVoucher,
  nextOrderNumberCandidate,
  cancelOrderAndRestoreStock,
  updateOrderStatus,
  byProductId,
  byProductAndVariantId,
  MAX_ORDER_NUMBER_RETRIES,
}
