import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const banners = await db.banner.findMany({
    where: { isActive: true },
    orderBy: [{ position: 'asc' }, { order: 'asc' }],
  })
  return NextResponse.json(
    { banners },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    }
  )
}
