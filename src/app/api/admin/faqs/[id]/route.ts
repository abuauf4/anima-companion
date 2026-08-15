import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission, handleAuthError } from '@/lib/admin-auth'
import { invalidate } from '@/lib/cache'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('faqs.manage')
    const { id } = await params
    const body = await req.json()
    const { question, answer, order, isActive } = body

    if (!question || !answer) {
      return NextResponse.json(
        { error: 'Pertanyaan dan jawaban wajib diisi' },
        { status: 400 }
      )
    }

    const updated = await db.fAQ.update({
      where: { id },
      data: {
        question: String(question).trim(),
        answer: String(answer).trim(),
        order: Number(order) || 0,
        isActive: isActive !== false,
      },
    })
    invalidate('home:')
    return NextResponse.json({ faq: updated })
  } catch (e: unknown) {
    const authRes = handleAuthError(e)
    if (authRes) return authRes
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('faqs.manage')
    const { id } = await params
    await db.fAQ.delete({ where: { id } })
    invalidate('home:')
    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    const authRes = handleAuthError(e)
    if (authRes) return authRes
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
