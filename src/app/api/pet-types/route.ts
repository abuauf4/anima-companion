import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const petTypes = await db.petType.findMany({
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { products: { where: { product: { isActive: true } } } } },
    },
  })
  return NextResponse.json(
    { petTypes },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
      },
    }
  )
}
