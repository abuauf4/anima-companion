import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/faqs
 * Public endpoint — returns active FAQs ordered by `order` ascending.
 */
export async function GET() {
  const faqs = await db.fAQ.findMany({
    where: { isActive: true },
    orderBy: { order: 'asc' },
  })
  return NextResponse.json(
    { faqs },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200',
      },
    }
  )
}
