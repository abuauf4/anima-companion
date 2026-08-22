import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission, handleAuthError } from '@/lib/admin-auth'
import { ORDER_STATUS } from '@/lib/format'

/**
 * Parse a "YYYY-MM-DD" date string interpreted as Asia/Jakarta (WIB, UTC+7)
 * and return the UTC Date at the start (00:00:00.000) or end (23:59:59.999)
 * of that WIB day.
 *
 *   startOfDayWib('2026-08-23') → 2026-08-22T17:00:00.000Z
 *   endOfDayWib  ('2026-08-23') → 2026-08-23T16:59:59.999Z
 *
 * Returns null if the input is null/empty/invalid.
 *
 * Why hardcoded +07:00: Indonesia has not observed DST since 1964 and
 * has no plans to reintroduce it. A fixed offset is correct and avoids
 * platform-dependent IANA timezone databases (V8 vs Node vs Bun).
 */
function parseWibDate(input: string | null, endOfDay: boolean): Date | null {
  if (!input) return null
  const s = input.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  // Append time + explicit +07:00 offset so JS Date parses to an absolute UTC instant.
  const iso = endOfDay ? `${s}T23:59:59.999+07:00` : `${s}T00:00:00.000+07:00`
  const d = new Date(iso)
  return isNaN(d.getTime()) ? null : d
}

export async function GET(req: NextRequest) {
  try {
    await requirePermission('orders.view')
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = 20
    // Date range filter — interpreted as Asia/Jakarta (WIB, UTC+7).
    // `from` = start of WIB day, `to` = end of WIB day (inclusive both ends).
    // Stored on `Order.createdAt` as UTC TIMESTAMP — Prisma comparison is
    // against the absolute UTC instant, so the WIB→UTC conversion is done
    // here at the API layer (NOT at the DB layer).
    const from = parseWibDate(searchParams.get('from'), false)
    const to = parseWibDate(searchParams.get('to'), true)

    const where: any = {}
    if (status && status !== 'ALL') where.status = status
    if (from || to) {
      where.createdAt = {}
      if (from) where.createdAt.gte = from
      if (to) where.createdAt.lte = to
    }

    const [total, orders] = await Promise.all([
      db.order.count({ where }),
      db.order.findMany({
        where,
        include: {
          items: true,
          user: { select: { id: true, name: true, email: true, phone: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ])

    return NextResponse.json({
      orders,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (e: any) {
    const authRes = handleAuthError(e)
    if (authRes) return authRes
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
