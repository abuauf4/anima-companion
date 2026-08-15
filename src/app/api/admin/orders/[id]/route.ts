import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, handleAuthError } from '@/lib/admin-auth'
import { updateOrderStatus, OrderError } from '@/lib/orders'

/**
 * PUT /api/admin/orders/:id — update an order's status.
 *
 * Rules enforced (see src/lib/orders.ts):
 *
 * - Admin role required (requireAdmin).
 * - Status must be one of: PENDING, CONFIRMED, PROCESSED, COMPLETED, CANCELLED.
 * - Transition INTO CANCELLED restores stock atomically (exactly once).
 * - Re-cancelling an already-CANCELLED order is a no-op (does NOT double-restore).
 * - Transition OUT of CANCELLED to any other status is REJECTED (400).
 *   CANCELLED is terminal for V1.
 * - Ordinary transitions (PENDING → CONFIRMED, etc.) do NOT modify stock.
 *   Stock was already decremented at order creation time.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('orders.manage')
    const { id } = await params
    const body = await req.json()
    const { status } = body

    const order = await updateOrderStatus(id, status)
    return NextResponse.json({ order })
  } catch (e: any) {
    const authRes = handleAuthError(e)
    if (authRes) return authRes
    if (e instanceof OrderError) {
      return NextResponse.json(
        { error: e.message, code: e.code },
        { status: e.status }
      )
    }
    console.error('Update order status error:', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
