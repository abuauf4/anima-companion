import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { invalidate } from '@/lib/cache'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
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

    const updated = await db.testimonial.update({
      where: { id },
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
    return NextResponse.json({ testimonial: updated })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg === 'UNAUTHORIZED' || msg === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Tidak diizinkan' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    await db.testimonial.delete({ where: { id } })
    invalidate('home:')
    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg === 'UNAUTHORIZED' || msg === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Tidak diizinkan' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
