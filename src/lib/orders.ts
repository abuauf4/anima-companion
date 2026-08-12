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
 * 6. Cancellation restores stock exactly once. Re-cancelling an already
 *    CANCELLED order is a no-op (does not double-restore).
 * 7. CANCELLED is terminal for V1. Transitioning CANCELLED → any other
 *    status is rejected with a 400.
 */

import { Prisma, PrismaClient } from '@prisma/client'
import { db } from '@/lib/db'
import { generateOrderNumber } from '@/lib/format'

// =====================================================
// Types
// =====================================================

export interface CreateOrderInput {
  user: { id: string; email: string; name: string | null; phone: string | null }
  items: Array<{ productId: string; quantity: number }>
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
  PRODUCT_INACTIVE: (productId: string) =>
    new OrderError(400, 'PRODUCT_INACTIVE', `Produk tidak tersedia: ${productId}`),
  OUT_OF_STOCK: (productId: string) =>
    new OrderError(409, 'OUT_OF_STOCK', `Stok tidak mencukupi untuk produk: ${productId}`),
  INVALID_TRANSITION: (from: string, to: string) =>
    new OrderError(400, 'INVALID_TRANSITION', `Tidak dapat mengubah status dari ${from} ke ${to}`),
  ORDER_NUMBER_CONFLICT: () =>
    new OrderError(500, 'ORDER_NUMBER_CONFLICT', 'Gagal membuat nomor pesanan unik, coba lagi'),
} as const

// =====================================================
// Internal: aggregate duplicate cart items
// =====================================================

/**
 * Merge items with the same productId by summing their quantities.
 * Returns items in stable insertion order (first occurrence wins).
 *
 * Example: [{A,2},{B,1},{A,3}] → [{A,5},{B,1}]
 */
export function aggregateCartItems(
  items: Array<{ productId: string; quantity: number }>
): Array<{ productId: string; quantity: number }> {
  const map = new Map<string, number>()
  const order: string[] = []
  for (const item of items) {
    if (!map.has(item.productId)) {
      order.push(item.productId)
      map.set(item.productId, 0)
    }
    map.set(item.productId, (map.get(item.productId) || 0) + item.quantity)
  }
  return order.map((productId) => ({ productId, quantity: map.get(productId)! }))
}

// =====================================================
// Internal: validate aggregated items
// =====================================================

/**
 * Validate that every quantity is a positive integer. productId must be a
 * non-empty string.
 *
 * Throws OrderError(400, 'INVALID_QUANTITY', ...) on first violation.
 */
function validateQuantities(items: Array<{ productId: string; quantity: number }>) {
  for (const item of items) {
    if (
      !item.productId ||
      typeof item.quantity !== 'number' ||
      !Number.isInteger(item.quantity) ||
      item.quantity <= 0
    ) {
      throw ORDER_ERRORS.INVALID_QUANTITY(item.productId || '(unknown)')
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
}

/**
 * Atomically check + decrement stock for ONE product inside a transaction.
 *
 * Uses `updateMany` with a WHERE clause that requires both `isActive = true`
 * AND `stock >= requestedQuantity`. The decrement happens in the same SQL
 * UPDATE statement, so it's atomic at the row level — two concurrent
 * transactions cannot both pass the check.
 *
 * Returns the authoritative product snapshot (post-decrement stock is NOT
 * read back; we use pre-decrement values for the OrderItem record).
 *
 * Throws OUT_OF_STOCK if the update affected 0 rows (product missing,
 * inactive, or insufficient stock).
 */
async function atomicStockDecrement(
  tx: Prisma.TransactionClient,
  productId: string,
  quantity: number
): Promise<ResolvedProduct> {
  // First, fetch authoritative product data for the OrderItem snapshot.
  // We do NOT trust client-supplied name/sku/price.
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
    },
  })

  if (!product) {
    throw ORDER_ERRORS.PRODUCT_NOT_FOUND(productId)
  }
  if (!product.isActive) {
    throw ORDER_ERRORS.PRODUCT_INACTIVE(productId)
  }

  // Atomic conditional decrement. This is the concurrency-critical statement.
  // Equivalent SQL:
  //   UPDATE "Product"
  //   SET stock = stock - $1
  //   WHERE id = $2 AND "isActive" = true AND stock >= $1
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

  return product
}

