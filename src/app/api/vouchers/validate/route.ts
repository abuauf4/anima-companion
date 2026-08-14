import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * POST /api/vouchers/validate — pre-check a voucher code for the cart UI.
 *
 * This endpoint is purely informational: the cart view calls it to preview
 * the discount a voucher would apply BEFORE the customer clicks "Checkout".
 * The authoritative voucher validation happens server-side inside
 * `createOrder()` at order creation time — this preview can be wrong if the
 * voucher changes between this call and the actual checkout, and that's OK.
 *
 * INPUT:
 *   { code: string, subtotal: number }
 *
 * OUTPUT (success):
 *   { voucher: { code, type, value, discount, description } }
 *
 * ERROR CONTRACT (aligned with createOrder's VOUCHER_* errors so the cart
 * UI shows the same message the customer would see at checkout):
 *   400 — code missing or empty
 *   404 — code doesn't match any voucher         (VOUCHER_NOT_FOUND)
 *   400 — voucher.isActive === false             (VOUCHER_INACTIVE)
 *   400 — voucher.validUntil < now               (VOUCHER_EXPIRED)
 *   400 — subtotal < voucher.minSpend            (VOUCHER_MINIMUM_NOT_MET)
 *
 * The response carries a `code` field on error so the client can branch on
 * the same machine-readable codes used by /api/orders.
 */
export async function POST(req: NextRequest) {
  try {
    const { code, subtotal } = await req.json()

    if (!code) {
      return NextResponse.json(
        { error: 'Kode voucher wajib diisi', code: 'VOUCHER_CODE_EMPTY' },
        { status: 400 }
      )
    }

    const normalizedCode = String(code).toUpperCase().trim()
    const voucher = await db.voucher.findUnique({
      where: { code: normalizedCode },
    })

    if (!voucher) {
      return NextResponse.json(
        { error: `Kode voucher tidak ditemukan: ${normalizedCode}`, code: 'VOUCHER_NOT_FOUND' },
        { status: 404 }
      )
    }

    if (!voucher.isActive) {
      return NextResponse.json(
        { error: `Voucher tidak aktif: ${normalizedCode}`, code: 'VOUCHER_INACTIVE' },
        { status: 400 }
      )
    }

    if (voucher.validUntil && new Date(voucher.validUntil) < new Date()) {
      return NextResponse.json(
        {
          error: `Voucher sudah kedaluwarsa: ${normalizedCode} (berlaku hingga ${new Date(voucher.validUntil).toISOString().slice(0, 10)})`,
          code: 'VOUCHER_EXPIRED',
        },
        { status: 400 }
      )
    }

    const numericSubtotal = Number(subtotal) || 0
    if (numericSubtotal < voucher.minSpend) {
      return NextResponse.json(
        {
          error: `Minimal belanja ${voucher.minSpend} untuk voucher ${normalizedCode}. Subtotal Anda ${numericSubtotal}. Tambah belanja ${Math.max(0, voucher.minSpend - numericSubtotal)} lagi untuk memakai voucher ini.`,
          code: 'VOUCHER_MINIMUM_NOT_MET',
          minSpend: voucher.minSpend,
          subtotal: numericSubtotal,
        },
        { status: 400 }
      )
    }

    const discount =
      voucher.type === 'PERCENTAGE'
        ? Math.round((numericSubtotal * voucher.value) / 100)
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
    return NextResponse.json(
      { error: 'Terjadi kesalahan server', code: 'INTERNAL' },
      { status: 500 }
    )
  }
}
