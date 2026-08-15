import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission, handleAuthError, logAuthError } from '@/lib/admin-auth'

/**
 * GET /api/admin/customers/export — CSV export of member registry.
 *
 * Respects the SAME query params as the list endpoint:
 *   search, verified, provider
 *
 * The `role: 'CUSTOMER'` filter is HARDCODED — there is no `role` query
 * param. ADMIN and SELLER rows are NEVER included in the CSV, so the
 * doorprize dataset Anima consumes from this export is staff-account-free.
 *
 * Page/limit are ignored — export returns ALL matching rows (the use case
 * is "download the filtered set for offline doorprize operations", not
 * "download page 1 of 20"). We cap at 50,000 rows to prevent runaway
 * memory usage; above that the operator should narrow the filters.
 *
 * CSV columns (PHASE 7):
 *   id, name, email, phone, role, provider, emailVerified,
 *   emailVerifiedAt, createdAt, totalOrders, lastOrderAt
 *
 * NEVER EXPORTED (PHASE 9):
 *   password, passwordHash, providerSubject, session data, verification
 *   tokens, AUTH_SECRET, any secret.
 *
 * The CSV is generated manually (no PapaParse dependency) to keep the
 * bundle small. Values are RFC 4180-quoted: any value containing comma,
 * double-quote, or newline is wrapped in double-quotes with embedded
 * double-quotes doubled.
 *
 * AUTHORIZATION (PHASE 8): requireAdmin() — 401/403 enforced.
 */
export async function GET(req: NextRequest) {
  try {
    await requirePermission('customers.export')
    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search')?.trim() || ''
    const verifiedParam = searchParams.get('verified')?.toLowerCase() || ''
    const providerParam = searchParams.get('provider')?.toUpperCase() || ''

    // Same WHERE clause as the list endpoint — kept in sync so the export
    // matches what the operator sees on screen. The `role: 'CUSTOMER'`
    // filter is hardcoded — exports cannot be broadened to ADMIN/SELLER.
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
      where.emailVerifiedAt = { not: null }
    } else if (verifiedParam === 'false') {
      where.emailVerifiedAt = null
    }

    if (providerParam === 'PASSWORD' || providerParam === 'GOOGLE') {
      where.provider = providerParam
    }

    // Fetch all matching rows (capped at 50k). Explicit whitelist select.
    const members = await db.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50000,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        provider: true,
        emailVerifiedAt: true,
        createdAt: true,
        _count: { select: { orders: true } },
        orders: {
          select: { createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    })

    // Build CSV.
    const headers = [
      'id',
      'name',
      'email',
      'phone',
      'role',
      'provider',
      'emailVerified',
      'emailVerifiedAt',
      'createdAt',
      'totalOrders',
      'lastOrderAt',
    ]

    const rows = members.map((m) => [
      m.id,
      m.name,
      m.email,
      m.phone ?? '',
      m.role,
      m.provider,
      m.emailVerifiedAt !== null ? 'true' : 'false',
      m.emailVerifiedAt ? m.emailVerifiedAt.toISOString() : '',
      m.createdAt.toISOString(),
      String(m._count.orders),
      m.orders[0]?.createdAt ? m.orders[0].createdAt.toISOString() : '',
    ])

    const csv = [headers, ...rows]
      .map((row) => row.map(csvEscape).join(','))
      .join('\r\n')

    // Filename includes the active filters + a timestamp so operators can
    // tell multiple exports apart in their downloads folder.
    const filterParts: string[] = []
    if (search) filterParts.push(`search-${sanitizeFilename(search)}`)
    if (verifiedParam) filterParts.push(`verified-${verifiedParam}`)
    if (providerParam) filterParts.push(`provider-${providerParam}`)
    const filterSuffix = filterParts.length > 0 ? `_${filterParts.join('_')}` : ''
    const dateStr = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
    const filename = `anima-members_${dateStr}${filterSuffix}.csv`

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        // Disable caching — the export reflects current DB state.
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    })
  } catch (e) {
    const authRes = handleAuthError(e)
    if (authRes) return authRes
    logAuthError('Admin members export error', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}

/**
 * RFC 4180 CSV escaping: wrap value in double-quotes IF it contains comma,
 * double-quote, CR, or LF. Inside the quotes, double any double-quote.
 * Empty string stays empty (no quotes needed).
 */
function csvEscape(value: string): string {
  if (!value) return ''
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

/**
 * Sanitize a search string for inclusion in the export filename. Only
 * allow alphanumeric + dash + underscore; replace anything else with dash.
 * Truncate to 30 chars to keep filenames manageable.
 */
function sanitizeFilename(s: string): string {
  return s.replace(/[^a-zA-Z0-9-_]/g, '-').slice(0, 30)
}
