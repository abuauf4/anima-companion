import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission, handleAuthError, logAuthError } from '@/lib/admin-auth'

/**
 * GET /api/admin/customers/[id] — Member detail.
 *
 * Returns a single CUSTOMER member's record + lightweight stats (order
 * count, last 5 orders). Read-only — admin cannot mutate emailVerifiedAt,
 * provider, providerSubject, or role from this endpoint (PHASE 6 — "Admin
 * tidak boleh mengubah emailVerifiedAt / provider / providerSubject / role
 * secara sembarang hanya dari member detail"). There is intentionally NO
 * POST/PATCH/PUT handler on this route.
 *
 * CUSTOMER-ONLY INVARIANT: the query is `findFirst({ where: { id, role:
 * 'CUSTOMER' } })`. If the requested id belongs to an ADMIN or SELLER, the
 * response is 404 MEMBER_NOT_FOUND — staff accounts are not member
 * records and must not be retrievable via the member detail endpoint.
 * Google members are still reachable (they have role='CUSTOMER' +
 * provider='GOOGLE').
 *
 * PRIVACY (PHASE 9): explicit Prisma select whitelist — NEVER includes
 * password, providerSubject, or any verification-token data.
 *
 * AUTHORIZATION (PHASE 8): requireAdmin() — 401 for guests, 403 for
 * non-admin authenticated users, allowed for admins.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission('customers.view')
    const { id } = await params

    // findFirst (NOT findUnique) — we add `role: 'CUSTOMER'` so an id
    // belonging to an ADMIN or SELLER returns null → 404. The detail
    // endpoint must never surface staff records as if they were members.
    const member = await db.user.findFirst({
      where: { id, role: 'CUSTOMER' },
      // EXPLICIT WHITELIST — see PHASE 9.
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        provider: true,
        emailVerifiedAt: true,
        createdAt: true,
        updatedAt: true,
        // NEVER select: password, providerSubject
        // NEVER include: verificationTokens (raw token hashes)
        _count: {
          select: { orders: true },
        },
        orders: {
          select: {
            id: true,
            orderNumber: true,
            total: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 5, // last 5 orders only — keeps payload bounded
        },
      },
    })

    if (!member) {
      return NextResponse.json(
        { error: 'Member tidak ditemukan', code: 'MEMBER_NOT_FOUND' },
        { status: 404 }
      )
    }

    // Flatten + add convenience boolean.
    return NextResponse.json({
      member: {
        ...member,
        emailVerified: member.emailVerifiedAt !== null,
      },
    })
  } catch (e) {
    const authRes = handleAuthError(e)
    if (authRes) return authRes
    logAuthError('Admin member detail error', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
