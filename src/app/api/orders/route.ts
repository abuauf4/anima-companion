import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { createOrder, OrderError } from '@/lib/orders'

/**
 * GET /api/orders — list orders for the authenticated customer.
 *
 * Customers see only their own orders. Admins are NOT special-cased here
 * (they use /api/admin/orders which is role-guarded separately). If a user
 * is not authenticated, return 401.
 */
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const orders = await db.order.findMany({
      where: { userId: user.id },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ orders })
  } catch (e) {
    console.error('Get orders error:', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}

/**
 * POST /api/orders — create a customer order.
 *
 * SECURITY INVARIANTS:
 *
 * 1. The customer is derived from the authenticated server session via
 *    `getCurrentUser()`. The request body NEVER supplies a userId — any
 *    `userId` field in the body is ignored. Unauthenticated requests
 *    receive 401.
 *
 * 2. The body supplies only `{ items: [{productId, quantity}], ... }`.
 *    Product name, SKU, price, salePrice, stock, and isActive are all
 *    fetched server-side from PostgreSQL inside the create-order
 *    transaction. Client-supplied values for these are NEVER used.
 *
 * 3. Stock check and decrement are atomic inside the transaction. If any
 *    product is missing, inactive, or out of stock, the entire transaction
 *    rolls back — no partial orders, no negative stock.
 *
 * 4. Order numbers are generated race-safely via unique constraint + retry.
 *
 * See src/lib/orders.ts for the full implementation.
 */
export async function POST(req: NextRequest) {
  try {
    // ----- 1. Authenticate -----
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Login diperlukan untuk checkout', code: 'UNAUTHENTICATED' },
        { status: 401 }
      )
    }

    // ----- 2. Parse body (only productId + quantity + delivery info + voucher) -----
    const body = await req.json()
    const { items, customerName, customerPhone, address, notes, voucherCode } = body

    // ----- 3. Create the order (transactional stock integrity) -----
    const order = await createOrder({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
      },
      items,
      customerName,
      customerPhone,
      address,
      notes,
      voucherCode,
    })

    return NextResponse.json({ order })
  } catch (e: any) {
    // OrderError carries a structured status + code
    if (e instanceof OrderError) {
      return NextResponse.json(
        { error: e.message, code: e.code },
        { status: e.status }
      )
    }
    console.error('Create order error:', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