// =====================================================
// Internal: voucher validation (preserved from previous flow)
// =====================================================

/**
 * Resolve voucher by code. Returns {discount, appliedCode} or zero discount
 * if the voucher is invalid/expired/below min spend. Does NOT mutate voucher
 * state — voucher usage tracking is out of scope for V1.
 *
 * Server-side authoritative. The client-sent voucherCode is just a key; the
 * discount value comes from the DB.
 */
async function resolveVoucher(
  tx: Prisma.TransactionClient,
  voucherCode: string | null | undefined,
  subtotal: number
): Promise<{ discount: number; appliedVoucherCode: string | null }> {
  if (!voucherCode) {
    return { discount: 0, appliedVoucherCode: null }
  }
  const voucher = await tx.voucher.findUnique({
    where: { code: voucherCode.toUpperCase().trim() },
  })
  if (!voucher || !voucher.isActive) {
    return { discount: 0, appliedVoucherCode: null }
  }
  if (voucher.validUntil && new Date(voucher.validUntil) < new Date()) {
    return { discount: 0, appliedVoucherCode: null }
  }
  if (subtotal < voucher.minSpend) {
    return { discount: 0, appliedVoucherCode: null }
  }
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
}

/**
 * Compute authoritative per-item price and subtotal from the resolved product
 * snapshot. The price used is salePrice if set and less than the regular price,
 * otherwise the regular price — matching `effectivePrice()` in lib/format.ts.
 */
function buildOrderItemRecords(
  resolved: ResolvedProduct[],
  quantities: Map<string, number>
): { items: OrderItemRecord[]; subtotal: number } {
  const orderItems: OrderItemRecord[] = []
  let subtotal = 0
  for (const product of resolved) {
    const quantity = quantities.get(product.id)!
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
    })
  }
  return { items: orderItems, subtotal }
}

// =====================================================
// Public: createOrder
// =====================================================

const MAX_ORDER_NUMBER_RETRIES = 5

/**
 * Create a customer order with full transactional stock integrity.
 *
 * Flow:
 * 1. Validate input (auth enforced by caller; items non-empty; quantities
 *    are positive integers).
 * 2. Aggregate duplicate productId entries.
 * 3. Inside `db.$transaction`:
 *    a. For each unique productId: atomicStockDecrement() — this fetches
 *       authoritative product data AND atomically checks+decrements stock.
 *       If any product is missing/inactive/out-of-stock, throw → rollback.
 *    b. Compute subtotal from authoritative prices.
 *    c. Resolve voucher server-side.
 *    d. Generate order number.
 *    e. Create Order + OrderItems.
 * 4. If step 3e fails with Prisma P2002 on orderNumber, retry the whole
 *    transaction (with a fresh count-based order number) up to
 *    MAX_ORDER_NUMBER_RETRIES times.
 *
 * The transaction guarantees: ALL stock decrements + Order creation succeed,
 * OR NONE do. Stock can never go negative. No partial orders.
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
  const aggregated = aggregateCartItems(input.items)
  validateQuantities(aggregated)

  const quantities = new Map(aggregated.map((i) => [i.productId, i.quantity]))

  // ----- 3. Transaction with retry on order-number conflict -----
  let lastError: unknown
  for (let attempt = 0; attempt < MAX_ORDER_NUMBER_RETRIES; attempt++) {
    try {
      return await db.$transaction(async (tx) => {
        // 3a. Atomic stock check + decrement for each product.
        //     Collect authoritative product snapshots in parallel.
        const resolved: ResolvedProduct[] = []
        for (const { productId, quantity } of aggregated) {
          // Sequential — preserves deterministic error ordering on failure.
          const product = await atomicStockDecrement(tx, productId, quantity)
          resolved.push(product)
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

        return order
      })
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
      // inactive product, etc.) propagates immediately.
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
 * Rules:
 * - If the order is already CANCELLED, return it without re-restoring stock
 *   (idempotent). Caller can detect this via `alreadyCancelled: true`.
 * - If the order is in any non-CANCELLED status, transition it to CANCELLED
 *   and restore stock for every OrderItem inside the same transaction.
 * - CANCELLED is terminal: callers should never pass a non-CANCELLED status
 *   after this. Use `updateOrderStatus` for ordinary transitions.
 *
 * Stock restoration uses `updateMany` (not `update`) so a deleted Product
 * row doesn't fail the cancellation — the order is still marked CANCELLED,
 * and the missing product simply doesn't get its stock restored.
 */
