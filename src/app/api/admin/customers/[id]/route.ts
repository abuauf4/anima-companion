import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, handleAuthError, logAuthError } from '@/lib/auth'

/**
 * GET /api/admin/customers/[id] — Member detail.
 *
 * Returns a single member's record + lightweight stats (order count, last
 * order date). Read-only — admin cannot mutate emailVerifiedAt, provider,
 * providerSubject, or role from this endpoint (PHASE 6 — "Admin tidak
 * boleh mengubah emailVerifiedAt / provider / providerSubject / role
 * secara sembarang hanya dari member detail"). There is intentionally NO
 * POST/PATCH/PUT handler on this route.
 *
 * PRIVACY (PHASE 9): explicit Prisma select whitelist — NEVER includes
 * password, providerSubject, or any verification-token data.
 *
 * AUTHORIZATION (PHASE 8): requireAdmin() — 401 for guests, 403 for
 * non-admin authenticated users, allowed for admins.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin()
    const { id } = params

    const member = await db.user.findUnique({
      where: { id },
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
