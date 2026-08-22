import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission, handleAuthError } from '@/lib/admin-auth'
import { invalidate } from '@/lib/cache'

/**
 * Parse a promo datetime value from the admin payload.
 *
 * Accepts:
 *   - ISO 8601 string with explicit timezone (e.g. "2026-08-23T00:00:00+07:00"
 *     or "2026-08-22T17:00:00Z") — used as-is, Prisma stores as UTC.
 *   - null / undefined / '' — returns null (no datetime set).
 *
 * The admin UI (SettingsView) constructs the ISO string with an explicit
 * +07:00 offset (Asia/Jakarta), so the server doesn't need to know the
 * admin's timezone — the offset is baked into the string.
 *
 * Returns Date | null. Invalid date strings (e.g. "not a date") fall back
 * to null rather than throwing — the start<end validation downstream will
 * surface the problem as a 400.
 */
function parsePromoDt(v: unknown): Date | null {
  if (v === null || v === undefined || v === '') return null
  const s = String(v).trim()
  if (!s) return null
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

/**
 * GET /api/admin/settings
 * Returns the singleton SiteSetting row. If none exists, creates one with defaults.
 */
export async function GET() {
  try {
    await requirePermission('settings.view')
    let settings = await db.siteSetting.findUnique({ where: { id: 'singleton' } })
    if (!settings) {
      settings = await db.siteSetting.create({ data: { id: 'singleton' } })
    }
    return NextResponse.json({ settings })
  } catch (e: unknown) {
    const authRes = handleAuthError(e)
    if (authRes) return authRes
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}

/**
 * PUT /api/admin/settings
 * Updates the singleton SiteSetting row. Creates it if missing (upsert).
 */
export async function PUT(req: NextRequest) {
  try {
    await requirePermission('settings.manage')
    const body = await req.json()

    // Coerce & sanitize all known fields
    const data = {
      heroEyebrow: String(body.heroEyebrow ?? '').slice(0, 200),
      heroTitle1: String(body.heroTitle1 ?? '').slice(0, 100),
      heroTitle2: String(body.heroTitle2 ?? '').slice(0, 100),
      heroDescription: String(body.heroDescription ?? '').slice(0, 1000),
      heroHookTitle1: String(body.heroHookTitle1 ?? '').slice(0, 100),
      heroHookTitle2: String(body.heroHookTitle2 ?? '').slice(0, 100),
      trustBadge1Value: String(body.trustBadge1Value ?? '').slice(0, 50),
      trustBadge1Label: String(body.trustBadge1Label ?? '').slice(0, 50),
      trustBadge2Value: String(body.trustBadge2Value ?? '').slice(0, 50),
      trustBadge2Label: String(body.trustBadge2Label ?? '').slice(0, 50),
      trustBadge3Value: String(body.trustBadge3Value ?? '').slice(0, 50),
      trustBadge3Label: String(body.trustBadge3Label ?? '').slice(0, 50),
      trustBadge4Value: String(body.trustBadge4Value ?? '').slice(0, 50),
      trustBadge4Label: String(body.trustBadge4Label ?? '').slice(0, 50),
      whatsappNumber: String(body.whatsappNumber ?? '').slice(0, 32),
      email: String(body.email ?? '').slice(0, 120),
      instagram: String(body.instagram ?? '').slice(0, 60),
      instagramUrl: String(body.instagramUrl ?? '').slice(0, 300),
      shopeeUrl: String(body.shopeeUrl ?? '').slice(0, 300),
      tokopediaUrl: String(body.tokopediaUrl ?? '').slice(0, 300),
      tiktokUrl: String(body.tiktokUrl ?? '').slice(0, 300),
      announcement1: String(body.announcement1 ?? '').slice(0, 200),
      announcement2: String(body.announcement2 ?? '').slice(0, 200),
      announcement3: String(body.announcement3 ?? '').slice(0, 200),
      announcement4: String(body.announcement4 ?? '').slice(0, 200),
      freeShippingThreshold: Number(body.freeShippingThreshold) || 0,
      // ---- Promo / Announcement campaign ----
      // See schema.prisma for the full state-machine semantics.
      // Datetimes are stored as UTC; admin input is interpreted as Asia/Jakarta
      // (WIB, UTC+7) — the WIB→UTC conversion is done client-side in
      // SettingsView so the server stays tz-agnostic and testable.
      promoActive: Boolean(body.promoActive),
      promoTitle: String(body.promoTitle ?? '').slice(0, 120),
      promoStartAt: parsePromoDt(body.promoStartAt),
      promoEndAt: parsePromoDt(body.promoEndAt),
      promoCountdown: Boolean(body.promoCountdown),
      promoTextBefore: String(body.promoTextBefore ?? '').slice(0, 200),
      promoTextDuring: String(body.promoTextDuring ?? '').slice(0, 200),
      promoLink: String(body.promoLink ?? '').slice(0, 300),
    }

    // Validate: if both datetimes are present, start must be strictly
    // before end. We reject (400) instead of silently swapping so the admin
    // sees the error and fixes their input.
    if (data.promoStartAt && data.promoEndAt && data.promoStartAt >= data.promoEndAt) {
      return NextResponse.json(
        { error: 'Tanggal & jam mulai harus lebih awal dari tanggal & jam selesai' },
        { status: 400 }
      )
    }
    // If only one of the two is set, reject — a promo campaign needs both
    // bounds to be well-defined (otherwise the state machine can't decide
    // before/during/after).
    if (data.promoActive && (!data.promoStartAt || !data.promoEndAt)) {
      return NextResponse.json(
        { error: 'Promo aktif memerlukan tanggal & jam mulai dan selesai' },
        { status: 400 }
      )
    }

    const settings = await db.siteSetting.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', ...data },
      update: data,
    })

    invalidate('home:')
    return NextResponse.json({ settings })
  } catch (e: unknown) {
    const authRes = handleAuthError(e)
    if (authRes) return authRes
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