export async function cancelOrderAndRestoreStock(orderId: string): Promise<{
  order: any
  alreadyCancelled: boolean
}> {
  return db.$transaction(async (tx) => {
    // Read order WITH items in the same transaction to get a consistent
    // snapshot. We use the raw `findUnique` (not `findFirst`) so a missing
    // order is null rather than undefined.
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    })
    if (!order) {
      throw ORDER_ERRORS.PRODUCT_NOT_FOUND(orderId)
    }

    // Idempotent: already cancelled → no-op (do NOT double-restore).
    if (order.status === 'CANCELLED') {
      return { order, alreadyCancelled: true }
    }

    // Restore stock for each item. We use updateMany (not update) so a
    // deleted product doesn't fail the whole cancellation — the order is
    // still marked CANCELLED, that product simply doesn't get restocked.
    for (const item of order.items) {
      await tx.product.updateMany({
        where: { id: item.productId },
        data: { stock: { increment: item.quantity } },
      })
    }

    const updated = await tx.order.update({
      where: { id: orderId },
      data: { status: 'CANCELLED' },
      include: { items: true },
    })

    return { order: updated, alreadyCancelled: false }
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
 * This function:
 * - Rejects unknown status values (400).
 * - Rejects transition FROM CANCELLED → any other status (400). CANCELLED
 *   is terminal for V1.
 * - For an already-CANCELLED order transitioning to CANCELLED, delegates
 *   to `cancelOrderAndRestoreStock` which is idempotent.
 * - For non-CANCELLED → CANCELLED, delegates to `cancelOrderAndRestoreStock`.
 * - For all other transitions (PENDING → CONFIRMED, etc.), performs a plain
 *   status update. Stock is NOT modified — it was already decremented at
 *   order creation time.
 */
export async function updateOrderStatus(orderId: string, newStatus: string): Promise<any> {
  if (!VALID_STATUSES.includes(newStatus)) {
    throw ORDER_ERRORS.INVALID_TRANSITION('(unknown)', newStatus)
  }

  // Transition INTO CANCELLED — delegate to the cancellation helper which
  // restores stock atomically and is idempotent on already-CANCELLED.
  if (newStatus === 'CANCELLED') {
    const result = await cancelOrderAndRestoreStock(orderId)
    return result.order
  }

  // For any other transition, fetch the current status and validate.
  const current = await db.order.findUnique({
    where: { id: orderId },
    select: { status: true },
  })
  if (!current) {
    throw ORDER_ERRORS.PRODUCT_NOT_FOUND(orderId)
  }

  if (current.status === TERMINAL_STATUS) {
    // CANCELLED → anything else is forbidden for V1.
    throw ORDER_ERRORS.INVALID_TRANSITION(TERMINAL_STATUS, newStatus)
  }

  // Ordinary status change — no stock modification.
  return db.order.update({
    where: { id: orderId },
    data: { status: newStatus },
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
  MAX_ORDER_NUMBER_RETRIES,
}
