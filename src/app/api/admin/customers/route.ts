import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, handleAuthError, logAuthError } from '@/lib/auth'

/**
 * GET /api/admin/customers — Member Registry list.
 *
 * Member Registry = CUSTOMER users only. ADMIN and SELLER accounts are
 * operational staff identities, not customer/member records, and must NOT
 * appear in the member list, search results, or CSV export — otherwise the
 * dataset that Anima consumes for offline doorprize operations would be
 * contaminated by staff accounts. Google-authenticated members are still
 * CUSTOMER users (`provider: 'GOOGLE'` + `role: 'CUSTOMER'`) — provider and
 * role are orthogonal concepts.
 *
 * The `role: 'CUSTOMER'` filter is HARDCODED — there is no `role` query
 * param. The operator cannot broaden the registry to include ADMIN/SELLER
 * from the UI.
 *
 * QUERY PARAMS (all optional):
 *   search    — string, case-insensitive contains on name OR email OR phone
 *   verified  — 'true' | 'false' (filter by emailVerifiedAt !== null)
 *   provider  — 'PASSWORD' | 'GOOGLE' (case-insensitive)
 *   page      — 1-indexed page number (default 1)
 *   limit     — page size (default 20, max 100 to avoid unbounded queries)
 *
 * PRIVACY (PHASE 9):
 *   The Prisma `select` is an EXPLICIT WHITELIST. It NEVER includes:
 *     - password (bcrypt hash)
 *     - providerSubject (Google `sub` — sensitive identity-provider data)
 *     - EmailVerificationToken rows (raw token hashes, expiry, etc.)
 *   Defense-in-depth: even if Prisma client behavior changes, the explicit
 *   select ensures these columns never reach the response body.
 *
 * AUTHORIZATION (PHASE 8):
 *   requireAdmin() — guest → 401 (UNAUTHENTICATED), customer → 403
 *   (FORBIDDEN), admin → allowed. UI hiding alone is NOT sufficient.
 */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin()
    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search')?.trim() || ''
    const verifiedParam = searchParams.get('verified')?.toLowerCase() || ''
    const providerParam = searchParams.get('provider')?.toUpperCase() || ''
    const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20') || 20))

    // Build the WHERE clause from the filters. Each filter is opt-in.
    // The `role: 'CUSTOMER'` filter is HARDCODED — ADMIN/SELLER are NEVER
    // part of the Member Registry regardless of operator-selected filters.
    type WhereClause = {
      OR?: Array<
        | { name: { contains: string; mode: 'insensitive' } }
        | { email: { contains: string; mode: 'insensitive' } }
        | { phone: { contains: string } }
      >
      emailVerifiedAt?: { not: null } | null
      provider?: string
      role: string // always 'CUSTOMER'
    }
    const where: WhereClause = { role: 'CUSTOMER' }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
      ]
    }

    if (verifiedParam === 'true') {
      // Verified = emailVerifiedAt is NOT NULL
      where.emailVerifiedAt = { not: null }
    } else if (verifiedParam === 'false') {
      // Unverified = emailVerifiedAt IS NULL
      where.emailVerifiedAt = null
    }

    if (providerParam === 'PASSWORD' || providerParam === 'GOOGLE') {
      where.provider = providerParam
    }

    const [total, members] = await Promise.all([
      db.user.count({ where }),
      db.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        // EXPLICIT WHITELIST — see PRIVACY section above.
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          provider: true,
          emailVerifiedAt: true,
          createdAt: true,
          // NEVER select: password, providerSubject
          // NEVER include: verificationTokens (raw token hashes)
          // Optional stats (kept lightweight — single count + last date).
          _count: {
            select: { orders: true },
          },
          orders: {
            select: { createdAt: true },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      }),
    ])

    // Shape the response — flatten the order stats for easy client consumption.
    const membersWithStats = members.map((m) => ({
      id: m.id,
      name: m.name,
      email: m.email,
      phone: m.phone,
      role: m.role,
      provider: m.provider,
      emailVerifiedAt: m.emailVerifiedAt,
      // Convenience boolean for the client (so the UI doesn't have to do
      // null-checks everywhere).
      emailVerified: m.emailVerifiedAt !== null,
      createdAt: m.createdAt,
      totalOrders: m._count.orders,
      lastOrderAt: m.orders[0]?.createdAt ?? null,
    }))

    return NextResponse.json({
      members: membersWithStats,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      // Echo the active filters back to the client so the UI can render
      // active-filter chips and so the export endpoint can reuse the same
      // query params without re-parsing.
      filters: {
        search,
        verified: verifiedParam || null,
        provider: providerParam || null,
      },
    })
  } catch (e) {
    const authRes = handleAuthError(e)
    if (authRes) return authRes
    logAuthError('Admin members list error', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
