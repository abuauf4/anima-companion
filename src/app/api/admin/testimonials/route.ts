import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { invalidate } from '@/lib/cache'

export async function GET() {
  try {
    await requireAdmin()
    const testimonials = await db.testimonial.findMany({
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
    })
    return NextResponse.json({ testimonials })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg === 'UNAUTHORIZED' || msg === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Tidak diizinkan' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
    const body = await req.json()
    const { name, petName, petType, message, rating, avatar, isActive } = body

    if (!name || !petName || !petType || !message) {
      return NextResponse.json(
        { error: 'Nama, nama hewan, jenis hewan, dan pesan wajib diisi' },
        { status: 400 }
      )
    }

    const ratingNum = Number(rating) || 5
    if (ratingNum < 1 || ratingNum > 5) {
      return NextResponse.json(
        { error: 'Rating harus antara 1–5' },
        { status: 400 }
      )
    }

    const testimonial = await db.testimonial.create({
      data: {
        name: String(name).trim(),
        petName: String(petName).trim(),
        petType: String(petType).trim(),
        message: String(message).trim(),
        rating: ratingNum,
        avatar: avatar ? String(avatar) : null,
        isActive: isActive !== false,
      },
    })
    invalidate('home:')
    return NextResponse.json({ testimonial })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg === 'UNAUTHORIZED' || msg === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Tidak diizinkan' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
