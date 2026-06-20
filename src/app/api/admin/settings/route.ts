import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { invalidate } from '@/lib/cache'

/**
 * GET /api/admin/settings
 * Returns the singleton SiteSetting row. If none exists, creates one with defaults.
 */
export async function GET() {
  try {
    await requireAdmin()
    let settings = await db.siteSetting.findUnique({ where: { id: 'singleton' } })
    if (!settings) {
      settings = await db.siteSetting.create({ data: { id: 'singleton' } })
    }
    return NextResponse.json({ settings })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg === 'UNAUTHORIZED' || msg === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Tidak diizinkan' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}

/**
 * PUT /api/admin/settings
 * Updates the singleton SiteSetting row. Creates it if missing (upsert).
 */
export async function PUT(req: NextRequest) {
  try {
    await requireAdmin()
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
    }

    const settings = await db.siteSetting.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', ...data },
      update: data,
    })

    invalidate('home:')
    return NextResponse.json({ settings })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg === 'UNAUTHORIZED' || msg === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Tidak diizinkan' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
