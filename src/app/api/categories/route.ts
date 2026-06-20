import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const categories = await db.category.findMany({
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { products: { where: { isActive: true } } } },
    },
  })
  return NextResponse.json(
    { categories },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200',
      },
    }
  )
}
