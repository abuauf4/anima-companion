import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission, handleAuthError } from '@/lib/admin-auth'

export async function GET() {
  try {
    await requirePermission('banners.view')
    const banners = await db.banner.findMany({
      orderBy: [{ position: 'asc' }, { order: 'asc' }],
    })
    return NextResponse.json({ banners })
  } catch (e: any) {
    const authRes = handleAuthError(e)
    if (authRes) return authRes
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await requirePermission('banners.manage')
    const body = await req.json()
    const { title, subtitle, imageUrl, link, position, order, isActive } = body
    if (!title || !imageUrl) {
      return NextResponse.json({ error: 'Title dan imageUrl wajib diisi' }, { status: 400 })
    }

    const banner = await db.banner.create({
      data: {
        title, subtitle: subtitle || null,
        imageUrl, link: link || null,
        position: position || 'HOME',
        order: order || 0,
        isActive: isActive !== false,
      },
    })
    return NextResponse.json({ banner })
  } catch (e: any) {
    const authRes = handleAuthError(e)
    if (authRes) return authRes
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
