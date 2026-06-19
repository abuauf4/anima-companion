import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

const CACHE_HEADERS = {
  'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200',
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const slug = searchParams.get('slug')

  if (slug) {
    const problem = await db.problem.findUnique({
      where: { slug },
      include: {
        products: {
          where: { product: { isActive: true } },
          include: {
            product: {
              include: {
                images: { take: 1, orderBy: { order: 'asc' } },
                category: true,
                problems: { include: { problem: true } },
              },
            },
          },
        },
      },
    })
    if (!problem) {
      return NextResponse.json({ error: 'Problem tidak ditemukan' }, { status: 404 })
    }
    const products = problem.products.map((p) => p.product)
    return NextResponse.json({ problem, products }, { headers: CACHE_HEADERS })
  }

  const problems = await db.problem.findMany({
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { products: { where: { product: { isActive: true } } } } },
    },
  })
  return NextResponse.json({ problems }, { headers: CACHE_HEADERS })
}
