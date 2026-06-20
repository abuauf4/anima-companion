import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const { code, subtotal } = await req.json()

    if (!code) {
      return NextResponse.json({ error: 'Kode voucher wajib diisi' }, { status: 400 })
    }

    const voucher = await db.voucher.findUnique({
      where: { code: code.toUpperCase().trim() },
    })

    if (!voucher || !voucher.isActive) {
      return NextResponse.json({ error: 'Kode voucher tidak valid' }, { status: 404 })
    }

    if (voucher.validUntil && new Date(voucher.validUntil) < new Date()) {
      return NextResponse.json({ error: 'Voucher sudah kedaluwarsa' }, { status: 400 })
    }

    if (subtotal < voucher.minSpend) {
      return NextResponse.json({
        error: `Minimal belanja ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(voucher.minSpend)} untuk menggunakan voucher ini`,
      }, { status: 400 })
    }

    const discount =
      voucher.type === 'PERCENTAGE'
        ? Math.round((subtotal * voucher.value) / 100)
        : voucher.value

    return NextResponse.json({
      voucher: {
        code: voucher.code,
        type: voucher.type,
        value: voucher.value,
        discount,
        description: voucher.description,
      },
    })
  } catch (e) {
    console.error('Voucher validate error:', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
