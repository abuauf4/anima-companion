import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { invalidate } from '@/lib/cache'

export async function GET() {
  try {
    await requireAdmin()
    const faqs = await db.fAQ.findMany({
      orderBy: [{ isActive: 'desc' }, { order: 'asc' }],
    })
    return NextResponse.json({ faqs })
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
    const { question, answer, order, isActive } = body

    if (!question || !answer) {
      return NextResponse.json(
        { error: 'Pertanyaan dan jawaban wajib diisi' },
        { status: 400 }
      )
    }

    const faq = await db.fAQ.create({
      data: {
        question: String(question).trim(),
        answer: String(answer).trim(),
        order: Number(order) || 0,
        isActive: isActive !== false,
      },
    })
    invalidate('home:')
    return NextResponse.json({ faq })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg === 'UNAUTHORIZED' || msg === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Tidak diizinkan' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
