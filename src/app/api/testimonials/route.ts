import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const testimonials = await db.testimonial.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(
    { testimonials },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200',
      },
    }
  )
}
