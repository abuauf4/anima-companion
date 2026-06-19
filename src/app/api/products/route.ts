import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const slug = searchParams.get('slug')
  const category = searchParams.get('category')
  const problem = searchParams.get('problem')
  const petType = searchParams.get('petType')
  // `pet` is an alias for `petType` (used by Navbar mega-menu links)
  const petTypeParam = petType || searchParams.get('pet')
  // `brand` is an alias for `seller` (used by Navbar mega-menu links & HomeView)
  const sellerParam = searchParams.get('seller') || searchParams.get('brand')
  const search = searchParams.get('search')
  const isBestSeller = searchParams.get('bestSeller') === '1'
  const isNew = searchParams.get('new') === '1'
  const isSubscribe = searchParams.get('subscribe') === '1'
  const sort = searchParams.get('sort') || 'newest'
  // newest | price-asc | price-desc | name | popular | rating
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const limit = Math.min(60, Math.max(1, parseInt(searchParams.get('limit') || '12')))

  // Detail by slug
  if (slug) {
    const product = await db.product.findUnique({
      where: { slug },
      include: {
        images: { orderBy: { order: 'asc' } },
        category: true,
        petTypes: { include: { petType: true } },
        problems: { include: { problem: true } },
        seller: { select: { id: true, name: true, slug: true, isVerified: true, rating: true, totalSales: true } },
        reviews: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    })
    if (!product) {
      return NextResponse.json({ error: 'Produk tidak ditemukan' }, { status: 404 })
    }
    // Related products: same category or shared problems
    const related = await db.product.findMany({
      where: {
        AND: [
          { id: { not: product.id } },
          { isActive: true },
          {
            OR: [
              { categoryId: product.categoryId },
              { problems: { some: { problemId: { in: product.problems.map((p) => p.problemId) } } } },
            ],
          },
        ],
      },
      include: {
        images: { take: 1, orderBy: { order: 'asc' } },
        seller: { select: { id: true, name: true, slug: true, isVerified: true } },
      },
      take: 4,
    })

    const avgRating = product.reviews.length
      ? product.reviews.reduce((s, r) => s + r.rating, 0) / product.reviews.length
      : 0

    return NextResponse.json({
      product: {
        ...product,
        avgRating,
        reviewCount: product.reviews.length,
      },
      related,
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    })
  }

  // List with filters
  const where: {
    isActive: boolean
    category?: { slug: string }
    problems?: { some: { problem: { slug: string } } }
    petTypes?: { some: { petType: { slug: string } } }
    seller?: { slug: string }
    isBestSeller?: boolean
    isNew?: boolean
    isSubscribeEligible?: boolean
    OR?: Array<Record<string, unknown>>
  } = { isActive: true }
  if (category) where.category = { slug: category }
  if (problem) where.problems = { some: { problem: { slug: problem } } }
  if (petTypeParam) where.petTypes = { some: { petType: { slug: petTypeParam } } }
  if (sellerParam) where.seller = { slug: sellerParam }
  if (isBestSeller) where.isBestSeller = true
  if (isNew) where.isNew = true
  if (isSubscribe) where.isSubscribeEligible = true
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
      { brand: { contains: search, mode: 'insensitive' } },
    ]
  }

  let orderBy: Record<string, 'asc' | 'desc'>
  switch (sort) {
    case 'price-asc':
      orderBy = { price: 'asc' }
      break
    case 'price-desc':
      orderBy = { price: 'desc' }
      break
    case 'name':
      orderBy = { name: 'asc' }
      break
    case 'popular':
      orderBy = { reviewCount: 'desc' }
      break
    case 'rating':
      orderBy = { rating: 'desc' }
      break
    case 'newest':
    default:
      orderBy = { createdAt: 'desc' }
      break
  }

  const [total, products] = await Promise.all([
    db.product.count({ where }),
    db.product.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
      include: {
        images: { take: 1, orderBy: { order: 'asc' } },
        category: true,
        problems: { include: { problem: true } },
        petTypes: { include: { petType: true } },
        seller: { select: { id: true, name: true, slug: true, isVerified: true } },
      },
    }),
  ])

  return NextResponse.json(
    {
      products,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    }
  )
}
