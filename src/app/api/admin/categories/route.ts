import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'

export async function GET() {
  try {
    await requireAdmin()
    const categories = await db.category.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: true } } },
    })
    return NextResponse.json({ categories })
  } catch (e: any) {
    if (e.message === 'UNAUTHORIZED' || e.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Tidak diizinkan' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
    const body = await req.json()
    const { name, icon } = body
    if (!name) return NextResponse.json({ error: 'Nama wajib diisi' }, { status: 400 })

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

    const existing = await db.category.findUnique({ where: { slug } })
    if (existing) return NextResponse.json({ error: 'Kategori sudah ada' }, { status: 409 })

    const category = await db.category.create({ data: { name, slug, icon: icon || null } })
    return NextResponse.json({ category })
  } catch (e: any) {
    if (e.message === 'UNAUTHORIZED' || e.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Tidak diizinkan' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
