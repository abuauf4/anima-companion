import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'

export async function GET() {
  try {
    await requireAdmin()
    const vouchers = await db.voucher.findMany({
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ vouchers })
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
    const { code, type, value, minSpend, description, isActive, validUntil } = body

    if (!code || !type || !value) {
      return NextResponse.json({ error: 'Kode, tipe, dan nilai wajib diisi' }, { status: 400 })
    }

    const voucher = await db.voucher.create({
      data: {
        code: code.toUpperCase().trim(),
        type,
        value: parseInt(value),
        minSpend: parseInt(minSpend) || 0,
        description: description || null,
        isActive: isActive !== false,
        validUntil: validUntil ? new Date(validUntil) : null,
      },
    })
    return NextResponse.json({ voucher })
  } catch (e: any) {
    if (e.message === 'UNAUTHORIZED' || e.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Tidak diizinkan' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
