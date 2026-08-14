import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, handleAuthError } from '@/lib/auth'

// PUT /api/admin/vouchers/[id] — update an existing voucher.
// DELETE /api/admin/vouchers/[id] — permanently delete a voucher.
//
// Both handlers are server-side guarded by requireAdmin() (see
// src/lib/auth.ts), which HMAC-verifies the session cookie and
// re-fetches the user from the database to confirm role === 'ADMIN'.
//
// Voucher has no Prisma relations (no FKs point to it — Order.voucherCode
// is a free-form string snapshot, not a FK), so DELETE is safe and does
// not cascade or damage unrelated data.

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    const body = await req.json()
    const { code, type, value, minSpend, description, isActive, validUntil } = body

    if (!code || !type || !value) {
      return NextResponse.json({ error: 'Kode, tipe, dan nilai wajib diisi' }, { status: 400 })
    }

    const updated = await db.voucher.update({
      where: { id },
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
    return NextResponse.json({ voucher: updated })
  } catch (e: any) {
    const authRes = handleAuthError(e)
    if (authRes) return authRes
    // Prisma throws P2002 on unique-constraint violation (duplicate code).
    if (e?.code === 'P2002') {
      return NextResponse.json({ error: 'Kode voucher sudah digunakan' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    await db.voucher.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    const authRes = handleAuthError(e)
    if (authRes) return authRes
    // Prisma throws P2025 if the record does not exist.
    if (e?.code === 'P2025') {
      return NextResponse.json({ error: 'Voucher tidak ditemukan' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
